import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { AIEventType, trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { CacheInvalidation, InvalidationTrigger } from '@/features/ai/cache/invalidation';

export type { UnifiedPipelineInput, UnifiedPipelineResult } from '@/features/ai/core/UnifiedAIPipeline';

// Export unifiedPipeline instance for direct access
export { unifiedPipeline };

/**
 * Kanonik AI giriş noktası: process()
 * - Telemetry: UNIFIED_PIPELINE_STARTED/COMPLETED
 * - Geçici: UnifiedAIPipeline'a delege eder
 */
export async function process(input: Parameters<typeof unifiedPipeline.process>[0]) {
  try {
    await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_STARTED, {
      userId: input.userId,
      type: input.type,
      source: input.context?.source,
    });

    const result = await unifiedPipeline.process(input);

    await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_COMPLETED, {
      userId: input.userId,
      type: input.type,
      source: result.metadata?.source,
      processingTime: result.metadata?.processingTime,
      cacheTTL: result.metadata?.cacheTTL,
    });

    return result;
  } catch (error: any) {
    // Enhanced error handling with user feedback
    await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_ERROR, {
      userId: input.userId,
      message: error?.message || String(error),
    });
    
    // 🚨 USER FEEDBACK: Show user-friendly error and fallback options
    try {
      const { aiErrorFeedbackService, AIErrorType } = await import('@/features/ai/feedback/aiErrorFeedbackService');
      
      // Determine error type based on error message/type
      let errorType = AIErrorType.LLM_SERVICE_UNAVAILABLE;
      const errorMessage = error?.message || String(error);
      
      if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        errorType = AIErrorType.NETWORK_ERROR;
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        errorType = AIErrorType.RATE_LIMIT_EXCEEDED;
      } else if (errorMessage.includes('voice') || errorMessage.includes('audio')) {
        errorType = AIErrorType.VOICE_ANALYSIS_FAILED;
      }
      
      await aiErrorFeedbackService.handleAIError(errorType, {
        userId: input.userId,
        feature: 'unified_pipeline',
        heuristicFallback: false,
        retryable: true,
        userVisible: true,
        metadata: {
          inputType: input.type,
          source: input.context?.source,
          errorMessage
        }
      });
      
    } catch (feedbackError) {
      console.warn('⚠️ Failed to show pipeline error feedback:', feedbackError);
    }
    
    throw error;
  }
}

/**
 * Invalidation köprüsü: legacy string hooks → InvalidationTrigger enum
 */
export async function triggerInvalidation(hook: string, userId?: string) {
  const cache = CacheInvalidation.getInstance();
  const map: Record<string, InvalidationTrigger> = {
    mood_added: InvalidationTrigger.MOOD_RECORDED,
    manual_refresh: InvalidationTrigger.DAY_ROLLOVER,
    cbt_record_added: InvalidationTrigger.CBT_THOUGHT_CREATED,
    compulsion_added: InvalidationTrigger.COMPULSION_RECORDED,
    onboarding_finalized: InvalidationTrigger.ONBOARDING_FINALIZED,
  };
  const trigger = map[hook];
  if (!trigger) return;
  await cache.invalidate({
    trigger,
    userId,
    timestamp: Date.now(),
  } as any);
}

export const pipeline = { process, triggerInvalidation };


