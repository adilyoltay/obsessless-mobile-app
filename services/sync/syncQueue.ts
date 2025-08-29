import AsyncStorage from '@react-native-async-storage/async-storage';

type SyncStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface SyncOperation {
  id: string;
  entity: 'user_profile' | 'mood_entry' | 'voice_checkin' | 'achievement' | 'ai_profile' | 'treatment_plan';
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  priority: number;
}

export class SyncQueue {
  private queue: SyncOperation[] = [];
  private isProcessing = false;
  private retryCount = new Map<string, number>();

  async addToQueue(operation: SyncOperation): Promise<void> {
    this.queue.push(operation);
    this.queue.sort((a, b) => a.priority - b.priority);
    await this.persist();
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;
    try {
      while (this.queue.length > 0) {
        const operation = this.queue.shift()!;
        try {
          await this.executeSync(operation);
          await this.updateSyncStatus(operation.id, 'completed');
        } catch (error) {
          await this.handleSyncError(operation, error as Error);
        }
      }
    } finally {
      this.isProcessing = false;
      await this.persist();
    }
  }

  private async handleSyncError(operation: SyncOperation, error: Error): Promise<void> {
    const retries = this.retryCount.get(operation.id) || 0;
    if (retries < 3) {
      const delay = Math.pow(2, retries) * 1000 + Math.floor(Math.random() * 250);
      setTimeout(() => {
        this.queue.push(operation);
        this.retryCount.set(operation.id, retries + 1);
      }, delay);
      await this.updateSyncStatus(operation.id, 'queued');
    } else {
      await this.updateSyncStatus(operation.id, 'failed');
      // UI çatışma çözümü için işaretleme (best-effort)
      try {
        const { trackAIInteraction, AIEventType } = await import('@/services/telemetry/noopTelemetry');
        trackAIInteraction(AIEventType.SYSTEM_STATUS, { event: 'sync_operation_failed', opId: operation.id, entity: operation.entity });
      } catch {}
    }
  }

  // Placeholder - gerçek sync implementasyonu mevcut servislerle bağlanır
  private async executeSync(operation: SyncOperation): Promise<void> {
    // Burada ilgili servis çağrıları yapılır (Supabase API vb.)
    await new Promise(res => setTimeout(res, 5));
  }

  private async updateSyncStatus(id: string, status: SyncStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(`sync_status_${id}`, status);
    } catch {}
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_queue_v2', JSON.stringify(this.queue));
    } catch {}
  }
}


