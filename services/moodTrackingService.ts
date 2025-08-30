import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import batchOptimizer from '@/services/sync/batchOptimizer';
import { intelligentMergeService } from '@/services/staticMoodMerge';
import { secureDataService } from '@/services/encryption/secureDataService';
import { generatePrefixedId } from '@/utils/idGenerator';
import { idempotencyService } from '@/services/idempotencyService';
import optimizedStorage from '@/services/optimizedStorage';

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
  content_hash?: string; // For duplicate detection
  created_at?: string; // Alternative timestamp field
  
  // ID MAPPING FIELDS for local ↔ remote sync
  local_id?: string; // Client-generated ID (mood_xxx_timestamp) 
  remote_id?: string; // Supabase UUID after successful save
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
   * Get current user ID from AsyncStorage
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      return userId;
    } catch (error) {
      console.warn('⚠️ Could not get current user ID:', error);
      return null;
    }
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
    // 🛡️ IDEMPOTENCY CHECK: Prevent duplicate mood entries
    const idempotencyResult = await idempotencyService.checkMoodEntryIdempotency({
      user_id: entry.user_id,
      mood_score: entry.mood_score,
      energy_level: entry.energy_level,
      anxiety_level: entry.anxiety_level,
      notes: entry.notes,
      triggers: entry.triggers,
      activities: entry.activities
    });

    // ✅ DUPLICATE DETECTED: Clear signal to UI - don't return entry that confuses state
    if (idempotencyResult.isDuplicate && !idempotencyResult.shouldProcess) {
      console.log(`🛡️ Duplicate mood entry prevented: ${idempotencyResult.localEntryId}`);
      
      // 🚨 CRITICAL FIX: Throw specific error that UI can handle gracefully
      // This prevents UI from thinking a new entry was created
      const duplicateError = new Error('DUPLICATE_MOOD_ENTRY_PREVENTED');
      (duplicateError as any).code = 'DUPLICATE_PREVENTED';
      (duplicateError as any).existingEntryId = idempotencyResult.localEntryId;
      (duplicateError as any).existingTimestamp = idempotencyResult.existingEntry?.timestamp;
      
      throw duplicateError;
    }

    // ✅ SAFE TO PROCESS: Create mood entry with consistent local ID
    const moodEntry: MoodEntry = {
      ...entry,
      // 🎯 Use consistent local entry ID from idempotency service
      id: idempotencyResult.localEntryId,
      local_id: idempotencyResult.localEntryId, // Store local ID for mapping
      timestamp: new Date().toISOString(),
      synced: false,
      sync_attempts: 0,
    };

    await this.saveToLocalStorage(moodEntry);

    // Use standardized supabaseService.saveMoodEntry (writes to canonical mood_entries table)
    try {
      const supabaseResult = await supabaseService.saveMoodEntry({
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
      
      // 🆔 ID MAPPING: Store remote UUID returned from Supabase for future delete operations
      if (supabaseResult && supabaseResult.id) {
        const remoteId = supabaseResult.id;
        
        // Update mood entry with remote ID mapping
        moodEntry.remote_id = remoteId;
        moodEntry.synced = true; // Mark as successfully synced
        
        console.log(`🔄 ID mapping created: Local(${moodEntry.local_id}) ↔ Remote(${remoteId})`);
        
        // Update local storage with ID mapping for future operations
        await this.updateInLocalStorage(moodEntry);
      }
      
      // ✅ Mark as successfully processed in idempotency service
      await idempotencyService.markAsProcessed(
        idempotencyResult.localEntryId,
        idempotencyResult.contentHash,
        moodEntry.user_id
      );
      
      await this.markAsSynced(moodEntry.id, moodEntry.user_id);
    } catch (e) {
      console.warn('❌ Mood entry Supabase save failed, adding to offline sync queue:', e);
      
      // 🛡️ Check if we should queue (idempotency service prevents double-queuing)
      if (!idempotencyResult.shouldQueue) {
        console.log(`🛡️ Skipping sync queue - already queued: ${idempotencyResult.localEntryId}`);
        return moodEntry;
      }
      
      // 🔔 USER FEEDBACK: Record initial mood entry sync error
      try {
        const { default: offlineSyncUserFeedbackService } = await import('@/services/offlineSyncUserFeedbackService');
        await offlineSyncUserFeedbackService.recordSyncError(
          moodEntry.id,
          'mood_entry',
          'CREATE',
          e instanceof Error ? e.message : String(e),
          0, // Initial attempt
          8  // Max retries in offline sync
        );
      } catch (feedbackError) {
        console.warn('⚠️ Failed to record mood entry sync error for user feedback:', feedbackError);
      }
      
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
        
        // ✅ Mark as queued in idempotency service
        await idempotencyService.markAsQueued(
          idempotencyResult.localEntryId,
          idempotencyResult.contentHash,
          moodEntry.user_id
        );
        
        console.log('✅ Failed mood entry added to offline sync queue:', moodEntry.id);
        
        // Track successful queue addition
        try {
          // 🚫 AI Telemetry - DISABLED (Hard Stop AI Cleanup)
          // const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
          // await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_CACHE_MISS, {
          //   event: 'mood_auto_queued_for_sync',
          //   entryId: moodEntry.id,
          //   userId: moodEntry.user_id,
          //   reason: 'supabase_save_failed'
          // });
        } catch (telemetryError) {
          console.warn('⚠️ Telemetry failed for mood queue event:', telemetryError);
        }
        
              } catch (queueError) {
        console.error('❌ CRITICAL: Failed to add mood entry to offline sync queue:', queueError);
        
        // ❌ Mark as failed in idempotency service for potential retry
        await idempotencyService.markAsFailed(idempotencyResult.localEntryId);
        
        // Track critical failure
        try {
          // 🚫 AI Telemetry - DISABLED (Hard Stop AI Cleanup)
          // const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
          // await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          //   event: 'mood_queue_addition_failed',
          //   entryId: moodEntry.id,
          //   userId: moodEntry.user_id,
          //   error: queueError instanceof Error ? queueError.message : String(queueError),
          //   severity: 'critical'
          // });
        } catch {}
      }
    }

    // 🧹 Periodic cleanup of old idempotency entries (1% chance per save)
    if (Math.random() < 0.01) {
      try {
        idempotencyService.cleanupOldEntries().then(deletedCount => {
          if (deletedCount > 0) {
            console.log(`🧹 Background cleanup: removed ${deletedCount} old idempotency entries`);
          }
        }).catch(() => {}); // Silent failure for background cleanup
      } catch {} // Silent failure
    }

    return moodEntry;
  }

  /**
   * 📝 Update existing mood entry (both local and remote)
   */
  async updateMoodEntry(entryId: string, updates: Partial<Omit<MoodEntry, 'id' | 'user_id' | 'timestamp'>>): Promise<MoodEntry> {
    try {
      console.log(`📝 Updating mood entry: ${entryId}`, updates);

      // 🔍 First, find the entry to get user_id and current data
      const existingEntries = await this.getMoodEntries((updates as any).user_id || 'unknown', 30);
      const existingEntry = existingEntries.find(entry => entry.id === entryId);
      
      if (!existingEntry) {
        throw new Error(`Mood entry not found: ${entryId}`);
      }

      // 🔄 Create updated entry
      const updatedEntry: MoodEntry = {
        ...existingEntry,
        ...updates,
        timestamp: existingEntry.timestamp, // Keep original timestamp
        synced: false, // Mark as needing sync
        sync_attempts: 0
      };

      // 🔒 Update in local storage
      await this.updateInLocalStorage(updatedEntry);
      
      // 🌐 Update in remote (Supabase)
      try {
        await supabaseService.updateMoodEntry(entryId, {
          mood_score: updatedEntry.mood_score,
          energy_level: updatedEntry.energy_level, 
          anxiety_level: updatedEntry.anxiety_level,
          notes: updatedEntry.notes,
          triggers: updatedEntry.triggers,
          activities: updatedEntry.activities
        });
        
        // Mark as synced
        updatedEntry.synced = true;
        await this.updateInLocalStorage(updatedEntry);
        
        console.log(`✅ Mood entry updated successfully: ${entryId}`);
      } catch (remoteError) {
        console.warn('⚠️ Remote update failed, will sync later:', remoteError);
        
        // Add to sync queue for later
        // TODO: Add to offline sync queue
      }

      return updatedEntry;
    } catch (error) {
      console.error(`❌ Failed to update mood entry ${entryId}:`, error);
      throw error;
    }
  }

  /**
   * 🔄 Update mood entry in local storage only
   */
  private async updateInLocalStorage(entry: MoodEntry): Promise<void> {
    const entryDate = new Date(entry.timestamp);
    const localDateKey = this.getLocalDateKey(entryDate);
    const key = `${this.STORAGE_KEY}_${entry.user_id}_${localDateKey}`;
    
    try {
      const existing = await optimizedStorage.getOptimized<EncryptedMoodStorage[]>(key) || [];
      
      // Find and update the entry
      let updated = false;
      for (let i = 0; i < existing.length; i++) {
        const storedEntry = existing[i];
        const metadata = storedEntry.metadata || storedEntry;
        
        if ((metadata as any).id === (entry as any).id) {
          // Update the entry
          existing[i] = await this.encryptMoodEntry(entry);
          updated = true;
          break;
        }
      }
      
      if (!updated) {
        console.warn(`⚠️ Entry ${entry.id} not found in local storage for update`);
        // Add as new entry
        existing.push(await this.encryptMoodEntry(entry));
      }
      
      await optimizedStorage.setOptimized(key, existing, true);
      console.log(`✅ Local storage updated for entry: ${entry.id}`);
      
    } catch (error) {
      console.error('❌ Failed to update in local storage:', error);
      throw error;
    }
  }

  /**
   * 🔒 Encrypt mood entry for storage
   */
  private async encryptMoodEntry(entry: MoodEntry): Promise<EncryptedMoodStorage> {
    const sensitiveData = {
      notes: entry.notes || '',
      triggers: entry.triggers || [],
      activities: entry.activities || []
    };
    
    const encryptedSensitiveData = await secureDataService.encryptSensitiveData(sensitiveData);
    
    return {
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
      storageVersion: 2
    };
  }

  private async saveToLocalStorage(entry: MoodEntry): Promise<void> {
    // 🌍 TIMEZONE FIX: Use local date for storage key instead of UTC
    const entryDate = new Date(entry.timestamp);
    const localDateKey = this.getLocalDateKey(entryDate);
    const key = `${this.STORAGE_KEY}_${entry.user_id}_${localDateKey}`;
    
    console.log(`🌍 Using local date key: ${localDateKey} (from timestamp: ${entry.timestamp})`);
    
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
      
      // 📦 SAVE TO OPTIMIZED STORAGE (with batching and caching)
      const existing = await optimizedStorage.getOptimized<EncryptedMoodStorage[]>(key) || [];
      existing.push(encryptedEntry);
      // Use immediate=true for critical mood data to ensure persistence
      await optimizedStorage.setOptimized(key, existing, true);
      
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

            // 🔔 USER FEEDBACK: Mark any sync errors for this entry as resolved
            try {
              const { default: offlineSyncUserFeedbackService } = await import('@/services/offlineSyncUserFeedbackService');
              await offlineSyncUserFeedbackService.markErrorResolved(id);
            } catch (feedbackError) {
              console.warn('⚠️ Failed to mark sync error as resolved:', feedbackError);
            }

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

  // 🌍 TIMEZONE FIX: Generate local date keys instead of UTC
  private async getRecentDates(days: number): Promise<string[]> {
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000);
      // 🔧 Use LOCAL date instead of UTC
      const localDate = this.getLocalDateKey(d);
      dates.push(localDate);
    }
    return dates;
  }

  /**
   * 🌍 Get local date string for storage key (YYYY-MM-DD)
   * Avoids UTC timezone issues where mood entries appear in wrong day
   */
  private getLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    // 🚀 PERFORMANCE OPTIMIZATION: Use optimized storage with query capabilities
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      
      const optimizedEntries = await optimizedStorage.queryMoodEntries(userId, {
        dateFrom,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });

      // If optimized query returns results, use them
      if (optimizedEntries.length > 0) {
        console.log(`⚡ Optimized query: ${optimizedEntries.length} entries in optimized path`);
        return optimizedEntries;
      }
    } catch (error) {
      console.warn('Optimized query failed, falling back to traditional method:', error);
    }

    // 🔄 FALLBACK: Traditional AsyncStorage method (backwards compatibility)
    const localEntries: MoodEntry[] = [];
    const dates = await this.getRecentDates(days);
    
    // 🚀 OPTIMIZATION: Parallel loading instead of sequential
    const loadPromises = dates.map(async (date) => {
      const key = `${this.STORAGE_KEY}_${userId}_${date}`;
      try {
        const existing = await optimizedStorage.getOptimized<any>(key); // Use cache
        if (existing) {
          const decryptedEntries: MoodEntry[] = [];
          
          // 🔒 DECRYPT ENTRIES WITH BACKWARDS COMPATIBILITY
          for (const rawEntry of existing) {
            try {
              const decryptedEntry = await this.decryptMoodEntry(rawEntry);
              if (decryptedEntry) {
                decryptedEntries.push(decryptedEntry);
              }
            } catch (decryptError) {
              console.warn('⚠️ Failed to decrypt mood entry, skipping:', decryptError);
            }
          }
          return decryptedEntries;
        }
      } catch (error) {
        console.warn(`Failed to load mood entries for date ${date}:`, error);
      }
      return [];
    });

    const allEntries = await Promise.all(loadPromises);
    localEntries.push(...allEntries.flat());
    
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
          
          const mergeResult = await intelligentMergeService.intelligentMoodMerge(localEntries, remoteEntries);
          
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
   * Check if entry exists in LOCAL storage only (bypass intelligent merge)
   * Used for deletion verification without triggering remote sync
   */
  async checkEntryExistsInLocalStorage(entryId: string): Promise<boolean> {
    try {
      console.log('🔍 Checking local storage for entry:', entryId);
      
      // Get all possible storage keys
      const allKeys = await this.getAllMoodStorageKeys();
      
      for (const storageKey of allKeys) {
        const existing = await AsyncStorage.getItem(storageKey);
        
        if (existing) {
          try {
            let entries: any[] = JSON.parse(existing);
            
            // Handle both encrypted (v2) and plain (v1) storage formats
            if (entries.length > 0 && entries[0].storageVersion === 2) {
              // Decrypt entries to check IDs
              for (const rawEntry of entries) {
                const decrypted = await this.decryptMoodEntry(rawEntry);
                if (decrypted && decrypted.id === entryId) {
                  console.log(`🔍 Entry ${entryId} found in encrypted storage key: ${storageKey}`);
                  return true;
                }
              }
            } else {
              // Plain format - direct check
              const found = entries.some((entry: any) => entry.id === entryId);
              if (found) {
                console.log(`🔍 Entry ${entryId} found in plain storage key: ${storageKey}`);
                return true;
              }
            }
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse storage key ${storageKey}:`, parseError);
          }
        }
      }
      
      // Also check main storage key
      const mainData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (mainData) {
        try {
          const entries: MoodEntry[] = JSON.parse(mainData);
          const found = entries.some(entry => entry.id === entryId);
          if (found) {
            console.log(`🔍 Entry ${entryId} found in main storage`);
            return true;
          }
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse main storage:`, parseError);
        }
      }
      
      console.log(`🔍 Entry ${entryId} NOT found in local storage`);
      return false;
      
    } catch (error) {
      console.error('❌ Failed to check entry existence in local storage:', error);
      return false;
    }
  }

  /**
   * Force delete mood entry with more aggressive cleanup
   * Used when standard deletion fails
   */
  async forceDeleteMoodEntry(entryId: string): Promise<void> {
    try {
      console.log('🔥 FORCE DELETING mood entry from local storage:', entryId);
      
      // 🚀 CRITICAL: Mark entry as deleted in cache FIRST to prevent re-add
      const userId = await this.getCurrentUserId();
      if (userId) {
        const { moodDeletionCache } = await import('@/services/moodDeletionCache');
        await moodDeletionCache.markAsDeleted(entryId, userId, 'cleanup');
        console.log('✅ Entry marked in deletion cache (FORCE mode)');
      }
      
      let deletionSuccess = false;
      let keysProcessed = 0;
      
      // 1. Get ALL storage keys (not just recent dates)
      const allStorageKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allStorageKeys.filter(key => 
        key.includes('mood_entries') || key.includes(this.STORAGE_KEY)
      );
      
      console.log(`🔍 Force deletion: Found ${moodKeys.length} potential mood storage keys`);
      
      // 2. Process each key
      for (const storageKey of moodKeys) {
        keysProcessed++;
        const existing = await AsyncStorage.getItem(storageKey);
        
        if (existing) {
          try {
            let entries: any[] = JSON.parse(existing);
            let originalCount = entries.length;
            
            // Handle encrypted format
            if (entries.length > 0 && entries[0].storageVersion === 2) {
              console.log(`🔍 Processing encrypted storage key: ${storageKey}`);
              
              // Decrypt, filter, and re-encrypt
              const decryptedEntries: MoodEntry[] = [];
              for (const rawEntry of entries) {
                const decrypted = await this.decryptMoodEntry(rawEntry);
                if (decrypted && decrypted.id !== entryId) {
                  decryptedEntries.push(decrypted);
                }
              }
              
              // Re-encrypt remaining entries
              if (decryptedEntries.length > 0) {
                const encryptedEntries = [];
                for (const entry of decryptedEntries) {
                  const sensitiveData = {
                    notes: entry.notes || '',
                    triggers: entry.triggers || [],
                    activities: entry.activities || []
                  };
                  
                  const encryptedData = await secureDataService.encryptSensitiveData(sensitiveData);
                  
                  const encryptedEntry = {
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
                    encryptedData,
                    storageVersion: 2
                  };
                  
                  encryptedEntries.push(encryptedEntry);
                }
                await AsyncStorage.setItem(storageKey, JSON.stringify(encryptedEntries));
              } else {
                await AsyncStorage.removeItem(storageKey);
                console.log(`🗑️ Removed empty encrypted storage key: ${storageKey}`);
              }
              
              if (originalCount > decryptedEntries.length) {
                console.log(`🔥 FORCE DELETED from encrypted key ${storageKey}: ${originalCount} -> ${decryptedEntries.length}`);
                deletionSuccess = true;
              }
              
            } else {
              // Handle plain format
              console.log(`🔍 Processing plain storage key: ${storageKey}`);
              const filteredEntries = entries.filter((entry: any) => entry.id !== entryId);
              
              if (filteredEntries.length !== originalCount) {
                if (filteredEntries.length > 0) {
                  await AsyncStorage.setItem(storageKey, JSON.stringify(filteredEntries));
                } else {
                  await AsyncStorage.removeItem(storageKey);
                  console.log(`🗑️ Removed empty plain storage key: ${storageKey}`);
                }
                console.log(`🔥 FORCE DELETED from plain key ${storageKey}: ${originalCount} -> ${filteredEntries.length}`);
                deletionSuccess = true;
              }
            }
            
          } catch (processError) {
            console.warn(`⚠️ Failed to process storage key ${storageKey}:`, processError);
          }
        }
      }
      
      // 3. Clear any caches or temporary data
      try {
        const cacheKeys = allStorageKeys.filter(key => 
          key.includes('cache') && key.includes('mood')
        );
        for (const cacheKey of cacheKeys) {
          await AsyncStorage.removeItem(cacheKey);
          console.log(`🧹 Cleared mood cache: ${cacheKey}`);
        }
      } catch (cacheError) {
        console.warn('⚠️ Failed to clear mood caches:', cacheError);
      }
      
      console.log(`🔥 Force deletion summary:`);
      console.log(`   Keys processed: ${keysProcessed}`);
      console.log(`   Deletion success: ${deletionSuccess}`);
      
      if (deletionSuccess) {
        console.log('✅ FORCE DELETION completed successfully');
      } else {
        console.warn('⚠️ FORCE DELETION: Entry not found in any storage key');
      }
      
    } catch (error) {
      console.error('❌ FORCE DELETE failed:', error);
      throw error;
    }
  }

  /**
   * Delete mood entry from local storage
   * ENHANCED: Better logging and verification
   */
  async deleteMoodEntry(entryId: string): Promise<void> {
    try {
      console.log('🗑️ Starting mood entry deletion from local storage:', entryId);
      
      // 🚀 CRITICAL: Mark entry as deleted in cache FIRST to prevent re-add
      const userId = await this.getCurrentUserId();
      if (userId) {
        const { moodDeletionCache } = await import('@/services/moodDeletionCache');
        await moodDeletionCache.markAsDeleted(entryId, userId, 'user_initiated');
        console.log('✅ Entry marked in deletion cache to prevent re-add');
      }
      
      let entryFound = false;
      let totalKeysChecked = 0;
      let keysWithData = 0;

      // 🆔 ID MAPPING: Support both UUID (remote) and local ID (mood_xxx) formats
      const isUUIDFormat = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(entryId);
      const isLocalFormat = entryId.startsWith('mood_');
      
      console.log(`🔍 Delete ID analysis: ${entryId} (UUID: ${isUUIDFormat}, Local: ${isLocalFormat})`);
      
      // If we have a UUID, try to find corresponding local_id
      let localIdToSearch = entryId;
      if (isUUIDFormat) {
        try {
          // Search for entry with this remote_id to get local_id
          const allEntries = await this.getMoodEntries(userId || 'unknown', 30);
          const matchingEntry = allEntries.find(entry => 
            entry.remote_id === entryId || entry.id === entryId
          );
          
          if (matchingEntry && matchingEntry.local_id) {
            localIdToSearch = matchingEntry.local_id;
            console.log(`🔄 Found local ID mapping: ${entryId} → ${localIdToSearch}`);
          } else if (matchingEntry) {
            localIdToSearch = matchingEntry.id;
            console.log(`🔄 Using entry.id as fallback: ${localIdToSearch}`);
          }
        } catch (mappingError) {
          console.warn('⚠️ ID mapping lookup failed, will search with original ID:', mappingError);
        }
      }
      
      // Get all possible user storage keys by scanning existing storage
      const allKeys = await this.getAllMoodStorageKeys();
      console.log(`🔍 Checking ${allKeys.length} storage keys for entry ${entryId}`);
      
      for (const storageKey of allKeys) {
        totalKeysChecked++;
        const existing = await AsyncStorage.getItem(storageKey);
        
        if (existing) {
          keysWithData++;
          try {
            // Handle both encrypted (v2) and plain (v1) storage formats
            let entries: any[] = JSON.parse(existing);
            
            // Check if this is encrypted format
            if (entries.length > 0 && entries[0].storageVersion === 2) {
              // Encrypted format - need to decrypt to check IDs
              const decryptedEntries: MoodEntry[] = [];
              for (const rawEntry of entries) {
                const decrypted = await this.decryptMoodEntry(rawEntry);
                if (decrypted) {
                  decryptedEntries.push(decrypted);
                }
              }
              entries = decryptedEntries;
            }
            
            const originalCount = entries.length;
            // 🆔 ENHANCED FILTERING: Check both original entryId and mapped localIdToSearch
            const filteredEntries = entries.filter((entry: any) => {
              const entryMatches = (
                entry.id === entryId || 
                entry.id === localIdToSearch ||
                entry.local_id === entryId ||
                entry.remote_id === entryId
              );
              return !entryMatches; // Keep entries that DON'T match
            });
            
            // If entries were removed, update storage
            if (filteredEntries.length !== originalCount) {
              console.log(`🔍 Found entry ${entryId} in ${storageKey} (${originalCount} -> ${filteredEntries.length})`);
              
              if (filteredEntries.length > 0) {
                // Re-encrypt if necessary and save
                if (entries.length > 0 && (entries[0] as any).storageVersion === 2) {
                  // Need to re-encrypt the remaining entries
                  const encryptedEntries = [];
                  for (const entry of filteredEntries) {
                    const sensitiveData = {
                      notes: entry.notes || '',
                      triggers: entry.triggers || [],
                      activities: entry.activities || []
                    };
                    
                    const encryptedData = await secureDataService.encryptSensitiveData(sensitiveData);
                    
                    const encryptedEntry = {
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
                      encryptedData,
                      storageVersion: 2
                    };
                    
                    encryptedEntries.push(encryptedEntry);
                  }
                  await AsyncStorage.setItem(storageKey, JSON.stringify(encryptedEntries));
                } else {
                  // Plain format
                  await AsyncStorage.setItem(storageKey, JSON.stringify(filteredEntries));
                }
              } else {
                await AsyncStorage.removeItem(storageKey); // Remove empty date entry
                console.log(`🗑️ Removed empty storage key: ${storageKey}`);
              }
              
              console.log(`✅ Entry ${entryId} removed from storage key: ${storageKey}`);
              entryFound = true;
              // Don't break - entry might exist in multiple places due to sync issues
            }
          } catch (parseError) {
            console.warn(`⚠️ Failed to process storage key ${storageKey}:`, parseError);
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

      // Final summary
      console.log(`📊 Deletion summary for ${entryId}:`);
      console.log(`   Keys checked: ${totalKeysChecked}`);
      console.log(`   Keys with data: ${keysWithData}`);
      console.log(`   Entry found and deleted: ${entryFound}`);
      
      if (entryFound) {
        console.log('✅ Successfully deleted mood entry from local storage');
      } else {
        console.warn(`⚠️ Entry ${entryId} not found in local storage - might have been already deleted or ID mismatch`);
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
      
      let invalidEntries = 0;
      const validEntries: MoodEntry[] = [];
      const invalidIds: string[] = [];

      // ✅ PRE-VALIDATE entries before adding to sync queue
      for (const entry of unsyncedEntries) {
        const isValid = entry.user_id && 
                       entry.mood_score !== undefined && 
                       entry.mood_score !== null &&
                       typeof entry.mood_score === 'number';
        
        if (!isValid) {
          console.warn(`🚫 Skipping invalid mood entry during auto-recovery:`, {
            id: entry.id,
            hasUserId: !!entry.user_id,
            hasMoodScore: entry.mood_score !== undefined,
            moodScoreType: typeof entry.mood_score,
            moodScoreValue: entry.mood_score
          });
          invalidEntries++;
          invalidIds.push(entry.id);
        } else {
          validEntries.push(entry);
        }
      }

      // ✅ Process only valid entries
      for (const entry of validEntries) {
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

      // 🧹 CLEANUP: Remove invalid entries from local storage to prevent future issues
      if (invalidEntries > 0) {
        console.log(`🧹 Cleaning up ${invalidEntries} invalid mood entries from local storage...`);
        await this.cleanupInvalidEntries(userId, invalidIds);
      }

      console.log(`✅ Auto-recovery complete: ${recovered} queued, ${failed} failed${invalidEntries > 0 ? `, ${invalidEntries} invalid entries cleaned` : ''}`);

      // Track recovery telemetry
      try {
        // 🚫 AI Telemetry - DISABLED (Hard Stop AI Cleanup)
        // const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        // await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        //   event: 'mood_auto_recovery_completed',
        //   userId: userId,
        //   totalUnsynced: unsyncedEntries.length,
        //   recovered: recovered,
        //   failed: failed,
        //   invalidEntries: invalidEntries,
        //   cleanupPerformed: invalidEntries > 0
        // });
      } catch {}

      return { recovered, failed };
      
    } catch (error) {
      console.error('❌ Auto-recovery failed:', error);
      return { recovered: 0, failed: 0 };
    }
  }

  /**
   * 🧹 Clean up invalid mood entries from local storage
   * Removes entries that are missing required fields (user_id, mood_score)
   */
  private async cleanupInvalidEntries(userId: string, invalidIds: string[]): Promise<number> {
    let cleanedCount = 0;
    
    try {
      const dates = await this.getRecentDates(30); // Check last 30 days
      
      for (const date of dates) {
        const key = `${this.STORAGE_KEY}_${userId}_${date}`;
        const existing = await AsyncStorage.getItem(key);
        
        if (existing) {
          const entries: MoodEntry[] = JSON.parse(existing);
          const originalCount = entries.length;
          
          // Filter out invalid entries
          const validEntries = entries.filter(entry => {
            const isInvalid = invalidIds.includes(entry.id);
            if (isInvalid) {
              console.log(`🗑️ Removing invalid entry ${entry.id} from ${date}`);
              cleanedCount++;
            }
            return !isInvalid;
          });
          
          // Save the cleaned data back to storage
          if (validEntries.length !== originalCount) {
            if (validEntries.length === 0) {
              await AsyncStorage.removeItem(key);
              console.log(`🗑️ Removed empty storage key: ${key}`);
            } else {
              await AsyncStorage.setItem(key, JSON.stringify(validEntries));
              console.log(`🧹 Updated ${key}: ${originalCount} → ${validEntries.length} entries`);
            }
          }
        }
      }
      
      console.log(`✅ Cleanup complete: Removed ${cleanedCount} invalid mood entries from local storage`);
      
      // Track cleanup telemetry
      try {
        // 🚫 AI Telemetry - DISABLED (Hard Stop AI Cleanup)
        // const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        // await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        //   event: 'mood_storage_cleanup',
        //   userId,
        //   cleanedCount,
        //   invalidIds: invalidIds.slice(0, 5) // Only log first 5 IDs for privacy
        // });
      } catch (telemetryError) {
        console.log('Failed to track cleanup telemetry:', telemetryError);
      }
      
    } catch (error) {
      console.error('❌ Failed to cleanup invalid entries:', error);
    }
    
    return cleanedCount;
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



