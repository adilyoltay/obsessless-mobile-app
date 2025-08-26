import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { AIEventType, trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { CacheInvalidation, InvalidationTrigger } from '@/features/ai/cache/invalidation';

export type { UnifiedPipelineInput, UnifiedPipelineResult } from '@/features/ai/core/UnifiedAIPipeline';

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
    await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_ERROR, {
      userId: input.userId,
      message: error?.message || String(error),
    });
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


