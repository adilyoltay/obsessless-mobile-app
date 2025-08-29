/**
 * Non-AI Sync Metrics Service
 * 
 * Post-AI cleanup için sync performance ve health metrics.
 * Queue durumu, sync başarı oranı, latency tracking.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSyncTime?: string;
  avgLatencyMs?: number;
  queueLength: number;
  dlqLength: number; // Dead Letter Queue
  
  // Detailed counters
  moodEntrySyncs: number;
  voiceCheckinSyncs: number;
  profileSyncs: number;
  
  // Error tracking
  lastError?: string;
  errorFrequency: { [key: string]: number };
}

interface SyncEvent {
  type: 'mood_entry' | 'voice_checkin' | 'profile' | 'other';
  status: 'success' | 'failure' | 'queued' | 'dlq';
  latencyMs?: number;
  error?: string;
  timestamp: string;
}

class SyncMetricsService {
  private static instance: SyncMetricsService;
  private metricsKey = 'sync_metrics_v1';
  
  public static getInstance(): SyncMetricsService {
    if (!SyncMetricsService.instance) {
      SyncMetricsService.instance = new SyncMetricsService();
    }
    return SyncMetricsService.instance;
  }

  /**
   * Get current sync metrics
   */
  public async getMetrics(): Promise<SyncMetrics> {
    try {
      const stored = await AsyncStorage.getItem(this.metricsKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to get sync metrics:', error);
    }

    // Return default metrics
    return {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      queueLength: 0,
      dlqLength: 0,
      moodEntrySyncs: 0,
      voiceCheckinSyncs: 0,
      profileSyncs: 0,
      errorFrequency: {}
    };
  }

  /**
   * Record a sync event
   */
  public async recordSyncEvent(event: SyncEvent): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      
      // Update counters
      metrics.totalSyncs++;
      
      if (event.status === 'success') {
        metrics.successfulSyncs++;
      } else if (event.status === 'failure') {
        metrics.failedSyncs++;
        
        if (event.error) {
          metrics.lastError = event.error;
          metrics.errorFrequency[event.error] = (metrics.errorFrequency[event.error] || 0) + 1;
        }
      }

      // Update by type
      switch (event.type) {
        case 'mood_entry':
          metrics.moodEntrySyncs++;
          break;
        case 'voice_checkin':
          metrics.voiceCheckinSyncs++;
          break;
        case 'profile':
          metrics.profileSyncs++;
          break;
      }

      // Update timing
      if (event.status === 'success' || event.status === 'failure') {
        metrics.lastSyncTime = event.timestamp;
      }

      // Update average latency
      if (event.latencyMs && event.status === 'success') {
        if (metrics.avgLatencyMs) {
          // Simple moving average
          metrics.avgLatencyMs = Math.round((metrics.avgLatencyMs + event.latencyMs) / 2);
        } else {
          metrics.avgLatencyMs = event.latencyMs;
        }
      }

      await AsyncStorage.setItem(this.metricsKey, JSON.stringify(metrics));

    } catch (error) {
      console.warn('Failed to record sync event:', error);
    }
  }

  /**
   * Update queue lengths (called by sync services)
   */
  public async updateQueueLengths(queueLength: number, dlqLength: number): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      metrics.queueLength = queueLength;
      metrics.dlqLength = dlqLength;
      
      await AsyncStorage.setItem(this.metricsKey, JSON.stringify(metrics));
    } catch (error) {
      console.warn('Failed to update queue lengths:', error);
    }
  }

  /**
   * Get sync health status
   */
  public async getSyncHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    details: {
      successRate: number;
      avgLatency?: number;
      queueBacklog: number;
      lastSyncAge?: number; // minutes since last sync
    };
  }> {
    try {
      const metrics = await this.getMetrics();
      
      // Calculate success rate
      const successRate = metrics.totalSyncs > 0 
        ? Math.round((metrics.successfulSyncs / metrics.totalSyncs) * 100)
        : 100;

      // Calculate time since last sync
      let lastSyncAge: number | undefined;
      if (metrics.lastSyncTime) {
        const lastSync = new Date(metrics.lastSyncTime);
        const now = new Date();
        lastSyncAge = Math.round((now.getTime() - lastSync.getTime()) / (1000 * 60));
      }

      const queueBacklog = metrics.queueLength + metrics.dlqLength;

      // Determine health status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = 'Sync sistemi sorunsuz çalışıyor';

      if (successRate < 70) {
        status = 'critical';
        message = `Sync başarı oranı düşük (%${successRate})`;
      } else if (queueBacklog > 50) {
        status = 'critical';
        message = `Sync kuyruğu çok dolu (${queueBacklog} öğe)`;
      } else if (lastSyncAge && lastSyncAge > 60) {
        status = 'warning';
        message = `Son sync ${lastSyncAge} dakika önce`;
      } else if (successRate < 90) {
        status = 'warning';
        message = `Sync başarı oranı normal altında (%${successRate})`;
      } else if (queueBacklog > 10) {
        status = 'warning';
        message = `Sync kuyruğu dolmaya başladı (${queueBacklog} öğe)`;
      }

      return {
        status,
        message,
        details: {
          successRate,
          avgLatency: metrics.avgLatencyMs,
          queueBacklog,
          lastSyncAge
        }
      };
    } catch (error) {
      console.warn('Failed to get sync health:', error);
      return {
        status: 'critical',
        message: 'Sync health durumu alınamadı',
        details: {
          successRate: 0,
          queueBacklog: 0
        }
      };
    }
  }

  /**
   * Reset metrics (for debugging)
   */
  public async resetMetrics(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.metricsKey);
      console.log('🗑️ Sync metrics reset');
    } catch (error) {
      console.warn('Failed to reset sync metrics:', error);
    }
  }

  /**
   * Get formatted metrics for debug screen
   */
  public async getFormattedMetrics(): Promise<{
    summary: string[];
    details: string[];
    errors: string[];
  }> {
    try {
      const metrics = await this.getMetrics();
      const health = await this.getSyncHealth();

      const summary = [
        `📊 Toplam Sync: ${metrics.totalSyncs}`,
        `✅ Başarılı: ${metrics.successfulSyncs} (${health.details.successRate}%)`,
        `❌ Başarısız: ${metrics.failedSyncs}`,
        `⏱️ Ortalama Süre: ${metrics.avgLatencyMs || 'N/A'}ms`
      ];

      const details = [
        `📝 Mood Entry: ${metrics.moodEntrySyncs}`,
        `🎤 Voice Checkin: ${metrics.voiceCheckinSyncs}`, 
        `👤 Profile: ${metrics.profileSyncs}`,
        `📋 Queue: ${metrics.queueLength} normal, ${metrics.dlqLength} DLQ`,
        `🕒 Son Sync: ${metrics.lastSyncTime ? new Date(metrics.lastSyncTime).toLocaleString('tr-TR') : 'Hiç'}`
      ];

      const errors = Object.entries(metrics.errorFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([error, count]) => `${error}: ${count}x`);

      return { summary, details, errors };
    } catch (error) {
      console.warn('Failed to get formatted metrics:', error);
      return {
        summary: ['Metrics alınamadı'],
        details: [],
        errors: []
      };
    }
  }
}

export const syncMetrics = SyncMetricsService.getInstance();
export default syncMetrics;
