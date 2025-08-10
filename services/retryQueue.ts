/**
 * 🔄 Retry Queue Service - Robust Background Sync
 * 
 * Network hatalarında verileri kuyruklayan ve bağlantı kurulduğunda
 * otomatik olarak senkronize eden queue sistemi.
 * 
 * Features:
 * ✅ Automatic retry with exponential backoff
 * ✅ Persistent queue in AsyncStorage
 * ✅ Network status awareness
 * ✅ Priority-based queue processing
 * ✅ Error recovery and dead letter queue
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { InteractionManager } from 'react-native';

// =============================================================================
// 🎯 TYPES & INTERFACES
// =============================================================================

export interface QueueItem {
  id: string;
  type: 'supabase_insert' | 'supabase_update' | 'supabase_upsert';
  table: string;
  data: any;
  userId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextRetryAt?: Date;
}

export interface QueueConfig {
  maxItems: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  processIntervalMs: number;
  enabled: boolean;
}

// =============================================================================
// 🔄 RETRY QUEUE SERVICE
// =============================================================================

class RetryQueueService {
  private static instance: RetryQueueService;
  private queue: QueueItem[] = [];
  private isProcessing: boolean = false;
  private isOnline: boolean = true;
  private processingInterval: NodeJS.Timeout | null = null;
  
  private config: QueueConfig = {
    maxItems: 1000,
    maxAttempts: 5,
    baseDelayMs: 1000, // 1 second
    maxDelayMs: 5 * 60 * 1000, // 5 minutes
    processIntervalMs: 30 * 1000, // 30 seconds
    enabled: true
  };

  private constructor() {
    this.initializeNetworkListener();
    this.loadQueueFromStorage();
    this.startProcessing();
  }

  static getInstance(): RetryQueueService {
    if (!RetryQueueService.instance) {
      RetryQueueService.instance = new RetryQueueService();
    }
    return RetryQueueService.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION
  // =============================================================================

  /**
   * Network state listener
   */
  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      console.log('🌐 Retry Queue: Network state changed:', {
        isConnected: this.isOnline,
        type: state.type
      });
      
      // If we just came online, process queue immediately
      if (wasOffline && this.isOnline && this.queue.length > 0) {
        console.log('🔄 Network restored, processing queued items...');
        this.processQueue();
      }
    });
  }

  /**
   * Load persisted queue from storage
   */
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const storedQueue = await AsyncStorage.getItem('retry_queue');
      if (storedQueue) {
        const items: QueueItem[] = JSON.parse(storedQueue);
        
        // Restore dates
        this.queue = items.map(item => ({
          ...item,
          createdAt: new Date(item.createdAt),
          nextRetryAt: item.nextRetryAt ? new Date(item.nextRetryAt) : undefined
        }));
        
        console.log(`🔄 Loaded ${this.queue.length} items from persistent queue`);
        
        // Clean expired items
        this.cleanExpiredItems();
      }
    } catch (error) {
      console.error('❌ Failed to load retry queue from storage:', error);
      try {
        await trackAIInteraction(AIEventType.API_ERROR, {
          component: 'RetryQueue',
          action: 'load_queue',
          error: (error as Error).message
        });
      } catch {}
      this.queue = [];
    }
  }

  /**
   * Save queue to persistent storage
   */
  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem('retry_queue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('❌ Failed to save retry queue to storage:', error);
      try {
        await trackAIInteraction(AIEventType.API_ERROR, {
          component: 'RetryQueue',
          action: 'save_queue',
          error: (error as Error).message
        });
      } catch {}
    }
  }

  /**
   * Start background processing
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.processingInterval = setInterval(() => {
      if (this.config.enabled && this.isOnline && this.queue.length > 0) {
        this.processQueue();
      }
    }, this.config.processIntervalMs);
  }

  // =============================================================================
  // 🎯 PUBLIC API
  // =============================================================================

  /**
   * Add item to retry queue
   */
  async addToQueue(
    type: QueueItem['type'],
    table: string,
    data: any,
    userId: string,
    priority: QueueItem['priority'] = 'medium'
  ): Promise<string> {
    const item: QueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      table,
      data,
      userId,
      priority,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: this.config.maxAttempts
    };

    // Check queue size limit
    if (this.queue.length >= this.config.maxItems) {
      // Remove oldest low priority items
      this.queue = this.queue
        .filter(item => item.priority !== 'low')
        .slice(-(this.config.maxItems - 1));
    }

    this.queue.push(item);
    this.sortQueueByPriority();
    
    console.log(`🔄 Added to retry queue: ${table} (${priority} priority)`, {
      queueSize: this.queue.length,
      itemId: item.id
    });

    // Save to storage
    await this.saveQueueToStorage();

    // Try immediate processing if online
    if (this.isOnline) {
      InteractionManager.runAfterInteractions(() => {
        this.processQueue();
      });
    }

    return item.id;
  }

  /**
   * Process retry queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Processing retry queue: ${this.queue.length} items`);

    const itemsToProcess = this.queue.filter(item => {
      // Check if it's time to retry
      if (item.nextRetryAt && item.nextRetryAt > new Date()) {
        return false;
      }
      return item.attempts < item.maxAttempts;
    });

    for (const item of itemsToProcess) {
      try {
        await this.processItem(item);
        
        // Remove successful item from queue
        this.queue = this.queue.filter(q => q.id !== item.id);
        console.log(`✅ Queue item processed successfully: ${item.table}/${item.id}`);
        
      } catch (error) {
        // Handle failed item
        item.attempts++;
        item.lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (item.attempts >= item.maxAttempts) {
          console.error(`❌ Queue item failed permanently: ${item.table}/${item.id}`, error);
          // Move to dead letter queue or remove
          this.queue = this.queue.filter(q => q.id !== item.id);
          await this.handleDeadLetter(item);
        } else {
          // Schedule retry with exponential backoff
          const delay = Math.min(
            this.config.baseDelayMs * Math.pow(2, item.attempts - 1),
            this.config.maxDelayMs
          );
          item.nextRetryAt = new Date(Date.now() + delay);
          
          console.warn(`⚠️ Queue item failed, retry #${item.attempts} in ${delay}ms: ${item.table}/${item.id}`);
          try {
            await trackAIInteraction(AIEventType.SLOW_RESPONSE, {
              component: 'RetryQueue',
              action: 'retry_scheduled',
              attempts: item.attempts,
              delayMs: delay,
              table: item.table,
              id: item.id
            });
          } catch {}
        }
      }
    }

    // Save updated queue
    await this.saveQueueToStorage();
    this.isProcessing = false;
  }

  /**
   * Process individual queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    const { supabaseService } = await import('@/services/supabase');
    
    switch (item.type) {
      case 'supabase_insert':
        await supabaseService.supabaseClient
          .from(item.table)
          .insert(item.data);
        break;
        
      case 'supabase_update':
        await supabaseService.supabaseClient
          .from(item.table)
          .update(item.data)
          .eq('user_id', item.userId);
        break;
        
      case 'supabase_upsert':
        await supabaseService.supabaseClient
          .from(item.table)
          .upsert(item.data);
        break;
        
      default:
        throw new Error(`Unknown queue item type: ${item.type}`);
    }
  }

  /**
   * Handle permanently failed items
   */
  private async handleDeadLetter(item: QueueItem): Promise<void> {
    try {
      // Save to dead letter queue for manual inspection
      const deadLetterQueue = await AsyncStorage.getItem('dead_letter_queue') || '[]';
      const deadItems = JSON.parse(deadLetterQueue);
      
      deadItems.push({
        ...item,
        deadAt: new Date().toISOString(),
        reason: 'Max attempts exceeded'
      });
      
      // Keep only last 100 dead items
      const recentDeadItems = deadItems.slice(-100);
      await AsyncStorage.setItem('dead_letter_queue', JSON.stringify(recentDeadItems));
      
      console.log(`💀 Item moved to dead letter queue: ${item.table}/${item.id}`);
    } catch (error) {
      console.error('❌ Failed to save dead letter item:', error);
    }
  }

  /**
   * Sort queue by priority
   */
  private sortQueueByPriority(): void {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    this.queue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Same priority, sort by creation time
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Clean expired items (older than 7 days)
   */
  private cleanExpiredItems(): void {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const initialCount = this.queue.length;
    
    this.queue = this.queue.filter(item => item.createdAt > sevenDaysAgo);
    
    const cleanedCount = initialCount - this.queue.length;
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} expired queue items`);
    }
  }

  // =============================================================================
  // 🔧 UTILITY METHODS
  // =============================================================================

  /**
   * Get queue status
   */
  getStatus(): {
    queueSize: number;
    isProcessing: boolean;
    isOnline: boolean;
    pendingItems: number;
    failedItems: number;
  } {
    const now = new Date();
    const pendingItems = this.queue.filter(item => 
      item.attempts < item.maxAttempts && 
      (!item.nextRetryAt || item.nextRetryAt <= now)
    ).length;
    
    const failedItems = this.queue.filter(item => 
      item.attempts > 0 && 
      item.nextRetryAt && 
      item.nextRetryAt > now
    ).length;

    return {
      queueSize: this.queue.length,
      isProcessing: this.isProcessing,
      isOnline: this.isOnline,
      pendingItems,
      failedItems
    };
  }

  /**
   * Force process queue (for testing)
   */
  async forceProcess(): Promise<void> {
    if (this.isOnline) {
      await this.processQueue();
    }
  }

  /**
   * Clear queue (for testing)
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueueToStorage();
    console.log('🧹 Retry queue cleared');
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    console.log('🔄 Retry Queue Service shut down');
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const retryQueueService = RetryQueueService.getInstance();
export default retryQueueService;
