/**
 * 🔄 Scheduled Maintenance Service
 * Handles periodic cleanup and maintenance tasks for sync services
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deadLetterQueue } from './deadLetterQueue';
import { syncCircuitBreaker } from '@/utils/circuitBreaker';

export interface MaintenanceConfig {
  dlqMaintenanceInterval: number; // ms
  circuitBreakerResetInterval: number; // ms
  storageCleanupInterval: number; // ms
  enableAutoMaintenance: boolean;
}

export class ScheduledMaintenanceService {
  private static instance: ScheduledMaintenanceService;
  private maintenanceIntervals: NodeJS.Timeout[] = [];
  private isMaintenanceRunning = false;

  private config: MaintenanceConfig = {
    dlqMaintenanceInterval: 6 * 60 * 60 * 1000, // 6 hours
    circuitBreakerResetInterval: 24 * 60 * 60 * 1000, // 24 hours
    storageCleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
    enableAutoMaintenance: true
  };

  static getInstance(): ScheduledMaintenanceService {
    if (!ScheduledMaintenanceService.instance) {
      ScheduledMaintenanceService.instance = new ScheduledMaintenanceService();
    }
    return ScheduledMaintenanceService.instance;
  }

  constructor() {
    this.initializeAutoMaintenance();
  }

  /**
   * 🚀 Initialize automatic maintenance schedules
   */
  private initializeAutoMaintenance(): void {
    if (!this.config.enableAutoMaintenance) return;

    // DLQ maintenance every 6 hours
    const dlqInterval = setInterval(async () => {
      try {
        await this.performDLQMaintenance();
      } catch (error) {
        console.error('🚨 DLQ maintenance failed:', error);
      }
    }, this.config.dlqMaintenanceInterval);

    // Circuit breaker health check every 24 hours
    const circuitInterval = setInterval(async () => {
      try {
        await this.performCircuitBreakerMaintenance();
      } catch (error) {
        console.error('🚨 Circuit breaker maintenance failed:', error);
      }
    }, this.config.circuitBreakerResetInterval);

    // Storage cleanup every 24 hours
    const storageInterval = setInterval(async () => {
      try {
        await this.performStorageCleanup();
      } catch (error) {
        console.error('🚨 Storage cleanup failed:', error);
      }
    }, this.config.storageCleanupInterval);

    this.maintenanceIntervals.push(dlqInterval as any, circuitInterval as any, storageInterval as any);
    console.log('🔄 Scheduled maintenance initialized');
  }

  /**
   * 🧹 Perform DLQ maintenance
   */
  async performDLQMaintenance(): Promise<{ archived: number; cleaned: number }> {
    console.log('🔄 Starting DLQ maintenance...');
    
    try {
      const result = await deadLetterQueue.performScheduledMaintenance();
      
      // Telemetry
      try {
        const { trackAIInteraction, AIEventType } = await import('@/services/telemetry/noopTelemetry');
        await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'dlq_maintenance_completed',
          archivedCount: result.archived,
          cleanedCount: result.cleaned
        });
      } catch {}

      console.log(`✅ DLQ maintenance completed: ${result.archived} archived, ${result.cleaned} cleaned`);
      return result;
    } catch (error) {
      console.error('❌ DLQ maintenance failed:', error);
      throw error;
    }
  }

  /**
   * ⚡ Perform circuit breaker maintenance
   */
  async performCircuitBreakerMaintenance(): Promise<void> {
    console.log('🔄 Starting circuit breaker maintenance...');
    
    try {
      const metrics = syncCircuitBreaker.getHealthMetrics();
      
      // Reset circuit breaker if it's been open for too long without recovery
      if (metrics.state === 'OPEN' && metrics.lastFailureTime) {
        const hoursOpen = (Date.now() - metrics.lastFailureTime) / (1000 * 60 * 60);
        
        if (hoursOpen > 24) {
          console.log('🔄 Resetting circuit breaker after 24 hours');
          syncCircuitBreaker.reset();
          
          // Telemetry
          try {
            const { trackAIInteraction, AIEventType } = await import('@/services/telemetry/noopTelemetry');
            await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
              event: 'circuit_breaker_auto_reset',
              hoursOpen: Math.round(hoursOpen)
            });
          } catch {}
        }
      }

      // Log health metrics
      console.log('⚡ Circuit breaker health:', {
        state: metrics.state,
        successRate: `${(metrics.successRate * 100).toFixed(1)}%`,
        isHealthy: metrics.isHealthy
      });

      // Telemetry for health metrics
      try {
        const { trackAIInteraction, AIEventType } = await import('@/services/telemetry/noopTelemetry');
        await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'circuit_breaker_health_check',
          state: metrics.state,
          successRate: metrics.successRate,
          isHealthy: metrics.isHealthy,
          failureCount: metrics.failureCount
        });
      } catch {}

      console.log('✅ Circuit breaker maintenance completed');
    } catch (error) {
      console.error('❌ Circuit breaker maintenance failed:', error);
      throw error;
    }
  }

  /**
   * 🧹 Perform storage cleanup
   */
  async performStorageCleanup(): Promise<{ removedKeys: number; freedBytes: number }> {
    console.log('🔄 Starting storage cleanup...');
    
    try {
      let removedKeys = 0;
      let freedBytes = 0;

      // Get all storage keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Clean up old temporary keys
      const tempKeys = allKeys.filter(key => 
        key.startsWith('temp_') || 
        key.startsWith('cache_') ||
        key.includes('_temp_') ||
        key.includes('_cache_')
      );

      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

      for (const key of tempKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (!value) continue;

          // Try to parse and check timestamp
          let shouldRemove = false;
          try {
            const parsed = JSON.parse(value);
            if (parsed.timestamp && parsed.timestamp < cutoffTime) {
              shouldRemove = true;
            }
          } catch {
            // If we can't parse, assume it's old and remove temp keys
            if (key.startsWith('temp_')) {
              shouldRemove = true;
            }
          }

          if (shouldRemove) {
            await AsyncStorage.removeItem(key);
            removedKeys++;
            freedBytes += value.length;
          }
        } catch (error) {
          // If there's an error accessing the key, try to remove it
          try {
            await AsyncStorage.removeItem(key);
            removedKeys++;
          } catch {}
        }
      }

      // Clean up old sync summaries (keep only last 30)
      const syncSummaryKeys = allKeys.filter(key => key.includes('sync_summary') || key.includes('last_sync'));
      if (syncSummaryKeys.length > 30) {
        const toRemove = syncSummaryKeys.slice(0, syncSummaryKeys.length - 30);
        for (const key of toRemove) {
          try {
            const value = await AsyncStorage.getItem(key);
            await AsyncStorage.removeItem(key);
            removedKeys++;
            if (value) freedBytes += value.length;
          } catch {}
        }
      }

      // Telemetry
      try {
        const { trackAIInteraction, AIEventType } = await import('@/services/telemetry/noopTelemetry');
        await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'storage_cleanup_completed',
          removedKeys,
          freedBytes
        });
      } catch {}

      console.log(`✅ Storage cleanup completed: ${removedKeys} keys removed, ${freedBytes} bytes freed`);
      return { removedKeys, freedBytes };
    } catch (error) {
      console.error('❌ Storage cleanup failed:', error);
      throw error;
    }
  }

  /**
   * 🔄 Manual maintenance trigger
   */
  async performFullMaintenance(): Promise<{
    dlq: { archived: number; cleaned: number };
    storage: { removedKeys: number; freedBytes: number };
    circuitBreakerReset: boolean;
  }> {
    if (this.isMaintenanceRunning) {
      throw new Error('Maintenance is already running');
    }

    this.isMaintenanceRunning = true;
    console.log('🔄 Starting full maintenance...');

    try {
      const results = {
        dlq: { archived: 0, cleaned: 0 },
        storage: { removedKeys: 0, freedBytes: 0 },
        circuitBreakerReset: false
      };

      // DLQ maintenance
      results.dlq = await this.performDLQMaintenance();

      // Storage cleanup
      results.storage = await this.performStorageCleanup();

      // Circuit breaker maintenance
      const cbMetrics = syncCircuitBreaker.getHealthMetrics();
      if (cbMetrics.state === 'OPEN') {
        syncCircuitBreaker.reset();
        results.circuitBreakerReset = true;
        console.log('🔄 Circuit breaker manually reset');
      }

      console.log('✅ Full maintenance completed:', results);
      return results;
    } finally {
      this.isMaintenanceRunning = false;
    }
  }

  /**
   * 📊 Get maintenance status
   */
  getMaintenanceStatus(): {
    isRunning: boolean;
    autoMaintenanceEnabled: boolean;
    nextDLQMaintenance: number;
    nextStorageCleanup: number;
    circuitBreakerHealth: any;
  } {
    const now = Date.now();
    return {
      isRunning: this.isMaintenanceRunning,
      autoMaintenanceEnabled: this.config.enableAutoMaintenance,
      nextDLQMaintenance: now + this.config.dlqMaintenanceInterval,
      nextStorageCleanup: now + this.config.storageCleanupInterval,
      circuitBreakerHealth: syncCircuitBreaker.getHealthMetrics()
    };
  }

  /**
   * ⚙️ Update maintenance configuration
   */
  updateConfig(newConfig: Partial<MaintenanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enableAutoMaintenance !== undefined) {
      if (newConfig.enableAutoMaintenance && !this.config.enableAutoMaintenance) {
        this.initializeAutoMaintenance();
      } else if (!newConfig.enableAutoMaintenance && this.config.enableAutoMaintenance) {
        this.stopAutoMaintenance();
      }
    }
  }

  /**
   * 🛑 Stop automatic maintenance
   */
  stopAutoMaintenance(): void {
    this.maintenanceIntervals.forEach(interval => clearInterval(interval));
    this.maintenanceIntervals = [];
    console.log('🛑 Automatic maintenance stopped');
  }

  /**
   * 🧹 Cleanup on app shutdown
   */
  cleanup(): void {
    this.stopAutoMaintenance();
  }
}

export const scheduledMaintenance = ScheduledMaintenanceService.getInstance();
