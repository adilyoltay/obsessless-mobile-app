/**
 * 🗑️ Mood Deletion Cache Service
 * Tracks recently deleted mood entries to prevent IntelligentMerge from restoring them
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DeletedEntryRecord {
  entryId: string;
  userId: string;
  deletedAt: number;
  deleteReason: 'user_initiated' | 'user_initiated_offline' | 'cleanup' | 'sync_conflict';
  expiresAt: number;
}

export class MoodDeletionCacheService {
  private static instance: MoodDeletionCacheService;
  private readonly CACHE_KEY = 'mood_deletion_cache';
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  static getInstance(): MoodDeletionCacheService {
    if (!MoodDeletionCacheService.instance) {
      MoodDeletionCacheService.instance = new MoodDeletionCacheService();
    }
    return MoodDeletionCacheService.instance;
  }

  /**
   * 🗑️ Mark an entry as recently deleted
   */
  async markAsDeleted(
    entryId: string, 
    userId: string, 
    deleteReason: DeletedEntryRecord['deleteReason'] = 'user_initiated'
  ): Promise<void> {
    try {
      console.log(`🗑️ Marking entry as deleted in cache: ${entryId}`);
      
      const now = Date.now();
      const record: DeletedEntryRecord = {
        entryId,
        userId,
        deletedAt: now,
        deleteReason,
        expiresAt: now + this.DEFAULT_TTL
      };
      
      // Get existing cache
      const cache = await this.getCache();
      
      // Add new record
      cache[entryId] = record;
      
      // Save updated cache
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
      
      console.log(`✅ Entry ${entryId} marked as deleted (expires: ${new Date(record.expiresAt).toLocaleString()})`);
      
    } catch (error) {
      console.error('❌ Failed to mark entry as deleted:', error);
    }
  }

  /**
   * 🔍 Check if an entry was recently deleted
   */
  async isRecentlyDeleted(entryId: string): Promise<boolean> {
    try {
      const cache = await this.getCache();
      const record = cache[entryId];
      
      if (!record) {
        return false;
      }
      
      // Check if expired
      if (Date.now() > record.expiresAt) {
        console.log(`⏰ Deletion record expired for ${entryId}, removing from cache`);
        await this.removeFromCache(entryId);
        return false;
      }
      
      console.log(`🗑️ Entry ${entryId} is recently deleted (deleted at: ${new Date(record.deletedAt).toLocaleString()})`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to check deletion status:', error);
      return false;
    }
  }

  /**
   * 📋 Get list of recently deleted entry IDs for a user
   */
  async getRecentlyDeletedIds(userId: string): Promise<string[]> {
    try {
      const cache = await this.getCache();
      const now = Date.now();
      const deletedIds: string[] = [];
      
      Object.values(cache).forEach(record => {
        if (record.userId === userId && now <= record.expiresAt) {
          deletedIds.push(record.entryId);
        }
      });
      
      return deletedIds;
      
    } catch (error) {
      console.error('❌ Failed to get recently deleted IDs:', error);
      return [];
    }
  }

  /**
   * 🧹 Clean up expired deletion records
   */
  async cleanupExpired(): Promise<number> {
    try {
      const cache = await this.getCache();
      const now = Date.now();
      let cleanedCount = 0;
      
      const updatedCache: Record<string, DeletedEntryRecord> = {};
      
      Object.entries(cache).forEach(([entryId, record]) => {
        if (now <= record.expiresAt) {
          updatedCache[entryId] = record;
        } else {
          cleanedCount++;
          console.log(`⏰ Removing expired deletion record: ${entryId}`);
        }
      });
      
      if (cleanedCount > 0) {
        await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(updatedCache));
        console.log(`🧹 Cleaned up ${cleanedCount} expired deletion records`);
      }
      
      return cleanedCount;
      
    } catch (error) {
      console.error('❌ Failed to cleanup expired records:', error);
      return 0;
    }
  }

  /**
   * 📊 Get deletion cache stats
   */
  async getStats(): Promise<{
    totalRecords: number;
    expiredRecords: number;
    userBreakdown: Record<string, number>;
    reasonBreakdown: Record<string, number>;
  }> {
    try {
      const cache = await this.getCache();
      const now = Date.now();
      
      const stats = {
        totalRecords: Object.keys(cache).length,
        expiredRecords: 0,
        userBreakdown: {} as Record<string, number>,
        reasonBreakdown: {} as Record<string, number>
      };
      
      Object.values(cache).forEach(record => {
        // Count by user
        stats.userBreakdown[record.userId] = (stats.userBreakdown[record.userId] || 0) + 1;
        
        // Count by reason
        stats.reasonBreakdown[record.deleteReason] = (stats.reasonBreakdown[record.deleteReason] || 0) + 1;
        
        // Count expired
        if (now > record.expiresAt) {
          stats.expiredRecords++;
        }
      });
      
      return stats;
      
    } catch (error) {
      console.error('❌ Failed to get deletion cache stats:', error);
      return {
        totalRecords: 0,
        expiredRecords: 0,
        userBreakdown: {},
        reasonBreakdown: {}
      };
    }
  }

  /**
   * 🧪 Clear all deletion records (for testing/debugging)
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CACHE_KEY);
      console.log('🧹 Deletion cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear deletion cache:', error);
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private async getCache(): Promise<Record<string, DeletedEntryRecord>> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.error('❌ Failed to get deletion cache:', error);
      return {};
    }
  }

  private async removeFromCache(entryId: string): Promise<void> {
    try {
      const cache = await this.getCache();
      delete cache[entryId];
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('❌ Failed to remove from deletion cache:', error);
    }
  }
}

// Singleton instance
export const moodDeletionCache = MoodDeletionCacheService.getInstance();
