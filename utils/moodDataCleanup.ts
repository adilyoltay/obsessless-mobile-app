/**
 * Mood Data Cleanup Utility
 * 
 * Clean slate test için tüm mood-related data'yı temizler.
 * DANGEROUS: Production'da sadece test user'ları için kullan!
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';

interface CleanupResult {
  asyncStorageKeysRemoved: number;
  supabaseEntriesRemoved: number;
  cacheEntriesCleared: number;
  errors: string[];
}

class MoodDataCleanupService {
  /**
   * 🧹 NUCLEAR OPTION: Clean ALL mood data for a user
   * USE WITH EXTREME CAUTION!
   */
  public static async cleanAllMoodData(userId: string, confirmText: string): Promise<CleanupResult> {
    if (confirmText !== 'CLEAN_ALL_MOOD_DATA_CONFIRMED') {
      throw new Error('Invalid confirmation text. This is a destructive operation.');
    }

    const result: CleanupResult = {
      asyncStorageKeysRemoved: 0,
      supabaseEntriesRemoved: 0,
      cacheEntriesCleared: 0,
      errors: []
    };

    try {
      console.log(`🧹 STARTING NUCLEAR CLEANUP for user: ${userId.slice(0, 8)}...`);

      // 1. Clean AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => 
        key.includes(userId) && (
          key.includes('mood_entries_') ||
          key.includes('mood_cache_') ||
          key.includes('mood_patterns_') ||
          key.includes('idempotency_') ||
          key.includes('deletion_cache_') ||
          key.includes('sync_queue_')
        )
      );

      if (moodKeys.length > 0) {
        await AsyncStorage.multiRemove(moodKeys);
        result.asyncStorageKeysRemoved = moodKeys.length;
        console.log(`🗑️ Removed ${moodKeys.length} AsyncStorage keys`);
      }

      // 2. Clean Supabase mood_entries
      try {
        const { data: existingEntries } = await supabaseService.supabaseClient
          .from('mood_entries')
          .select('id')
          .eq('user_id', userId);

        if (existingEntries && existingEntries.length > 0) {
          const idsToDelete = existingEntries.map(e => e.id);
          
          const { error: deleteError } = await supabaseService.supabaseClient
            .from('mood_entries')
            .delete()
            .eq('user_id', userId);

          if (!deleteError) {
            result.supabaseEntriesRemoved = existingEntries.length;
            console.log(`🗑️ Removed ${existingEntries.length} Supabase entries`);
          } else {
            result.errors.push(`Supabase delete error: ${deleteError.message}`);
          }
        }
      } catch (supabaseError) {
        result.errors.push(`Supabase cleanup failed: ${supabaseError}`);
      }

      // 3. Clear all cache systems
      const cacheKeys = allKeys.filter(key => 
        key.includes('cache') || 
        key.includes('pattern') ||
        key.includes('insights')
      );

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        result.cacheEntriesCleared = cacheKeys.length;
        console.log(`🗑️ Cleared ${cacheKeys.length} cache keys`);
      }

      console.log(`✅ NUCLEAR CLEANUP COMPLETE:`, result);
      return result;

    } catch (error) {
      console.error('❌ Nuclear cleanup failed:', error);
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  /**
   * 🔍 Analyze current mood data state for debugging
   */
  public static async analyzeMoodDataState(userId: string): Promise<{
    asyncStorage: {
      totalKeys: number;
      moodKeys: string[];
      patterns: any[];
    };
    supabase: {
      totalEntries: number;
      recentEntries: any[];
    };
    idempotency: {
      trackedEntries: number;
      recentChecks: any[];
    };
    issues: string[];
  }> {
    const analysis = {
      asyncStorage: { totalKeys: 0, moodKeys: [], patterns: [] },
      supabase: { totalEntries: 0, recentEntries: [] },
      idempotency: { trackedEntries: 0, recentChecks: [] },
      issues: []
    };

    try {
      // Analyze AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => 
        key.includes(userId) && key.includes('mood')
      );

      analysis.asyncStorage.totalKeys = allKeys.length;
      analysis.asyncStorage.moodKeys = moodKeys;

      // Sample mood patterns
      for (const key of moodKeys.slice(0, 3)) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            analysis.asyncStorage.patterns.push({
              key,
              entryCount: Array.isArray(parsed) ? parsed.length : 1,
              sample: Array.isArray(parsed) ? parsed[0] : parsed
            });
          }
        } catch (error) {
          analysis.issues.push(`Failed to parse key ${key}: ${error}`);
        }
      }

      // Analyze Supabase
      try {
        const { data: supabaseEntries } = await supabaseService.supabaseClient
          .from('mood_entries')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (supabaseEntries) {
          analysis.supabase.totalEntries = supabaseEntries.length;
          analysis.supabase.recentEntries = supabaseEntries;
        }
      } catch (supabaseError) {
        analysis.issues.push(`Supabase analysis failed: ${supabaseError}`);
      }

      // Check for common issues
      if (analysis.asyncStorage.moodKeys.length > analysis.supabase.totalEntries + 5) {
        analysis.issues.push('AsyncStorage has significantly more keys than Supabase entries');
      }

      const localIds = new Set();
      const remoteIds = new Set();
      
      analysis.asyncStorage.patterns.forEach(pattern => {
        if (pattern.sample?.id) {
          if (pattern.sample.id.startsWith('mood_')) {
            localIds.add(pattern.sample.id);
          } else {
            remoteIds.add(pattern.sample.id);
          }
        }
      });

      if (localIds.size > 0 && remoteIds.size > 0) {
        analysis.issues.push(`ID format mismatch: ${localIds.size} local IDs, ${remoteIds.size} remote IDs in local storage`);
      }

      return analysis;
    } catch (error) {
      analysis.issues.push(`Analysis failed: ${error}`);
      return analysis;
    }
  }
}

export default MoodDataCleanupService;
