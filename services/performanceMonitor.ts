/**
 * Performance Monitor Service
 * 
 * Post-AI cleanup için performance baseline measurement.
 * Cold start, latency tracking, memory monitoring, budget alerts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

interface PerformanceMetric {
  timestamp: string;
  type: 'cold_start' | 'mood_save' | 'sync_operation' | 'screen_load' | 'memory_sample';
  value: number; // milliseconds or bytes
  context?: {
    screenName?: string;
    operationType?: string;
    entryCount?: number;
    userId?: string;
  };
}

interface PerformanceBudget {
  coldStartMs: number; // Target: < 3000ms
  moodSaveMs: number;  // Target: < 500ms
  syncOperationMs: number; // Target: < 2000ms
  screenLoadMs: number; // Target: < 1000ms
  memoryUsageMB: number; // Target: < 100MB
}

interface PerformanceSummary {
  averages: {
    coldStart: number;
    moodSave: number;
    syncOperation: number;
    screenLoad: number;
  };
  budgetStatus: {
    coldStart: 'good' | 'warning' | 'critical';
    moodSave: 'good' | 'warning' | 'critical';
    syncOperation: 'good' | 'warning' | 'critical';
    screenLoad: 'good' | 'warning' | 'critical';
  };
  trends: {
    improving: string[];
    declining: string[];
  };
  recommendations: string[];
}

class PerformanceMonitorService {
  private static instance: PerformanceMonitorService;
  private metricsKey = 'performance_metrics_v1';
  private appStartTime = Date.now();
  private coldStartRecorded = false;
  
  // Performance budgets
  private budgets: PerformanceBudget = {
    coldStartMs: 3000,
    moodSaveMs: 500,
    syncOperationMs: 2000,
    screenLoadMs: 1000,
    memoryUsageMB: 100
  };

  public static getInstance(): PerformanceMonitorService {
    if (!PerformanceMonitorService.instance) {
      PerformanceMonitorService.instance = new PerformanceMonitorService();
    }
    return PerformanceMonitorService.instance;
  }

  /**
   * Initialize performance monitoring
   */
  public async initialize(): Promise<void> {
    try {
      // Track app state changes for cold start detection
      AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active' && !this.coldStartRecorded) {
          const coldStartTime = Date.now() - this.appStartTime;
          this.recordMetric('cold_start', coldStartTime);
          this.coldStartRecorded = true;
          console.log(`📱 Cold start: ${coldStartTime}ms`);
        }
      });

      // Start periodic memory sampling
      this.startMemoryMonitoring();
      
      console.log('✅ Performance monitoring initialized');
    } catch (error) {
      console.error('Failed to initialize performance monitoring:', error);
    }
  }

  /**
   * Record a performance metric
   */
  public async recordMetric(
    type: PerformanceMetric['type'],
    value: number,
    context?: PerformanceMetric['context']
  ): Promise<void> {
    try {
      const metric: PerformanceMetric = {
        timestamp: new Date().toISOString(),
        type,
        value,
        context
      };

      // Get existing metrics
      const stored = await AsyncStorage.getItem(this.metricsKey);
      const metrics: PerformanceMetric[] = stored ? JSON.parse(stored) : [];
      
      // Add new metric
      metrics.push(metric);
      
      // Keep only last 100 metrics per type (prevent storage bloat)
      const typeCount: { [key: string]: number } = {};
      const filteredMetrics = metrics.reverse().filter(m => {
        typeCount[m.type] = (typeCount[m.type] || 0) + 1;
        return typeCount[m.type] <= 100;
      }).reverse();

      await AsyncStorage.setItem(this.metricsKey, JSON.stringify(filteredMetrics));

      // Log if budget exceeded
      this.checkBudgetAlert(type, value);

    } catch (error) {
      console.warn('Failed to record performance metric:', error);
    }
  }

  /**
   * Check if metric exceeds budget and log warning
   */
  private checkBudgetAlert(type: PerformanceMetric['type'], value: number): void {
    let budget: number;
    let unit = 'ms';

    switch (type) {
      case 'cold_start':
        budget = this.budgets.coldStartMs;
        break;
      case 'mood_save':
        budget = this.budgets.moodSaveMs;
        break;
      case 'sync_operation':
        budget = this.budgets.syncOperationMs;
        break;
      case 'screen_load':
        budget = this.budgets.screenLoadMs;
        break;
      case 'memory_sample':
        budget = this.budgets.memoryUsageMB;
        unit = 'MB';
        break;
      default:
        return;
    }

    // Only show performance warnings in development
    if (__DEV__ && value > budget * 2) { // Only log if 2x over budget
      console.warn(`⚠️ Performance: ${type} took ${value}${unit} (budget: ${budget}${unit})`);
    } else if (value > budget * 3) { // Production critical only if 3x over
      console.error(`🚨 Performance issue: ${type} took ${value}${unit}`);
    }
  }

  /**
   * Start memory monitoring (sample every 30 seconds)
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      // React Native doesn't have direct memory API
      // This is a placeholder for when we integrate with native modules
      // For now, track AsyncStorage usage as a proxy
      this.sampleMemoryUsage();
    }, 30000); // 30 seconds
  }

  /**
   * Sample memory usage (AsyncStorage proxy)
   */
  private async sampleMemoryUsage(): Promise<void> {
    try {
      // Use AsyncStorage size as a memory usage proxy
      const allKeys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      for (const key of allKeys.slice(0, 10)) { // Sample first 10 keys
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            totalSize += data.length;
          }
        } catch (error) {
          // Skip problematic keys
        }
      }
      
      // Estimate total storage usage in MB
      const estimatedTotalMB = Math.round((totalSize * allKeys.length / 10) / (1024 * 1024));
      
      await this.recordMetric('memory_sample', estimatedTotalMB, {
        operationType: 'storage_proxy'
      });

    } catch (error) {
      console.warn('Failed to sample memory usage:', error);
    }
  }

  /**
   * Measure mood save latency
   */
  public async measureMoodSave(operation: () => Promise<any>): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const latency = Date.now() - startTime;
      
      await this.recordMetric('mood_save', latency, {
        operationType: 'save_entry'
      });
      
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      await this.recordMetric('mood_save', latency, {
        operationType: 'save_entry_failed'
      });
      throw error;
    }
  }

  /**
   * Measure sync operation latency
   */
  public async measureSyncOperation(operation: () => Promise<any>): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const latency = Date.now() - startTime;
      
      await this.recordMetric('sync_operation', latency, {
        operationType: 'full_sync'
      });
      
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      await this.recordMetric('sync_operation', latency, {
        operationType: 'sync_failed'
      });
      throw error;
    }
  }

  /**
   * Get performance summary
   */
  public async getPerformanceSummary(): Promise<PerformanceSummary> {
    try {
      const stored = await AsyncStorage.getItem(this.metricsKey);
      const metrics: PerformanceMetric[] = stored ? JSON.parse(stored) : [];

      if (metrics.length === 0) {
        return {
          averages: { coldStart: 0, moodSave: 0, syncOperation: 0, screenLoad: 0 },
          budgetStatus: { coldStart: 'good', moodSave: 'good', syncOperation: 'good', screenLoad: 'good' },
          trends: { improving: [], declining: [] },
          recommendations: ['Henüz yeterli performance verisi yok']
        };
      }

      // Calculate averages
      const getAverage = (type: PerformanceMetric['type']) => {
        const typeMetrics = metrics.filter(m => m.type === type);
        if (typeMetrics.length === 0) return 0;
        return Math.round(typeMetrics.reduce((sum, m) => sum + m.value, 0) / typeMetrics.length);
      };

      const averages = {
        coldStart: getAverage('cold_start'),
        moodSave: getAverage('mood_save'),
        syncOperation: getAverage('sync_operation'),
        screenLoad: getAverage('screen_load')
      };

      // Check budget status
      const budgetStatus = {
        coldStart: this.getBudgetStatus('cold_start', averages.coldStart),
        moodSave: this.getBudgetStatus('mood_save', averages.moodSave),
        syncOperation: this.getBudgetStatus('sync_operation', averages.syncOperation),
        screenLoad: this.getBudgetStatus('screen_load', averages.screenLoad)
      };

      // Generate recommendations
      const recommendations = this.generatePerformanceRecommendations(averages, budgetStatus);

      return {
        averages,
        budgetStatus,
        trends: { improving: [], declining: [] }, // TODO: Implement trend analysis
        recommendations
      };
    } catch (error) {
      console.error('Failed to get performance summary:', error);
      return {
        averages: { coldStart: 0, moodSave: 0, syncOperation: 0, screenLoad: 0 },
        budgetStatus: { coldStart: 'good', moodSave: 'good', syncOperation: 'good', screenLoad: 'good' },
        trends: { improving: [], declining: [] },
        recommendations: ['Performance analizi başarısız']
      };
    }
  }

  /**
   * Get budget status for a metric
   */
  private getBudgetStatus(type: string, average: number): 'good' | 'warning' | 'critical' {
    let budget: number;
    
    switch (type) {
      case 'cold_start': budget = this.budgets.coldStartMs; break;
      case 'mood_save': budget = this.budgets.moodSaveMs; break;
      case 'sync_operation': budget = this.budgets.syncOperationMs; break;
      case 'screen_load': budget = this.budgets.screenLoadMs; break;
      default: return 'good';
    }

    if (average > budget * 1.5) return 'critical';
    if (average > budget) return 'warning';
    return 'good';
  }

  /**
   * Generate performance recommendations
   */
  private generatePerformanceRecommendations(
    averages: PerformanceSummary['averages'],
    budgetStatus: PerformanceSummary['budgetStatus']
  ): string[] {
    const recommendations: string[] = [];

    if (budgetStatus.coldStart === 'critical') {
      recommendations.push('Cold start çok yavaş - Bundle size optimize edilmeli');
    }
    
    if (budgetStatus.moodSave === 'critical') {
      recommendations.push('Mood save çok yavaş - AsyncStorage encryption optimize edilmeli');
    }
    
    if (budgetStatus.syncOperation === 'critical') {
      recommendations.push('Sync operation yavaş - Batch size azaltılmalı');
    }

    if (averages.coldStart > 2000) {
      recommendations.push('Cold start iyileştirilebilir - Lazy loading eklenebilir');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance budgets içinde - sistem sağlıklı! 🎯');
    }

    return recommendations;
  }

  /**
   * Get formatted performance metrics for debug screen
   */
  public async getFormattedMetrics(): Promise<{
    summary: string[];
    details: string[];
    budgets: string[];
    alerts: string[];
  }> {
    try {
      const summary = await this.getPerformanceSummary();
      
      const summaryText = [
        `🚀 Cold Start: ${summary.averages.coldStart}ms`,
        `💾 Mood Save: ${summary.averages.moodSave}ms`,
        `🔄 Sync Ops: ${summary.averages.syncOperation}ms`,
        `📱 Screen Load: ${summary.averages.screenLoad}ms`
      ];

      const details = Object.entries(summary.budgetStatus).map(([type, status]) => {
        const emoji = status === 'good' ? '✅' : status === 'warning' ? '⚠️' : '🚨';
        return `${emoji} ${type}: ${status}`;
      });

      const budgets = [
        `🎯 Cold Start Budget: ${this.budgets.coldStartMs}ms`,
        `🎯 Mood Save Budget: ${this.budgets.moodSaveMs}ms`,
        `🎯 Sync Budget: ${this.budgets.syncOperationMs}ms`,
        `🎯 Screen Load Budget: ${this.budgets.screenLoadMs}ms`
      ];

      const alerts = summary.recommendations;

      return { summary: summaryText, details, budgets, alerts };
    } catch (error) {
      console.error('Failed to get formatted performance metrics:', error);
      return {
        summary: ['Performance data alınamadı'],
        details: [],
        budgets: [],
        alerts: ['Metrics error']
      };
    }
  }

  /**
   * Reset all performance metrics
   */
  public async resetMetrics(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.metricsKey);
      this.appStartTime = Date.now();
      this.coldStartRecorded = false;
      console.log('🗑️ Performance metrics reset');
    } catch (error) {
      console.error('Failed to reset performance metrics:', error);
    }
  }

  /**
   * Update performance budgets
   */
  public updateBudgets(newBudgets: Partial<PerformanceBudget>): void {
    this.budgets = { ...this.budgets, ...newBudgets };
    console.log('🎯 Performance budgets updated:', newBudgets);
  }

  /**
   * Wrapper function for measuring any async operation
   */
  public async measureOperation<T>(
    type: PerformanceMetric['type'],
    operation: () => Promise<T>,
    context?: PerformanceMetric['context']
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const latency = Date.now() - startTime;
      
      await this.recordMetric(type, latency, context);
      
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      await this.recordMetric(type, latency, { 
        ...context, 
        operationType: `${context?.operationType || type}_failed` 
      });
      throw error;
    }
  }
}

export const performanceMonitor = PerformanceMonitorService.getInstance();
export default performanceMonitor;
