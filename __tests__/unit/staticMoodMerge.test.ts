/**
 * Static Mood Merge - Unit Tests
 * Tests deduplication logic and deletion cache integration
 */

import { intelligentMoodMerge } from '@/services/staticMoodMerge';
import { moodDeletionCache } from '@/services/moodDeletionCache';
import type { MoodEntry } from '@/services/moodTrackingService';

// Mock deletion cache
jest.mock('@/services/moodDeletionCache');

describe('Static Mood Merge - P0 Deduplication Fixes', () => {
  const mockUserId = 'test-user-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
    (moodDeletionCache.getRecentlyDeletedIds as jest.Mock).mockResolvedValue([]);
  });

  describe('Content Hash Deduplication', () => {
    it('should deduplicate entries with same content_hash', async () => {
      const localEntry: MoodEntry = {
        id: 'mood_local_123',
        local_id: 'mood_local_123',
        content_hash: 'abc123hash',
        user_id: mockUserId,
        mood_score: 75,
        energy_level: 80,
        anxiety_level: 30,
        notes: 'Test entry',
        triggers: [],
        activities: [],
        timestamp: '2025-08-30T12:00:00Z',
        synced: false,
        sync_attempts: 0
      };

      const remoteEntry: MoodEntry = {
        id: 'uuid-remote-456',
        remote_id: 'uuid-remote-456',
        content_hash: 'abc123hash', // Same content hash!
        user_id: mockUserId,
        mood_score: 75,
        energy_level: 80,
        anxiety_level: 30,
        notes: 'Test entry',
        triggers: [],
        activities: [],
        timestamp: '2025-08-30T12:00:00Z',
        synced: true,
        sync_attempts: 0
      };

      const result = await intelligentMoodMerge([localEntry], [remoteEntry], mockUserId);

      expect(result.mergedEntries).toHaveLength(1);
      expect(result.mergedEntries[0].id).toBe('uuid-remote-456'); // Remote wins
      expect(result.stats.duplicatesRemoved).toBe(1);
    });

    it('should deduplicate by remote_id mapping', async () => {
      const localEntry: MoodEntry = {
        id: 'mood_local_123',
        local_id: 'mood_local_123',
        remote_id: 'uuid-shared-789', // Mapped to remote!
        user_id: mockUserId,
        mood_score: 75,
        energy_level: 80,
        anxiety_level: 30,
        notes: 'Test entry',
        triggers: [],
        activities: [],
        timestamp: '2025-08-30T12:00:00Z',
        synced: true,
        sync_attempts: 0
      };

      const remoteEntry: MoodEntry = {
        id: 'uuid-shared-789', // Same as local's remote_id
        remote_id: 'uuid-shared-789',
        user_id: mockUserId,
        mood_score: 75,
        energy_level: 80,
        anxiety_level: 30,
        notes: 'Test entry',
        triggers: [],
        activities: [],
        timestamp: '2025-08-30T12:00:00Z',
        synced: true,
        sync_attempts: 0
      };

      const result = await intelligentMoodMerge([localEntry], [remoteEntry], mockUserId);

      expect(result.mergedEntries).toHaveLength(1);
      expect(result.mergedEntries[0].id).toBe('uuid-shared-789');
      expect(result.stats.duplicatesRemoved).toBe(0); // Skipped via mapping, not duplicate removal
    });
  });

  describe('Deletion Cache Integration', () => {
    it('should filter out recently deleted entries', async () => {
      const deletedId = 'deleted-entry-123';
      (moodDeletionCache.getRecentlyDeletedIds as jest.Mock).mockResolvedValue([deletedId]);

      const localEntry: MoodEntry = {
        id: deletedId, // This was recently deleted
        user_id: mockUserId,
        mood_score: 50,
        energy_level: 50,
        anxiety_level: 50,
        notes: 'Should be filtered',
        triggers: [],
        activities: [],
        timestamp: '2025-08-30T12:00:00Z',
        synced: false,
        sync_attempts: 0
      };

      const remoteEntry: MoodEntry = {
        id: deletedId, // Same deleted ID
        user_id: mockUserId,
        mood_score: 50,
        energy_level: 50,
        anxiety_level: 50,
        notes: 'Should be filtered',
        triggers: [],
        activities: [],
        timestamp: '2025-08-30T12:00:00Z',
        synced: true,
        sync_attempts: 0
      };

      const result = await intelligentMoodMerge([localEntry], [remoteEntry], mockUserId);

      expect(result.mergedEntries).toHaveLength(0); // Both filtered out
      expect(moodDeletionCache.getRecentlyDeletedIds).toHaveBeenCalledWith(mockUserId);
    });

    it('should filter by local_id and remote_id mappings in deletion cache', async () => {
      const deletedLocalId = 'mood_deleted_456';
      (moodDeletionCache.getRecentlyDeletedIds as jest.Mock).mockResolvedValue([deletedLocalId]);

      const localEntry: MoodEntry = {
        id: 'some-other-id',
        local_id: deletedLocalId, // This local_id was deleted
        user_id: mockUserId,
        mood_score: 60,
        energy_level: 60,
        anxiety_level: 40,
        notes: 'Should be filtered by local_id',
        triggers: [],
        activities: [],
        timestamp: '2025-08-30T12:00:00Z',
        synced: false,
        sync_attempts: 0
      };

      const result = await intelligentMoodMerge([localEntry], [], mockUserId);

      expect(result.mergedEntries).toHaveLength(0); // Filtered by local_id match
    });
  });

  describe('Edge Cases', () => {
    it('should handle entries without content_hash gracefully', async () => {
      const entryWithoutHash: MoodEntry = {
        id: 'no-hash-entry',
        user_id: mockUserId,
        mood_score: 70,
        energy_level: 70,
        anxiety_level: 20,
        notes: 'No content hash',
        triggers: ['work'],
        activities: ['exercise'],
        timestamp: '2025-08-30T14:00:00Z',
        synced: false,
        sync_attempts: 0
        // content_hash missing
      };

      const result = await intelligentMoodMerge([entryWithoutHash], [], mockUserId);

      expect(result.mergedEntries).toHaveLength(1);
      expect(result.mergedEntries[0].id).toBe('no-hash-entry');
    });

    it('should handle missing userId gracefully', async () => {
      const entry: MoodEntry = {
        id: 'test-entry',
        user_id: mockUserId,
        mood_score: 80,
        energy_level: 75,
        anxiety_level: 25,
        notes: 'Test without userId',
        triggers: [],
        activities: [],
        timestamp: '2025-08-30T15:00:00Z',
        synced: false,
        sync_attempts: 0
      };

      const result = await intelligentMoodMerge([entry], [], undefined); // No userId

      expect(result.mergedEntries).toHaveLength(1);
      expect(moodDeletionCache.getRecentlyDeletedIds).not.toHaveBeenCalled();
    });
  });
});
