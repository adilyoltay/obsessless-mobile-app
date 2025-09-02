import type { MoodEntry } from '@/services/moodTrackingService';
import { encryptionAdapter } from '@/services/mood/encryptionAdapter';
import { moodRepository } from '@/services/mood/moodRepository';

// Shared storage interface used by repository and service
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

export async function decryptMoodEntry(rawEntry: any): Promise<MoodEntry | null> {
  try {
    // v2 encrypted format
    if (rawEntry?.storageVersion === 2 && rawEntry.encryptedData && rawEntry.metadata) {
      const sensitiveData = await encryptionAdapter.decryptSensitiveData(rawEntry.encryptedData);
      return {
        ...rawEntry.metadata,
        notes: sensitiveData.notes || '',
        triggers: sensitiveData.triggers || [],
        activities: sensitiveData.activities || [],
        local_id: rawEntry.metadata.local_id,
        remote_id: rawEntry.metadata.remote_id,
        content_hash: rawEntry.metadata.content_hash,
      } as MoodEntry;
    }

    // v1 legacy plain format
    if (!rawEntry?.storageVersion || rawEntry.storageVersion === 1) {
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
      // Auto-migrate to encrypted format (best-effort)
      try { await moodRepository.save(moodEntry); } catch {}
      return moodEntry;
    }

    return null;
  } catch (err) {
    console.error('decryptMoodEntry failed:', err);
    throw err;
  }
}

export async function migrateEntryToEncrypted(entry: MoodEntry): Promise<void> {
  try {
    await moodRepository.save(entry);
  } catch (e) {
    // do not throw to avoid breaking read flows
  }
}

