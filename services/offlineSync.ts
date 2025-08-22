
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeStorageKey } from '@/lib/queryClient';
import NetInfo from '@react-native-community/netinfo';
import { apiService } from './api';
import supabaseService from '@/services/supabase';
import { unifiedConflictResolver, UnifiedDataConflict, EntityType } from './unifiedConflictResolver';
import deadLetterQueue from '@/services/sync/deadLetterQueue';
import { syncCircuitBreaker } from '@/utils/circuitBreaker';
import batchOptimizer from '@/services/sync/batchOptimizer';

export interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'compulsion' | 'achievement' | 'mood_entry' | 'ai_profile' | 'treatment_plan' | 'voice_checkin' | 'thought_record' | 'erp_session';
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
      let currentUserId = await AsyncStorage.getItem('currentUserId');
      try {
        const { default: supabase } = await import('@/services/supabase');
        const uid = (supabase as any)?.getCurrentUser?.() || (supabase as any)?.currentUser || null;
        if (uid && typeof uid === 'object' && uid.id) currentUserId = uid.id;
      } catch {}
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
      let currentUserId = await AsyncStorage.getItem('currentUserId');
      try {
        const { default: supabase } = await import('@/services/supabase');
        const uid = (supabase as any)?.getCurrentUser?.() || (supabase as any)?.currentUser || null;
        if (uid && typeof uid === 'object' && uid.id) currentUserId = uid.id;
      } catch {}
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
      const batchSize = batchOptimizer.calculate(itemsToSync.length);
      const startBatchAt = Date.now();
      
      for (let i = 0; i < itemsToSync.length; i++) {
        const item = itemsToSync[i];
        
        try {
          await syncCircuitBreaker.execute(() => this.syncItem(item));
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
      batchOptimizer.record(batchSize, summary.failed === 0, Date.now() - startBatchAt);
      try {
        console.log('🧾 Sync summary:', summary);
        await AsyncStorage.setItem('last_sync_summary', JSON.stringify({ ...summary, at: new Date().toISOString() }));
        // Persist daily conflictRate for tracking charts
        try {
          const { default: performanceMetricsService } = await import('@/services/telemetry/performanceMetricsService');
          const total = summary.successful + summary.failed + summary.conflicts;
          const conflictRate = total > 0 ? summary.conflicts / total : 0;
          await performanceMetricsService.recordToday({ sync: { conflictRate } });
        } catch {}
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
      case 'ai_profile':
        await this.syncAIProfile(item);
        break;
      case 'treatment_plan':
        await this.syncTreatmentPlan(item);
        break;
      case 'achievement':
        await this.syncAchievement(item);
        break;
      case 'mood_entry':
        await this.syncMoodEntry(item);
        break;
      case 'voice_checkin':
        await this.syncVoiceCheckin(item);
        break;
      case 'thought_record':
        await this.syncThoughtRecord(item);
        break;
      default:
        throw new Error(`Unknown entity type: ${item.entity}`);
    }
  }

  private async syncCompulsion(item: SyncQueueItem): Promise<void> {
    // Fetch server state if applicable (best-effort) via Supabase
    let remote: any = null;
    try {
      if (item.type !== 'CREATE' && item.data?.id) {
        const { default: svc } = await import('@/services/supabase');
        const list = await (svc as any).getCompulsions(item.data.user_id);
        remote = Array.isArray(list) ? list.find((x: any) => x.id === item.data.id) : null;
      }
    } catch {}

          // Resolve conflicts using unified resolver
      const conflictResult = await unifiedConflictResolver.resolveConflict(
        'compulsion', 
        item.data, 
        remote, 
        item.data.user_id
      );
      const resolved = conflictResult.resultData;

    const { default: svc } = await import('@/services/supabase');
    switch (item.type) {
      case 'CREATE':
        await (svc as any).saveCompulsion(resolved);
        break;
      case 'UPDATE':
        await (svc as any).saveCompulsion(resolved);
        break;
      case 'DELETE':
        await (svc as any).deleteCompulsion(item.data.id);
        break;
    }
  }

  private async syncERPSession(item: SyncQueueItem): Promise<void> {
    const { default: svc } = await import('@/services/supabase');
    switch (item.type) {
      case 'CREATE': {
        await (svc as any).saveERPSession(item.data);
        break;
      }
      case 'UPDATE': {
        // Fetch + resolve
        let remote: any = null;
        try {
          remote = await (svc as any).getERPSession(item.data.id);
        } catch {}
        const conflictResult = await unifiedConflictResolver.resolveConflict(
          'erp_session', 
          item.data, 
          remote, 
          item.data.user_id
        );
        const resolved = conflictResult.resultData;
        await (svc as any).saveERPSession(resolved);
        break;
      }
      // ERP sessions typically aren't deleted
    }
  }

  private async syncAIProfile(item: SyncQueueItem): Promise<void> {
    const { default: svc } = await import('@/services/supabase');
    const d = item.data || {};
    await (svc as any).upsertAIProfile(d.user_id, d.profile_data, !!d.onboarding_completed);
  }

  private async syncTreatmentPlan(item: SyncQueueItem): Promise<void> {
    const { default: svc } = await import('@/services/supabase');
    const d = item.data || {};
    await (svc as any).upsertAITreatmentPlan(d.user_id, d.plan_data, d.status || 'active');
  }

  // user_progress kaldırıldı – progress senkronizasyonu AI profiline taşındı (gerektiğinde ayrı servis kullanılacak)

  private async syncAchievement(item: SyncQueueItem): Promise<void> {
    // Sync achievements to Supabase
    try {
      const { default: svc } = await import('@/services/supabase');
      const d = item.data || {};
      switch (item.type) {
        case 'CREATE': {
          const { error } = await (svc as any).supabaseClient
            .from('user_achievements')
            .upsert({
              user_id: d.user_id,
              achievement_id: d.achievement_id,
              unlocked_at: d.unlocked_at || new Date().toISOString(),
              progress: d.progress ?? 100,
              metadata: d.metadata || {},
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,achievement_id' });
          if (error) throw error;
          break;
        }
        case 'UPDATE': {
          const { error } = await (svc as any).supabaseClient
            .from('user_achievements')
            .update({
              progress: d.progress,
              metadata: d.metadata,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', d.user_id)
            .eq('achievement_id', d.achievement_id);
          if (error) throw error;
          break;
        }
      }
    } catch (e) {
      console.warn('Achievement sync failed:', e);
      throw e;
    }
  }

  private async syncMoodEntry(item: SyncQueueItem): Promise<void> {
    // Normalize payload and save to the new canonical table: mood_entries
    const raw = item.data || {};
    const { default: svc } = await import('@/services/supabase');

    // Fallback user id acquisition
    let userId = raw.user_id || raw.userId;
    try {
      const uid = (svc as any)?.getCurrentUser?.() || (svc as any)?.currentUser || null;
      if (!userId && uid && typeof uid === 'object' && uid.id) userId = uid.id;
    } catch {}

    const entry = {
      user_id: userId,
      mood_score: raw.mood_score ?? raw.mood ?? 50,
      energy_level: raw.energy_level ?? raw.energy ?? 5,
      anxiety_level: raw.anxiety_level ?? raw.anxiety ?? 5,
      notes: raw.notes || '',
      trigger: raw.trigger || '',
    };

    await (svc as any).saveMoodEntry(entry);
  }

  private async syncVoiceCheckin(item: SyncQueueItem): Promise<void> {
    const { default: svc } = await import('@/services/supabase');
    switch (item.type) {
      case 'CREATE':
      case 'UPDATE':
        await (svc as any).saveVoiceCheckin(item.data);
        break;
      case 'DELETE':
        // Voice checkins typically aren't deleted
        console.log('Voice checkin deletion not implemented');
        break;
    }
  }

  private async syncThoughtRecord(item: SyncQueueItem): Promise<void> {
    const { default: svc } = await import('@/services/supabase');
    switch (item.type) {
      case 'CREATE':
      case 'UPDATE':
        // Check if it's a CBT record or regular thought record
        if (item.data.thought && item.data.distortions) {
          // CBT record format
          await (svc as any).saveCBTRecord(item.data);
        } else if (item.data.automatic_thought) {
          // Regular thought record
          await (svc as any).saveThoughtRecord(item.data);
        } else {
          console.warn('Unknown thought record format:', item.data);
        }
        break;
      case 'DELETE':
        // Thought records typically aren't deleted
        console.log('Thought record deletion not implemented');
        break;
    }
  }

  private async handleFailedSync(item: SyncQueueItem): Promise<void> {
    console.error('Failed to sync item after max retries:', item);
    try {
      await deadLetterQueue.addToDeadLetter({
        id: item.id,
        type: item.type,
        entity: item.entity,
        data: item.data,
        errorMessage: 'Max retries exceeded',
      });
    } catch (e) {
      // Fallback: persist minimal info
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const failedKey = `failedSyncItems_${safeStorageKey(currentUserId as any)}`;
      const failedItems = await AsyncStorage.getItem(failedKey);
      const failed = failedItems ? JSON.parse(failedItems) : [];
      failed.push(item);
      await AsyncStorage.setItem(failedKey, JSON.stringify(failed));
    }
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
