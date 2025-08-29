/**
 * Static Mood Merge Service
 * 
 * AI tabanlı intelligentMoodMergeService yerine kullanılacak basit merge servisi.
 * Kurallar:
 * 1. Remote (Supabase) verisi her zaman local'a göre öncelikli
 * 2. Timestamp bazlı conflict resolution
 * 3. Duplicate detection content_hash ile
 */

import type { MoodEntry } from '@/services/moodTrackingService';

interface MergeResult {
  mergedEntries: MoodEntry[];
  conflicts: any[];
  stats: {
    localCount: number;
    remoteCount: number;
    mergedCount: number;
    duplicatesRemoved: number;
    conflictsResolved: number;
    syncSuccess: boolean; // For backward compatibility
  };
}

interface MergeService {
  intelligentMoodMerge(
    localEntries: MoodEntry[],
    remoteEntries: MoodEntry[],
    userId?: string
  ): Promise<MergeResult>;
  
  shouldMerge(...args: any[]): Promise<boolean>;
}

/**
 * Simple merge logic:
 * 1. Remote entries öncelikli (Supabase truth source)
 * 2. Local-only entries remote'a eklenir
 * 3. Duplicate detection content_hash ile
 * 4. Conflict durumunda remote wins
 */
async function intelligentMoodMerge(
  localEntries: MoodEntry[] = [],
  remoteEntries: MoodEntry[] = [],
  userId?: string
): Promise<MergeResult> {
  console.log(`🔄 Starting static mood merge for user: ${userId || 'unknown'}`);
  
  const stats = {
    localCount: localEntries.length,
    remoteCount: remoteEntries.length,
    mergedCount: 0,
    duplicatesRemoved: 0,
    conflictsResolved: 0
  };

  // Remote entries'i base olarak al (truth source)
  const mergedEntries = [...remoteEntries];
  const remoteIds = new Set(remoteEntries.map(entry => entry.id));
  const remoteHashes = new Set(remoteEntries.map(entry => entry.content_hash).filter(Boolean));

  // 🔍 ENHANCED DUPLICATE DETECTION: Build comprehensive ID and content maps
  const remoteContentHashes = new Set(remoteEntries.map(entry => entry.content_hash).filter(Boolean));
  const remoteLocalIds = new Set(remoteEntries.map(entry => entry.local_id).filter(Boolean));
  const remoteRemoteIds = new Set(remoteEntries.map(entry => entry.remote_id || entry.id).filter(Boolean));

  console.log(`🔍 Merge analysis: Remote has ${remoteIds.size} IDs, ${remoteContentHashes.size} content hashes, ${remoteLocalIds.size} local_ids`);

  // Local entries'den remote'da olmayan ve duplicate olmayan'ları ekle
  for (const localEntry of localEntries) {
    let shouldSkip = false;
    let skipReason = '';

    // 1. EXACT ID MATCH CHECK (original logic)
    if (remoteIds.has(localEntry.id)) {
      shouldSkip = true;
      skipReason = 'exact_id_match';
    }

    // 2. LOCAL_ID MAPPING CHECK (new - critical for mood_xxx ↔ UUID mapping)
    if (!shouldSkip && localEntry.local_id && remoteLocalIds.has(localEntry.local_id)) {
      shouldSkip = true; 
      skipReason = 'local_id_mapping';
    }

    // 3. REMOTE_ID MAPPING CHECK (new - for UUID entries)
    if (!shouldSkip && localEntry.remote_id && remoteIds.has(localEntry.remote_id)) {
      shouldSkip = true;
      skipReason = 'remote_id_mapping';  
    }

    // 4. CONTENT HASH CHECK (enhanced)
    if (!shouldSkip && localEntry.content_hash && remoteContentHashes.has(localEntry.content_hash)) {
      shouldSkip = true;
      skipReason = 'content_hash_duplicate';
      stats.duplicatesRemoved++;
    }

    // 5. FALLBACK CONTENT SIMILARITY CHECK (new - for entries without content_hash)
    if (!shouldSkip && !localEntry.content_hash) {
      // Generate temporary content hash for comparison
      const tempHash = generateTempContentHash(localEntry);
      if (remoteContentHashes.has(tempHash)) {
        shouldSkip = true;
        skipReason = 'content_similarity';
        stats.duplicatesRemoved++;
      }
    }

    if (shouldSkip) {
      console.log(`🔄 Skipping local entry ${localEntry.id}: ${skipReason}`);
      continue;
    }

    // Bu local entry benzersiz, ekle
    console.log(`➕ Adding unique local entry: ${localEntry.id}`);
    mergedEntries.push(localEntry);
  }

  // Helper function for content hash generation
  function generateTempContentHash(entry: MoodEntry): string {
    const contentText = `${entry.user_id}|${entry.mood_score}|${entry.energy_level}|${entry.anxiety_level}|${(entry.notes || '').trim().toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < contentText.length; i++) {
      const char = contentText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  stats.mergedCount = mergedEntries.length;
  
  // Add syncSuccess for backward compatibility
  const statsWithSync = {
    ...stats,
    syncSuccess: true // Static merge always succeeds
  };

  // Timestamp'a göre sırala (en yeni en başta)
  mergedEntries.sort((a, b) => {
    const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
    const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  console.log(`✅ Static merge complete:`, statsWithSync);

  return {
    mergedEntries,
    conflicts: [], // Static merge'de conflict yok, remote wins
    stats: statsWithSync
  };
}

/**
 * Her zaman merge'e izin ver (AI logic yok)
 */
async function shouldMerge(...args: any[]): Promise<boolean> {
  return true;
}

export const staticMoodMergeService: MergeService = {
  intelligentMoodMerge,
  shouldMerge
};

// Backward compatibility için export
export const intelligentMergeService = staticMoodMergeService;

export default staticMoodMergeService;
