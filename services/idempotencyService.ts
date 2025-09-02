/**
 * 🔒 Idempotency Service - Duplicate Prevention for Mood Entries
 * 
 * Provides comprehensive duplicate prevention at multiple levels:
 * 1. Local duplicate prevention (AsyncStorage-based)
 * 2. Sync queue duplicate prevention 
 * 3. Consistent local entry ID generation
 * 4. Cross-device race condition protection
 * 
 * CRITICAL: Prevents duplicate mood entries during network interruptions,
 * multi-tap scenarios, and cross-device synchronization conflicts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generatePrefixedId } from '@/utils/idGenerator';

/**
 * 📋 Idempotency Entry - Tracks processed operations
 */
interface IdempotencyEntry {
  localEntryId: string;
  timestamp: string;
  contentHash: string;
  userId: string;
  processed: boolean;
  syncQueued: boolean;
  attempts: number;
  lastAttempt: string;
}

/**
 * 🎯 Mood Entry Input for idempotency checking
 */
interface MoodEntryInput {
  user_id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  notes?: string;
  triggers?: string[];
  activities?: string[];
  timestamp?: string;
}

/**
 * 📊 Idempotency Check Result
 */
interface IdempotencyResult {
  isDuplicate: boolean;
  localEntryId: string;
  contentHash: string;
  existingEntry?: IdempotencyEntry;
  shouldProcess: boolean;
  shouldQueue: boolean;
}

class IdempotencyService {
  private static instance: IdempotencyService;
  private readonly STORAGE_PREFIX = 'idempotency_mood_';
  
  // 🚀 CONFIGURABLE: Retention period in days (default 7, can be overridden via config)
  private retentionDays: number = parseInt(process.env.IDEMPOTENCY_RETENTION_DAYS || '7', 10);

  public static getInstance(): IdempotencyService {
    if (!IdempotencyService.instance) {
      IdempotencyService.instance = new IdempotencyService();
    }
    return IdempotencyService.instance;
  }

  /**
   * 🔧 Configure retention period dynamically
   * 
   * @param days Number of days to retain idempotency entries
   */
  public setRetentionPeriod(days: number): void {
    if (days < 1 || days > 365) {
      throw new Error('Retention period must be between 1 and 365 days');
    }
    
    const oldRetention = this.retentionDays;
    this.retentionDays = days;
    
    console.log(`🔧 Idempotency retention period updated: ${oldRetention} → ${days} days`);
  }

  /**
   * 📊 Get current retention period
   */
  public getRetentionPeriod(): number {
    return this.retentionDays;
  }

  /**
   * 🔍 Generate consistent content hash for mood entry
   * 
   * Same logic as supabaseService.computeContentHash but local.
   * Format: ${user_id}|${mood_score}|${energy_level}|${anxiety_level}|${notes}|${UTC_day}
   */
  private generateContentHash(entry: MoodEntryInput): string {
    const { computeMoodContentHash } = require('@/services/idempotency/moodContentHash');
    return computeMoodContentHash({
      user_id: entry.user_id,
      mood_score: entry.mood_score,
      energy_level: entry.energy_level,
      anxiety_level: entry.anxiety_level,
      notes: entry.notes,
      timestamp: entry.timestamp,
    }, { dayMode: 'UTC' });
  }

  /**
   * 🎯 Generate consistent local entry ID
   * 
   * Uses content hash + timestamp minutes for consistency across retries
   * while avoiding collisions.
   */
  private generateLocalEntryId(entry: MoodEntryInput, contentHash: string): string {
    const timestamp = entry.timestamp || new Date().toISOString();
    const timestampMinutes = timestamp.slice(0, 16); // YYYY-MM-DDTHH:MM
    
    return `mood_${contentHash}_${timestampMinutes.replace(/[:-]/g, '')}`;
  }

  /**
   * 🔍 Check if mood entry is duplicate
   * 
   * Comprehensive duplicate detection:
   * 1. Content-based: Same content within time window
   * 2. ID-based: Same local entry ID already processed
   * 3. Time-based: Recent similar entry (prevents rapid duplicates)
   */
  public async checkMoodEntryIdempotency(entry: MoodEntryInput): Promise<IdempotencyResult> {
    const contentHash = this.generateContentHash(entry);
    const localEntryId = this.generateLocalEntryId(entry, contentHash);
    const timestamp = entry.timestamp || new Date().toISOString();

    try {
      // 🔍 Check for existing idempotency record
      const existingEntry = await this.getIdempotencyEntry(localEntryId);
      
      if (existingEntry) {
        console.log(`🛡️ Idempotency: Found existing entry ${localEntryId}`);
        
        // Entry already processed successfully
        if (existingEntry.processed) {
          return {
            isDuplicate: true,
            localEntryId,
            contentHash,
            existingEntry,
            shouldProcess: false,
            shouldQueue: false
          };
        }
        
        // Entry already queued for sync
        if (existingEntry.syncQueued) {
          console.log(`🔄 Idempotency: Entry ${localEntryId} already in sync queue`);
          return {
            isDuplicate: true,
            localEntryId,
            contentHash,
            existingEntry,
            shouldProcess: false,
            shouldQueue: false
          };
        }
        
        // Entry exists but failed - allow retry with increment
        console.log(`🔄 Idempotency: Retrying failed entry ${localEntryId}`);
        await this.incrementAttempts(localEntryId);
        
        return {
          isDuplicate: false,
          localEntryId,
          contentHash,
          existingEntry,
          shouldProcess: true,
          shouldQueue: true
        };
      }

      // 🔍 Check for content-based duplicates (different ID, same content)
      const contentDuplicate = await this.findContentDuplicate(contentHash, entry.user_id, timestamp);
      
      if (contentDuplicate) {
        console.log(`🛡️ Idempotency: Content duplicate detected for ${contentHash}`);
        return {
          isDuplicate: true,
          localEntryId,
          contentHash,
          existingEntry: contentDuplicate,
          shouldProcess: false,
          shouldQueue: false
        };
      }

      // ✅ No duplicate found - safe to process
      console.log(`✅ Idempotency: New mood entry ${localEntryId}`);
      return {
        isDuplicate: false,
        localEntryId,
        contentHash,
        shouldProcess: true,
        shouldQueue: true
      };

    } catch (error) {
      console.error('❌ Idempotency check failed:', error);
      
      // 🚨 FAIL-SAFE: On error, allow processing to avoid blocking users
      // but use a fallback unique ID to minimize collision risk
      const fallbackId = generatePrefixedId('mood_fallback');
      
      return {
        isDuplicate: false,
        localEntryId: fallbackId,
        contentHash,
        shouldProcess: true,
        shouldQueue: true
      };
    }
  }

  /**
   * 📝 Mark mood entry as processed
   */
  public async markAsProcessed(localEntryId: string, contentHash: string, userId: string): Promise<void> {
    const entry: IdempotencyEntry = {
      localEntryId,
      timestamp: new Date().toISOString(),
      contentHash,
      userId,
      processed: true,
      syncQueued: false,
      attempts: 1,
      lastAttempt: new Date().toISOString()
    };

    await this.saveIdempotencyEntry(localEntryId, entry);
    console.log(`✅ Marked as processed: ${localEntryId}`);
  }

  /**
   * 🔄 Mark mood entry as queued for sync
   */
  public async markAsQueued(localEntryId: string, contentHash: string, userId: string): Promise<void> {
    let entry = await this.getIdempotencyEntry(localEntryId);
    
    if (!entry) {
      entry = {
        localEntryId,
        timestamp: new Date().toISOString(),
        contentHash,
        userId,
        processed: false,
        syncQueued: true,
        attempts: 1,
        lastAttempt: new Date().toISOString()
      };
    } else {
      entry.syncQueued = true;
      entry.lastAttempt = new Date().toISOString();
    }

    await this.saveIdempotencyEntry(localEntryId, entry);
    console.log(`🔄 Marked as queued: ${localEntryId}`);
  }

  /**
   * ❌ Mark mood entry as failed (allows retry)
   */
  public async markAsFailed(localEntryId: string): Promise<void> {
    const entry = await this.getIdempotencyEntry(localEntryId);
    
    if (entry) {
      entry.processed = false;
      entry.syncQueued = false;
      entry.lastAttempt = new Date().toISOString();
      await this.saveIdempotencyEntry(localEntryId, entry);
      console.log(`❌ Marked as failed: ${localEntryId}`);
    }
  }

  /**
   * 🔍 Find content-based duplicates
   */
  private async findContentDuplicate(contentHash: string, userId: string, timestamp: string): Promise<IdempotencyEntry | null> {
    try {
      const keys = await this.getIdempotencyKeys(userId);
      const now = new Date().getTime();
      const timeWindow = 10 * 60 * 1000; // 10 minutes window for content duplicates
      
      for (const key of keys) {
        const entry = await this.getIdempotencyEntry(key);
        if (entry && entry.contentHash === contentHash) {
          const entryTime = new Date(entry.timestamp).getTime();
          
          // Check if within time window
          if (Math.abs(now - entryTime) <= timeWindow) {
            return entry;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Content duplicate check failed:', error);
      return null;
    }
  }

  /**
   * 🔢 Increment attempt counter
   */
  private async incrementAttempts(localEntryId: string): Promise<void> {
    const entry = await this.getIdempotencyEntry(localEntryId);
    if (entry) {
      entry.attempts++;
      entry.lastAttempt = new Date().toISOString();
      await this.saveIdempotencyEntry(localEntryId, entry);
    }
  }

  /**
   * 💾 Storage helpers
   */
  private async saveIdempotencyEntry(localEntryId: string, entry: IdempotencyEntry): Promise<void> {
    const key = `${this.STORAGE_PREFIX}${localEntryId}`;
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  }

  private async getIdempotencyEntry(localEntryId: string): Promise<IdempotencyEntry | null> {
    try {
      const key = `${this.STORAGE_PREFIX}${localEntryId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private async getIdempotencyKeys(userId: string): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys
        .filter(key => key.startsWith(this.STORAGE_PREFIX))
        .filter(key => key.includes(userId))
        .map(key => key.replace(this.STORAGE_PREFIX, ''));
    } catch {
      return [];
    }
  }

  /**
   * 🧹 Cleanup old idempotency entries
   * 
   * Called periodically to prevent storage bloat.
   * Removes entries older than configured retention period.
   */
  public async cleanupOldEntries(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const idempotencyKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX));
      
      const cutoffTime = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;
      
      for (const key of idempotencyKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const entry: IdempotencyEntry = JSON.parse(data);
            const entryTime = new Date(entry.timestamp).getTime();
            
            if (entryTime < cutoffTime) {
              await AsyncStorage.removeItem(key);
              deletedCount++;
            }
          }
        } catch {
          // Remove corrupted entries
          await AsyncStorage.removeItem(key);
          deletedCount++;
        }
      }
      
      console.log(`🧹 Cleaned up ${deletedCount} old idempotency entries (retention: ${this.retentionDays} days)`);
      return deletedCount;
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * 📊 Get idempotency stats for debugging
   */
  public async getStats(userId?: string): Promise<{
    totalEntries: number;
    processedEntries: number;
    queuedEntries: number;
    failedEntries: number;
    oldestEntry: string | null;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      let idempotencyKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX));
      
      if (userId) {
        idempotencyKeys = idempotencyKeys.filter(key => key.includes(userId));
      }
      
      let processedEntries = 0;
      let queuedEntries = 0;
      let failedEntries = 0;
      let oldestEntry: string | null = null;
      let oldestTime = Date.now();
      
      for (const key of idempotencyKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const entry: IdempotencyEntry = JSON.parse(data);
            
            if (entry.processed) processedEntries++;
            else if (entry.syncQueued) queuedEntries++;
            else failedEntries++;
            
            const entryTime = new Date(entry.timestamp).getTime();
            if (entryTime < oldestTime) {
              oldestTime = entryTime;
              oldestEntry = entry.timestamp;
            }
          }
        } catch {}
      }
      
      return {
        totalEntries: idempotencyKeys.length,
        processedEntries,
        queuedEntries,
        failedEntries,
        oldestEntry
      };
    } catch {
      return {
        totalEntries: 0,
        processedEntries: 0,
        queuedEntries: 0,
        failedEntries: 0,
        oldestEntry: null
      };
    }
  }
}

// Export singleton instance
export const idempotencyService = IdempotencyService.getInstance();
