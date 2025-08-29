/**
 * AsyncStorage Hygiene Service
 * 
 * Post-AI cleanup için AsyncStorage optimizasyonu ve temizlik.
 * Key management, storage size monitoring, old data cleanup.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface StorageUsage {
  totalKeys: number;
  totalSizeBytes: number;
  keysByCategory: { [category: string]: number };
  sizeByCategoryBytes: { [category: string]: number };
  oldestEntry?: string;
  newestEntry?: string;
}

interface CleanupResult {
  removedKeys: number;
  freedBytes: number;
  categories: { [category: string]: number };
}

class AsyncStorageHygieneService {
  private static instance: AsyncStorageHygieneService;
  
  // Storage limits (configurable)
  private static readonly MAX_MOOD_ENTRIES_PER_DAY = 50;
  private static readonly MAX_DAYS_TO_KEEP = 90; // 3 months
  private static readonly MAX_TOTAL_KEYS = 1000;
  
  public static getInstance(): AsyncStorageHygieneService {
    if (!AsyncStorageHygieneService.instance) {
      AsyncStorageHygieneService.instance = new AsyncStorageHygieneService();
    }
    return AsyncStorageHygieneService.instance;
  }

  /**
   * Analyze current AsyncStorage usage
   */
  public async analyzeUsage(): Promise<StorageUsage> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      
      const keysByCategory: { [key: string]: number } = {};
      const sizeByCategoryBytes: { [key: string]: number } = {};
      let totalSizeBytes = 0;
      let oldestEntry: string | undefined;
      let newestEntry: string | undefined;

      // Analyze each key
      for (const key of allKeys) {
        const category = this.categorizeKey(key);
        keysByCategory[category] = (keysByCategory[category] || 0) + 1;
        
        try {
          const data = await AsyncStorage.getItem(key);
          const sizeBytes = data ? new Blob([data]).size : 0;
          
          sizeByCategoryBytes[category] = (sizeByCategoryBytes[category] || 0) + sizeBytes;
          totalSizeBytes += sizeBytes;
          
          // Track entry dates for mood entries
          if (key.includes('mood_entries_')) {
            const dateMatch = key.match(/\d{4}-\d{2}-\d{2}/);
            if (dateMatch) {
              const entryDate = dateMatch[0];
              if (!oldestEntry || entryDate < oldestEntry) {
                oldestEntry = entryDate;
              }
              if (!newestEntry || entryDate > newestEntry) {
                newestEntry = entryDate;
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to analyze key ${key}:`, error);
        }
      }

      return {
        totalKeys: allKeys.length,
        totalSizeBytes,
        keysByCategory,
        sizeByCategoryBytes,
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      console.error('Failed to analyze AsyncStorage usage:', error);
      return {
        totalKeys: 0,
        totalSizeBytes: 0,
        keysByCategory: {},
        sizeByCategoryBytes: {}
      };
    }
  }

  /**
   * Categorize storage key for analysis
   */
  private categorizeKey(key: string): string {
    if (key.startsWith('mood_entries_')) return 'mood_entries';
    if (key.startsWith('voice_checkin_')) return 'voice_checkins';
    if (key.startsWith('user_profile_')) return 'user_profiles';
    if (key.startsWith('onboarding_')) return 'onboarding';
    if (key.startsWith('gamification_')) return 'gamification';
    if (key.startsWith('sync_queue_')) return 'sync_queue';
    if (key.startsWith('error_logs')) return 'error_logs';
    if (key.startsWith('crash_reports')) return 'crash_reports';
    if (key.includes('cache')) return 'cache';
    return 'other';
  }

  /**
   * Clean up old mood entries based on date
   */
  public async cleanupOldMoodEntries(userId: string, daysToKeep: number = 90): Promise<CleanupResult> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => 
        key.startsWith(`mood_entries_${userId}_`) && 
        key.includes('-') // Has date format
      );

      const keysToRemove: string[] = [];
      let freedBytes = 0;

      for (const key of moodKeys) {
        const dateMatch = key.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch && dateMatch[0] < cutoffDateString) {
          // This key is older than cutoff, remove it
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              freedBytes += new Blob([data]).size;
            }
            keysToRemove.push(key);
          } catch (error) {
            console.warn(`Failed to analyze old key ${key}:`, error);
          }
        }
      }

      // Remove old keys
      await AsyncStorage.multiRemove(keysToRemove);
      
      console.log(`🗑️ Cleaned up ${keysToRemove.length} old mood entry keys (>${daysToKeep} days), freed ~${Math.round(freedBytes / 1024)}KB`);

      return {
        removedKeys: keysToRemove.length,
        freedBytes,
        categories: { mood_entries: keysToRemove.length }
      };
    } catch (error) {
      console.error('Failed to cleanup old mood entries:', error);
      return {
        removedKeys: 0,
        freedBytes: 0,
        categories: {}
      };
    }
  }

  /**
   * Clean up old cache and temporary data
   */
  public async cleanupCaches(maxAgeHours: number = 72): Promise<CleanupResult> {
    try {
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Keys that typically contain cache data
      const cacheKeys = allKeys.filter(key => 
        key.includes('cache') || 
        key.includes('temp') ||
        key.startsWith('error_logs') ||
        key.startsWith('debug_')
      );

      const keysToRemove: string[] = [];
      let freedBytes = 0;
      const categories: { [key: string]: number } = {};

      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            
            // Check if it has a timestamp field that's too old
            const timestamp = parsed.timestamp || parsed.createdAt || parsed.lastUpdated;
            if (timestamp && new Date(timestamp).getTime() < cutoffTime) {
              const category = this.categorizeKey(key);
              categories[category] = (categories[category] || 0) + 1;
              freedBytes += new Blob([data]).size;
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          // If parsing fails, it might be corrupted cache - remove it
          keysToRemove.push(key);
          const category = this.categorizeKey(key);
          categories[category] = (categories[category] || 0) + 1;
        }
      }

      // Remove old cache keys
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`🧹 Cleaned up ${keysToRemove.length} old cache keys (>${maxAgeHours}h), freed ~${Math.round(freedBytes / 1024)}KB`);
      }

      return {
        removedKeys: keysToRemove.length,
        freedBytes,
        categories
      };
    } catch (error) {
      console.error('Failed to cleanup caches:', error);
      return {
        removedKeys: 0,
        freedBytes: 0,
        categories: {}
      };
    }
  }

  /**
   * Check for storage issues and recommend cleanup
   */
  public async checkStorageHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    recommendations: string[];
    usage: StorageUsage;
  }> {
    try {
      const usage = await this.analyzeUsage();
      const recommendations: string[] = [];
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = 'Storage kullanımı normal seviyede';

      // Check total keys
      if (usage.totalKeys > AsyncStorageHygieneService.MAX_TOTAL_KEYS) {
        status = 'critical';
        message = `Çok fazla storage key (${usage.totalKeys})`;
        recommendations.push('Eski cache verilerini temizleyin');
      } else if (usage.totalKeys > AsyncStorageHygieneService.MAX_TOTAL_KEYS * 0.8) {
        status = 'warning';
        message = `Storage key sayısı yüksek (${usage.totalKeys})`;
        recommendations.push('Cache temizliği yakında gerekli');
      }

      // Check total size (rough estimate)
      const sizeMB = usage.totalSizeBytes / (1024 * 1024);
      if (sizeMB > 50) {
        status = 'critical';
        message = `Storage boyutu çok yüksek (${sizeMB.toFixed(1)}MB)`;
        recommendations.push('Eski mood entries temizlenebilir');
      } else if (sizeMB > 20) {
        if (status !== 'critical') {
          status = 'warning';
          message = `Storage boyutu artmaya başladı (${sizeMB.toFixed(1)}MB)`;
        }
        recommendations.push('Weekly cleanup önerilebilir');
      }

      // Check mood entry distribution
      const moodKeyCount = usage.keysByCategory.mood_entries || 0;
      if (moodKeyCount > 180) { // ~6 months daily
        recommendations.push('3+ ay öncesi mood entries silinebilir');
      }

      return {
        status,
        message,
        recommendations,
        usage
      };
    } catch (error) {
      console.error('Failed to check storage health:', error);
      return {
        status: 'critical',
        message: 'Storage health kontrol edilemedi',
        recommendations: ['Manual cleanup gerekli'],
        usage: {
          totalKeys: 0,
          totalSizeBytes: 0,
          keysByCategory: {},
          sizeByCategoryBytes: {}
        }
      };
    }
  }

  /**
   * Perform automatic maintenance
   */
  public async performMaintenance(userId: string): Promise<{
    totalCleaned: number;
    freedBytes: number;
    actions: string[];
  }> {
    try {
      console.log('🧹 Starting AsyncStorage maintenance...');
      
      const actions: string[] = [];
      let totalCleaned = 0;
      let freedBytes = 0;

      // 1. Clean up old mood entries (90 days)
      const moodCleanup = await this.cleanupOldMoodEntries(userId, 90);
      if (moodCleanup.removedKeys > 0) {
        totalCleaned += moodCleanup.removedKeys;
        freedBytes += moodCleanup.freedBytes;
        actions.push(`${moodCleanup.removedKeys} eski mood entry temizlendi`);
      }

      // 2. Clean up old caches (72 hours)
      const cacheCleanup = await this.cleanupCaches(72);
      if (cacheCleanup.removedKeys > 0) {
        totalCleaned += cacheCleanup.removedKeys;
        freedBytes += cacheCleanup.freedBytes;
        actions.push(`${cacheCleanup.removedKeys} cache key temizlendi`);
      }

      if (actions.length === 0) {
        actions.push('Temizlenecek veri bulunamadı');
      }

      console.log(`✅ Maintenance complete: ${totalCleaned} keys, ${Math.round(freedBytes / 1024)}KB freed`);

      return {
        totalCleaned,
        freedBytes,
        actions
      };
    } catch (error) {
      console.error('Maintenance failed:', error);
      return {
        totalCleaned: 0,
        freedBytes: 0,
        actions: ['Maintenance başarısız']
      };
    }
  }

  /**
   * Get formatted storage info for debug screen
   */
  public async getFormattedUsage(): Promise<{
    summary: string[];
    breakdown: string[];
    health: string;
    recommendations: string[];
  }> {
    try {
      const health = await this.checkStorageHealth();
      
      const summary = [
        `📊 Total Keys: ${health.usage.totalKeys}`,
        `💾 Total Size: ${(health.usage.totalSizeBytes / 1024).toFixed(1)}KB`,
        `🗓️ Mood Range: ${health.usage.oldestEntry || 'N/A'} - ${health.usage.newestEntry || 'N/A'}`
      ];

      const breakdown = Object.entries(health.usage.keysByCategory)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category, count]) => {
          const sizeKB = (health.usage.sizeByCategoryBytes[category] / 1024).toFixed(1);
          return `${category}: ${count} keys (${sizeKB}KB)`;
        });

      return {
        summary,
        breakdown,
        health: `${health.status.toUpperCase()}: ${health.message}`,
        recommendations: health.recommendations
      };
    } catch (error) {
      console.error('Failed to get formatted usage:', error);
      return {
        summary: ['Usage analizi başarısız'],
        breakdown: [],
        health: 'UNKNOWN: Analiz hatası',
        recommendations: ['Manual cleanup gerekli']
      };
    }
  }
}

export const asyncStorageHygiene = AsyncStorageHygieneService.getInstance();
export default asyncStorageHygiene;
