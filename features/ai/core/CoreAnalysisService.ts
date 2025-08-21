/**
 * 🎯 CoreAnalysisService v1 - Single Entry Point for All AI Analysis
 * 
 * This service provides a unified interface for all AI analysis operations,
 * implementing LLM gating, budget management, deduplication, and multi-layer caching.
 * 
 * Architecture:
 * - Single entry point for voice/text/sensor inputs
 * - Deterministic heuristic classification 
 * - Smart LLM gating to reduce costs
 * - Multi-layer cache with TTL management
 * - Progressive UI support
 * 
 * @module CoreAnalysisService
 * @since v1.0.0
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import Constants from 'expo-constants';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

/**
 * Input types that can be analyzed
 */
export type InputKind = 'VOICE' | 'TEXT' | 'SENSOR';

/**
 * Quick classification categories
 */
export type QuickClass = 'MOOD' | 'CBT' | 'OCD' | 'ERP' | 'BREATHWORK' | 'OTHER';

/**
 * Routing actions based on analysis
 */
export type RouteAction = 'OPEN_SCREEN' | 'AUTO_SAVE' | 'SUGGEST_BREATHWORK';

/**
 * Input data for analysis
 */
export interface AnalysisInput {
  kind: InputKind;
  content: string;
  userId: string;
  locale: 'tr-TR' | 'en-US';
  ts: number;
  metadata?: {
    source?: string;
    sessionId?: string;
    contextData?: Record<string, any>;
  };
}

/**
 * Result of analysis
 */
export interface AnalysisResult {
  quickClass: QuickClass;
  confidence: number;
  needsLLM: boolean;
  route: RouteAction;
  payload: {
    screen?: string;
    params?: Record<string, any>;
    message?: string;
    data?: any;
  };
  cacheKey: string;
  computedAt: number;
  source: 'heuristic' | 'llm' | 'cache';
  debugInfo?: {
    gatingReason?: string;
    processingTimeMs?: number;
    tokenCount?: number;
  };
}

/**
 * Core service interface
 */
export interface ICoreAnalysisService {
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
  getCached(cacheKey: string): Promise<AnalysisResult | null>;
  invalidate(keys: string[] | 'ALL'): Promise<void>;
  getStats(): Promise<AnalysisStats>;
}

/**
 * Service statistics
 */
export interface AnalysisStats {
  totalRequests: number;
  cacheHits: number;
  llmCalls: number;
  avgProcessingTimeMs: number;
  tokenUsage: {
    daily: number;
    remaining: number;
  };
}

// =============================================================================
// 🔧 CONFIGURATION
// =============================================================================

/**
 * Service configuration from environment
 */
const CONFIG = {
  confidence: {
    heuristicMoodBreathwork: parseFloat(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_HEURISTIC_MOOD || '0.65'
    ),
    llmLow: parseFloat(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_LOW || '0.60'
    ),
    llmComplex: parseFloat(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_COMPLEX || '0.80'
    ),
  },
  textLengthThreshold: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_TEXT_LENGTH_THRESHOLD || '280'
  ),
  llmRateLimitPer10Min: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_LLM_RATE_LIMIT_PER_10MIN || '3'
  ),
  llmDailyTokenSoftLimit: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_LLM_DAILY_TOKEN_SOFT_LIMIT || '20000'
  ),
  cacheTTL: {
    insightsHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_INSIGHTS_HOURS || '24'
    ),
    erpPlanHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_ERP_PLAN_HOURS || '12'
    ),
    voiceHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_VOICE_HOURS || '1'
    ),
    todayDigestHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_TODAY_DIGEST_HOURS || '12'
    ),
  },
};

// =============================================================================
// 🎯 CORE ANALYSIS SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Main implementation of CoreAnalysisService
 */
class CoreAnalysisService implements ICoreAnalysisService {
  private static instance: CoreAnalysisService;
  private isInitialized = false;
  private stats: AnalysisStats = {
    totalRequests: 0,
    cacheHits: 0,
    llmCalls: 0,
    avgProcessingTimeMs: 0,
    tokenUsage: {
      daily: 0,
      remaining: CONFIG.llmDailyTokenSoftLimit,
    },
  };

  // Dependencies (will be injected)
  private needsLLMAnalysis?: (params: any) => boolean;
  private tokenBudgetManager?: any;
  private similarityDedup?: any;
  private resultCache?: any;
  private moduleOrchestrator?: any;
  private externalAIService?: any;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CoreAnalysisService {
    if (!CoreAnalysisService.instance) {
      CoreAnalysisService.instance = new CoreAnalysisService();
    }
    return CoreAnalysisService.instance;
  }

  /**
   * Initialize the service with dependencies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if feature is enabled
      if (!FEATURE_FLAGS.isEnabled('AI_CORE_ANALYSIS')) {
        console.log('⚠️ CoreAnalysisService: Feature disabled');
        return;
      }

      // Import dependencies dynamically
      const [
        { needsLLMAnalysis },
        { TokenBudgetManager },
        { SimilarityDedup },
        { ResultCache },
        { ModuleOrchestrator },
        { externalAIService },
      ] = await Promise.all([
        import('./needsLLMAnalysis'),
        import('../budget/tokenBudgetManager'),
        import('../dedup/similarityDedup'),
        import('../cache/resultCache'),
        import('./ModuleOrchestrator'),
        import('../services/externalAIService'),
      ]);

      // Initialize dependencies
      this.needsLLMAnalysis = needsLLMAnalysis;
      this.tokenBudgetManager = new TokenBudgetManager();
      this.similarityDedup = new SimilarityDedup();
      this.resultCache = new ResultCache();
      this.moduleOrchestrator = new ModuleOrchestrator();
      this.externalAIService = externalAIService;

      await Promise.all([
        this.tokenBudgetManager.initialize(),
        this.resultCache.initialize(),
      ]);

      this.isInitialized = true;
      console.log('✅ CoreAnalysisService initialized');
    } catch (error) {
      console.error('❌ CoreAnalysisService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Main analysis method - single entry point
   */
  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Ensure service is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Update stats
      this.stats.totalRequests++;

      // Generate cache key
      const cacheKey = this.generateCacheKey(input);

      // Check cache first
      const cached = await this.getCached(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return {
          ...cached,
          source: 'cache',
          debugInfo: {
            ...cached.debugInfo,
            processingTimeMs: Date.now() - startTime,
          },
        };
      }

      // Normalize and preprocess input
      const normalized = this.normalizeInput(input);

      // Check for duplicate/similar recent requests
      if (this.similarityDedup) {
        const isDuplicate = await this.similarityDedup.checkDuplicate(normalized.content);
        if (isDuplicate) {
          console.log('🔁 Duplicate request detected, returning cached result');
          // Return a generic result for duplicates
          return this.createGenericResult(input, cacheKey, startTime);
        }
      }

      // Perform heuristic classification
      const heuristicResult = await this.performHeuristicAnalysis(normalized);

      // Determine if LLM is needed
      const shouldUseLLM = this.shouldUseLLM(heuristicResult, normalized);

      let finalResult: AnalysisResult;

      if (shouldUseLLM && this.canUseLLM()) {
        // Use LLM for enhanced analysis
        finalResult = await this.performLLMAnalysis(normalized, heuristicResult);
        this.stats.llmCalls++;
      } else {
        // Use heuristic result
        finalResult = this.buildResult(heuristicResult, cacheKey, startTime, 'heuristic');
      }

      // Cache the result
      await this.cacheResult(cacheKey, finalResult);

      // Update processing time average
      const processingTime = Date.now() - startTime;
      this.updateAvgProcessingTime(processingTime);

      return {
        ...finalResult,
        debugInfo: {
          ...finalResult.debugInfo,
          processingTimeMs: processingTime,
        },
      };
    } catch (error) {
      console.error('❌ CoreAnalysisService.analyze error:', error);
      // Return fallback result on error
      return this.createFallbackResult(input, startTime);
    }
  }

  /**
   * Get cached result
   */
  async getCached(cacheKey: string): Promise<AnalysisResult | null> {
    if (!this.resultCache) {
      return null;
    }
    return this.resultCache.get(cacheKey);
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(keys: string[] | 'ALL'): Promise<void> {
    if (!this.resultCache) {
      return;
    }
    
    if (keys === 'ALL') {
      await this.resultCache.clear();
    } else {
      await Promise.all(keys.map(key => this.resultCache.delete(key)));
    }
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<AnalysisStats> {
    return { ...this.stats };
  }

  // =============================================================================
  // 🔧 PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Generate cache key for input
   */
  private generateCacheKey(input: AnalysisInput): string {
    const components = [
      'ai',
      input.userId,
      input.kind.toLowerCase(),
      this.hashString(input.content),
    ];
    return components.join(':');
  }

  /**
   * Simple hash function for strings
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Normalize input for processing
   */
  private normalizeInput(input: AnalysisInput): AnalysisInput {
    return {
      ...input,
      content: input.content
        .trim()
        .replace(/\s+/g, ' ') // Collapse whitespace
        .toLowerCase(),
    };
  }

  /**
   * Perform heuristic analysis
   */
  private async performHeuristicAnalysis(input: AnalysisInput): Promise<{
    quickClass: QuickClass;
    confidence: number;
    route: RouteAction;
    payload: any;
  }> {
    // This will be expanded with actual heuristic logic
    // For now, return a simple classification
    const content = input.content;
    
    // Simple keyword-based classification
    if (content.includes('nefes') || content.includes('sakin')) {
      return {
        quickClass: 'BREATHWORK',
        confidence: 0.7,
        route: 'SUGGEST_BREATHWORK',
        payload: { protocol: 'box' },
      };
    }
    
    if (content.includes('takıntı') || content.includes('kontrol')) {
      return {
        quickClass: 'OCD',
        confidence: 0.6,
        route: 'OPEN_SCREEN',
        payload: { screen: 'tracking' },
      };
    }
    
    // Default to mood
    return {
      quickClass: 'MOOD',
      confidence: 0.5,
      route: 'AUTO_SAVE',
      payload: { mood: 50 },
    };
  }

  /**
   * Determine if LLM should be used
   */
  private shouldUseLLM(heuristicResult: any, input: AnalysisInput): boolean {
    if (!this.needsLLMAnalysis || !FEATURE_FLAGS.isEnabled('AI_LLM_GATING')) {
      return false;
    }

    return this.needsLLMAnalysis({
      quickClass: heuristicResult.quickClass,
      heuristicConfidence: heuristicResult.confidence,
      textLen: input.content.length,
    });
  }

  /**
   * Check if LLM can be used (budget/rate limits)
   */
  private canUseLLM(): boolean {
    if (!this.tokenBudgetManager) {
      return false;
    }
    
    return this.tokenBudgetManager.canMakeRequest() && 
           this.stats.tokenUsage.remaining > 0;
  }

  /**
   * Perform LLM-enhanced analysis
   */
  private async performLLMAnalysis(
    input: AnalysisInput,
    heuristicResult: any
  ): Promise<AnalysisResult> {
    // This will integrate with externalAIService
    // For now, return enhanced heuristic result
    return this.buildResult(
      {
        ...heuristicResult,
        confidence: Math.min(heuristicResult.confidence + 0.2, 1),
      },
      this.generateCacheKey(input),
      Date.now(),
      'llm'
    );
  }

  /**
   * Build analysis result
   */
  private buildResult(
    analysis: any,
    cacheKey: string,
    startTime: number,
    source: 'heuristic' | 'llm' | 'cache'
  ): AnalysisResult {
    return {
      quickClass: analysis.quickClass,
      confidence: analysis.confidence,
      needsLLM: false,
      route: analysis.route,
      payload: analysis.payload,
      cacheKey,
      computedAt: Date.now(),
      source,
      debugInfo: {
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Cache analysis result
   */
  private async cacheResult(cacheKey: string, result: AnalysisResult): Promise<void> {
    if (!this.resultCache) {
      return;
    }
    
    // Determine TTL based on result type
    let ttlHours = CONFIG.cacheTTL.voiceHours;
    if (result.quickClass === 'ERP') {
      ttlHours = CONFIG.cacheTTL.erpPlanHours;
    } else if (result.route === 'AUTO_SAVE') {
      ttlHours = CONFIG.cacheTTL.todayDigestHours;
    }
    
    await this.resultCache.set(cacheKey, result, ttlHours * 60 * 60 * 1000);
  }

  /**
   * Update average processing time
   */
  private updateAvgProcessingTime(newTime: number): void {
    const total = this.stats.avgProcessingTimeMs * (this.stats.totalRequests - 1) + newTime;
    this.stats.avgProcessingTimeMs = Math.round(total / this.stats.totalRequests);
  }

  /**
   * Create generic result for duplicate requests
   */
  private createGenericResult(
    input: AnalysisInput,
    cacheKey: string,
    startTime: number
  ): AnalysisResult {
    return {
      quickClass: 'MOOD',
      confidence: 0.5,
      needsLLM: false,
      route: 'AUTO_SAVE',
      payload: { message: 'Tekrarlanan istek algılandı' },
      cacheKey,
      computedAt: Date.now(),
      source: 'cache',
      debugInfo: {
        gatingReason: 'duplicate',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create fallback result on error
   */
  private createFallbackResult(input: AnalysisInput, startTime: number): AnalysisResult {
    return {
      quickClass: 'OTHER',
      confidence: 0,
      needsLLM: false,
      route: 'AUTO_SAVE',
      payload: { error: true },
      cacheKey: this.generateCacheKey(input),
      computedAt: Date.now(),
      source: 'heuristic',
      debugInfo: {
        gatingReason: 'error',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}

// =============================================================================
// 🚀 EXPORTS
// =============================================================================

// Export singleton instance
export const coreAnalysisService = CoreAnalysisService.getInstance();

// Export types
export type { ICoreAnalysisService, AnalysisStats };
