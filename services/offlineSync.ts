
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { apiService } from './api';

export interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'compulsion' | 'erp_session' | 'achievement';
  data: any;
  timestamp: number;
  retryCount: number;
  // Optional vector clock fields for future multi-device resolution
  // version?: number;
  // deviceId?: string;
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
      const queueKey = currentUserId ? `syncQueue_${currentUserId}` : 'syncQueue_anon';
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
      const queueKey = currentUserId ? `syncQueue_${currentUserId}` : 'syncQueue_anon';
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
      const itemsToSync = [...this.syncQueue];
      
      for (let i = 0; i < itemsToSync.length; i++) {
        const item = itemsToSync[i];
        
        try {
          await this.syncItem(item);
          
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
            }
          }
        }
      }

      await this.saveSyncQueue();
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
    switch (item.type) {
      case 'CREATE':
        await apiService.compulsions.create(item.data);
        break;
      case 'UPDATE':
        await apiService.compulsions.update(item.data.id, item.data);
        break;
      case 'DELETE':
        await apiService.compulsions.delete(item.data.id);
        break;
    }
  }

  private async syncERPSession(item: SyncQueueItem): Promise<void> {
    switch (item.type) {
      case 'CREATE':
        await apiService.erp.createExercise(item.data);
        break;
      case 'UPDATE':
        await apiService.erp.completeSession(item.data.id, item.data);
        break;
      // ERP sessions typically aren't deleted
    }
  }

  // user_progress kaldırıldı – progress senkronizasyonu AI profiline taşındı (gerektiğinde ayrı servis kullanılacak)

  private async syncAchievement(item: SyncQueueItem): Promise<void> {
    // Sync achievement unlocks
    // This would typically be a separate endpoint
    console.log('Syncing achievement:', item.data);
  }

  private async handleFailedSync(item: SyncQueueItem): Promise<void> {
    // Log failed sync or show user notification
    console.error('Failed to sync item after max retries:', item);
    
    // Could store in a separate failed items queue for manual retry
    const currentUserId = await AsyncStorage.getItem('currentUserId');
    const failedKey = currentUserId ? `failedSyncItems_${currentUserId}` : 'failedSyncItems_anon';
    const failedItems = await AsyncStorage.getItem(failedKey);
    const failed = failedItems ? JSON.parse(failedItems) : [];
    failed.push(item);
    await AsyncStorage.setItem(failedKey, JSON.stringify(failed));
  }

  // Local storage methods for offline operations
  async storeCompulsionLocally(compulsion: any): Promise<void> {
    try {
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const localKey = currentUserId ? `localCompulsions_${currentUserId}` : 'localCompulsions_anon';
      const stored = await AsyncStorage.getItem(localKey);
      const compulsions = stored ? JSON.parse(stored) : [];
      
      const nowIso = new Date().toISOString();
      const normalized = {
        ...compulsion,
        localId: compulsion.localId || `local_${Date.now()}`,
        synced: false,
        createdAt: compulsion.createdAt || nowIso,
        updatedAt: nowIso,
      };
      
      compulsions.push(normalized);
      
      await AsyncStorage.setItem(localKey, JSON.stringify(compulsions));
      
      // Add to sync queue
      await this.addToSyncQueue({
        type: 'CREATE',
        entity: 'compulsion',
        data: normalized,
      });
    } catch (error) {
      console.error('Error storing compulsion locally:', error);
    }
  }

  async getLocalCompulsions(): Promise<any[]> {
    try {
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const localKey = currentUserId ? `localCompulsions_${currentUserId}` : 'localCompulsions_anon';
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
      const localKey = currentUserId ? `localERPSessions_${currentUserId}` : 'localERPSessions_anon';
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
      const localKey = currentUserId ? `localERPSessions_${currentUserId}` : 'localERPSessions_anon';
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
}

export const offlineSyncService = OfflineSyncService.getInstance();
