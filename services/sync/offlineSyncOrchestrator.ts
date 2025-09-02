import type { SyncQueueItem } from '@/services/offlineSync';
import { networkMonitor, NetworkMonitor } from '@/services/sync/networkMonitor';
import { queueRepository } from '@/services/sync/queueRepository';
import { syncMaintenance } from '@/services/sync/syncMaintenance';

/**
 * OfflineSyncOrchestrator (scaffold)
 * Coordinates network status, queue persistence, and maintenance tasks.
 * Phase 1: introduced but not yet wired as the main driver to keep risk low.
 */
export class OfflineSyncOrchestrator {
  constructor(
    private net: NetworkMonitor = networkMonitor
  ) {}

  start() {
    this.net.start();
  }

  isOnline(): boolean {
    return this.net.getStatus();
  }

  async loadQueue(): Promise<SyncQueueItem[]> {
    return queueRepository.load<SyncQueueItem>();
  }

  async saveQueue(queue: SyncQueueItem[]): Promise<boolean> {
    return queueRepository.save<SyncQueueItem>(queue);
  }

  cleanupStale(queue: SyncQueueItem[], maxAgeInDays: number) {
    return syncMaintenance.cleanupStaleItems(queue, maxAgeInDays);
  }

  getHealth(queue: SyncQueueItem[]) {
    return syncMaintenance.getQueueHealthMetrics(queue);
  }

  /**
   * Run items with limited concurrency and optional key-based exclusivity (e.g., user_id).
   * The provided worker is responsible for success/failure handling.
   */
  async run<T extends { id: string }>(
    items: T[],
    worker: (item: T) => Promise<void>,
    opts?: {
      concurrency?: number;
      deriveKey?: (item: T) => string | null;
      hooks?: {
        onStart?: (item: T) => void | Promise<void>;
        onSuccess?: (item: T, latencyMs: number) => void | Promise<void>;
        onError?: (item: T, error: unknown, latencyMs: number) => void | Promise<void>;
      };
    }
  ): Promise<void> {
    if (!items.length) return;
    const concurrency = Math.max(1, Math.min(opts?.concurrency || 2, items.length));
    const inflightKeys = new Set<string>();
    const consumed = new Set<string>();
    const deriveKey = opts?.deriveKey || (() => null);

    const pick = (): T | undefined => {
      for (let i = 0; i < items.length; i++) {
        const cand = items[i];
        if (consumed.has(cand.id)) continue;
        const key = deriveKey(cand);
        if (key && inflightKeys.has(key)) continue;
        return cand;
      }
      return undefined;
    };

    const runWorker = async (): Promise<void> => {
      while (true) {
        const current = pick();
        if (!current) break;
        const key = deriveKey(current);
        if (key) inflightKeys.add(key);
        consumed.add(current.id);
        try {
          if (opts?.hooks?.onStart) await opts.hooks.onStart(current);
          const startedAt = Date.now();
          await worker(current);
          const latency = Date.now() - startedAt;
          if (opts?.hooks?.onSuccess) await opts.hooks.onSuccess(current, latency);
        } finally {
          if (key) inflightKeys.delete(key);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  }
}

export const offlineSyncOrchestrator = new OfflineSyncOrchestrator();

// Factory: standardize error recording for offline sync items
export function createOfflineErrorHook(options: {
  recordUserFeedback: (args: { id: string; entity: string; type: string; message: string; retryCount: number; maxRetries: number; }) => Promise<void>;
  markIdempotencyFailed?: (localEntryId: string) => Promise<void>;
}) {
  return async function onError(current: any, error: unknown, _latencyMs: number) {
    try {
      // Mood idempotency fail mark (if available)
      const localId = current?.data?.local_entry_id;
      if (options.markIdempotencyFailed && current?.entity === 'mood_entry' && localId) {
        try { await options.markIdempotencyFailed(localId); } catch {}
      }
      // Record user feedback (non-blocking)
      const retryCount = typeof current?.retryCount === 'number' ? current.retryCount : 0;
      await options.recordUserFeedback({
        id: String(current?.id || ''),
        entity: String(current?.entity || ''),
        type: String(current?.type || ''),
        message: error instanceof Error ? error.message : String(error),
        retryCount,
        maxRetries: 8
      });
    } catch {}
  };
}

// Factory: move item to DLQ (Dead Letter Queue)
export function createDLQHandler() {
  return async function moveToDLQ(current: any, errorMessage: string) {
    try {
      const { default: deadLetterQueue } = await import('@/services/sync/deadLetterQueue');
      await deadLetterQueue.addToDeadLetter({
        id: current.id,
        type: current.type,
        entity: current.entity,
        data: current.data,
        errorMessage
      });
    } catch (e) {
      // Swallow DLQ errors to avoid infinite loops
      console.warn('DLQ handler failed:', e);
    }
  };
}
