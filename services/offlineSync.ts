
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeStorageKey } from '@/lib/queryClient';
import NetInfo from '@react-native-community/netinfo';
import { apiService } from './api';
import supabaseService from '@/services/supabase';
import { unifiedConflictResolver, UnifiedDataConflict, EntityType } from './unifiedConflictResolver';
import deadLetterQueue from '@/services/sync/deadLetterQueue';
import { syncCircuitBreaker } from '@/utils/circuitBreaker';
import batchOptimizer from '@/services/sync/batchOptimizer';
import { isUUID } from '@/utils/validators';

export interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'achievement' | 'mood_entry' | 'ai_profile' | 'treatment_plan' | 'voice_checkin' | 'user_profile';
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
        const uid = (supabase as any)?.getCurrentUserId?.() || null;
        if (uid && typeof uid === 'string') currentUserId = uid;
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
        const uid = (supabase as any)?.getCurrentUserId?.() || null;
        if (uid && typeof uid === 'string') currentUserId = uid;
      } catch {}
      const queueKey = `syncQueue_${safeStorageKey(currentUserId as any)}`;
      await AsyncStorage.setItem(queueKey, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  private async resolveValidUserId(candidate?: string | null): Promise<string> {
    if (candidate && isUUID(candidate)) return candidate;
    try {
      const { default: svc } = await import('@/services/supabase');
      const uid = (svc as any)?.getCurrentUserId?.() || null;
      if (uid && isUUID(uid)) return uid;
    } catch {}
    throw new Error('No valid user id available');
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    // ✅ F-01 FIX: Guard against unsupported entities (ERP remnants)
    const SUPPORTED_ENTITIES = new Set([
      'achievement', 'mood_entry', 'ai_profile', 'treatment_plan', 'voice_checkin', 'user_profile'
    ]);
    
    if (!SUPPORTED_ENTITIES.has(item.entity as any)) {
      console.warn('🚫 Dropping unsupported entity from sync queue:', item.entity);
      try {
        const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'unsupported_entity_dropped',
          entity: item.entity,
          type: item.type
        });
      } catch (error) {
        console.log('Failed to track unsupported entity drop:', error);
      }
      return; // Drop the item silently
    }

    // Sanitize invalid user ids early (e.g., 'anon') so we can resolve later
    try {
      if (item.data && typeof item.data === 'object' && 'user_id' in item.data && !isUUID((item.data as any).user_id)) {
        delete (item.data as any).user_id;
      }
      if (item.data && typeof item.data === 'object' && 'userId' in item.data && !isUUID((item.data as any).userId)) {
        delete (item.data as any).userId;
      }
    } catch {}

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

    // 📊 Telemetry: queued for offline delete
    try {
      if (syncItem.type === 'DELETE') {
        const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        await trackAIInteraction(AIEventType.DELETE_QUEUED_OFFLINE, {
          entity: syncItem.entity,
          id: syncItem.data?.id,
          userId: syncItem.data?.user_id || syncItem.data?.userId
        }, syncItem.data?.user_id || syncItem.data?.userId);
      }
    } catch {}

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
      const summary = { successful: 0, failed: 0, conflicts: 0 } as const;
      const itemsToSync = [...this.syncQueue];
      const batchSize = batchOptimizer.calculate(itemsToSync.length);
      const startBatchAt = Date.now();

      const successful: SyncQueueItem[] = [];
      const failed: SyncQueueItem[] = [];
      const latencies: number[] = [];

      // Small concurrency limiter (2)
      const concurrency = 2;
      let index = 0;

      const runNext = async (): Promise<void> => {
        if (index >= itemsToSync.length) return;
        const current = itemsToSync[index++];
        try {
          const startedAt = Date.now();
          await syncCircuitBreaker.execute(() => this.syncItem(current));
          const latencyMs = Date.now() - startedAt;
          successful.push(current);
          latencies.push(latencyMs);
          // Remove from queue if successful
          this.syncQueue = this.syncQueue.filter(q => q.id !== current.id);
          // Telemetry (non-blocking)
          try {
            const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
            await trackAIInteraction(AIEventType.CACHE_INVALIDATION, { scope: 'sync_item_succeeded', entity: current.entity, latencyMs });
          } catch {}
        } catch (error) {
          // Increment retry count and backoff per-item
          const queueItem = this.syncQueue.find(q => q.id === current.id);
          if (queueItem) {
            queueItem.retryCount = (queueItem.retryCount || 0) + 1;
            failed.push(queueItem);
            const attempt = queueItem.retryCount;
            const base = 2000;
            const delay = Math.min(base * Math.pow(2, attempt), 60000) + Math.floor(Math.random() * 500);
            await new Promise(res => setTimeout(res, delay));
            if (attempt >= 8) {
              this.syncQueue = this.syncQueue.filter(q => q.id !== queueItem.id);
              await this.handleFailedSync(queueItem);
            }
          }
        } finally {
          await runNext();
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, itemsToSync.length) }, () => runNext());
      await Promise.all(workers);

      await this.saveSyncQueue();
      batchOptimizer.record(batchSize, failed.length === 0, Date.now() - startBatchAt);

      // Emit cache invalidation for only successfully synced entities
      if (successful.length > 0) {
        try {
          const { emitSyncCompleted } = await import('@/hooks/useCacheInvalidation');
          const syncedEntities = Array.from(new Set(successful.map(item => item.entity)));
          const firstSuccessfulUserId = successful[0]?.data?.user_id || successful[0]?.data?.userId;
          emitSyncCompleted(syncedEntities, firstSuccessfulUserId);
          if (__DEV__) console.log('🔄 Cache invalidation triggered for:', syncedEntities);
        } catch (error) {
          if (__DEV__) console.warn('⚠️ Failed to emit cache invalidation:', error);
        }
      }

      // Persist summary + telemetry
      try {
        const attempted = itemsToSync.length;
        const succeeded = successful.length;
        const failedCount = failed.length;
        await AsyncStorage.setItem('last_sync_summary', JSON.stringify({ attempted, succeeded, failed: failedCount, at: new Date().toISOString() }));
        try {
          const { default: performanceMetricsService } = await import('@/services/telemetry/performanceMetricsService');
          const successRate = attempted > 0 ? succeeded / attempted : 1;
          const avgResponseMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
          await performanceMetricsService.recordToday({ sync: { successRate, avgResponseMs } });
        } catch {}
        // Telemetry aggregation (avg latency)
        try {
          const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
          const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
          await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
            event: 'sync_batch_completed',
            attempted,
            succeeded,
            failed: failedCount,
            avgLatencyMs
          });
        } catch {}
      } catch {}
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    switch (item.entity) {
      case 'user_profile':
        await this.syncUserProfile(item);
        break;
      // compulsion removed
      // thought_record removed
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
      // thought_record removed
      default:
        throw new Error(`Unknown entity type: ${item.entity}`);
    }
  }

  // compulsion sync removed

  // ✅ REMOVED: syncERPSession method - ERP module deleted

  private async syncAIProfile(item: SyncQueueItem): Promise<void> {
    const { default: svc } = await import('@/services/supabase');
    const d = item.data || {};
    const uid = await this.resolveValidUserId(d.user_id || d.userId);
    await (svc as any).upsertAIProfile(uid, d.profile_data, !!d.onboarding_completed);
  }

  private async syncUserProfile(item: SyncQueueItem): Promise<void> {
    const { default: svc } = await import('@/services/supabase');
    const d = item.data || {};
    let uid = d.user_id || d.userId;
    if (!uid) {
      try {
        const cur = (svc as any)?.getCurrentUserId?.();
        if (cur) uid = cur;
      } catch {}
    }
    if (!uid) throw new Error('No user id available for user_profile sync');
    await (svc as any).upsertUserProfile(uid, d.payload || d);
  }

  private async syncTreatmentPlan(item: SyncQueueItem): Promise<void> {
    const { default: svc } = await import('@/services/supabase');
    const d = item.data || {};
    const uid = await this.resolveValidUserId(d.user_id || d.userId);
    await (svc as any).upsertAITreatmentPlan(uid, d.plan_data, d.status || 'active');
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

  // ✅ F-04 FIX: Add DELETE handling to mood entry sync
  private async syncMoodEntry(item: SyncQueueItem): Promise<void> {
    const raw = item.data || {};
    const { default: svc } = await import('@/services/supabase');

    // Handle DELETE operations
    if (item.type === 'DELETE') {
      if (raw.id) {
        try {
          await (svc as any).deleteMoodEntry(raw.id);
          console.log('✅ Mood entry deleted successfully:', raw.id);
          try {
            const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
            await trackAIInteraction(AIEventType.DELETE_REPLAYED_SUCCESS, { entity: 'mood_entry', id: raw.id }, raw.user_id);
          } catch {}
        } catch (error) {
          console.warn('⚠️ Mood entry deletion failed:', error);
          try {
            const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
            await trackAIInteraction(AIEventType.DELETE_REPLAYED_FAILED, { entity: 'mood_entry', id: raw.id }, raw.user_id);
          } catch {}
          throw error; // Let it retry via DLQ
        }
      } else {
        console.log('⚠️ DELETE skipped: missing mood entry id');
      }
      return;
    }

    // Handle CREATE/UPDATE operations
    // Normalize payload and save to the new canonical table: mood_entries
    // Fallback user id acquisition
    const userId = await this.resolveValidUserId(raw.user_id || raw.userId);

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

  // ✅ F-04 FIX: Complete DELETE implementation for voice checkins
  private async syncVoiceCheckin(item: SyncQueueItem): Promise<void> {
    const { default: svc } = await import('@/services/supabase');
    switch (item.type) {
      case 'CREATE':
      case 'UPDATE':
        {
          const d = item.data || {};
          const uid = await this.resolveValidUserId(d.user_id || d.userId);
          await (svc as any).saveVoiceCheckin({ ...d, user_id: uid });
        }
        break;
      case 'DELETE':
        // ✅ F-04 FIX: Implement voice checkin deletion
        if (item.data?.id) {
          try {
            await (svc as any).deleteVoiceCheckin(item.data.id);
            console.log('✅ Voice checkin deleted successfully:', item.data.id);
            try {
              const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
              await trackAIInteraction(AIEventType.DELETE_REPLAYED_SUCCESS, { entity: 'voice_checkin', id: item.data.id }, item.data.user_id);
            } catch {}
          } catch (error) {
            console.warn('⚠️ Voice checkin deletion failed:', error);
            try {
              const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
              await trackAIInteraction(AIEventType.DELETE_REPLAYED_FAILED, { entity: 'voice_checkin', id: item.data.id }, item.data.user_id);
            } catch {}
            throw error; // Let it retry via DLQ
          }
        } else {
          console.log('⚠️ DELETE skipped: missing voice checkin id');
        }
        break;
    }
  }

  // ✅ F-04 FIX: Complete DELETE implementation for thought records
  // thought record sync removed

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

  // compulsion offline helpers removed

  // ✅ F-01 FIX: ERP session methods REMOVED
  // ERP module has been deleted from the application.
  // These methods were creating ghost 'erp_session' entities in the sync queue.
  // If legacy code calls these methods, they will be no-ops.

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
