
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeStorageKey } from '@/lib/queryClient';
import NetInfo from '@react-native-community/netinfo';
import { apiService } from './api';
import conflictResolver, { DataConflict } from './conflictResolution';

export interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'compulsion' | 'erp_session' | 'achievement';
  data: any;
  timestamp: number;
  retryCount: number;
  deviceId?: string;
  lastModified?: number;
}

export class OfflineSyncService {
  private static instance: OfflineSyncService;
  private isOnline: boolean = true;
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing: boolean = false;

  public static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  constructor() {
    this.initializeNetworkListener();
    this.loadSyncQueue();
  }

  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline) {
        // Came back online, start syncing
        this.processSyncQueue();
      }
    });
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const queueKey = `syncQueue_${safeStorageKey(currentUserId as any)}`;
      const queueData = await AsyncStorage.getItem(queueKey);
      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const queueKey = `syncQueue_${safeStorageKey(currentUserId as any)}`;
      await AsyncStorage.setItem(queueKey, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const syncItem: SyncQueueItem = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      deviceId: await AsyncStorage.getItem('device_id') || 'unknown_device',
      lastModified: Date.now()
    };

    this.syncQueue.push(syncItem);
    await this.saveSyncQueue();

    // If online, try to sync immediately
    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  async processSyncQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      const summary = { successful: 0, failed: 0, conflicts: 0 };
      const itemsToSync = [...this.syncQueue];
      
      for (let i = 0; i < itemsToSync.length; i++) {
        const item = itemsToSync[i];
        
        try {
          await this.syncItem(item);
          summary.successful++;
          
          // Remove from queue if successful
          this.syncQueue = this.syncQueue.filter(queueItem => queueItem.id !== item.id);
        } catch (error) {
          console.error('Error syncing item:', error);
          
          // Increment retry count
          const queueItem = this.syncQueue.find(q => q.id === item.id);
          if (queueItem) {
            queueItem.retryCount++;
            
            // Exponential backoff with jitter
            const base = 2000; // 2s
            const delay = Math.min(base * Math.pow(2, queueItem.retryCount), 60000) + Math.floor(Math.random() * 500);
            await new Promise(res => setTimeout(res, delay));
            // Remove to dead-letter if max retries reached
            if (queueItem.retryCount >= 8) {
              this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
              await this.handleFailedSync(queueItem);
              summary.failed++;
            }
          }
        }
      }

      await this.saveSyncQueue();
      try {
        console.log('🧾 Sync summary:', summary);
        await AsyncStorage.setItem('last_sync_summary', JSON.stringify({ ...summary, at: new Date().toISOString() }));
      } catch {}
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    switch (item.entity) {
      case 'compulsion':
        await this.syncCompulsion(item);
        break;
      case 'erp_session':
        await this.syncERPSession(item);
        break;
      case 'achievement':
        await this.syncAchievement(item);
        break;
      default:
        throw new Error(`Unknown entity type: ${item.entity}`);
    }
  }

  private async syncCompulsion(item: SyncQueueItem): Promise<void> {
    // Fetch server state if applicable (best-effort)
    let remote: any = null;
    try {
      if (item.type !== 'CREATE' && item.data?.id) {
        const list = await apiService.compulsions.list({ id: item.data.id });
        remote = Array.isArray(list) ? list[0] : null;
      }
    } catch {}

    // Resolve conflicts
    const resolved = await conflictResolver.resolveConflict('compulsion', item.data, remote);

    switch (item.type) {
      case 'CREATE':
        await apiService.compulsions.create({ ...resolved, last_modified: item.lastModified, device_id: item.deviceId });
        break;
      case 'UPDATE':
        await apiService.compulsions.update(resolved.id, { ...resolved, last_modified: item.lastModified, device_id: item.deviceId });
        break;
      case 'DELETE':
        await apiService.compulsions.delete(item.data.id);
        break;
    }
  }

  private async syncERPSession(item: SyncQueueItem): Promise<void> {
    switch (item.type) {
      case 'CREATE': {
        await apiService.erp.createExercise(item.data);
        break;
      }
      case 'UPDATE': {
        // best-effort fetch + resolve
        let remote: any = null;
        try {
          const list = await apiService.erp.getExercises();
          remote = Array.isArray(list) ? list.find((x: any) => x.id === item.data.id) : null;
        } catch {}
        const resolved = await conflictResolver.resolveConflict('erp_session', item.data, remote);
        await apiService.erp.completeSession(resolved.id, resolved);
        break;
      }
      // ERP sessions typically aren't deleted
    }
  }

  // user_progress kaldırıldı – progress senkronizasyonu AI profiline taşındı (gerektiğinde ayrı servis kullanılacak)

  private async syncAchievement(item: SyncQueueItem): Promise<void> {
    // Sync achievement unlocks (best-effort)
    try {
      // no dedicated API in apiService; log for now
      console.log('Syncing achievement:', item.data);
    } catch (e) {
      console.warn('Achievement sync failed:', e);
    }
  }

  private async handleFailedSync(item: SyncQueueItem): Promise<void> {
    // Log failed sync or show user notification
    console.error('Failed to sync item after max retries:', item);
    
    // Could store in a separate failed items queue for manual retry
    const currentUserId = await AsyncStorage.getItem('currentUserId');
    const failedKey = `failedSyncItems_${safeStorageKey(currentUserId as any)}`;
    const failedItems = await AsyncStorage.getItem(failedKey);
    const failed = failedItems ? JSON.parse(failedItems) : [];
    failed.push(item);
    await AsyncStorage.setItem(failedKey, JSON.stringify(failed));
  }

  // Local storage methods for offline operations
  async storeCompulsionLocally(compulsion: any): Promise<void> {
    try {
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const localKey = `localCompulsions_${safeStorageKey(currentUserId as any)}`;
      const stored = await AsyncStorage.getItem(localKey);
      const compulsions = stored ? JSON.parse(stored) : [];
      
      compulsions.push({
        ...compulsion,
        localId: `local_${Date.now()}`,
        synced: false,
        createdAt: new Date().toISOString(),
      });
      
      await AsyncStorage.setItem(localKey, JSON.stringify(compulsions));
      
      // Add to sync queue
      await this.addToSyncQueue({
        type: 'CREATE',
        entity: 'compulsion',
        data: compulsion,
      });
    } catch (error) {
      console.error('Error storing compulsion locally:', error);
    }
  }

  async getLocalCompulsions(): Promise<any[]> {
    try {
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const localKey = `localCompulsions_${safeStorageKey(currentUserId as any)}`;
      const stored = await AsyncStorage.getItem(localKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting local compulsions:', error);
      return [];
    }
  }

  async storeERPSessionLocally(session: any): Promise<void> {
    try {
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const localKey = `localERPSessions_${safeStorageKey(currentUserId as any)}`;
      const stored = await AsyncStorage.getItem(localKey);
      const sessions = stored ? JSON.parse(stored) : [];
      
      sessions.push({
        ...session,
        localId: `local_${Date.now()}`,
        synced: false,
        createdAt: new Date().toISOString(),
      });
      
      await AsyncStorage.setItem(localKey, JSON.stringify(sessions));
      
      // Add to sync queue
      await this.addToSyncQueue({
        type: 'CREATE',
        entity: 'erp_session',
        data: session,
      });
    } catch (error) {
      console.error('Error storing ERP session locally:', error);
    }
  }

  async getLocalERPSessions(): Promise<any[]> {
    try {
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const localKey = `localERPSessions_${safeStorageKey(currentUserId as any)}`;
      const stored = await AsyncStorage.getItem(localKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting local ERP sessions:', error);
      return [];
    }
  }

  isOnlineMode(): boolean {
    return this.isOnline;
  }

  getSyncQueueLength(): number {
    return this.syncQueue.length;
  }

  async forceSyncNow(): Promise<boolean> {
    if (!this.isOnline) {
      return false;
    }

    await this.processSyncQueue();
    return this.syncQueue.length === 0;
  }

  async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveSyncQueue();
  }

  /**
   * Batch conflict-aware sync entrypoint
   */
  async syncWithConflictResolution(batchSize: number = 10): Promise<{ successful: number; failed: number; conflicts: number; }>{
    const result = { successful: 0, failed: 0, conflicts: 0 };
    if (!this.isOnline || this.syncQueue.length === 0) return result;
    const items = [...this.syncQueue];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const settled = await Promise.allSettled(batch.map((it) => this.syncItem(it)));
      settled.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          result.successful++;
          this.syncQueue = this.syncQueue.filter(q => q.id !== batch[idx].id);
        } else {
          result.failed++;
        }
      });
      await this.saveSyncQueue();
    }
    try { await AsyncStorage.setItem('last_sync_summary', JSON.stringify({ ...result, at: new Date().toISOString() })); } catch {}
    return result;
  }
}

export const offlineSyncService = OfflineSyncService.getInstance();
