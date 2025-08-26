/**
 * 🔄 Cache Invalidation - Deterministic cache invalidation hooks
 * 
 * This module manages cache invalidation triggers based on specific user actions
 * and data changes to ensure cache consistency.
 * 
 * Invalidation triggers:
 * - CBT_THOUGHT_CREATED/UPDATED

 * - YBOCS_UPDATED
 * - ONBOARDING_FINALIZED
 * 
 * @module CacheInvalidation
 * @since v1.0.0
 */

import { ResultCache } from './resultCache';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

/**
 * Invalidation trigger types
 */
export enum InvalidationTrigger {
  CBT_THOUGHT_CREATED = 'CBT_THOUGHT_CREATED',
  CBT_THOUGHT_UPDATED = 'CBT_THOUGHT_UPDATED',
  // Terapi_SESSION_COMPLETED = 'Terapi_SESSION_COMPLETED', // Removed Terapi
  YBOCS_UPDATED = 'YBOCS_UPDATED',
  ONBOARDING_FINALIZED = 'ONBOARDING_FINALIZED',
  COMPULSION_RECORDED = 'COMPULSION_RECORDED',
  MOOD_RECORDED = 'MOOD_RECORDED',
  USER_PROFILE_UPDATED = 'USER_PROFILE_UPDATED',
  TREATMENT_PLAN_UPDATED = 'TREATMENT_PLAN_UPDATED',
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  DAY_ROLLOVER = 'DAY_ROLLOVER',
}

/**
 * Invalidation context
 */
export interface InvalidationContext {
  trigger: InvalidationTrigger;
  userId: string;
  timestamp: number;
  metadata?: {
    dayKey?: string;
    entityId?: string;
    entityType?: string;
    changes?: string[];
  };
}

/**
 * Invalidation strategy
 */
export interface InvalidationStrategy {
  trigger: InvalidationTrigger;
  patterns: string[];
  cascadeInvalidation?: boolean;
  delay?: number; // Delay in milliseconds before invalidation
}

/**
 * Invalidation result
 */
export interface InvalidationResult {
  trigger: InvalidationTrigger;
  invalidatedCount: number;
  patterns: string[];
  timestamp: number;
  duration: number;
}

// =============================================================================
// 🔄 CACHE INVALIDATION IMPLEMENTATION
// =============================================================================

/**
 * Cache invalidation manager
 */
export class CacheInvalidation {
  private static instance: CacheInvalidation;
  private cache: ResultCache | null = null;
  private strategies: Map<InvalidationTrigger, InvalidationStrategy> = new Map();
  private listeners: Map<InvalidationTrigger, Array<(context: InvalidationContext) => void>> = new Map();
  private invalidationHistory: InvalidationResult[] = [];
  private maxHistorySize = 100;

  private constructor() {
    this.initializeStrategies();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CacheInvalidation {
    if (!CacheInvalidation.instance) {
      CacheInvalidation.instance = new CacheInvalidation();
    }
    return CacheInvalidation.instance;
  }

  /**
   * Initialize with cache instance
   */
  initialize(cache: ResultCache): void {
    this.cache = cache;
    console.log('✅ CacheInvalidation initialized');
  }

  /**
   * Initialize invalidation strategies
   */
  private initializeStrategies(): void {
    // CBT thought changes invalidate insights and today digest
    this.strategies.set(InvalidationTrigger.CBT_THOUGHT_CREATED, {
      trigger: InvalidationTrigger.CBT_THOUGHT_CREATED,
      patterns: [
        'ai:{userId}:{dayKey}:insights',
        'ai:{userId}:{dayKey}:todayDigest',
        'ai:{userId}:*:cbt',
      ],
      cascadeInvalidation: true,
    });

    this.strategies.set(InvalidationTrigger.CBT_THOUGHT_UPDATED, {
      trigger: InvalidationTrigger.CBT_THOUGHT_UPDATED,
      patterns: [
        'ai:{userId}:{dayKey}:insights',
        'ai:{userId}:{dayKey}:todayDigest',
        'ai:{userId}:*:cbt',
      ],
      cascadeInvalidation: true,
    });

    // ✅ REMOVED: Terapi session completion - ERP module deleted

    // YBOCS update invalidates treatment plan and all analyses
    this.strategies.set(InvalidationTrigger.YBOCS_UPDATED, {
      trigger: InvalidationTrigger.YBOCS_UPDATED,
      patterns: [
        'ai:{userId}:*', // Invalidate all user cache
      ],
      cascadeInvalidation: true,
    });

    // Onboarding completion invalidates everything
    this.strategies.set(InvalidationTrigger.ONBOARDING_FINALIZED, {
      trigger: InvalidationTrigger.ONBOARDING_FINALIZED,
      patterns: [
        'ai:{userId}:*', // Invalidate all user cache
      ],
      cascadeInvalidation: true,
    });

    // Compulsion recording invalidates insights and patterns
    this.strategies.set(InvalidationTrigger.COMPULSION_RECORDED, {
      trigger: InvalidationTrigger.COMPULSION_RECORDED,
      patterns: [
        'ai:{userId}:{dayKey}:insights',
        'ai:{userId}:{dayKey}:todayDigest',
        'ai:{userId}:*:pattern',
      ],
      cascadeInvalidation: false,
      delay: 500,
    });

    // Mood recording invalidates insights
    this.strategies.set(InvalidationTrigger.MOOD_RECORDED, {
      trigger: InvalidationTrigger.MOOD_RECORDED,
      patterns: [
        'ai:{userId}:{dayKey}:insights',
        'ai:{userId}:{dayKey}:todayDigest',
      ],
      cascadeInvalidation: false,
      delay: 500,
    });

    // Profile update invalidates personalization
    this.strategies.set(InvalidationTrigger.USER_PROFILE_UPDATED, {
      trigger: InvalidationTrigger.USER_PROFILE_UPDATED,
      patterns: [
        'ai:{userId}:*:profile',
        'ai:{userId}:*:personalization',
      ],
      cascadeInvalidation: true,
    });

    // Treatment plan update invalidates insights only (ERP removed)
    this.strategies.set(InvalidationTrigger.TREATMENT_PLAN_UPDATED, {
      trigger: InvalidationTrigger.TREATMENT_PLAN_UPDATED,
      patterns: [
        // ✅ REMOVED: 'ai:{userId}:*:erp' - ERP module deleted
        'ai:{userId}:*:insights',
        'ai:{userId}:*:treatment',
      ],
      cascadeInvalidation: true,
    });

    // Settings change invalidates everything
    this.strategies.set(InvalidationTrigger.SETTINGS_CHANGED, {
      trigger: InvalidationTrigger.SETTINGS_CHANGED,
      patterns: [
        'ai:{userId}:*',
      ],
      cascadeInvalidation: true,
    });

    // Day rollover invalidates previous day's caches
    this.strategies.set(InvalidationTrigger.DAY_ROLLOVER, {
      trigger: InvalidationTrigger.DAY_ROLLOVER,
      patterns: [
        'ai:{userId}:{dayKey}:*',
      ],
      cascadeInvalidation: false,
    });
  }

  /**
   * Trigger cache invalidation
   */
  async invalidate(context: InvalidationContext): Promise<InvalidationResult> {
    const startTime = Date.now();

    if (!this.cache) {
      console.warn('⚠️ CacheInvalidation: No cache instance');
      return this.createEmptyResult(context.trigger, startTime);
    }

    const strategy = this.strategies.get(context.trigger);
    if (!strategy) {
      console.warn(`⚠️ No invalidation strategy for trigger: ${context.trigger}`);
      return this.createEmptyResult(context.trigger, startTime);
    }

    // Apply delay if specified
    if (strategy.delay) {
      await new Promise(resolve => setTimeout(resolve, strategy.delay));
    }

    // Process patterns
    const processedPatterns = this.processPatterns(strategy.patterns, context);
    let totalInvalidated = 0;

    for (const pattern of processedPatterns) {
      const count = await this.cache.invalidateByPattern(pattern);
      totalInvalidated += count;
    }

    // Cascade invalidation if needed
    if (strategy.cascadeInvalidation) {
      await this.cascadeInvalidation(context);
    }

    // Notify listeners
    await this.notifyListeners(context);

    // Create result
    const result: InvalidationResult = {
      trigger: context.trigger,
      invalidatedCount: totalInvalidated,
      patterns: processedPatterns,
      timestamp: context.timestamp,
      duration: Date.now() - startTime,
    };

    // Store in history
    this.addToHistory(result);

    // Log result
    if (__DEV__) {
      console.log('🔄 Cache invalidation:', {
        trigger: context.trigger,
        invalidated: totalInvalidated,
        duration: `${result.duration}ms`,
      });
    }

    return result;
  }

  /**
   * Register invalidation listener
   */
  onInvalidation(
    trigger: InvalidationTrigger,
    callback: (context: InvalidationContext) => void
  ): () => void {
    if (!this.listeners.has(trigger)) {
      this.listeners.set(trigger, []);
    }

    const listeners = this.listeners.get(trigger)!;
    listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get invalidation history
   */
  getHistory(limit?: number): InvalidationResult[] {
    const history = [...this.invalidationHistory];
    history.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear invalidation history
   */
  clearHistory(): void {
    this.invalidationHistory = [];
  }

  /**
   * Get invalidation statistics
   */
  getStatistics(): {
    totalInvalidations: number;
    averageDuration: number;
    mostFrequentTrigger?: InvalidationTrigger;
    totalInvalidatedCount: number;
  } {
    if (this.invalidationHistory.length === 0) {
      return {
        totalInvalidations: 0,
        averageDuration: 0,
        totalInvalidatedCount: 0,
      };
    }

    const triggerCounts = new Map<InvalidationTrigger, number>();
    let totalDuration = 0;
    let totalInvalidated = 0;

    for (const result of this.invalidationHistory) {
      totalDuration += result.duration;
      totalInvalidated += result.invalidatedCount;
      
      const count = triggerCounts.get(result.trigger) || 0;
      triggerCounts.set(result.trigger, count + 1);
    }

    // Find most frequent trigger
    let mostFrequent: InvalidationTrigger | undefined;
    let maxCount = 0;
    for (const [trigger, count] of triggerCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = trigger;
      }
    }

    return {
      totalInvalidations: this.invalidationHistory.length,
      averageDuration: totalDuration / this.invalidationHistory.length,
      mostFrequentTrigger: mostFrequent,
      totalInvalidatedCount: totalInvalidated,
    };
  }

  // =============================================================================
  // 🔧 PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Process pattern templates
   */
  private processPatterns(patterns: string[], context: InvalidationContext): string[] {
    const processed: string[] = [];
    const dayKey = context.metadata?.dayKey || this.getCurrentDayKey();

    for (const pattern of patterns) {
      let processedPattern = pattern
        .replace('{userId}', context.userId)
        .replace('{dayKey}', dayKey);

      // Handle wildcards
      if (processedPattern.includes('*')) {
        // Convert to regex pattern
        processedPattern = processedPattern.replace(/\*/g, '.*');
      }

      processed.push(processedPattern);
    }

    return processed;
  }

  /**
   * Get current day key (Europe/Istanbul)
   */
  private getCurrentDayKey(): string {
    const now = new Date();
    const istanbulTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
    return istanbulTime.toISOString().split('T')[0];
  }

  /**
   * Cascade invalidation to related caches
   */
  private async cascadeInvalidation(context: InvalidationContext): Promise<void> {
    // Cascade logic based on trigger type
    switch (context.trigger) {
      case InvalidationTrigger.YBOCS_UPDATED:
      case InvalidationTrigger.ONBOARDING_FINALIZED:
        // These triggers cascade to all related caches
        await this.invalidate({
          ...context,
          trigger: InvalidationTrigger.TREATMENT_PLAN_UPDATED,
        });
        break;

      case InvalidationTrigger.TREATMENT_PLAN_UPDATED:
        // ✅ REMOVED: Cascade to Terapi - ERP module deleted
        // No further cascade needed, just invalidates insights and treatment
        break;
    }
  }

  /**
   * Notify registered listeners
   */
  private async notifyListeners(context: InvalidationContext): Promise<void> {
    const listeners = this.listeners.get(context.trigger);
    if (!listeners || listeners.length === 0) {
      return;
    }

    await Promise.all(
      listeners.map(listener => {
        try {
          listener(context);
        } catch (error) {
          console.error('Error in invalidation listener:', error);
        }
      })
    );
  }

  /**
   * Add result to history
   */
  private addToHistory(result: InvalidationResult): void {
    this.invalidationHistory.push(result);

    // Trim history if too large
    if (this.invalidationHistory.length > this.maxHistorySize) {
      this.invalidationHistory.shift();
    }
  }

  /**
   * Create empty result
   */
  private createEmptyResult(trigger: InvalidationTrigger, startTime: number): InvalidationResult {
    return {
      trigger,
      invalidatedCount: 0,
      patterns: [],
      timestamp: Date.now(),
      duration: Date.now() - startTime,
    };
  }
}

// =============================================================================
// 🚀 EXPORTS
// =============================================================================

// Export singleton instance
export const cacheInvalidation = CacheInvalidation.getInstance();

// Export default only to avoid duplicate type export conflicts
export default CacheInvalidation;
