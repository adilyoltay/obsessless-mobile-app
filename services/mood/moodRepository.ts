import AsyncStorage from '@react-native-async-storage/async-storage';
import optimizedStorage from '@/services/optimizedStorage';
import type { MoodEntry } from '@/services/moodTrackingService';
import { encryptionAdapter } from '@/services/mood/encryptionAdapter';

// Storage schema used by moodTrackingService
interface EncryptedMoodStorage {
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
    local_id?: string;
    remote_id?: string;
    content_hash?: string;
  };
  encryptedData: {
    encrypted: string;
    iv: string;
    algorithm: string;
    version: number;
    hash: string;
    timestamp: number;
  };
  storageVersion: number;
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const moodRepository = {
  async save(entry: MoodEntry): Promise<void> {
    const key = `mood_entries_${entry.user_id}_${localDateKey(new Date(entry.timestamp))}`;
    const sensitive = {
      notes: entry.notes || '',
      triggers: entry.triggers || [],
      activities: entry.activities || [],
    };
    const encryptedData = await encryptionAdapter.encryptSensitiveData(sensitive);
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
        local_id: entry.local_id,
        remote_id: entry.remote_id,
        content_hash: entry.content_hash,
      },
      encryptedData,
      storageVersion: 2,
    };
    const existing = await optimizedStorage.getOptimized<EncryptedMoodStorage[]>(key) || [];
    existing.push(encryptedEntry);
    await optimizedStorage.setOptimized(key, existing, true);
  },

  async update(entry: MoodEntry): Promise<void> {
    const key = `mood_entries_${entry.user_id}_${localDateKey(new Date(entry.timestamp))}`;
    const existing = await optimizedStorage.getOptimized<EncryptedMoodStorage[]>(key) || [];
    const sensitive = {
      notes: entry.notes || '',
      triggers: entry.triggers || [],
      activities: entry.activities || [],
    };
    const encryptedData = await encryptionAdapter.encryptSensitiveData(sensitive);

    let updated = false;
    for (let i = 0; i < existing.length; i++) {
      const md = existing[i].metadata || (existing[i] as any);
      const matches = md.id === entry.id || (md.local_id && md.local_id === entry.local_id) || (md.remote_id && md.remote_id === entry.remote_id);
      if (matches) {
        existing[i] = {
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
            local_id: entry.local_id,
            remote_id: entry.remote_id,
            content_hash: entry.content_hash,
          },
          encryptedData,
          storageVersion: 2,
        } as EncryptedMoodStorage;
        updated = true;
        break;
      }
    }
    if (!updated) existing.push({ metadata: { id: entry.id, user_id: entry.user_id, mood_score: entry.mood_score, energy_level: entry.energy_level, anxiety_level: entry.anxiety_level, timestamp: entry.timestamp, synced: entry.synced, sync_attempts: entry.sync_attempts, last_sync_attempt: entry.last_sync_attempt, local_id: entry.local_id, remote_id: entry.remote_id, content_hash: entry.content_hash }, encryptedData, storageVersion: 2 });
    await optimizedStorage.setOptimized(key, existing, true);
  },

  async markSynced(id: string, userId: string): Promise<void> {
    // Keep simple; moodTrackingService already iterates across recent keys.
    // We retain that logic there in this phase to avoid behavior changes.
    const dates = await getRecentDates(7);
    for (const date of dates) {
      const key = `mood_entries_${userId}_${date}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const entries: EncryptedMoodStorage[] = JSON.parse(raw);
        let updated = false;
        const updatedEntries = entries.map(e => {
          const entryId = e.storageVersion === 2 ? e.metadata.id : (e as any).id;
          if (entryId === id) {
            updated = true;
            if (e.storageVersion === 2) {
              return { ...e, metadata: { ...e.metadata, synced: true, last_sync_attempt: new Date().toISOString() } };
            }
            return { ...(e as any), synced: true, last_sync_attempt: new Date().toISOString() } as any;
          }
          return e;
        });
        if (updated) await AsyncStorage.setItem(key, JSON.stringify(updatedEntries));
      } catch {}
    }
  },

  async getUnsyncedEntries(userId: string, days: number = 30): Promise<MoodEntry[]> {
    const results: MoodEntry[] = [];
    const dates = await getRecentDates(days);
    for (const date of dates) {
      const key = `mood_entries_${userId}_${date}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const arr: any[] = JSON.parse(raw);
        if (!Array.isArray(arr) || arr.length === 0) continue;
        // Encrypted v2 format
        if (arr[0].storageVersion === 2) {
          const { decryptMoodEntry } = await import('@/services/mood/moodMigration');
          for (const rec of arr) {
            const dec = await decryptMoodEntry(rec);
            if (dec && !dec.synced && ((dec.sync_attempts || 0) < 5)) results.push(dec);
          }
        } else {
          // Legacy plain format
          for (const rec of arr) {
            if (rec && !rec.synced && ((rec.sync_attempts || 0) < 5)) results.push(rec as MoodEntry);
          }
        }
      } catch {}
    }
    return results;
  },
};

async function getRecentDates(days: number): Promise<string[]> {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(localDateKey(d));
  }
  return dates;
}
