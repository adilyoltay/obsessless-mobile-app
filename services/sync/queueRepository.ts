import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeStorageKey } from '@/lib/queryClient';
import { secureDataService } from '@/services/encryption/secureDataService';

/**
 * QueueRepository: handles persistence of the sync queue (encrypted)
 * - Resolves per-user storage key
 * - Encrypts/decrypts payloads
 * - Migrates legacy unencrypted arrays
 */
class QueueRepository {
  private async resolveQueueKey(): Promise<string> {
    let currentUserId = await AsyncStorage.getItem('currentUserId');
    try {
      // Lazy import to avoid cycles in native envs
      const { default: supabase } = await import('@/services/supabase');
      const uid = (supabase as any)?.getCurrentUserId?.() || null;
      if (uid && typeof uid === 'string') currentUserId = uid;
    } catch {}
    return `syncQueue_${safeStorageKey(currentUserId as any)}`;
  }

  async load<T = any>(): Promise<T[]> {
    try {
      const queueKey = await this.resolveQueueKey();
      const stored = await AsyncStorage.getItem(queueKey);
      if (!stored) return [];

      try {
        const parsed = JSON.parse(stored);
        // Encrypted payload expected to have algorithm/ciphertext/iv props
        if (parsed && parsed.algorithm && parsed.ciphertext && parsed.iv) {
          const decrypted = await secureDataService.decryptData(parsed);
          return Array.isArray(decrypted) ? decrypted : [];
        }

        // Legacy format (plain array) — migrate immediately
        if (Array.isArray(parsed)) {
          const legacy: T[] = parsed;
          await this.save(legacy);
          return legacy;
        }

        // Unknown format — clear and start fresh
        await AsyncStorage.removeItem(queueKey);
        return [];
      } catch (e) {
        // Corrupted payload — clear and start empty
        try { await AsyncStorage.removeItem(queueKey); } catch {}
        return [];
      }
    } catch (error) {
      console.error('QueueRepository.load error:', error);
      return [];
    }
  }

  /**
   * Saves the queue encrypted. On failure, raises security alert and returns false.
   */
  async save<T = any>(queue: T[]): Promise<boolean> {
    try {
      const queueKey = await this.resolveQueueKey();
      const encrypted = await secureDataService.encryptData(queue);
      await AsyncStorage.setItem(queueKey, JSON.stringify(encrypted));
      // Clear failure flag if any
      try { await AsyncStorage.removeItem('sync_queue_encryption_failed'); } catch {}
      return true;
    } catch (error) {
      console.error('QueueRepository.save encryption failed:', error);
      try {
        await AsyncStorage.setItem('sync_queue_encryption_failed', 'true');
        const securityAlert = {
          type: 'encryption_failure',
          message: 'Güvenlik hatası nedeniyle senkronizasyon durduruldu. Uygulamayı yeniden başlatın.',
          severity: 'critical',
          timestamp: new Date().toISOString(),
          requiresAppRestart: true
        };
        await AsyncStorage.setItem('security_alert', JSON.stringify(securityAlert));
        try {
          const { safeTrackAIInteraction, AIEventType } = await import('@/services/telemetry/noopTelemetry');
          await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
            event: 'sync_queue_encryption_failure',
            severity: 'critical',
            securityIncident: true,
            queueSize: Array.isArray(queue) ? queue.length : 0
          });
        } catch {}
      } catch (alertError) {
        console.error('QueueRepository.save security alert set failed:', alertError);
      }
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const queueKey = await this.resolveQueueKey();
      await AsyncStorage.removeItem(queueKey);
    } catch (e) {
      console.warn('QueueRepository.clear failed:', e);
    }
  }
}

export const queueRepository = new QueueRepository();

