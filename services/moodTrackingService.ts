import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import batchOptimizer from '@/services/sync/batchOptimizer';
import { IntelligentMoodMergeService } from '@/features/ai/services/intelligentMoodMergeService';

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

class MoodTrackingService {
  private static instance: MoodTrackingService;
  private readonly STORAGE_KEY = 'mood_entries';

  static getInstance(): MoodTrackingService {
    if (!MoodTrackingService.instance) {
      MoodTrackingService.instance = new MoodTrackingService();
    }
    return MoodTrackingService.instance;
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
        trigger: moodEntry.triggers?.[0] || '', // Convert first trigger to string
      });
      await this.markAsSynced(moodEntry.id, moodEntry.user_id);
    } catch (e) {
      await this.incrementSyncAttempt(moodEntry.id, moodEntry.user_id);
    }

    return moodEntry;
  }

  private async saveToLocalStorage(entry: MoodEntry): Promise<void> {
    const key = `${this.STORAGE_KEY}_${entry.user_id}_${entry.timestamp.split('T')[0]}`;
    const existing = await AsyncStorage.getItem(key);
    const entries = existing ? JSON.parse(existing) : [];
    entries.push(entry);
    await AsyncStorage.setItem(key, JSON.stringify(entries));
  }

  private async markAsSynced(id: string, userId: string): Promise<void> {
    const dates = await this.getRecentDates(7);
    for (const date of dates) {
      const key = `${this.STORAGE_KEY}_${userId}_${date}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        const entries: MoodEntry[] = JSON.parse(existing);
        const updated = entries.map(e =>
          e.id === id
            ? { ...e, synced: true, last_sync_attempt: new Date().toISOString() }
            : e
        );
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      }
    }
  }

  private async incrementSyncAttempt(id: string, userId: string): Promise<void> {
    const dates = await this.getRecentDates(7);
    for (const date of dates) {
      const key = `${this.STORAGE_KEY}_${userId}_${date}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        const entries: MoodEntry[] = JSON.parse(existing);
        const updated = entries.map(e =>
          e.id === id
            ? {
                ...e,
                sync_attempts: (e.sync_attempts || 0) + 1,
                last_sync_attempt: new Date().toISOString(),
              }
            : e
        );
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      }
    }
  }

  async syncPendingEntries(userId: string): Promise<{ synced: number; failed: number }> {
    const result = { synced: 0, failed: 0 };
    const pending = await this.getUnsyncedEntries(userId);
    if (pending.length === 0) return result;

    // Dinamik batch boyutu
    const BATCH_SIZE = Math.max(1, batchOptimizer.calculate(pending.length, 'normal'));
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      try {
        // Use standardized batch processing with supabaseService.saveMoodEntry
        let batchError = null;
        for (const entry of batch) {
          try {
            await supabaseService.saveMoodEntry({
              user_id: entry.user_id,
              mood_score: entry.mood_score,
              energy_level: entry.energy_level,
              anxiety_level: entry.anxiety_level,
              notes: entry.notes,
              trigger: entry.triggers?.[0] || '', // Convert first trigger to string
            });
          } catch (e) {
            batchError = e;
            break; // Stop on first error to maintain original batch behavior
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
      if (existing) localEntries.push(...JSON.parse(existing));
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
          notes: d.notes,
          triggers: d.triggers || [],  // Ensure array
          activities: d.activities || [], // Ensure array
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
}

export const moodTracker = MoodTrackingService.getInstance();
export default moodTracker;


