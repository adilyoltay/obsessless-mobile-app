import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DeadLetterItem<T = any> {
  id: string;
  type: string;
  entity: string;
  data: T;
  failedAt: string;
  errorMessage: string;
  errorCode?: string | number;
  canRetry: boolean;
  archived: boolean;
  retryCount?: number;
}

class DeadLetterQueueService {
  private static instance: DeadLetterQueueService;
  private readonly STORAGE_KEY = 'dead_letter_queue';
  private readonly MAX_ARCHIVE_DAYS = 30;

  static getInstance(): DeadLetterQueueService {
    if (!DeadLetterQueueService.instance) {
      DeadLetterQueueService.instance = new DeadLetterQueueService();
    }
    return DeadLetterQueueService.instance;
  }

  async addToDeadLetter(item: Omit<DeadLetterItem, 'failedAt' | 'archived' | 'canRetry'>, error?: any): Promise<void> {
    const queue = await this.getQueue();
    const record: DeadLetterItem = {
      ...item,
      failedAt: new Date().toISOString(),
      errorMessage: error?.message || item.errorMessage || 'Unknown error',
      errorCode: error?.code ?? error?.status,
      canRetry: this.isRetryable(error),
      archived: false,
    } as DeadLetterItem;
    queue.push(record);
    await this.saveQueue(queue);
  }

  async retryDeadLetterItem(itemId: string, requeue: (data: any) => Promise<void>): Promise<boolean> {
    const queue = await this.getQueue();
    const found = queue.find(i => i.id === itemId);
    if (!found || !found.canRetry || found.archived) return false;
    try {
      await requeue(found.data);
      await this.removeFromQueue(itemId);
      return true;
    } catch {
      return false;
    }
  }

  async list(limit: number = 50): Promise<DeadLetterItem[]> {
    const queue = await this.getQueue();
    return queue.slice(-limit).reverse();
  }

  async archiveOldItems(): Promise<number> {
    const queue = await this.getQueue();
    const cutoff = new Date(Date.now() - this.MAX_ARCHIVE_DAYS * 86400000);
    let archived = 0;
    const updated = queue.map(item => {
      if (!item.archived && new Date(item.failedAt) < cutoff) {
        archived++;
        return { ...item, archived: true };
      }
      return item;
    });
    await this.saveQueue(updated);
    return archived;
  }

  async processDeadLetterQueue(): Promise<{ retried: number; archived: number }> {
    let retried = 0;
    let archived = 0;
    const items = await this.getQueue();
    
    // ✅ F-01 FIX: Define supported entities to match offlineSync
    const SUPPORTED_ENTITIES = new Set([
      'achievement', 'mood_entry', 'ai_profile', 'treatment_plan', 'voice_checkin'
    ]);
    const SUPPORTED_OPERATIONS = new Set(['CREATE', 'UPDATE', 'DELETE']);
    
    // Network-aware: skip if offline
    try {
      const NetInfo = require('@react-native-community/netinfo').default;
      const state = await NetInfo.fetch();
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      if (offline) return { retried: 0, archived: archived + (await this.archiveOldItems()) };
    } catch {}
    
    for (const item of items) {
      if (item.archived) continue;
      
      // ✅ F-01 FIX: Archive unsupported entities immediately
      if (!SUPPORTED_OPERATIONS.has(item.type as any) || !SUPPORTED_ENTITIES.has(item.entity as any)) {
        // Mark as archived instead of retrying
        item.archived = true;
        archived++;
        console.warn('🗄️ Archived unsupported DLQ item:', { entity: item.entity, type: item.type });
        continue;
      }
      
      if (item.canRetry && (item.retryCount || 0) < 5) {
        try {
          // Exponential backoff with jitter by retryCount
          const attempt = (item.retryCount || 0) + 1;
          const base = 2000; // 2 seconds
          const delay = Math.min(base * Math.pow(2, attempt), 60000) + Math.floor(Math.random() * 500);
          await new Promise(res => setTimeout(res, delay));

          const { offlineSyncService } = await import('@/services/offlineSync');
          await offlineSyncService.addToSyncQueue({ type: item.type as any, entity: item.entity as any, data: item.data });
          await this.removeFromQueue(item.id);
          retried++;
        } catch {}
      }
    }
    
    // Save updated queue with archived items
    if (archived > 0) {
      await this.saveQueue(items);
    }
    
    archived += await this.archiveOldItems();
    return { retried, archived };
  }

  async getStatistics(): Promise<{
    total: number;
    retryable: number;
    archived: number;
    byEntity: Record<string, number>;
    byError: Record<string, number>;
  }> {
    const queue = await this.getQueue();
    const stats = {
      total: queue.length,
      retryable: queue.filter(i => i.canRetry && !i.archived).length,
      archived: queue.filter(i => i.archived).length,
      byEntity: {} as Record<string, number>,
      byError: {} as Record<string, number>,
    };
    queue.forEach(i => {
      stats.byEntity[i.entity] = (stats.byEntity[i.entity] || 0) + 1;
      const err = (i.errorCode ?? 'unknown').toString();
      stats.byError[err] = (stats.byError[err] || 0) + 1;
    });
    return stats;
  }

  private isRetryable(error: any): boolean {
    if (!error) return false;
    if (error?.code === 'NETWORK_ERROR') return true;
    if (error?.code === 'TIMEOUT') return true;
    if (error?.status === 429) return true;
    if (error?.status >= 500 && error?.status < 600) return true;
    if (error?.status === 401 || error?.status === 403) return false;
    if (error?.status === 400) return false;
    return false;
  }

  private async getQueue(): Promise<DeadLetterItem[]> {
    try {
      const raw = await AsyncStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private async saveQueue(queue: DeadLetterItem[]): Promise<void> {
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
  }

  private async removeFromQueue(itemId: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(i => i.id !== itemId);
    await this.saveQueue(filtered);
  }
}

export const deadLetterQueue = DeadLetterQueueService.getInstance();
export default deadLetterQueue;


