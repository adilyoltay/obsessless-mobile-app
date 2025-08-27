import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import batchOptimizer from '@/services/sync/batchOptimizer';
import { IntelligentMoodMergeService } from '@/features/ai/services/intelligentMoodMergeService';
import { secureDataService } from '@/services/encryption/secureDataService';

export interface MoodEntry {
  id: string;
  user_id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  notes?: string;
  triggers?: string[];
  activities?: string[];
  timestamp: string;
  synced: boolean;
  sync_attempts?: number;
  last_sync_attempt?: string;
}

/**
 * 🔒 ENCRYPTED STORAGE FORMAT
 * Separates non-sensitive metadata from encrypted sensitive data
 */
interface EncryptedMoodStorage {
  // Non-sensitive metadata (queryable, indexable)
  metadata: {
    id: string;
    user_id: string;
    mood_score: number;
    energy_level: number;
    anxiety_level: number;
    timestamp: string;
    synced: boolean;
    sync_attempts?: number;
    last_sync_attempt?: string;
  };
  // 🔒 Encrypted sensitive data (AES-256-GCM)
  encryptedData: {
    encrypted: string;
    iv: string;
    algorithm: string;
    version: number;
    hash: string;
    timestamp: number;
  };
  // Schema versioning for migration
  storageVersion: number;
}

class MoodTrackingService {
  private static instance: MoodTrackingService;
  private readonly STORAGE_KEY = 'mood_entries';

  static getInstance(): MoodTrackingService {
    if (!MoodTrackingService.instance) {
      MoodTrackingService.instance = new MoodTrackingService();
    }
    return MoodTrackingService.instance;
  }

  /**
   * 🔒 DECRYPT MOOD ENTRY WITH BACKWARDS COMPATIBILITY
   * Handles both v1 (plain) and v2 (encrypted) storage formats
   */
  private async decryptMoodEntry(rawEntry: any): Promise<MoodEntry | null> {
    try {
      // 📋 V2 FORMAT: Encrypted storage
      if (rawEntry.storageVersion === 2 && rawEntry.encryptedData && rawEntry.metadata) {
        console.log('🔓 Decrypting v2 encrypted mood entry...');
        
        const sensitiveData = await secureDataService.decryptSensitiveData(rawEntry.encryptedData);
        
        return {
          ...rawEntry.metadata,
          notes: sensitiveData.notes || '',
          triggers: sensitiveData.triggers || [],
          activities: sensitiveData.activities || []
        };
      }
      
      // 📋 V1 FORMAT: Legacy plain storage (backwards compatibility)
      else if (!rawEntry.storageVersion || rawEntry.storageVersion === 1) {
        console.log('⚠️ Loading v1 plain mood entry (migration needed)');
        
        // Direct migration from old format
        const moodEntry: MoodEntry = {
          id: rawEntry.id,
          user_id: rawEntry.user_id,
          mood_score: rawEntry.mood_score,
          energy_level: rawEntry.energy_level,
          anxiety_level: rawEntry.anxiety_level,
          notes: rawEntry.notes || '',
          triggers: rawEntry.triggers || [],
          activities: rawEntry.activities || [],
          timestamp: rawEntry.timestamp,
          synced: rawEntry.synced,
          sync_attempts: rawEntry.sync_attempts,
          last_sync_attempt: rawEntry.last_sync_attempt,
        };
        
        // 🔒 AUTO-MIGRATE: Re-encrypt legacy entry for future
        try {
          console.log('🔄 Auto-migrating v1 entry to encrypted format...');
          await this.migrateEntryToEncrypted(moodEntry);
        } catch (migrationError) {
          console.warn('⚠️ Migration failed for entry, keeping as-is:', migrationError);
        }
        
        return moodEntry;
      }
      
      else {
        console.error('❌ Unknown storage format version:', rawEntry.storageVersion);
        return null;
      }
      
    } catch (error) {
      console.error('❌ Mood entry decryption failed:', error);
      throw error;
    }
  }

  /**
   * 🔄 MIGRATE LEGACY ENTRY TO ENCRYPTED FORMAT
   * Automatically upgrades v1 entries to v2 encrypted format
   */
  private async migrateEntryToEncrypted(entry: MoodEntry): Promise<void> {
    try {
      // Re-save with encryption (will create v2 format)
      await this.saveToLocalStorage(entry);
      console.log('✅ Entry migrated to encrypted format:', entry.id);
    } catch (error) {
      console.error('❌ Failed to migrate entry to encrypted format:', error);
      // Don't throw - migration failure shouldn't break read operations
    }
  }

  async saveMoodEntry(entry: Omit<MoodEntry, 'id' | 'timestamp' | 'synced'>): Promise<MoodEntry> {
    const moodEntry: MoodEntry = {
      ...entry,
      id: `mood_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      synced: false,
      sync_attempts: 0,
    };

    await this.saveToLocalStorage(moodEntry);

    // Use standardized supabaseService.saveMoodEntry (writes to canonical mood_entries table)
    try {
      await supabaseService.saveMoodEntry({
        user_id: moodEntry.user_id,
        mood_score: moodEntry.mood_score,
        energy_level: moodEntry.energy_level,
        anxiety_level: moodEntry.anxiety_level,
        notes: moodEntry.notes,
        triggers: moodEntry.triggers || [], // Send full triggers array
        activities: moodEntry.activities || [], // Send activities array
        trigger: moodEntry.triggers?.[0] || '', // Keep backward compatibility
        timestamp: moodEntry.timestamp, // Preserve original creation time for idempotency
      });
      await this.markAsSynced(moodEntry.id, moodEntry.user_id);
    } catch (e) {
      console.warn('❌ Mood entry Supabase save failed, adding to offline sync queue:', e);
      
      // ✅ FIXED: Increment sync attempt for tracking
      await this.incrementSyncAttempt(moodEntry.id, moodEntry.user_id);
      
      // ✅ NEW: Auto-add failed entries to offline sync queue for automatic retry
      try {
        const { offlineSyncService } = await import('@/services/offlineSync');
        await offlineSyncService.addToSyncQueue({
          type: 'CREATE',
          entity: 'mood_entry',
          data: {
            user_id: moodEntry.user_id,
            mood_score: moodEntry.mood_score,
            energy_level: moodEntry.energy_level,
            anxiety_level: moodEntry.anxiety_level,
            notes: moodEntry.notes || '',
            triggers: moodEntry.triggers || [],
            activities: moodEntry.activities || [],
            timestamp: moodEntry.timestamp,
            // Include local entry ID for potential dedup
            local_entry_id: moodEntry.id
          },
          priority: 'high' as any, // Mood entries are high priority
          deviceId: await AsyncStorage.getItem('device_id') || 'unknown_device'
        });
        
        console.log('✅ Failed mood entry added to offline sync queue:', moodEntry.id);
        
        // Track successful queue addition
        try {
          const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
          await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_CACHE_MISS, {
            event: 'mood_auto_queued_for_sync',
            entryId: moodEntry.id,
            userId: moodEntry.user_id,
            reason: 'supabase_save_failed'
          });
        } catch (telemetryError) {
          console.warn('⚠️ Telemetry failed for mood queue event:', telemetryError);
        }
        
      } catch (queueError) {
        console.error('❌ CRITICAL: Failed to add mood entry to offline sync queue:', queueError);
        
        // Track critical failure
        try {
          const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
          await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
            event: 'mood_queue_addition_failed',
            entryId: moodEntry.id,
            userId: moodEntry.user_id,
            error: queueError instanceof Error ? queueError.message : String(queueError),
            severity: 'critical'
          });
        } catch {}
      }
    }

    return moodEntry;
  }

  private async saveToLocalStorage(entry: MoodEntry): Promise<void> {
    const key = `${this.STORAGE_KEY}_${entry.user_id}_${entry.timestamp.split('T')[0]}`;
    
    try {
      // 🔒 ENCRYPT SENSITIVE DATA
      const sensitiveData = {
        notes: entry.notes || '',
        triggers: entry.triggers || [],
        activities: entry.activities || []
      };
      
      const encryptedSensitiveData = await secureDataService.encryptSensitiveData(sensitiveData);
      
      // 📋 CREATE ENCRYPTED STORAGE ENTRY
      const encryptedEntry: EncryptedMoodStorage = {
        metadata: {
          id: entry.id,
          user_id: entry.user_id,
          mood_score: entry.mood_score,
          energy_level: entry.energy_level,
          anxiety_level: entry.anxiety_level,
          timestamp: entry.timestamp,
          synced: entry.synced,
          sync_attempts: entry.sync_attempts,
          last_sync_attempt: entry.last_sync_attempt,
        },
        encryptedData: encryptedSensitiveData,
        storageVersion: 2 // v2 = encrypted format
      };
      
      // 📦 SAVE TO ASYNCSTORAGE
      const existing = await AsyncStorage.getItem(key);
      const entries: EncryptedMoodStorage[] = existing ? JSON.parse(existing) : [];
      entries.push(encryptedEntry);
      await AsyncStorage.setItem(key, JSON.stringify(entries));
      
      console.log('🔒 Mood entry saved with AES-256-GCM encryption');
      
    } catch (error) {
      // 🚨 CRITICAL: Never store unencrypted if encryption fails
      if (error && (error as any).code === 'ENCRYPTION_FAILED_DO_NOT_STORE') {
        console.error('❌ CRITICAL: Encryption failed, mood entry NOT STORED for security');
        throw new Error('MOOD_ENCRYPTION_FAILED');
      } else {
        console.error('❌ Unexpected error during encrypted mood save:', error);
        throw error;
      }
    }
  }

  private async markAsSynced(id: string, userId: string): Promise<void> {
    const dates = await this.getRecentDates(7);
    for (const date of dates) {
      const key = `${this.STORAGE_KEY}_${userId}_${date}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        try {
          const rawEntries = JSON.parse(existing);
          let foundAndUpdated = false;
          
          // 🔒 UPDATE ENCRYPTED STORAGE WITH SYNC STATUS
          const updatedEntries = rawEntries.map((rawEntry: any) => {
            // Handle both v1 and v2 formats for sync marking
            const entryId = rawEntry.storageVersion === 2 ? rawEntry.metadata?.id : rawEntry.id;
            
            if (entryId === id) {
              foundAndUpdated = true;
              
              if (rawEntry.storageVersion === 2) {
                // V2 format: Update metadata
                return {
                  ...rawEntry,
                  metadata: {
                    ...rawEntry.metadata,
                    synced: true,
                    last_sync_attempt: new Date().toISOString()
                  }
                };
              } else {
                // V1 format: Update directly (backwards compatibility)
                return {
                  ...rawEntry,
                  synced: true,
                  last_sync_attempt: new Date().toISOString()
                };
              }
            }
            return rawEntry;
          });
          
          if (foundAndUpdated) {
            await AsyncStorage.setItem(key, JSON.stringify(updatedEntries));
            console.log('✅ Mood entry marked as synced:', id);
            break;
          }
        } catch (error) {
          console.error('❌ Failed to mark mood entry as synced:', error);
        }
      }
    }
  }

  private async incrementSyncAttempt(id: string, userId: string): Promise<void> {
    const dates = await this.getRecentDates(7);
    for (const date of dates) {
      const key = `${this.STORAGE_KEY}_${userId}_${date}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        try {
          const rawEntries = JSON.parse(existing);
          let foundAndUpdated = false;
          
          // 🔒 UPDATE ENCRYPTED STORAGE WITH SYNC ATTEMPT COUNT
          const updatedEntries = rawEntries.map((rawEntry: any) => {
            // Handle both v1 and v2 formats for sync attempt increment
            const entryId = rawEntry.storageVersion === 2 ? rawEntry.metadata?.id : rawEntry.id;
            
            if (entryId === id) {
              foundAndUpdated = true;
              
              if (rawEntry.storageVersion === 2) {
                // V2 format: Update metadata
                return {
                  ...rawEntry,
                  metadata: {
                    ...rawEntry.metadata,
                    sync_attempts: (rawEntry.metadata.sync_attempts || 0) + 1,
                    last_sync_attempt: new Date().toISOString()
                  }
                };
              } else {
                // V1 format: Update directly (backwards compatibility)
                return {
                  ...rawEntry,
                  sync_attempts: (rawEntry.sync_attempts || 0) + 1,
                  last_sync_attempt: new Date().toISOString()
                };
              }
            }
            return rawEntry;
          });
          
          if (foundAndUpdated) {
            await AsyncStorage.setItem(key, JSON.stringify(updatedEntries));
            console.log('🔄 Sync attempt incremented for mood entry:', id);
            break;
          }
        } catch (error) {
          console.error('❌ Failed to increment sync attempt:', error);
        }
      }
    }
  }

  async syncPendingEntries(userId: string): Promise<{ synced: number; failed: number }> {
    const result = { synced: 0, failed: 0 };
    const pending = await this.getUnsyncedEntries(userId);
    if (pending.length === 0) return result;

    console.log(`🔄 Syncing ${pending.length} pending mood entries for user ${userId}`);

    try {
      // ✅ NEW: Use bulk sync for better performance
      const { offlineSyncService } = await import('@/services/offlineSync');
      const bulkResult = await offlineSyncService.bulkSyncMoodEntries(pending, userId);
      
      // Mark successfully synced entries as synced
      if (bulkResult.synced > 0) {
        const syncedEntries = pending.slice(0, bulkResult.synced);
        for (const entry of syncedEntries) {
          await this.markAsSynced(entry.id, userId);
          result.synced++;
        }
      }
      
      // Update retry count for failed entries
      if (bulkResult.failed > 0) {
        const failedEntries = pending.slice(bulkResult.synced);
        for (const entry of failedEntries) {
          await this.incrementSyncAttempt(entry.id, userId);
          result.failed++;
        }
      }

      console.log(`✅ Mood sync completed: ${result.synced} synced, ${result.failed} failed`);
      return result;
      
    } catch (error) {
      console.error('❌ Bulk mood sync failed, falling back to individual sync:', error);
      
      // Fallback to individual sync if bulk fails
      const BATCH_SIZE = Math.max(1, batchOptimizer.calculate(pending.length, 'normal'));
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        try {
          let batchError = null;
          for (const entry of batch) {
            try {
              await supabaseService.saveMoodEntry({
                user_id: entry.user_id,
                mood_score: entry.mood_score,
                energy_level: entry.energy_level,
                anxiety_level: entry.anxiety_level,
                notes: entry.notes,
                triggers: entry.triggers || [], // Send full triggers array
                activities: entry.activities || [], // Send activities array
                trigger: entry.triggers?.[0] || '', // Keep backward compatibility
                timestamp: entry.timestamp, // Preserve original creation time for idempotency
              });
            } catch (e) {
              batchError = e;
              break;
            }
          }
          const error = batchError;
          if (!error) {
            for (const item of batch) {
              await this.markAsSynced(item.id, userId);
              result.synced++;
            }
          } else {
            result.failed += batch.length;
            for (const item of batch) {
              await this.incrementSyncAttempt(item.id, userId);
            }
          }
        } catch (e) {
          result.failed += batch.length;
          for (const item of batch) {
            await this.incrementSyncAttempt(item.id, userId);
          }
        }
      }

      return result;
    }
  }

  private async getUnsyncedEntries(userId: string): Promise<MoodEntry[]> {
    const unsynced: MoodEntry[] = [];
    const dates = await this.getRecentDates(30);
    for (const date of dates) {
      const key = `${this.STORAGE_KEY}_${userId}_${date}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        const entries: MoodEntry[] = JSON.parse(existing);
        unsynced.push(...entries.filter(e => !e.synced && (e.sync_attempts || 0) < 5));
      }
    }
    return unsynced;
  }

  private async getRecentDates(days: number): Promise<string[]> {
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }

  /**
   * Get the last mood entry for the user
   * Combines local and remote data to return the most recent entry
   */
  async getLastMoodEntry(userId: string): Promise<MoodEntry | null> {
    if (!userId) {
      console.warn('⚠️ getLastMoodEntry: userId is required');
      return null;
    }

    try {
      // Get recent mood entries (last 7 days should be sufficient for "last" entry)
      const recentEntries = await this.getMoodEntries(userId, 7);
      
      if (recentEntries.length === 0) {
        console.log('📊 getLastMoodEntry: No mood entries found');
        return null;
      }

      // getMoodEntries already returns sorted by timestamp (desc), so first is most recent
      const lastEntry = recentEntries[0];
      
      console.log('📊 getLastMoodEntry: Found last entry:', {
        id: lastEntry.id,
        timestamp: lastEntry.timestamp,
        mood_score: lastEntry.mood_score,
        synced: lastEntry.synced
      });
      
      return lastEntry;
    } catch (error) {
      console.error('❌ getLastMoodEntry error:', error);
      return null;
    }
  }

  /**
   * Legacy sync method - get last mood entry synchronously (deprecated)
   * @deprecated Use getLastMoodEntry(userId) instead
   */
  getLastMoodEntrySync(): { anxiety: number } | null {
    console.warn('⚠️ getLastMoodEntrySync is deprecated, use async getLastMoodEntry(userId) instead');
    return null;
  }

  // Cross-device: fetch recent remote entries and merge with local using intelligent merge
  async getMoodEntries(userId: string, days: number = 7): Promise<MoodEntry[]> {
    const localEntries: MoodEntry[] = [];
    const dates = await this.getRecentDates(days);
    
    for (const date of dates) {
      const key = `${this.STORAGE_KEY}_${userId}_${date}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        try {
          const parsedData = JSON.parse(existing);
          
          // 🔒 DECRYPT ENTRIES WITH BACKWARDS COMPATIBILITY
          for (const rawEntry of parsedData) {
            try {
              const decryptedEntry = await this.decryptMoodEntry(rawEntry);
              if (decryptedEntry) {
                localEntries.push(decryptedEntry);
              }
            } catch (decryptError) {
              console.warn('⚠️ Failed to decrypt mood entry, skipping:', decryptError);
              // Don't break the entire flow for one corrupted entry
            }
          }
        } catch (parseError) {
          console.error('❌ Failed to parse mood entries from storage:', parseError);
        }
      }
    }
    
    try {
      // Use fully standardized supabaseService.getMoodEntries (canonical service method)
      const remoteData = await supabaseService.getMoodEntries(userId, days);
      
      if (remoteData && remoteData.length > 0) {
        const remoteEntries: MoodEntry[] = remoteData.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          mood_score: d.mood_score,
          energy_level: d.energy_level,
          anxiety_level: d.anxiety_level,
          notes: d.notes || '',
          // ✅ NEW SCHEMA: Handle both array and single trigger formats for migration period
          triggers: d.triggers && Array.isArray(d.triggers) 
            ? d.triggers 
            : (d.trigger ? [d.trigger] : []),
          activities: d.activities || [],
          timestamp: d.created_at || d.timestamp,
          synced: true,
          sync_attempts: 0,
        }));
        
        // 🔄 INTELLIGENT MOOD MERGE WITH CONFLICT RESOLUTION
        try {
          console.log('🔄 Using intelligent mood merge for cross-device sync...', {
            localCount: localEntries.length,
            remoteCount: remoteEntries.length
          });
          
          const intelligentMergeService = new IntelligentMoodMergeService();
          const mergeResult = await intelligentMergeService.intelligentMoodMerge(userId, localEntries, remoteEntries);
          
          console.log('✅ Intelligent merge completed:', {
            totalEntries: mergeResult.mergedEntries.length,
            conflictsResolved: mergeResult.conflicts.length,
            syncSuccess: mergeResult.stats.syncSuccess
          });
          
          // Log conflicts for debugging if any
          if (mergeResult.conflicts.length > 0) {
            console.log('⚠️ Mood data conflicts resolved:', mergeResult.conflicts.map(c => ({
              entryId: c.entryId,
              strategy: c.resolution,
              timestamp: c.mergedVersion?.timestamp
            })));
          }
          
          return mergeResult.mergedEntries.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
        } catch (mergeError) {
          console.error('⚠️ Intelligent mood merge failed, falling back to simple merge:', mergeError);
          
          // Fallback to original simple merge logic
          const merged = new Map<string, MoodEntry>();
          [...localEntries, ...remoteEntries].forEach((e) => {
            const existing = merged.get(e.id);
            if (!existing) merged.set(e.id, e);
            else if (!existing.synced && e.synced) merged.set(e.id, e);
            else if (new Date(e.timestamp).getTime() > new Date(existing.timestamp).getTime()) merged.set(e.id, e);
          });
          return Array.from(merged.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
      }
    } catch (fetchError) {
      console.error('⚠️ Failed to fetch remote mood entries:', fetchError);
    }
    
    return localEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Delete mood entry from local storage
   * FIXED: Proper UUID/ID handling without incorrect parsing
   */
  async deleteMoodEntry(entryId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting mood entry from local storage:', entryId);
      
      let entryFound = false;
      
      // Get recent dates (last 30 days to be safe)
      const dates = await this.getRecentDates(30);
      
      // Get all possible user storage keys by scanning existing storage
      const allKeys = await this.getAllMoodStorageKeys();
      
      for (const storageKey of allKeys) {
        const existing = await AsyncStorage.getItem(storageKey);
        
        if (existing) {
          try {
            const entries: MoodEntry[] = JSON.parse(existing);
            const filteredEntries = entries.filter(entry => entry.id !== entryId);
            
            // If entries were removed, update storage
            if (filteredEntries.length !== entries.length) {
              if (filteredEntries.length > 0) {
                await AsyncStorage.setItem(storageKey, JSON.stringify(filteredEntries));
              } else {
                await AsyncStorage.removeItem(storageKey); // Remove empty date entry
              }
              console.log(`✅ Removed entry ${entryId} from storage key: ${storageKey}`);
              entryFound = true;
              // Don't break - entry might exist in multiple places due to sync issues
            }
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse data from storage key ${storageKey}:`, parseError);
          }
        }
      }

      // Also try to remove from the main storage key (fallback for old format)
      const mainKey = this.STORAGE_KEY;
      const mainData = await AsyncStorage.getItem(mainKey);
      if (mainData) {
        try {
          const entries: MoodEntry[] = JSON.parse(mainData);
          const filteredEntries = entries.filter(entry => entry.id !== entryId);
          
          if (filteredEntries.length !== entries.length) {
            if (filteredEntries.length > 0) {
              await AsyncStorage.setItem(mainKey, JSON.stringify(filteredEntries));
            } else {
              await AsyncStorage.removeItem(mainKey);
            }
            console.log(`✅ Removed entry ${entryId} from main storage`);
            entryFound = true;
          }
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse data from main storage:`, parseError);
        }
      }

      if (entryFound) {
        console.log('✅ Successfully deleted mood entry from local storage');
      } else {
        console.warn(`⚠️ Entry ${entryId} not found in local storage - might have been already deleted`);
      }
      
    } catch (error) {
      console.error('❌ Failed to delete mood entry from local storage:', error);
      throw error;
    }
  }

  /**
   * ✅ NEW: Auto-recover unsynchronized mood entries on app startup
   * This method should be called during app initialization to ensure no mood data is lost
   */
  async autoRecoverUnsyncedEntries(userId: string): Promise<{ recovered: number; failed: number }> {
    if (!userId) {
      console.warn('⚠️ autoRecoverUnsyncedEntries: userId is required');
      return { recovered: 0, failed: 0 };
    }

    try {
      console.log('🔄 Auto-recovering unsynced mood entries...');
      
      const unsyncedEntries = await this.getUnsyncedEntries(userId);
      if (unsyncedEntries.length === 0) {
        console.log('✅ No unsynced mood entries found');
        return { recovered: 0, failed: 0 };
      }

      console.log(`📊 Found ${unsyncedEntries.length} unsynced mood entries, adding to offline sync queue...`);
      
      let recovered = 0;
      let failed = 0;
      
      // Add unsynced entries to offline sync queue for automatic processing
      const { offlineSyncService } = await import('@/services/offlineSync');
      
      for (const entry of unsyncedEntries) {
        try {
          await offlineSyncService.addToSyncQueue({
            type: 'CREATE',
            entity: 'mood_entry',
            data: {
              user_id: entry.user_id,
              mood_score: entry.mood_score,
              energy_level: entry.energy_level,
              anxiety_level: entry.anxiety_level,
              notes: entry.notes || '',
              triggers: entry.triggers || [],
              activities: entry.activities || [],
              timestamp: entry.timestamp,
              local_entry_id: entry.id
            },
            priority: 'high' as any,
            deviceId: await AsyncStorage.getItem('device_id') || 'unknown_device'
          });
          recovered++;
        } catch (error) {
          console.error(`❌ Failed to queue mood entry ${entry.id}:`, error);
          failed++;
        }
      }

      console.log(`✅ Auto-recovery complete: ${recovered} queued, ${failed} failed`);

      // Track recovery telemetry
      try {
        const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'mood_auto_recovery_completed',
          userId: userId,
          totalUnsynced: unsyncedEntries.length,
          recovered: recovered,
          failed: failed
        });
      } catch {}

      return { recovered, failed };
      
    } catch (error) {
      console.error('❌ Auto-recovery failed:', error);
      return { recovered: 0, failed: 0 };
    }
  }

  /**
   * Helper: Get all mood-related storage keys
   * Scans AsyncStorage for keys matching mood entry pattern
   */
  private async getAllMoodStorageKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => key.startsWith(this.STORAGE_KEY));
      console.log(`📦 Found ${moodKeys.length} mood storage keys`);
      return moodKeys;
    } catch (error) {
      console.error('❌ Failed to get mood storage keys:', error);
      return [];
    }
  }


}

export const moodTracker = MoodTrackingService.getInstance();
export default moodTracker;


