/**
 * 📅 Daily Maintenance Scheduler
 * 
 * Runs daily cleanup tasks for sync queue and dead letter queue
 * to keep the offline system healthy and performant.
 * 
 * @since Phase 4 - Legacy Cleanup & Queue Maintenance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineSyncService } from '../offlineSync';

export interface MaintenanceResult {
  lastRun: string;
  staleItemsRemoved: number;
  dlqItemsProcessed: number;
  queueHealth: {
    totalItems: number;
    staleItems: number;
    retryItems: number;
    oldestItem: number | null;
    averageRetryCount: number;
  };
  success: boolean;
  error?: string;
}

export class MaintenanceScheduler {
  private static instance: MaintenanceScheduler;
  private readonly LAST_RUN_KEY = 'maintenance_last_run';
  private readonly MAINTENANCE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private timer?: NodeJS.Timeout;

  static getInstance(): MaintenanceScheduler {
    if (!MaintenanceScheduler.instance) {
      MaintenanceScheduler.instance = new MaintenanceScheduler();
    }
    return MaintenanceScheduler.instance;
  }

  constructor() {
    this.scheduleMaintenance();
  }

  /**
   * Check if maintenance is due and run it if needed
   */
  async checkAndRunMaintenance(force: boolean = false): Promise<MaintenanceResult | null> {
    try {
      const lastRunStr = await AsyncStorage.getItem(this.LAST_RUN_KEY);
      const lastRun = lastRunStr ? new Date(lastRunStr).getTime() : 0;
      const now = Date.now();
      const timeSinceLastRun = now - lastRun;

      const isDue = force || timeSinceLastRun >= this.MAINTENANCE_INTERVAL;

      if (!isDue) {
        console.log(`⏰ Maintenance not due (last run: ${timeSinceLastRun / 1000 / 60 / 60} hours ago)`);
        return null;
      }

      console.log('🚀 Starting scheduled maintenance...');
      
      const maintenanceResult = await offlineSyncService.runDailyMaintenance();
      
      // Save last run timestamp
      await AsyncStorage.setItem(this.LAST_RUN_KEY, new Date().toISOString());

      const result: MaintenanceResult = {
        lastRun: new Date().toISOString(),
        ...maintenanceResult,
        success: true
      };

      console.log('✅ Scheduled maintenance completed successfully');
      return result;

    } catch (error) {
      console.error('❌ Maintenance failed:', error);
      return {
        lastRun: new Date().toISOString(),
        staleItemsRemoved: 0,
        dlqItemsProcessed: 0,
        queueHealth: {
          totalItems: 0,
          staleItems: 0,
          retryItems: 0,
          oldestItem: null,
          averageRetryCount: 0
        },
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Schedule recurring maintenance checks
   */
  private scheduleMaintenance(): void {
    // Check every hour if maintenance is due
    const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
    
    this.timer = setInterval(() => {
      this.checkAndRunMaintenance();
    }, CHECK_INTERVAL);

    // Also check immediately on startup
    setTimeout(() => {
      this.checkAndRunMaintenance();
    }, 5000); // Wait 5 seconds after startup
  }

  /**
   * Force run maintenance now (for debugging/testing)
   */
  async forceMaintenanceNow(): Promise<MaintenanceResult> {
    const result = await this.checkAndRunMaintenance(true);
    return result || {
      lastRun: new Date().toISOString(),
      staleItemsRemoved: 0,
      dlqItemsProcessed: 0,
      queueHealth: {
        totalItems: 0,
        staleItems: 0,
        retryItems: 0,
        oldestItem: null,
        averageRetryCount: 0
      },
      success: false,
      error: 'Maintenance was not due and force flag failed'
    };
  }

  /**
   * Get maintenance status and last run info
   */
  async getMaintenanceStatus(): Promise<{
    lastRun: string | null;
    timeSinceLastRun: number;
    isDue: boolean;
    nextRunIn: number;
  }> {
    const lastRunStr = await AsyncStorage.getItem(this.LAST_RUN_KEY);
    const lastRun = lastRunStr ? new Date(lastRunStr).getTime() : 0;
    const now = Date.now();
    const timeSinceLastRun = now - lastRun;
    const isDue = timeSinceLastRun >= this.MAINTENANCE_INTERVAL;
    const nextRunIn = Math.max(0, this.MAINTENANCE_INTERVAL - timeSinceLastRun);

    return {
      lastRun: lastRunStr,
      timeSinceLastRun,
      isDue,
      nextRunIn
    };
  }

  /**
   * Stop the maintenance scheduler
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

// Export singleton instance
export const maintenanceScheduler = MaintenanceScheduler.getInstance();
