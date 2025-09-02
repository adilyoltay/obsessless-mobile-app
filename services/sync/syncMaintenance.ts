import type { SyncQueueItem } from '@/services/offlineSync';

/**
 * SyncMaintenance: helper routines for queue hygiene and metrics
 */
export const syncMaintenance = {
  cleanupStaleItems(queue: SyncQueueItem[], maxAgeInDays: number = 7) {
    const staleThreshold = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);
    const initialCount = queue.length;
    const updated = queue.filter(item => item.timestamp > staleThreshold);
    const removedCount = initialCount - updated.length;
    return { updatedQueue: updated, removedCount };
  },

  getQueueHealthMetrics(queue: SyncQueueItem[]) {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    const totalItems = queue.length;
    const staleItems = queue.filter(item => item.timestamp < sevenDaysAgo).length;
    const retryItems = queue.filter(item => (item.retryCount || 0) > 0).length;
    const oldestItem = totalItems > 0 ? Math.min(...queue.map(item => item.timestamp)) : null;
    const averageRetryCount = totalItems > 0
      ? Math.round((queue.reduce((sum, it) => sum + (it.retryCount || 0), 0) / totalItems) * 100) / 100
      : 0;

    return { totalItems, staleItems, retryItems, oldestItem, averageRetryCount };
  }
};

