import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import batchOptimizer from '@/services/sync/batchOptimizer';

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

    // best-effort sync to server (if schema/table exists in current project)
    try {
      await (supabaseService as any).supabaseClient
        .from('mood_tracking')
        .upsert({
          id: moodEntry.id,
          user_id: moodEntry.user_id,
          mood_score: moodEntry.mood_score,
          energy_level: moodEntry.energy_level,
          anxiety_level: moodEntry.anxiety_level,
          notes: moodEntry.notes,
          triggers: moodEntry.triggers,
          activities: moodEntry.activities,
          created_at: moodEntry.timestamp,
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
        const { error } = await (supabaseService as any).supabaseClient
          .from('mood_tracking')
          .upsert(
            batch.map(e => ({
              id: e.id,
              user_id: e.user_id,
              mood_score: e.mood_score,
              energy_level: e.energy_level,
              anxiety_level: e.anxiety_level,
              notes: e.notes,
              triggers: e.triggers,
              activities: e.activities,
              created_at: e.timestamp,
            }))
          );
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

  // Cross-device: fetch recent remote entries and merge with local
  async getMoodEntries(userId: string, days: number = 7): Promise<MoodEntry[]> {
    const entries: MoodEntry[] = [];
    const dates = await this.getRecentDates(days);
    for (const date of dates) {
      const key = `${this.STORAGE_KEY}_${userId}_${date}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) entries.push(...JSON.parse(existing));
    }
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await (supabaseService as any).supabaseClient
        .from('mood_tracking')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (!error && data) {
        const remoteEntries: MoodEntry[] = data.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          mood_score: d.mood_score,
          energy_level: d.energy_level,
          anxiety_level: d.anxiety_level,
          notes: d.notes,
          triggers: d.triggers,
          activities: d.activities,
          timestamp: d.created_at,
          synced: true,
          sync_attempts: 0,
        }));
        const merged = new Map<string, MoodEntry>();
        [...entries, ...remoteEntries].forEach((e) => {
          const existing = merged.get(e.id);
          if (!existing) merged.set(e.id, e);
          else if (!existing.synced && e.synced) merged.set(e.id, e);
          else if (new Date(e.timestamp).getTime() > new Date(existing.timestamp).getTime()) merged.set(e.id, e);
        });
        return Array.from(merged.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    } catch {}
    return entries;
  }
}

export const moodTracker = MoodTrackingService.getInstance();
export default moodTracker;


