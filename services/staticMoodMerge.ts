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

  // Local entries'den remote'da olmayan ve duplicate olmayan'ları ekle
  for (const localEntry of localEntries) {
    // ID check (exact match)
    if (remoteIds.has(localEntry.id)) {
      continue; // Remote'da var, skip
    }

    // Content hash check (duplicate content)
    if (localEntry.content_hash && remoteHashes.has(localEntry.content_hash)) {
      stats.duplicatesRemoved++;
      continue; // Duplicate content, skip
    }

    // Bu local entry benzersiz, ekle
    mergedEntries.push(localEntry);
  }

  stats.mergedCount = mergedEntries.length;

  // Timestamp'a göre sırala (en yeni en başta)
  mergedEntries.sort((a, b) => {
    const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
    const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  console.log(`✅ Static merge complete:`, stats);

  return {
    mergedEntries,
    conflicts: [], // Static merge'de conflict yok, remote wins
    stats
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
