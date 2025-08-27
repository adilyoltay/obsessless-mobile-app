
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
import { generateSecureId } from '@/utils/idGenerator';
import { idempotencyService } from '@/services/idempotencyService';
import { secureDataService } from '@/services/encryption/secureDataService';

export interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'achievement' | 'mood_entry' | 'ai_profile' | 'treatment_plan' | 'voice_checkin' | 'user_profile';
  data: any;
  timestamp: number;
  retryCount: number;
  deviceId?: string;
  lastModified?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  isBulkOperation?: boolean;
  batchId?: string;
}

export class OfflineSyncService {
  private static instance: OfflineSyncService;
  private isOnline: boolean = true;
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing: boolean = false;
  
  // 🚨 CRITICAL FIX: Queue size limit to prevent unbounded growth
  private static readonly MAX_QUEUE_SIZE = 1000;
  
  // ✅ NEW: Performance metrics tracking
  private syncMetrics = {
    successRate: 0,
    avgResponseTime: 0,
    lastSyncTime: 0,
    totalSynced: 0,
    totalFailed: 0,
    queueOverflows: 0 // Track how often we hit the limit
  };

  // 🧹 MEMORY LEAK FIX: Store NetInfo listener for cleanup
  private netInfoUnsubscribe?: () => void;

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
    // 🧹 MEMORY LEAK FIX: Store unsubscribe function for cleanup
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline) {
        console.log('📡 Device came back online, starting comprehensive sync...');
        
        // Start processing the sync queue
        this.processSyncQueue();
        
        // ✅ NEW: Also trigger mood entry auto-recovery when coming back online
        this.triggerMoodAutoRecovery().catch(error => {
          console.warn('⚠️ Mood auto-recovery failed after coming online:', error);
        });
      }
    });
  }

  // 🔐 PRIVACY-FIRST: Load encrypted sync queue
  private async loadSyncQueue(): Promise<void> {
    try {
      let currentUserId = await AsyncStorage.getItem('currentUserId');
      try {
        const { default: supabase } = await import('@/services/supabase');
        const uid = (supabase as any)?.getCurrentUserId?.() || null;
        if (uid && typeof uid === 'string') currentUserId = uid;
      } catch {}
      const queueKey = `syncQueue_${safeStorageKey(currentUserId as any)}`;
      const encryptedQueueData = await AsyncStorage.getItem(queueKey);
      
      if (encryptedQueueData) {
        try {
          // 🔍 BACKWARD COMPATIBILITY: Check if data is encrypted or legacy format
          const parsedData = JSON.parse(encryptedQueueData);
          
          // Check if it's an encrypted payload (has algorithm, ciphertext, iv)
          if (parsedData.algorithm && parsedData.ciphertext && parsedData.iv) {
            console.log('🔓 Detected encrypted queue data, decrypting...');
            const decryptedData = await secureDataService.decryptData(parsedData);
            this.syncQueue = Array.isArray(decryptedData) ? decryptedData : [];
            console.log('✅ Encrypted sync queue loaded successfully');
          } else if (Array.isArray(parsedData)) {
            // Legacy unencrypted format - migrate to encrypted
            console.log('🔄 Detected legacy unencrypted queue, migrating...');
            this.syncQueue = parsedData;
            
            // Immediately save in encrypted format
            await this.saveSyncQueue();
            console.log('✅ Legacy queue migrated to encrypted format');
          } else {
            console.warn('⚠️ Unknown queue data format, starting fresh');
            this.syncQueue = [];
          }
        } catch (parseError) {
          console.warn('⚠️ Failed to parse/decrypt sync queue, starting with empty queue:', parseError);
          
          // Try to clear corrupted data
          try {
            await AsyncStorage.removeItem(queueKey);
            console.log('🧹 Cleared corrupted queue data');
          } catch {}
          
          this.syncQueue = [];
        }
      }
    } catch (error) {
      console.error('❌ Error loading sync queue:', error);
      this.syncQueue = [];
    }
  }

  // 🔐 PRIVACY-FIRST: Save encrypted sync queue  
  private async saveSyncQueue(): Promise<void> {
    try {
      let currentUserId = await AsyncStorage.getItem('currentUserId');
      try {
        const { default: supabase } = await import('@/services/supabase');
        const uid = (supabase as any)?.getCurrentUserId?.() || null;
        if (uid && typeof uid === 'string') currentUserId = uid;
      } catch {}
      const queueKey = `syncQueue_${safeStorageKey(currentUserId as any)}`;
      
      // 🔒 Encrypt the queue before storing
      const encryptedQueueData = await secureDataService.encryptData(this.syncQueue);
      await AsyncStorage.setItem(queueKey, JSON.stringify(encryptedQueueData));
      console.log('🔒 Sync queue encrypted and saved successfully');
    } catch (error) {
      console.error('❌ CRITICAL: Sync queue encryption failed - STOPPING queue operations to protect PII', error);
      
      // 🛡️ SECURITY: NO unencrypted fallback - halt queue operations instead
      try {
        // Mark queue as failed to prevent further processing
        await AsyncStorage.setItem('sync_queue_encryption_failed', 'true');
        
        // Notify user about the encryption failure
        const securityAlert = {
          type: 'encryption_failure',
          message: 'Güvenlik hatası nedeniyle senkronizasyon durduruldu. Uygulamayı yeniden başlatın.',
          severity: 'critical',
          timestamp: new Date().toISOString(),
          requiresAppRestart: true
        };
        
        await AsyncStorage.setItem('security_alert', JSON.stringify(securityAlert));
        
        // Track security incident
        try {
          const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
          const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
          await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
            event: 'sync_queue_encryption_failure',
            severity: 'critical',
            securityIncident: true,
            queueSize: this.syncQueue.length
          });
        } catch {}
        
        console.log('🛡️ Queue operations halted for security - user notification stored');
        
      } catch (alertError) {
        console.error('❌ Failed to store security alert:', alertError);
      }
      
      // Reset queue to prevent unencrypted data persistence
      this.syncQueue = [];
    }
  }

  // ✅ NEW: Priority system helper methods
  private determinePriority(entity: SyncQueueItem['entity']): 'low' | 'normal' | 'high' | 'critical' {
    switch (entity) {
      case 'mood_entry': return 'high';        // Mood data is critical for user experience
      case 'user_profile': return 'high';      // Profile updates are important for personalization
      case 'voice_checkin': return 'normal';   // Voice data is important but not critical
      case 'ai_profile': return 'normal';      // AI profiles can be delayed
      case 'treatment_plan': return 'normal';  // Treatment plans are important but not urgent
      case 'achievement': return 'low';        // Achievements can wait
      default: return 'normal';
    }
  }

  private getPriorityWeight(priority?: 'low' | 'normal' | 'high' | 'critical'): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  private sortQueueByPriority(items: SyncQueueItem[]): SyncQueueItem[] {
    return items.sort((a, b) => {
      // 🚨 ENHANCED: Operation-aware priority sorting for deletion priority
      const getEnhancedPriority = (item: SyncQueueItem): number => {
        // Base priority weight
        let weight = this.getPriorityWeight(item.priority);
        
        // 🗑️ DELETION BOOST: Add extra weight for delete operations
        if (item.type === 'DELETE') {
          weight += 10; // Deletions always get highest priority
        } else if (item.type === 'UPDATE') {
          weight += 2; // Updates get moderate boost
        }
        
        return weight;
      };
      
      const priorityDiff = getEnhancedPriority(b) - getEnhancedPriority(a);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Secondary sort by timestamp (oldest first within same priority)
      return a.timestamp - b.timestamp;
    });
  }

  // ✅ NEW: Performance metrics methods
  private updateMetrics(success: boolean, responseTime: number): void {
    this.syncMetrics.totalSynced += success ? 1 : 0;
    this.syncMetrics.totalFailed += success ? 0 : 1;
    
    const total = this.syncMetrics.totalSynced + this.syncMetrics.totalFailed;
    this.syncMetrics.successRate = total > 0 ? (this.syncMetrics.totalSynced / total) * 100 : 0;
    
    // Exponential moving average for response time
    if (success) {
      this.syncMetrics.avgResponseTime = this.syncMetrics.avgResponseTime === 0 
        ? responseTime 
        : (this.syncMetrics.avgResponseTime * 0.7) + (responseTime * 0.3);
    }
    
    this.syncMetrics.lastSyncTime = Date.now();
  }

  public getSyncMetrics(): typeof this.syncMetrics {
    return { ...this.syncMetrics };
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

  /**
   * 🌍 Get local date string for consistent date keys (YYYY-MM-DD)
   * Avoids UTC timezone issues where entries appear in wrong day
   */
  private getLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    // 🛡️ SECURITY CHECK: Prevent queue operations if encryption failed
    try {
      const encryptionFailed = await AsyncStorage.getItem('sync_queue_encryption_failed');
      if (encryptionFailed === 'true') {
        console.error('🛡️ SECURITY: Queue operations disabled due to encryption failure');
        throw new Error('Sync queue operations are disabled for security reasons. Please restart the app.');
      }
    } catch (error) {
      console.error('❌ Failed to check encryption status:', error);
    }

    // ✅ Enhanced validation using QueueValidator
    const { queueValidator } = await import('@/services/sync/queueValidator');
    
    // Create temporary item for validation
    const tempItem: SyncQueueItem = {
      ...item,
      id: `temp_${Date.now()}`,
      timestamp: Date.now(),
      retryCount: 0
    };

    // Validate and sanitize the item
    const validation = queueValidator.validateItem(tempItem);
    
    if (!validation.isValid) {
      console.warn('🚫 Dropping invalid sync queue item:', {
        entity: item.entity,
        type: item.type,
        errors: validation.errors
      });
      
      try {
        const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
        const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'invalid_sync_item_dropped',
          entity: item.entity,
          type: item.type,
          errors: validation.errors
        });
      } catch (error) {
        console.log('Failed to track invalid item drop:', error);
      }
      return; // Drop the item
    }

    // Log warnings but continue processing
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Sync item validation warnings:', {
        entity: item.entity,
        warnings: validation.warnings
      });
    }

    // Sanitize the item to fix common issues
    const sanitizedTempItem = queueValidator.sanitizeItem(tempItem);

    // ✅ NEW: Determine priority for the item (support explicit priority)
    const explicitPriority = (item.data as any)?.priority;
    const priority = explicitPriority || this.determinePriority(sanitizedTempItem.entity as SyncQueueItem['entity']);

    const syncItem: SyncQueueItem = {
      // 🔐 SECURITY FIX: Replace insecure Date.now() + Math.random() with crypto-secure UUID
      id: generateSecureId(),
      type: sanitizedTempItem.type,
      entity: sanitizedTempItem.entity as 'achievement' | 'mood_entry' | 'ai_profile' | 'treatment_plan' | 'voice_checkin' | 'user_profile',
      data: sanitizedTempItem.data,
      timestamp: Date.now(),
      retryCount: 0,
      deviceId: await AsyncStorage.getItem('device_id') || 'unknown_device',
      lastModified: Date.now(),
      priority: priority,
      isBulkOperation: (item as any).isBulkOperation || false,
      batchId: (item as any).batchId
    };

    // 🛡️ UNIVERSAL IDEMPOTENCY CHECK: Prevent duplicate entries for all entities
    const isDuplicate = await this.checkUniversalIdempotency(syncItem);
    if (isDuplicate) {
      return; // Skip adding to queue
    }

    // 🚨 CRITICAL FIX: Check queue size limit before adding
    if (this.syncQueue.length >= OfflineSyncService.MAX_QUEUE_SIZE) {
      await this.handleQueueOverflow();
    }

    this.syncQueue.push(syncItem);
    
    // 🚀 PRIORITY SORT: Deletions and high priority items first
    this.syncQueue = this.sortQueueByPriority(this.syncQueue);
    
    await this.saveSyncQueue();

    // 📊 Queue health telemetry
    if (this.syncQueue.length > OfflineSyncService.MAX_QUEUE_SIZE * 0.8) {
      try {
        const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
        const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'sync_queue_near_capacity',
          queueSize: this.syncQueue.length,
          maxSize: OfflineSyncService.MAX_QUEUE_SIZE,
          utilizationPercent: Math.round((this.syncQueue.length / OfflineSyncService.MAX_QUEUE_SIZE) * 100)
        });
      } catch {}
    }

    // 📊 Telemetry: queued for offline delete (with feature flag check)
    try {
      if (syncItem.type === 'DELETE') {
        const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
        const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        await safeTrackAIInteraction(AIEventType.DELETE_QUEUED_OFFLINE, {
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
    // 🛡️ SECURITY CHECK: Prevent processing if encryption failed
    try {
      const encryptionFailed = await AsyncStorage.getItem('sync_queue_encryption_failed');
      if (encryptionFailed === 'true') {
        console.error('🛡️ SECURITY: Queue processing disabled due to encryption failure');
        return;
      }
    } catch (error) {
      console.error('❌ Failed to check encryption status for queue processing:', error);
    }

    if (this.isSyncing || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      const summary = { successful: 0, failed: 0, conflicts: 0 } as const;
      // ✅ NEW: Sort queue by priority before processing
      const itemsToSync = this.sortQueueByPriority([...this.syncQueue]);
      const batchSize = batchOptimizer.calculate(itemsToSync.length);
      const startBatchAt = Date.now();

      console.log(`🔄 Processing sync queue: ${itemsToSync.length} items (Priorities: ${itemsToSync.slice(0, 5).map(i => i.priority).join(', ')}${itemsToSync.length > 5 ? '...' : ''})`);

      const successful: SyncQueueItem[] = [];
      const failed: SyncQueueItem[] = [];
      const latencies: number[] = [];

      // Small concurrency limiter (2) with per-user ordering
      const concurrency = 2;
      const inflightUsers = new Set<string>();
      const consumed = new Set<string>();

      const deriveUserId = (it: SyncQueueItem): string | null => {
        try {
          return it?.data?.user_id || it?.data?.userId || null;
        } catch { return null; }
      };

      const pickCandidate = (): SyncQueueItem | undefined => {
        for (let i = 0; i < itemsToSync.length; i++) {
          const cand = itemsToSync[i];
          if (consumed.has(cand.id)) continue;
          const uid = deriveUserId(cand);
          if (uid && inflightUsers.has(uid)) continue;
          return cand;
        }
        return undefined;
      };

      const runWorker = async (): Promise<void> => {
        while (true) {
          const current = pickCandidate();
          if (!current) break;
          const uid = deriveUserId(current);
          if (uid) inflightUsers.add(uid);
          consumed.add(current.id);
          const startedAt = Date.now();
          try {
            await syncCircuitBreaker.execute(() => this.syncItem(current));
            const latencyMs = Date.now() - startedAt;
            successful.push(current);
            latencies.push(latencyMs);
            // ✅ NEW: Update performance metrics
            this.updateMetrics(true, latencyMs);
            // Remove from queue if successful
            this.syncQueue = this.syncQueue.filter(q => q.id !== current.id);
            // Telemetry (non-blocking) with feature flag check
            try {
              const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
              const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
              await safeTrackAIInteraction(AIEventType.CACHE_INVALIDATION, { scope: 'sync_item_succeeded', entity: current.entity, latencyMs });
            } catch {}
          } catch (error) {
            // ✅ NEW: Update performance metrics for failed sync
            this.updateMetrics(false, Date.now() - startedAt);
            
            // 🛡️ Mark mood entry as failed in idempotency service
            const queueItem = this.syncQueue.find(q => q.id === current.id);
            if (queueItem?.entity === 'mood_entry' && queueItem.data?.local_entry_id) {
              try {
                await idempotencyService.markAsFailed(queueItem.data.local_entry_id);
                console.log(`❌ Marked mood entry sync as failed: ${queueItem.data.local_entry_id}`);
              } catch (idempotencyError) {
                console.warn('⚠️ Failed to mark mood entry as failed in idempotency service:', idempotencyError);
              }
            }
            
            // Increment retry count and backoff per-item
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
            if (uid) inflightUsers.delete(uid);
          }
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, itemsToSync.length) }, () => runWorker());
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
        // Telemetry aggregation (avg latency) with feature flag check
        try {
          const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
          const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
          const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
          await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
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

  // ✅ F-04 FIX: Enhanced DELETE handling with priority support
  private async syncMoodEntry(item: SyncQueueItem): Promise<void> {
    const raw = item.data || {};
    const { default: svc } = await import('@/services/supabase');

    // Handle DELETE operations
    if (item.type === 'DELETE') {
      if (raw.id) {
        try {
          const priority = raw.priority || 'normal';
          const deleteReason = raw.deleteReason || 'unknown';
          
          console.log(`🗑️ Processing ${priority} priority deletion: ${raw.id} (${deleteReason})`);
          
          await (svc as any).deleteMoodEntry(raw.id);
          console.log(`✅ ${priority.toUpperCase()} priority mood entry deleted successfully:`, raw.id);
          
          try {
            const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
            const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
            await safeTrackAIInteraction(AIEventType.DELETE_REPLAYED_SUCCESS, { 
              entity: 'mood_entry', 
              id: raw.id,
              priority,
              deleteReason
            }, raw.user_id);
          } catch {}
        } catch (error) {
          console.warn(`⚠️ ${raw.priority || 'normal'} priority mood entry deletion failed:`, error);
          try {
            const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
            const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
            await safeTrackAIInteraction(AIEventType.DELETE_REPLAYED_FAILED, { 
              entity: 'mood_entry', 
              id: raw.id,
              priority: raw.priority || 'normal',
              error: String(error)
            }, raw.user_id);
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

  // 🔒 IDEMPOTENCY FIX: Ensure consistent timestamp for duplicate prevention
  // Use original creation time from queue item, never generate new timestamp
  const originalTimestamp = raw.timestamp || raw.created_at || new Date(item.timestamp).toISOString();

  const entry = {
    user_id: userId,
    mood_score: raw.mood_score ?? raw.mood ?? 50,
    energy_level: raw.energy_level ?? raw.energy ?? 5,
    anxiety_level: raw.anxiety_level ?? raw.anxiety ?? 5,
    notes: raw.notes || '',
    triggers: raw.triggers || (raw.trigger ? [raw.trigger] : []),
    activities: raw.activities || [],
    // 🔒 CRITICAL: Use consistent timestamp - NEVER generate new ones in sync!
    timestamp: originalTimestamp,
    created_at: originalTimestamp,
  };

  console.log(`🔄 Syncing mood entry with consistent timestamp: ${originalTimestamp}`);
  await (svc as any).saveMoodEntry(entry);
    
    // ✅ Mark as successfully synced in idempotency service
    if (raw.local_entry_id) {
      try {
        // 🔒 IDEMPOTENCY FIX: Use same content hash algorithm as supabaseService
        // Must be consistent with supabaseService.computeContentHash()
        // 🌍 TIMEZONE FIX: Use local date instead of UTC for consistency
        const createdDate = new Date(originalTimestamp);
        const localDay = this.getLocalDateKey(createdDate);
        const notes = (entry.notes || '').trim().toLowerCase();
        const contentText = `${entry.user_id}|${Math.round(entry.mood_score)}|${Math.round(entry.energy_level)}|${Math.round(entry.anxiety_level)}|${notes}|${localDay}`;
        
        console.log(`🌍 OfflineSync: Using local date for content hash: ${localDay}`);
        
        let hash = 0;
        for (let i = 0; i < contentText.length; i++) {
          const char = contentText.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        const contentHash = Math.abs(hash).toString(36);
        
        console.log(`🔒 Content hash for idempotency: ${contentHash} (from: ${contentText})`);
        await idempotencyService.markAsProcessed(raw.local_entry_id, contentHash, userId);
        console.log(`✅ Marked mood entry as synced: ${raw.local_entry_id}`);
      } catch (error) {
        console.warn('⚠️ Failed to mark mood entry as processed in idempotency service:', error);
      }
    }
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
              const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
              const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
              await safeTrackAIInteraction(AIEventType.DELETE_REPLAYED_SUCCESS, { entity: 'voice_checkin', id: item.data.id }, item.data.user_id);
            } catch {}
          } catch (error) {
            console.warn('⚠️ Voice checkin deletion failed:', error);
            try {
              const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
              const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
              await safeTrackAIInteraction(AIEventType.DELETE_REPLAYED_FAILED, { entity: 'voice_checkin', id: item.data.id }, item.data.user_id);
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

  /**
   * 🧹 QUEUE MAINTENANCE: Clean stale items from sync queue
   * Removes items older than specified days to prevent queue bloat
   */
  async cleanupStaleItems(maxAgeInDays: number = 7): Promise<number> {
    const staleThreshold = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);
    const initialCount = this.syncQueue.length;
    
    this.syncQueue = this.syncQueue.filter(item => 
      item.timestamp > staleThreshold
    );
    
    const removedCount = initialCount - this.syncQueue.length;
    
    if (removedCount > 0) {
      await this.saveSyncQueue();
      console.log(`🧹 Cleaned up ${removedCount} stale sync items older than ${maxAgeInDays} days`);
    }
    
    return removedCount;
  }

  /**
   * 📊 QUEUE HEALTH: Get sync queue health metrics
   */
  async getQueueHealthMetrics(): Promise<{
    totalItems: number;
    staleItems: number;
    retryItems: number;
    oldestItem: number | null;
    averageRetryCount: number;
  }> {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const staleItems = this.syncQueue.filter(item => item.timestamp < sevenDaysAgo).length;
    const retryItems = this.syncQueue.filter(item => item.retryCount > 0).length;
    const oldestItem = this.syncQueue.length > 0 
      ? Math.min(...this.syncQueue.map(item => item.timestamp))
      : null;
    
    const totalRetries = this.syncQueue.reduce((sum, item) => sum + item.retryCount, 0);
    const averageRetryCount = this.syncQueue.length > 0 ? totalRetries / this.syncQueue.length : 0;
    
    return {
      totalItems: this.syncQueue.length,
      staleItems,
      retryItems,
      oldestItem,
      averageRetryCount: Math.round(averageRetryCount * 100) / 100
    };
  }

  /**
   * ⚡ DAILY MAINTENANCE: Run daily queue maintenance
   * Should be called once per day to keep the queue healthy
   */
  async runDailyMaintenance(): Promise<{
    staleItemsRemoved: number;
    dlqItemsProcessed: number;
    queueHealth: any;
  }> {
    console.log('⚡ Starting daily sync queue maintenance...');
    
    // 1. Clean stale items (older than 7 days)
    const staleItemsRemoved = await this.cleanupStaleItems(7);
    
    // 2. Trigger DLQ cleanup
    let dlqItemsProcessed = 0;
    try {
      const dlqResult = await deadLetterQueue.performScheduledMaintenance();
      dlqItemsProcessed = dlqResult.archived + dlqResult.cleaned;
    } catch (error) {
      console.warn('⚠️ DLQ maintenance failed:', error);
    }
    
    // 3. Get updated health metrics
    const queueHealth = await this.getQueueHealthMetrics();
    
    const result = {
      staleItemsRemoved,
      dlqItemsProcessed,
      queueHealth
    };
    
    console.log('✅ Daily maintenance completed:', result);
    return result;
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

  // ✅ NEW: Bulk operations for mood entries
  async bulkSyncMoodEntries(entries: any[], userId: string): Promise<{ synced: number; failed: number }> {
    const result = { synced: 0, failed: 0 };
    
    if (!entries.length || !isUUID(userId)) {
      return result;
    }

    const batchId = `mood_bulk_${Date.now()}_${userId}`;
    console.log(`🔄 Starting bulk mood sync: ${entries.length} entries (Batch: ${batchId})`);

    try {
      // Add all entries to sync queue as a batch
      const promises = entries.map((entry, index) => {
        const priority = 'high'; // Mood entries are high priority
        return this.addToSyncQueue({
          type: 'CREATE',
          entity: 'mood_entry',
          data: {
            user_id: userId,
            mood_score: entry.mood_score ?? entry.mood ?? 50,
            energy_level: entry.energy_level ?? entry.energy ?? 5,
            anxiety_level: entry.anxiety_level ?? entry.anxiety ?? 5,
            notes: entry.notes || '',
            triggers: entry.triggers || [],
            activities: entry.activities || [],
            timestamp: entry.timestamp || entry.created_at || new Date().toISOString(),
          },
          priority: priority as any,
          isBulkOperation: true,
          batchId: batchId
        });
      });

      await Promise.allSettled(promises);
      
      // Wait briefly for queue processing to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Process the queue immediately if we're online
      if (this.isOnline) {
        await this.processSyncQueue();
      }

      // Count successful items from the batch
      const remainingBatchItems = this.syncQueue.filter(item => item.batchId === batchId);
      result.synced = entries.length - remainingBatchItems.length;
      result.failed = remainingBatchItems.length;

      console.log(`✅ Bulk mood sync completed: ${result.synced}/${entries.length} synced (Batch: ${batchId})`);
      
      return result;
    } catch (error) {
      console.error('❌ Bulk mood sync failed:', error);
      result.failed = entries.length;
      return result;
    }
  }

  // ✅ NEW: Smart retry with network awareness
  private async smartRetry<T>(
    operation: () => Promise<T>, 
    context: { entity: string; userId?: string; priority?: string }
  ): Promise<T> {
    const maxRetries = context.priority === 'critical' ? 5 : 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check network status before retry
        try {
          const NetInfo = require('@react-native-community/netinfo').default;
          const state = await NetInfo.fetch();
          const isConnected = state.isConnected && state.isInternetReachable !== false;
          
          if (!isConnected && attempt > 0) {
            // If network is down, wait longer before retry
            const networkWaitTime = Math.min(5000 * Math.pow(2, attempt), 30000);
            console.log(`📡 Network down, waiting ${networkWaitTime}ms before retry (attempt ${attempt + 1})`);
            await new Promise(resolve => setTimeout(resolve, networkWaitTime));
            continue;
          }
        } catch {}

        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff with jitter
          const baseDelay = context.priority === 'critical' ? 1000 : 2000;
          const delay = Math.min(
            baseDelay * Math.pow(2, attempt), 
            context.priority === 'critical' ? 15000 : 30000
          ) + Math.floor(Math.random() * 1000);
          
          console.log(`⏳ Retrying ${context.entity} sync in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Smart retry failed');
  }

  // ✅ NEW: Trigger mood auto-recovery when network comes back online
  private async triggerMoodAutoRecovery(): Promise<void> {
    try {
      // Get current user ID
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      if (!currentUserId || !isUUID(currentUserId)) {
        console.log('🔄 Skipping mood auto-recovery: no valid user ID');
        return;
      }

      console.log('🔄 Triggering mood auto-recovery for user:', currentUserId);
      
      // Import and call mood tracking service auto-recovery
      const { default: moodTrackingService } = await import('@/services/moodTrackingService');
      const result = await moodTrackingService.autoRecoverUnsyncedEntries(currentUserId);
      
      if (result.recovered > 0) {
        console.log(`✅ Network auto-recovery: ${result.recovered} mood entries queued for sync`);
        
        // Immediately process the newly queued items
        setTimeout(() => {
          this.processSyncQueue();
        }, 1000); // Small delay to allow queue additions to complete
      } else if (result.recovered === 0 && result.failed === 0) {
        console.log('✅ Network auto-recovery: No unsynced mood entries found');
      } else {
        console.warn(`⚠️ Network auto-recovery: ${result.failed} entries failed to queue`);
      }
      
    } catch (error) {
      console.error('❌ Mood auto-recovery failed:', error);
      // Don't throw - this shouldn't break the main sync process
    }
  }

  /**
   * 🚨 CRITICAL: Handle queue overflow when MAX_QUEUE_SIZE is reached
   * Strategy: Move oldest low/normal priority items to Dead Letter Queue
   */
  private async handleQueueOverflow(): Promise<void> {
    const overflowCount = Math.ceil(OfflineSyncService.MAX_QUEUE_SIZE * 0.1); // Remove 10% to free space
    this.syncMetrics.queueOverflows++;

    console.warn(`🚨 Queue overflow! Size: ${this.syncQueue.length}/${OfflineSyncService.MAX_QUEUE_SIZE}, removing ${overflowCount} oldest items`);

    // Sort queue by timestamp (oldest first) and priority (high/critical items preserved)
    const sortedQueue = [...this.syncQueue].sort((a, b) => {
      // Preserve critical/high priority items
      if (a.priority === 'critical' && b.priority !== 'critical') return 1;
      if (b.priority === 'critical' && a.priority !== 'critical') return -1;
      if (a.priority === 'high' && !['critical', 'high'].includes(b.priority || 'normal')) return 1;
      if (b.priority === 'high' && !['critical', 'high'].includes(a.priority || 'normal')) return -1;
      
      // Among same priority, oldest first
      return a.timestamp - b.timestamp;
    });

    // Take oldest low/normal priority items for removal
    const itemsToMove = sortedQueue.slice(0, overflowCount);
    const itemsToKeep = sortedQueue.slice(overflowCount);

    // Move overflow items to Dead Letter Queue for later retry
    try {
      const { default: deadLetterQueue } = await import('@/services/sync/deadLetterQueue');
      for (const item of itemsToMove) {
        await deadLetterQueue.addToDeadLetter({
          id: item.id,
          type: item.type,
          entity: item.entity,
          data: item.data,
          retryCount: item.retryCount + 1,
          errorMessage: 'Queue overflow - moved to DLQ for retry'
        });
      }
      
      // Update in-memory queue
      this.syncQueue = itemsToKeep;
      await this.saveSyncQueue();

      // 📊 Telemetry: Report queue overflow
      try {
        const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
        const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'sync_queue_overflow_handled',
          movedToDLQ: itemsToMove.length,
          newQueueSize: this.syncQueue.length,
          overflowCount: this.syncMetrics.queueOverflows,
          highPriorityPreserved: itemsToKeep.filter(i => ['high', 'critical'].includes(i.priority || 'normal')).length
        });
      } catch {}

      console.log(`✅ Queue overflow handled: ${itemsToMove.length} items moved to DLQ, ${itemsToKeep.length} items retained`);
      
    } catch (error) {
      console.error('❌ Failed to handle queue overflow:', error);
      
      // 🚨 ENHANCED FALLBACK: Create emergency local backup before dropping items
      try {
        const emergencyBackup = {
          timestamp: new Date().toISOString(),
          droppedItems: itemsToMove,
          reason: 'queue_overflow_dlq_failed',
          userId: await AsyncStorage.getItem('currentUserId')
        };
        
        // Save emergency backup (encrypted if possible)
        try {
          const encryptedBackup = await secureDataService.encryptData(emergencyBackup);
          await AsyncStorage.setItem('emergency_sync_backup', JSON.stringify(encryptedBackup));
          console.log('🆘 Emergency backup created with encryption');
        } catch {
          // Fallback to unencrypted if encryption fails
          await AsyncStorage.setItem('emergency_sync_backup_raw', JSON.stringify(emergencyBackup));
          console.log('🆘 Emergency backup created (unencrypted fallback)');
        }
        
        // 📢 Notify user about potential data loss
        await this.notifyUserOfDataRisk(itemsToMove.length);
        
      } catch (backupError) {
        console.error('❌ Emergency backup also failed:', backupError);
      }
      
      // Fallback: Drop oldest items (data loss risk but prevents memory issues)
      this.syncQueue = itemsToKeep;
      await this.saveSyncQueue();
      
      console.warn(`⚠️ Fallback: ${itemsToMove.length} items dropped due to DLQ failure`);
    }
  }

  /**
   * 🛡️ Universal Idempotency Check - Prevent duplicates across all entities
   * 
   * Implements entity-specific duplicate detection strategies:
   * - mood_entry: Use existing idempotency service
   * - user_profile: Check by userId + payload hash
   * - ai_profile: Check by userId + profile type
   * - voice_checkin: Check by content hash + timestamp  
   * - achievement: Check by userId + achievement_id
   * - treatment_plan: Check by userId + plan type
   */
  private async checkUniversalIdempotency(item: SyncQueueItem): Promise<boolean> {
    try {
      const userId = item.data?.user_id || item.data?.userId;
      if (!userId) return false; // Can't check without user ID

      switch (item.entity) {
        case 'mood_entry':
          return await this.checkMoodIdempotency(item);
        
        case 'user_profile':
          return await this.checkUserProfileIdempotency(item, userId);
          
        case 'ai_profile':
          return await this.checkAIProfileIdempotency(item, userId);
          
        case 'voice_checkin':
          return await this.checkVoiceCheckinIdempotency(item, userId);
          
        case 'achievement':
          return await this.checkAchievementIdempotency(item, userId);
          
        case 'treatment_plan':
          return await this.checkTreatmentPlanIdempotency(item, userId);
          
        default:
          console.warn(`⚠️ No idempotency check implemented for entity: ${item.entity}`);
          return false;
      }
    } catch (error) {
      console.error('❌ Idempotency check failed:', error);
      return false; // Fail safe - allow item through if check fails
    }
  }

  /**
   * 🎯 Mood Entry Idempotency (existing logic)
   */
  private async checkMoodIdempotency(item: SyncQueueItem): Promise<boolean> {
    if (!item.data?.local_entry_id) return false;

    // Check queue for existing mood entry
    const existingInQueue = this.syncQueue.find(existingItem => 
      existingItem.entity === 'mood_entry' && 
      existingItem.data?.local_entry_id === item.data.local_entry_id
    );
    
    if (existingInQueue) {
      console.log(`🛡️ Duplicate mood entry in sync queue prevented: ${item.data.local_entry_id}`);
      return true;
    }
    
    // Check idempotency service
    const userId = item.data.user_id || item.data.userId;
    if (userId) {
      const idempotencyResult = await idempotencyService.checkMoodEntryIdempotency({
        user_id: userId,
        mood_score: item.data.mood_score || 50,
        energy_level: item.data.energy_level || 5,
        anxiety_level: item.data.anxiety_level || 5,
        notes: item.data.notes || '',
        triggers: item.data.triggers || [],
        activities: item.data.activities || [],
        timestamp: new Date(item.timestamp).toISOString()
      });
      
      if (idempotencyResult.isDuplicate && !idempotencyResult.shouldQueue) {
        console.log(`🛡️ Mood entry already processed, skipping queue: ${item.data.local_entry_id}`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * 🔐 ENHANCED: Generate normalized content hash for robust deduplication
   */
  private generateEntityHash(entity: string, userId: string, data: any): string {
    try {
      // 🎯 NORMALIZE: Create consistent content representation regardless of format variations
      const normalizedData = this.normalizeDataForHash(entity, data);
      
      // 📊 CONTENT: Create deterministic string for hashing
      const contentString = `${entity}|${userId}|${JSON.stringify(normalizedData)}`;
      
      // 🔐 HASH: Generate SHA-256-like hash for content uniqueness
      let hash = 0;
      for (let i = 0; i < contentString.length; i++) {
        const char = contentString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return `${entity}_${Math.abs(hash).toString(36)}`;
    } catch (error) {
      console.warn('⚠️ Hash generation failed, using timestamp fallback:', error);
      return `${entity}_${userId}_${Date.now()}`;
    }
  }

  /**
   * 🔄 NORMALIZE: Standardize data for consistent hashing
   */
  private normalizeDataForHash(entity: string, data: any): any {
    const normalized = { ...data };
    
    // Remove timing-sensitive fields that shouldn't affect uniqueness
    delete normalized.id;
    delete normalized.timestamp;
    delete normalized.created_at;
    delete normalized.updated_at;
    delete normalized.lastModified;
    delete normalized.sync_attempts;
    delete normalized.synced;
    
    // Entity-specific normalizations
    switch (entity) {
      case 'mood_entry':
        // Round numeric values to prevent floating-point variations
        if (normalized.mood_score) normalized.mood_score = Math.round(normalized.mood_score);
        if (normalized.energy_level) normalized.energy_level = Math.round(normalized.energy_level);
        if (normalized.anxiety_level) normalized.anxiety_level = Math.round(normalized.anxiety_level);
        
        // Normalize text content
        if (normalized.notes) normalized.notes = normalized.notes.trim().toLowerCase();
        
        // Sort arrays for consistent ordering
        if (normalized.triggers) normalized.triggers = normalized.triggers.sort();
        if (normalized.activities) normalized.activities = normalized.activities.sort();
        break;
        
      case 'voice_checkin':
        // Normalize text and round confidence scores
        if (normalized.text) normalized.text = normalized.text.trim().toLowerCase();
        if (normalized.confidence) normalized.confidence = Math.round(normalized.confidence * 100) / 100;
        if (normalized.mood) normalized.mood = Math.round(normalized.mood);
        break;
        
      case 'user_profile':
        // Normalize profile data
        if (normalized.payload && typeof normalized.payload === 'object') {
          const payload = normalized.payload;
          
          // Sort arrays in payload
          if (payload.motivation) payload.motivation = payload.motivation.sort();
          if (payload.symptoms) payload.symptoms = payload.symptoms.sort();
          if (payload.compulsions) payload.compulsions = payload.compulsions.sort();
        }
        break;
    }
    
    return normalized;
  }

  /**
   * 👤 User Profile Idempotency
   */
  private async checkUserProfileIdempotency(item: SyncQueueItem, userId: string): Promise<boolean> {
    // Generate content hash for user profile
    const profileHash = this.generateEntityHash('user_profile', userId, item.data);
    const storageKey = `idempotency_user_profile_${profileHash}`;
    
    try {
      const existing = await AsyncStorage.getItem(storageKey);
      if (existing) {
        console.log(`🛡️ Duplicate user profile prevented: ${userId}`);
        return true;
      }
      
      // Mark as seen
      await AsyncStorage.setItem(storageKey, JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        hash: profileHash
      }));
      
    } catch (error) {
      console.warn('⚠️ User profile idempotency check failed:', error);
    }
    
    return false;
  }

  /**
   * 🤖 AI Profile Idempotency
   */
  private async checkAIProfileIdempotency(item: SyncQueueItem, userId: string): Promise<boolean> {
    // 🔐 ENHANCED: Use content hash for better duplicate detection
    const aiProfileHash = this.generateEntityHash('ai_profile', userId, item.data);
    const storageKey = `idempotency_ai_profile_${aiProfileHash}`;
    
    try {
      const existing = await AsyncStorage.getItem(storageKey);
      if (existing) {
        const existingData = JSON.parse(existing);
        const timeDiff = Date.now() - new Date(existingData.timestamp).getTime();
        
        // AI profiles can be updated, but not within 5 minutes for same content
        if (timeDiff < 5 * 60 * 1000) {
          console.log(`🛡️ Duplicate AI profile prevented (content hash): ${aiProfileHash.substring(0, 16)}...`);
          return true;
        }
      }
      
      // Update timestamp
      await AsyncStorage.setItem(storageKey, JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        hash: aiProfileHash
      }));
      
    } catch (error) {
      console.warn('⚠️ AI profile idempotency check failed:', error);
    }
    
    return false;
  }

  /**
   * 🎤 Voice Checkin Idempotency
   */
  private async checkVoiceCheckinIdempotency(item: SyncQueueItem, userId: string): Promise<boolean> {
    const contentHash = this.generateEntityHash('voice_checkin', userId, {
      transcript: item.data?.transcript || '',
      duration: item.data?.duration || 0,
      timestamp: item.data?.timestamp || item.timestamp
    });
    
    const storageKey = `idempotency_voice_${contentHash}`;
    
    try {
      const existing = await AsyncStorage.getItem(storageKey);
      if (existing) {
        console.log(`🛡️ Duplicate voice checkin prevented: ${userId}`);
        return true;
      }
      
      await AsyncStorage.setItem(storageKey, JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        hash: contentHash
      }));
      
    } catch (error) {
      console.warn('⚠️ Voice checkin idempotency check failed:', error);
    }
    
    return false;
  }

  /**
   * 🏆 Achievement Idempotency
   */
  private async checkAchievementIdempotency(item: SyncQueueItem, userId: string): Promise<boolean> {
    const achievementId = item.data?.achievement_id;
    if (!achievementId) return false;
    
    const storageKey = `idempotency_achievement_${userId}_${achievementId}`;
    
    try {
      const existing = await AsyncStorage.getItem(storageKey);
      if (existing) {
        console.log(`🛡️ Duplicate achievement prevented: ${userId}/${achievementId}`);
        return true;
      }
      
      await AsyncStorage.setItem(storageKey, JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        achievementId
      }));
      
    } catch (error) {
      console.warn('⚠️ Achievement idempotency check failed:', error);
    }
    
    return false;
  }

  /**
   * 📋 Treatment Plan Idempotency
   */
  private async checkTreatmentPlanIdempotency(item: SyncQueueItem, userId: string): Promise<boolean> {
    // 🔐 ENHANCED: Use content hash for comprehensive duplicate detection
    const treatmentHash = this.generateEntityHash('treatment_plan', userId, item.data);
    const storageKey = `idempotency_treatment_${treatmentHash}`;
    
    try {
      const existing = await AsyncStorage.getItem(storageKey);
      if (existing) {
        const existingData = JSON.parse(existing);
        const timeDiff = Date.now() - new Date(existingData.timestamp).getTime();
        
        // Treatment plans can be updated, but not within 1 hour for same content
        if (timeDiff < 60 * 60 * 1000) {
          console.log(`🛡️ Duplicate treatment plan prevented (content hash): ${treatmentHash.substring(0, 16)}...`);
          return true;
        }
      }
      
      await AsyncStorage.setItem(storageKey, JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        hash: treatmentHash
      }));
      
    } catch (error) {
      console.warn('⚠️ Treatment plan idempotency check failed:', error);
    }
    
    return false;
  }

  /**
   * 🔗 Generate entity hash for idempotency
   */
  private generateEntityHash(entity: string, userId: string, data: any): string {
    const content = `${entity}|${userId}|${JSON.stringify(data)}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 📢 Notify user about potential data loss due to queue overflow
   * This creates a notification that the user can see to take action
   */
  private async notifyUserOfDataRisk(droppedItemCount: number): Promise<void> {
    try {
      // Store notification for UI to display
      const riskNotification = {
        type: 'queue_overflow_risk',
        message: `${droppedItemCount} kayıt senkronizasyon kuyruğundan çıkarıldı. Veri kaybını önlemek için internet bağlantınızı kontrol edin.`,
        severity: 'high',
        timestamp: new Date().toISOString(),
        actionRequired: true,
        droppedItemCount
      };

      // Store for UI to pick up
      await AsyncStorage.setItem('sync_risk_notification', JSON.stringify(riskNotification));
      
      // Try to show immediate notification using Expo Notifications API
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Senkronizasyon Uyarısı',
            body: riskNotification.message,
            data: { type: 'queue_overflow' }
          },
          trigger: null // Immediate notification
        });
        console.log('📱 Queue overflow notification sent to user');
      } catch (notifError) {
        console.warn('⚠️ Failed to show immediate notification:', notifError);
      }

      // Telemetry for monitoring
      try {
        const { safeTrackAIInteraction } = await import('@/features/ai/telemetry/telemetryHelpers');
        const { AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
        await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'user_notified_queue_overflow',
          droppedItemCount,
          notificationDelivered: true
        });
      } catch {}

    } catch (error) {
      console.error('❌ Failed to notify user of data risk:', error);
    }
  }

  /**
   * 📊 Get queue health statistics for monitoring
   */
  public getQueueStats() {
    const priorityCounts = this.syncQueue.reduce((acc, item) => {
      const priority = item.priority || 'normal';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const oldestItem = this.syncQueue.length > 0 
      ? Math.min(...this.syncQueue.map(item => item.timestamp))
      : null;

    return {
      size: this.syncQueue.length,
      maxSize: OfflineSyncService.MAX_QUEUE_SIZE,
      utilizationPercent: Math.round((this.syncQueue.length / OfflineSyncService.MAX_QUEUE_SIZE) * 100),
      priorityCounts,
      oldestItemAge: oldestItem ? Date.now() - oldestItem : null,
      overflowCount: this.syncMetrics.queueOverflows,
      isNearCapacity: this.syncQueue.length > OfflineSyncService.MAX_QUEUE_SIZE * 0.8
    };
  }



  /**
   * 🧹 CLEANUP: Properly teardown all listeners and prevent memory leaks
   * Call this when the service is no longer needed (app shutdown, user logout, etc.)
   */
  public cleanup(): void {
    console.log('🧹 OfflineSyncService: Starting cleanup...');
    
    // 1. Remove NetInfo listener to prevent memory leak
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = undefined;
      console.log('✅ NetInfo listener removed');
    }
    
    // 2. Stop any active sync operations
    this.isSyncing = false;
    
    // 3. Clear sync queue from memory (AsyncStorage data preserved)
    this.syncQueue = [];
    
    // 4. Reset metrics
    this.syncMetrics = {
      successRate: 0,
      avgResponseTime: 0,
      lastSyncTime: 0,
      totalSynced: 0,
      totalFailed: 0,
      queueOverflows: 0
    };
    
    console.log('✅ OfflineSyncService cleanup completed');
  }
}

export const offlineSyncService = OfflineSyncService.getInstance();
