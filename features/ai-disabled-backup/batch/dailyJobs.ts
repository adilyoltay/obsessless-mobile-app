/**
 * Daily Batch Jobs for AI Analysis
 * Hybrid implementation: Device (Expo) + Edge (Supabase Cron)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as TaskManager from 'expo-task-manager'; // DISABLED: Not available in development
// import * as BackgroundFetch from 'expo-background-fetch'; // DISABLED: Not available in development
import { Platform } from 'react-native';
import { StorageKeys } from '@/utils/storage';
import * as pipeline from '@/features/ai/pipeline';
import { trackAIInteraction, AIEventType } from '../telemetry/aiTelemetry';
import supabaseService from '@/services/supabase';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

const BATCH_TASK_NAME = 'AI_DAILY_BATCH_JOBS';
const BATCH_SCHEDULE_TIME = process.env.EXPO_PUBLIC_BATCH_SCHEDULE_LOCAL || '03:05';
const LAST_RUN_KEY = 'ai:batch:lastRun';

export interface BatchJobResult {
  jobName: string;
  success: boolean;
  startTime: number;
  endTime: number;
  metrics?: Record<string, any>;
  error?: string;
}

export interface TrendAnalysis {
  period: '7d' | '28d';
  metrics: {
    compulsionTrend: number; // -1 to 1 (decreasing to increasing)
    moodTrend: number; // -1 to 1
    resistanceTrend: number; // -1 to 1
  };
  insights: string[];
}

export interface TodayDigest {
  userId: string;
  date: string;
  summary: {
    highlights: string[];
    challenges: string[];
    recommendations: string[];
  };
  metrics: {
    totalCompulsions: number;
    avgResistance: number;

    moodRange: { min: number; max: number };
  };
  generatedAt: number;
  ttl: number; // hours
}

/**
 * DailyJobsManager - Orchestrates all batch jobs
 */
export class DailyJobsManager {
  private static instance: DailyJobsManager;
  private isRunning = false;
  private lastRunTime: number | null = null;

  static getInstance(): DailyJobsManager {
    if (!this.instance) {
      this.instance = new DailyJobsManager();
    }
    return this.instance;
  }

  /**
   * Initialize background task for device-side execution
   */
  async initialize() {
    if (Platform.OS === 'web') {
      console.log('⚠️ Background tasks not supported on web');
      return;
    }

    try {
      // DISABLED IN DEVELOPMENT: Check if already registered
      // const isRegistered = await TaskManager.isTaskRegisteredAsync(BATCH_TASK_NAME);
      
      if (false) { // DISABLED: Background tasks
        // Register the background task
        // await BackgroundFetch.registerTaskAsync(BATCH_TASK_NAME, {
        //   minimumInterval: 60 * 60 * 12, // 12 hours minimum
        //   stopOnTerminate: false,
        //   startOnBoot: true,
        // });
        console.log('✅ Daily batch jobs registered (DISABLED)');
      }

      // Load last run time
      const lastRun = await AsyncStorage.getItem(LAST_RUN_KEY);
      this.lastRunTime = lastRun ? parseInt(lastRun) : null;

      // Check if catch-up needed (>24h since last run)
      if (this.shouldRunCatchUp()) {
        console.log('🔄 Running catch-up batch jobs');
        setTimeout(() => this.runAllJobs(), 5000); // Delay 5s after app start
      }
    } catch (error) {
      console.error('❌ Failed to initialize batch jobs:', error);
    }
  }

  /**
   * Check if catch-up run is needed
   */
  private shouldRunCatchUp(): boolean {
    if (!this.lastRunTime) return true;
    const hoursSinceLastRun = (Date.now() - this.lastRunTime) / (1000 * 60 * 60);
    return hoursSinceLastRun > 24;
  }

  /**
   * Run all daily batch jobs
   */
  async runAllJobs(userId?: string): Promise<BatchJobResult[]> {
    if (this.isRunning) {
      console.log('⏳ Batch jobs already running, skipping');
      return [];
    }

    this.isRunning = true;
    const results: BatchJobResult[] = [];
    const startTime = Date.now();

    try {
      console.log('🚀 Starting daily batch jobs');

      // Track batch start
      await trackAIInteraction(AIEventType.BATCH_JOB_STARTED, {
        timestamp: new Date().toISOString(),
        userId,
      });

      // Get user ID if not provided
      if (!userId) {
        const userSession = await AsyncStorage.getItem('supabase-session');
        if (userSession) {
          const session = JSON.parse(userSession);
          userId = session.user?.id;
        }
      }

      if (!userId) {
        throw new Error('No user ID available for batch jobs');
      }

      // 1. Trend Analysis (7d and 28d)
      const trendResult = await this.runTrendAnalysis(userId);
      results.push(trendResult);

      // 2. Mood Smoothing & Outlier Detection
      const moodResult = await this.runMoodAnalysis(userId);
      results.push(moodResult);

      // 3. Risk Micro-updates (Δ≥0.15)
      const riskResult = await this.runRiskUpdate(userId);
      results.push(riskResult);

      // 4. Today Digest Pre-computation
      const digestResult = await this.generateTodayDigest(userId);
      results.push(digestResult);

      // 5. Cache Cleanup
      const cleanupResult = await this.runCacheCleanup(userId);
      results.push(cleanupResult);

      // Update last run time
      await AsyncStorage.setItem(LAST_RUN_KEY, Date.now().toString());
      this.lastRunTime = Date.now();

      // Track batch completion
      await trackAIInteraction(AIEventType.BATCH_JOB_COMPLETED, {
        timestamp: new Date().toISOString(),
        userId,
        duration: Date.now() - startTime,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
      });

      console.log('✅ Daily batch jobs completed', {
        duration: `${(Date.now() - startTime) / 1000}s`,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });

    } catch (error) {
      // 🔇 SILENCED: Development batch job errors (normal in dev mode)
      console.warn('⚠️ Batch jobs skipped:', error instanceof Error ? error.message : 'Unknown error');
      
      // Only track if we have a valid userId (production scenario)
      if (userId) {
        await trackAIInteraction(AIEventType.BATCH_JOB_FAILED, {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
        });
      }
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * 1. Trend Analysis - Analyze 7d and 28d trends
   */
  private async runTrendAnalysis(userId: string): Promise<BatchJobResult> {
    const startTime = Date.now();
    
    try {
      // Fetch historical data
      // Compulsion data removed
      const compulsions7d: any[] = [];
      const compulsions28d: any[] = [];

      const [moods7d, moods28d] = await Promise.all([
        this.fetchMoodData(userId, 7),
        this.fetchMoodData(userId, 28),
      ]);

      // ✅ REMOVED: ERP data fetching - ERP module deleted

      // Calculate trends
      const trends7d: TrendAnalysis = {
        period: '7d',
        metrics: {
          compulsionTrend: 0,
          moodTrend: this.calculateTrend(moods7d.map(m => m.value)),
          resistanceTrend: 0,
        },
        insights: [],
      };

      const trends28d: TrendAnalysis = {
        period: '28d',
        metrics: {
          compulsionTrend: 0,
          moodTrend: this.calculateTrend(moods28d.map(m => m.value)),
          resistanceTrend: 0,
        },
        insights: [],
      };

      // Generate insights based on trends
      // Compulsion/ERP insights removed

      // Store trends in cache
      const cacheKey7d = `ai:${userId}:${new Date().toISOString().split('T')[0]}:trends:7d`;
      const cacheKey28d = `ai:${userId}:${new Date().toISOString().split('T')[0]}:trends:28d`;
      
      await AsyncStorage.setItem(cacheKey7d, JSON.stringify(trends7d));
      await AsyncStorage.setItem(cacheKey28d, JSON.stringify(trends28d));

      return {
        jobName: 'TrendAnalysis',
        success: true,
        startTime,
        endTime: Date.now(),
        metrics: {
          trends7d: trends7d.metrics,
          trends28d: trends28d.metrics,
          insightsCount: trends7d.insights.length + trends28d.insights.length,
        },
      };

    } catch (error) {
      console.error('❌ Trend analysis failed:', error);
      return {
        jobName: 'TrendAnalysis',
        success: false,
        startTime,
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 2. Mood Analysis - Smoothing and outlier detection
   */
  private async runMoodAnalysis(userId: string): Promise<BatchJobResult> {
    const startTime = Date.now();
    
    try {
      const moods = await this.fetchMoodData(userId, 14); // 2 weeks of data
      
      if (moods.length < 3) {
        return {
          jobName: 'MoodAnalysis',
          success: true,
          startTime,
          endTime: Date.now(),
          metrics: { skipped: true, reason: 'Insufficient data' },
        };
      }

      // Apply exponential smoothing
      const smoothedMoods = this.exponentialSmoothing(moods.map(m => m.value), 0.3);
      
      // Detect outliers using IQR method
      const outliers = this.detectOutliers(moods.map(m => m.value));
      
      // Store analysis results
      const analysisResult = {
        smoothedValues: smoothedMoods,
        outlierIndices: outliers,
        insights: [],
      };

      if (outliers.length > 0) {
        analysisResult.insights.push(`Son 2 haftada ${outliers.length} ani duygu durum değişimi tespit edildi`);
      }

      const avgMood = smoothedMoods.reduce((a, b) => a + b, 0) / smoothedMoods.length;
      if (avgMood < 40) {
        analysisResult.insights.push('Genel duygu durumun düşük seyrediyor, destek almayı düşünebilirsin');
      }

      // Cache the result
      const cacheKey = `ai:${userId}:${new Date().toISOString().split('T')[0]}:mood:analysis`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(analysisResult));

      return {
        jobName: 'MoodAnalysis',
        success: true,
        startTime,
        endTime: Date.now(),
        metrics: {
          dataPoints: moods.length,
          outliers: outliers.length,
          avgMood: Math.round(avgMood),
        },
      };

    } catch (error) {
      console.error('❌ Mood analysis failed:', error);
      return {
        jobName: 'MoodAnalysis',
        success: false,
        startTime,
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 3. Risk Update - Micro-updates for risk scores
   */
  private async runRiskUpdate(userId: string): Promise<BatchJobResult> {
    const startTime = Date.now();
    
    try {
      // Get current risk score
      const riskKey = StorageKeys.USER_SETTINGS(userId);
      const settings = await AsyncStorage.getItem(riskKey);
      const currentRisk = settings ? JSON.parse(settings).riskScore || 0.5 : 0.5;

      // Calculate risk delta based on recent data
      const recentCompulsions = await this.fetchCompulsionData(userId, 3);
      // ✅ REMOVED: Recent ERP data - ERP module deleted
      
      let riskDelta = 0;
      
      // Increase risk if compulsions are increasing
      const compulsionTrend = this.calculateTrend(recentCompulsions.map(c => c.count));
      if (compulsionTrend > 0.3) riskDelta += 0.05;
      if (compulsionTrend < -0.3) riskDelta -= 0.05;
      
      // ✅ REMOVED: ERP compliance checks - ERP module deleted
      
      // Apply delta if significant (≥0.15)
      const newRisk = Math.max(0, Math.min(1, currentRisk + riskDelta));
      const shouldUpdate = Math.abs(riskDelta) >= 0.15;
      
      if (shouldUpdate) {
        const updatedSettings = {
          ...(settings ? JSON.parse(settings) : {}),
          riskScore: newRisk,
          riskUpdatedAt: Date.now(),
        };
        await AsyncStorage.setItem(riskKey, JSON.stringify(updatedSettings));
        
        console.log(`📊 Risk score updated: ${currentRisk.toFixed(2)} → ${newRisk.toFixed(2)}`);
      }

      return {
        jobName: 'RiskUpdate',
        success: true,
        startTime,
        endTime: Date.now(),
        metrics: {
          previousRisk: currentRisk,
          newRisk: shouldUpdate ? newRisk : currentRisk,
          delta: riskDelta,
          updated: shouldUpdate,
        },
      };

    } catch (error) {
      console.error('❌ Risk update failed:', error);
      return {
        jobName: 'RiskUpdate',
        success: false,
        startTime,
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 4. Generate Today Digest - Pre-compute daily summary
   */
  private async generateTodayDigest(userId: string): Promise<BatchJobResult> {
    const startTime = Date.now();
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Gather today's data
      const todayCompulsions = await this.fetchCompulsionData(userId, 1);
      const todayMoods = await this.fetchMoodData(userId, 1);
      // ✅ REMOVED: Today ERP data - ERP module deleted
      
      // Calculate metrics
      const totalCompulsions = todayCompulsions[0]?.count || 0;
      const avgResistance = todayCompulsions[0]?.avgResistance || 0;
      // ✅ REMOVED: ERP sessions calculation - ERP module deleted
      const moodValues = todayMoods.map(m => m.value);
      const moodRange = {
        min: moodValues.length > 0 ? Math.min(...moodValues) : 50,
        max: moodValues.length > 0 ? Math.max(...moodValues) : 50,
      };

      // Generate digest content
      const digest: TodayDigest = {
        userId,
        date: today,
        summary: {
          highlights: [],
          challenges: [],
          recommendations: [],
        },
        metrics: {
          totalCompulsions,
          avgResistance,
          // ✅ REMOVED: erpSessions - ERP module deleted
          moodRange,
        },
        generatedAt: Date.now(),
        ttl: parseInt(process.env.EXPO_PUBLIC_CACHE_TTL_TODAY_DIGEST_HOURS || '12'),
      };

      // Generate highlights
      if (avgResistance > 7) {
        digest.summary.highlights.push('Güçlü direnç gösterdin! 💪');
      }
      // ✅ REMOVED: ERP sessions highlights - ERP module deleted
      if (totalCompulsions === 0) {
        digest.summary.highlights.push('Kompulsiyonsuz bir gün! 🌟');
      }

      // Generate challenges
      if (totalCompulsions > 5) {
        digest.summary.challenges.push('Kompulsiyon sayısı normalden fazla');
      }
      if (moodRange.max - moodRange.min > 40) {
        digest.summary.challenges.push('Duygu durum dalgalanmaları var');
      }

      // Generate recommendations
      // ✅ REMOVED: ERP recommendations - ERP module deleted
      if (avgResistance < 5) {
        digest.summary.recommendations.push('Direnç tekniklerini gözden geçir');
      }
      if (moodRange.min < 30) {
        digest.summary.recommendations.push('Nefes egzersizleri ruh halini iyileştirebilir');
      }

      // Store digest in cache
      const cacheKey = `ai:${userId}:${today}:todayDigest`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(digest));

      // Process digest through UnifiedAIPipeline for comprehensive analysis
      try {
        await pipeline.process({
          userId,
          content: digest,
          context: {
            source: 'today',
            metadata: { cacheKey },
            timestamp: Date.now()
          }
        ,
          type: 'data'
        });
        console.log('✅ Daily digest processed through UnifiedAIPipeline');
      } catch (error) {
        console.warn('⚠️ UnifiedAIPipeline processing failed for daily digest:', error);
      }

      return {
        jobName: 'TodayDigest',
        success: true,
        startTime,
        endTime: Date.now(),
        metrics: {
          highlights: digest.summary.highlights.length,
          challenges: digest.summary.challenges.length,
          recommendations: digest.summary.recommendations.length,
        },
      };

    } catch (error) {
      console.error('❌ Today digest generation failed:', error);
      return {
        jobName: 'TodayDigest',
        success: false,
        startTime,
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 5. Cache Cleanup - Remove expired cache entries
   */
  private async runCacheCleanup(userId: string): Promise<BatchJobResult> {
    const startTime = Date.now();
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const aiKeys = allKeys.filter(key => key.startsWith('ai:'));
      
      let removedCount = 0;
      const now = Date.now();
      
      for (const key of aiKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            const data = JSON.parse(value);
            
            // Check if expired based on computedAt and TTL
            if (data.computedAt && data.ttl) {
              const expiresAt = data.computedAt + (data.ttl * 60 * 60 * 1000);
              if (now > expiresAt) {
                await AsyncStorage.removeItem(key);
                removedCount++;
              }
            }
            
            // Remove old daily keys (>30 days)
            const keyParts = key.split(':');
            if (keyParts.length >= 3) {
              const dateStr = keyParts[2];
              if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const keyDate = new Date(dateStr);
                const daysDiff = (now - keyDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysDiff > 30) {
                  await AsyncStorage.removeItem(key);
                  removedCount++;
                }
              }
            }
          }
        } catch (error) {
          // Skip invalid entries
          console.warn(`Failed to process cache key ${key}:`, error);
        }
      }

      console.log(`🧹 Cache cleanup: removed ${removedCount} expired entries`);

      return {
        jobName: 'CacheCleanup',
        success: true,
        startTime,
        endTime: Date.now(),
        metrics: {
          totalKeys: aiKeys.length,
          removedKeys: removedCount,
        },
      };

    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
      return {
        jobName: 'CacheCleanup',
        success: false,
        startTime,
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Helper methods

  private async fetchCompulsionData(userId: string, days: number) {
    const data = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const key = StorageKeys.CHECKINS(userId); // use generic checkins key; compulsion store removed
      const stored = await AsyncStorage.getItem(key);
      const allCompulsions = stored ? JSON.parse(stored) : [];
      
      const dayCompulsions = allCompulsions.filter((c: any) => 
        new Date(c.timestamp).toISOString().split('T')[0] === dateStr
      );
      
      const avgResistance = dayCompulsions.length > 0
        ? dayCompulsions.reduce((sum: number, c: any) => sum + (c.resistanceLevel || 0), 0) / dayCompulsions.length
        : 0;
      
      data.push({
        date: dateStr,
        count: dayCompulsions.length,
        avgResistance,
      });
    }
    
    return data.reverse(); // Return in chronological order
  }

  private async fetchMoodData(userId: string, days: number) {
    const data = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Fetch from Supabase or local storage
      try {
        const moods = await supabaseService.getMoodEntries(userId, 1);
        if (moods && moods.length > 0) {
          const avgMood = moods.reduce((sum, m) => sum + (m.mood || m.mood_score || 50), 0) / moods.length;
          data.push({
            date: dateStr,
            value: avgMood,
            count: moods.length,
          });
        } else {
          data.push({
            date: dateStr,
            value: 50, // Default neutral mood
            count: 0,
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch mood data for ${dateStr}:`, error);
        data.push({
          date: dateStr,
          value: 50,
          count: 0,
        });
      }
    }
    
    return data.reverse();
  }

  // ✅ REMOVED: fetchTerapiData method - ERP module deleted

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    // Simple linear regression
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Normalize to -1 to 1 range
    const maxSlope = Math.max(...values) - Math.min(...values);
    return maxSlope > 0 ? Math.max(-1, Math.min(1, slope / maxSlope)) : 0;
  }

  private exponentialSmoothing(values: number[], alpha: number): number[] {
    if (values.length === 0) return [];
    
    const smoothed = [values[0]];
    for (let i = 1; i < values.length; i++) {
      smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
    }
    
    return smoothed;
  }

  private detectOutliers(values: number[]): number[] {
    if (values.length < 4) return [];
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers: number[] = [];
    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        outliers.push(index);
      }
    });
    
    return outliers;
  }
}

/**
 * Task Manager Definition - Executed by Expo in background
 */
// DISABLED IN DEVELOPMENT - Background tasks cause ExpoTaskManager errors
// TaskManager.defineTask(BATCH_TASK_NAME, async () => {
//   try {
//     console.log('📅 Background batch job triggered');
    
//     const manager = DailyJobsManager.getInstance();
//     const results = await manager.runAllJobs();
    
//     return results.every(r => r.success)
//       ? BackgroundFetch.BackgroundFetchResult.NewData
//       : BackgroundFetch.BackgroundFetchResult.Failed;
      
//   } catch (error) {
//     console.error('❌ Background batch job error:', error);
//     return BackgroundFetch.BackgroundFetchResult.Failed;
//   }
// });

// Export singleton instance
export const dailyJobsManager = DailyJobsManager.getInstance();
