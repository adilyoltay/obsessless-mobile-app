/**
 * ✅ F-08 FIX: React Query Cache Invalidation Helpers
 * 
 * Centralized cache invalidation and TTL management for consistent data freshness
 * across the application. Integrates with OfflineSync and UnifiedAIPipeline.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { EventEmitter } from 'events';

// Global event emitter for cache invalidation events
const cacheEvents = new EventEmitter();

// ============================================================================
// CACHE CONFIGURATION & CONSTANTS
// ============================================================================

/**
 * TTL Configuration for different data types
 * Times in milliseconds
 */
export const CACHE_TTL = {
  // User data - frequently accessed
  compulsions: 5 * 60 * 1000, // 5 minutes
  mood_entries: 5 * 60 * 1000, // 5 minutes
  thought_records: 10 * 60 * 1000, // 10 minutes
  voice_checkins: 5 * 60 * 1000, // 5 minutes
  
  // Statistics - more stable data
  compulsion_stats: 2 * 60 * 1000, // 2 minutes
  mood_stats: 3 * 60 * 1000, // 3 minutes
  progress_stats: 5 * 60 * 1000, // 5 minutes
  
  // AI-generated content - expensive to compute
  ai_insights: 15 * 60 * 1000, // 15 minutes
  ai_patterns: 20 * 60 * 1000, // 20 minutes
  ai_suggestions: 10 * 60 * 1000, // 10 minutes
  
  // User profile - rarely changes
  user_profile: 30 * 60 * 1000, // 30 minutes
  gamification: 10 * 60 * 1000, // 10 minutes
  
  // System data - very stable
  achievement_definitions: 60 * 60 * 1000, // 1 hour
  categories: 60 * 60 * 1000, // 1 hour
} as const;

/**
 * Standard query key factory - ensures consistent naming
 */
export const queryKeys = {
  // Entity queries
  compulsions: (userId: string, scope?: string) => 
    scope ? ['compulsions', userId, scope] : ['compulsions', userId],
  
  moodEntries: (userId: string, days?: number) => 
    days ? ['mood_entries', userId, `${days}d`] : ['mood_entries', userId],
  
  thoughtRecords: (userId: string, scope?: string) =>
    scope ? ['thought_records', userId, scope] : ['thought_records', userId],
  
  voiceCheckins: (userId: string, days?: number) =>
    days ? ['voice_checkins', userId, `${days}d`] : ['voice_checkins', userId],
  
  // Statistics queries
  compulsionStats: (userId: string, period?: string) =>
    period ? ['compulsion_stats', userId, period] : ['compulsion_stats', userId],
  
  moodStats: (userId: string, period?: string) =>
    period ? ['mood_stats', userId, period] : ['mood_stats', userId],
  
  progressStats: (userId: string) => ['progress_stats', userId],
  
  // AI queries
  aiInsights: (userId: string, type?: string) =>
    type ? ['ai_insights', userId, type] : ['ai_insights', userId],
  
  aiPatterns: (userId: string, type?: string) =>
    type ? ['ai_patterns', userId, type] : ['ai_patterns', userId],
  
  aiSuggestions: (userId: string, context?: string) =>
    context ? ['ai_suggestions', userId, context] : ['ai_suggestions', userId],
  
  // User queries
  userProfile: (userId: string) => ['user_profile', userId],
  gamification: (userId: string) => ['gamification', userId],
  
  // System queries
  achievements: () => ['achievement_definitions'],
  categories: () => ['categories'],
} as const;

// ============================================================================
// CACHE INVALIDATION HOOK
// ============================================================================

export interface CacheInvalidationHelpers {
  // Individual entity invalidation
  invalidateCompulsions: (userId?: string, scope?: string) => Promise<void>;
  invalidateMoodEntries: (userId?: string) => Promise<void>;
  invalidateThoughtRecords: (userId?: string) => Promise<void>;
  invalidateVoiceCheckins: (userId?: string) => Promise<void>;
  
  // Statistics invalidation
  invalidateStats: (userId?: string, type?: 'compulsion' | 'mood' | 'progress' | 'all') => Promise<void>;
  
  // AI invalidation
  invalidateAI: (userId?: string, type?: 'insights' | 'patterns' | 'suggestions' | 'all') => Promise<void>;
  
  // Bulk invalidation
  invalidateUserData: (userId: string) => Promise<void>;
  invalidateAll: () => Promise<void>;
  
  // Event-based invalidation
  setupSyncInvalidation: () => void;
  setupAIInvalidation: () => void;
}

/**
 * Main cache invalidation hook
 */
export function useCacheInvalidation(): CacheInvalidationHelpers {
  const queryClient = useQueryClient();

  // ============================================================================
  // INDIVIDUAL ENTITY INVALIDATION
  // ============================================================================

  const invalidateCompulsions = useCallback(async (userId?: string, scope?: string): Promise<void> => {
    if (userId) {
      await queryClient.invalidateQueries({ 
        queryKey: queryKeys.compulsions(userId, scope),
        exact: !scope 
      });
    } else {
      await queryClient.invalidateQueries({ 
        queryKey: ['compulsions'],
        exact: false 
      });
    }
  }, [queryClient]);

  const invalidateMoodEntries = useCallback(async (userId?: string): Promise<void> => {
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.moodEntries(userId) });
    } else {
      await queryClient.invalidateQueries({ queryKey: ['mood_entries'] });
    }
  }, [queryClient]);

  const invalidateThoughtRecords = useCallback(async (userId?: string): Promise<void> => {
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.thoughtRecords(userId) });
    } else {
      await queryClient.invalidateQueries({ queryKey: ['thought_records'] });
    }
  }, [queryClient]);

  const invalidateVoiceCheckins = useCallback(async (userId?: string): Promise<void> => {
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.voiceCheckins(userId) });
    } else {
      await queryClient.invalidateQueries({ queryKey: ['voice_checkins'] });
    }
  }, [queryClient]);

  // ============================================================================
  // STATISTICS INVALIDATION
  // ============================================================================

  const invalidateStats = useCallback(async (
    userId?: string, 
    type?: 'compulsion' | 'mood' | 'progress' | 'all'
  ): Promise<void> => {
    const types = type === 'all' ? ['compulsion', 'mood', 'progress'] : [type || 'compulsion'];
    
    for (const statType of types) {
      if (userId) {
        switch (statType) {
          case 'compulsion':
            await queryClient.invalidateQueries({ queryKey: queryKeys.compulsionStats(userId) });
            break;
          case 'mood':
            await queryClient.invalidateQueries({ queryKey: queryKeys.moodStats(userId) });
            break;
          case 'progress':
            await queryClient.invalidateQueries({ queryKey: queryKeys.progressStats(userId) });
            break;
        }
      } else {
        await queryClient.invalidateQueries({ queryKey: [`${statType}_stats`] });
      }
    }
  }, [queryClient]);

  // ============================================================================
  // AI INVALIDATION
  // ============================================================================

  const invalidateAI = useCallback(async (
    userId?: string, 
    type?: 'insights' | 'patterns' | 'suggestions' | 'all'
  ): Promise<void> => {
    const types = type === 'all' ? ['insights', 'patterns', 'suggestions'] : [type || 'insights'];
    
    for (const aiType of types) {
      if (userId) {
        switch (aiType) {
          case 'insights':
            await queryClient.invalidateQueries({ queryKey: queryKeys.aiInsights(userId) });
            break;
          case 'patterns':
            await queryClient.invalidateQueries({ queryKey: queryKeys.aiPatterns(userId) });
            break;
          case 'suggestions':
            await queryClient.invalidateQueries({ queryKey: queryKeys.aiSuggestions(userId) });
            break;
        }
      } else {
        await queryClient.invalidateQueries({ queryKey: [`ai_${aiType}`] });
      }
    }
  }, [queryClient]);

  // ============================================================================
  // BULK INVALIDATION
  // ============================================================================

  const invalidateUserData = useCallback(async (userId: string): Promise<void> => {
    console.log('🔄 Invalidating all data for user:', userId.substring(0, 8));
    
    // Parallel invalidation for performance
    await Promise.all([
      invalidateCompulsions(userId),
      invalidateMoodEntries(userId),
      invalidateThoughtRecords(userId),
      invalidateVoiceCheckins(userId),
      invalidateStats(userId, 'all'),
      invalidateAI(userId, 'all'),
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.gamification(userId) }),
    ]);
  }, [queryClient, invalidateCompulsions, invalidateMoodEntries, invalidateThoughtRecords, invalidateVoiceCheckins, invalidateStats, invalidateAI]);

  const invalidateAll = useCallback(async (): Promise<void> => {
    console.log('🔄 Invalidating all cached data...');
    await queryClient.invalidateQueries();
  }, [queryClient]);

  // ============================================================================
  // EVENT-BASED INVALIDATION SETUP
  // ============================================================================

  const setupSyncInvalidation = useCallback((): void => {
    // Listen to sync completion events
    const handleSyncCompleted = async (data: { entities: string[]; userId?: string }) => {
      console.log('🔄 Sync completed, invalidating affected queries:', data.entities);
      
      for (const entity of data.entities) {
        switch (entity) {
          case 'compulsion':
            await invalidateCompulsions(data.userId);
            await invalidateStats(data.userId, 'compulsion');
            break;
          case 'mood_entry':
            await invalidateMoodEntries(data.userId);
            await invalidateStats(data.userId, 'mood');
            break;
          case 'thought_record':
            await invalidateThoughtRecords(data.userId);
            break;
          case 'voice_checkin':
            await invalidateVoiceCheckins(data.userId);
            break;
        }
      }
      
      // Always invalidate AI data when underlying data changes
      if (data.userId) {
        await invalidateAI(data.userId, 'all');
      }
    };

    cacheEvents.on('sync:completed', handleSyncCompleted);
    
    return () => {
      cacheEvents.off('sync:completed', handleSyncCompleted);
    };
  }, [invalidateCompulsions, invalidateMoodEntries, invalidateThoughtRecords, invalidateVoiceCheckins, invalidateStats, invalidateAI]);

  const setupAIInvalidation = useCallback((): void => {
    // Listen to AI pipeline invalidation events
    const handleAIInvalidation = async (data: { hook: string; userId?: string }) => {
      console.log('🤖 AI invalidation triggered:', data.hook);
      
      if (data.userId) {
        switch (data.hook) {
          case 'compulsion_added':
            await invalidateAI(data.userId, 'patterns');
            await invalidateStats(data.userId, 'progress');
            break;
          case 'cbt_record_added':
            await invalidateAI(data.userId, 'insights');
            break;
          case 'mood_added':
            await invalidateAI(data.userId, 'all');
            await invalidateStats(data.userId, 'all');
            break;
          default:
            await invalidateAI(data.userId, 'all');
        }
      }
    };

    cacheEvents.on('ai:invalidation', handleAIInvalidation);
    
    return () => {
      cacheEvents.off('ai:invalidation', handleAIInvalidation);
    };
  }, [invalidateAI, invalidateStats]);

  // ============================================================================
  // SETUP EFFECT
  // ============================================================================

  useEffect(() => {
    const syncCleanup = setupSyncInvalidation();
    const aiCleanup = setupAIInvalidation();
    
    return () => {
      syncCleanup();
      aiCleanup();
    };
  }, [setupSyncInvalidation, setupAIInvalidation]);

  return {
    invalidateCompulsions,
    invalidateMoodEntries,
    invalidateThoughtRecords,
    invalidateVoiceCheckins,
    invalidateStats,
    invalidateAI,
    invalidateUserData,
    invalidateAll,
    setupSyncInvalidation,
    setupAIInvalidation,
  };
}

// ============================================================================
// GLOBAL CACHE EVENT EMITTERS
// ============================================================================

/**
 * Emit sync completion event for cache invalidation
 */
export function emitSyncCompleted(entities: string[], userId?: string): void {
  cacheEvents.emit('sync:completed', { entities, userId });
}

/**
 * Emit AI invalidation event
 */
export function emitAIInvalidation(hook: string, userId?: string): void {
  cacheEvents.emit('ai:invalidation', { hook, userId });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get TTL for a specific cache type
 */
export function getCacheTTL(type: keyof typeof CACHE_TTL): number {
  return CACHE_TTL[type] || CACHE_TTL.compulsions;
}
