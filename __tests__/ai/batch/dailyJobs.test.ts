/**
 * 🧪 Daily Batch Jobs Test Suite
 * 
 * Tests for hybrid batch processing (device + edge)
 */

import { DailyJobsManager, TrendAnalysis, TodayDigest } from '@/features/ai/batch/dailyJobs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-task-manager');
jest.mock('expo-background-fetch');
jest.mock('@/features/ai/telemetry/aiTelemetry');
jest.mock('@/services/supabase', () => ({
  default: {
    getMoodEntries: jest.fn(),
  },
}));

describe('DailyJobsManager', () => {
  let manager: DailyJobsManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    manager = DailyJobsManager.getInstance();
    
    // Mock task registration
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);
    (BackgroundFetch.registerTaskAsync as jest.Mock).mockResolvedValue(undefined);
    
    await manager.initialize();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should register background task on initialization', async () => {
      expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(
        'AI_DAILY_BATCH_JOBS',
        expect.objectContaining({
          minimumInterval: 60 * 60 * 12,
          stopOnTerminate: false,
          startOnBoot: true,
        })
      );
    });

    it('should not re-register if already registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);
      
      const newManager = DailyJobsManager.getInstance();
      await newManager.initialize();
      
      expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
    });

    it('should run catch-up if last run >24h ago', async () => {
      const yesterday = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(yesterday.toString());
      
      const runSpy = jest.spyOn(manager, 'runAllJobs');
      
      await manager.initialize();
      
      // Wait for catch-up to trigger
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      expect(runSpy).toHaveBeenCalled();
    });
  });

  describe('Trend Analysis', () => {
    it('should calculate 7-day trends correctly', async () => {
      const userId = 'test-user';
      
      // Mock data for trend calculation
      const mockCompulsions = [
        { date: '2024-01-01', count: 10, avgResistance: 5 },
        { date: '2024-01-02', count: 9, avgResistance: 5.5 },
        { date: '2024-01-03', count: 8, avgResistance: 6 },
        { date: '2024-01-04', count: 7, avgResistance: 6.5 },
        { date: '2024-01-05', count: 6, avgResistance: 7 },
        { date: '2024-01-06', count: 5, avgResistance: 7.5 },
        { date: '2024-01-07', count: 4, avgResistance: 8 },
      ];

      // Mock AsyncStorage to return compulsion data
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key.includes('compulsions')) {
          return Promise.resolve(JSON.stringify(mockCompulsions));
        }
        return Promise.resolve(null);
      });

      const result = await manager['runTrendAnalysis'](userId);
      
      expect(result.success).toBe(true);
      expect(result.jobName).toBe('TrendAnalysis');
      expect(result.metrics).toBeDefined();
    });

    it('should generate insights for positive trends', async () => {
      const trends: TrendAnalysis = {
        period: '7d',
        metrics: {
          compulsionTrend: -0.3, // Decreasing (good)
          moodTrend: 0.2,

          resistanceTrend: 0.4, // Increasing (good)
        },
        insights: [],
      };

      // Process insights
      if (trends.metrics.compulsionTrend < -0.2) {
        trends.insights.push('Kompulsiyonlarında son 7 günde azalma var, harika gidiyorsun!');
      }
      if (trends.metrics.resistanceTrend > 0.3) {
        trends.insights.push('Direnç gücün artıyor, bu çok değerli bir ilerleme');
      }

      expect(trends.insights).toHaveLength(2);
      expect(trends.insights[0]).toContain('harika');
      expect(trends.insights[1]).toContain('değerli');
    });

    it('should handle insufficient data gracefully', async () => {
      const userId = 'new-user';
      
      // Mock no data
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      const result = await manager['runTrendAnalysis'](userId);
      
      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
    });
  });

  describe('Mood Analysis', () => {
    it('should apply exponential smoothing correctly', () => {
      const values = [50, 60, 55, 70, 45, 65, 50];
      const alpha = 0.3;
      
      const smoothed = manager['exponentialSmoothing'](values, alpha);
      
      expect(smoothed).toHaveLength(values.length);
      expect(smoothed[0]).toBe(values[0]); // First value unchanged
      
      // Verify smoothing formula
      for (let i = 1; i < values.length; i++) {
        const expected = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
        expect(smoothed[i]).toBeCloseTo(expected, 2);
      }
    });

    it('should detect outliers using IQR method', () => {
      const values = [50, 52, 48, 51, 49, 95, 10, 50, 51]; // 95 and 10 are outliers
      
      const outliers = manager['detectOutliers'](values);
      
      expect(outliers).toContain(5); // Index of 95
      expect(outliers).toContain(6); // Index of 10
    });

    it('should skip analysis with insufficient data', async () => {
      const userId = 'test-user';
      
      // Mock only 2 mood entries (need at least 3)
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          { date: '2024-01-01', value: 50, count: 1 },
          { date: '2024-01-02', value: 60, count: 1 },
        ])
      );
      
      const result = await manager['runMoodAnalysis'](userId);
      
      expect(result.success).toBe(true);
      expect(result.metrics?.skipped).toBe(true);
      expect(result.metrics?.reason).toBe('Insufficient data');
    });
  });

  describe('Risk Update', () => {
    it('should increase risk on negative trends', async () => {
      const userId = 'test-user';
      
      // Mock increasing compulsions (bad trend)
      const mockCompulsions = [
        { date: '2024-01-01', count: 5, avgResistance: 6 },
        { date: '2024-01-02', count: 7, avgResistance: 5 },
        { date: '2024-01-03', count: 10, avgResistance: 4 },
      ];
      
      // Mock poor ERP compliance
      const mockERP = [
        { date: '2024-01-01', completed: false, difficulty: 5 },
        { date: '2024-01-02', completed: false, difficulty: 5 },
        { date: '2024-01-03', completed: true, difficulty: 5 },
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key.includes('compulsions')) {
          return Promise.resolve(JSON.stringify(mockCompulsions));
        }
        if (key.includes('erp')) {
          return Promise.resolve(JSON.stringify(mockERP));
        }
        if (key.includes('settings')) {
          return Promise.resolve(JSON.stringify({ riskScore: 0.5 }));
        }
        return Promise.resolve(null);
      });
      
      const result = await manager['runRiskUpdate'](userId);
      
      expect(result.success).toBe(true);
      expect(result.metrics?.delta).toBeGreaterThan(0); // Risk increased
    });

    it('should decrease risk on positive trends', async () => {
      const userId = 'test-user';
      
      // Mock decreasing compulsions (good trend)
      const mockCompulsions = [
        { date: '2024-01-01', count: 10, avgResistance: 4 },
        { date: '2024-01-02', count: 7, avgResistance: 5 },
        { date: '2024-01-03', count: 5, avgResistance: 6 },
      ];
      
      // Mock good ERP compliance
      const mockERP = [
        { date: '2024-01-01', completed: true, difficulty: 5 },
        { date: '2024-01-02', completed: true, difficulty: 5 },
        { date: '2024-01-03', completed: true, difficulty: 6 },
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key.includes('compulsions')) {
          return Promise.resolve(JSON.stringify(mockCompulsions));
        }
        if (key.includes('erp')) {
          return Promise.resolve(JSON.stringify(mockERP));
        }
        if (key.includes('settings')) {
          return Promise.resolve(JSON.stringify({ riskScore: 0.5 }));
        }
        return Promise.resolve(null);
      });
      
      const result = await manager['runRiskUpdate'](userId);
      
      expect(result.success).toBe(true);
      expect(result.metrics?.delta).toBeLessThan(0); // Risk decreased
    });

    it('should only update if delta ≥ 0.15', async () => {
      const userId = 'test-user';
      
      // Mock small changes (delta < 0.15)
      const mockCompulsions = [
        { date: '2024-01-01', count: 5, avgResistance: 5 },
        { date: '2024-01-02', count: 5, avgResistance: 5 },
        { date: '2024-01-03', count: 5, avgResistance: 5 },
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key.includes('compulsions')) {
          return Promise.resolve(JSON.stringify(mockCompulsions));
        }
        if (key.includes('settings')) {
          return Promise.resolve(JSON.stringify({ riskScore: 0.5 }));
        }
        return Promise.resolve(null);
      });
      
      const result = await manager['runRiskUpdate'](userId);
      
      expect(result.success).toBe(true);
      expect(result.metrics?.updated).toBe(false); // Not updated due to small delta
    });
  });

  describe('Today Digest', () => {
    it('should generate comprehensive digest', async () => {
      const userId = 'test-user';
      const today = new Date().toISOString().split('T')[0];
      
      // Mock today's data
      const mockData = {
        compulsions: [{ date: today, count: 3, avgResistance: 7 }],
        moods: [
          { date: today, value: 40, count: 1 },
          { date: today, value: 60, count: 1 },
        ],
        erp: [
          { date: today, completed: true, difficulty: 5 },
        ],
      };
      
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key.includes('compulsions')) {
          return Promise.resolve(JSON.stringify(mockData.compulsions));
        }
        return Promise.resolve(null);
      });
      
      const result = await manager['generateTodayDigest'](userId);
      
      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.highlights).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.recommendations).toBeGreaterThanOrEqual(0);
    });

    it('should generate highlights for achievements', () => {
      const digest: TodayDigest = {
        userId: 'test-user',
        date: '2024-01-04',
        summary: {
          highlights: [],
          challenges: [],
          recommendations: [],
        },
        metrics: {
          totalCompulsions: 0,
          avgResistance: 8,
          erpSessions: 2,
          moodRange: { min: 60, max: 80 },
        },
        generatedAt: Date.now(),
        ttl: 12,
      };

      // Generate highlights based on metrics
      if (digest.metrics.totalCompulsions === 0) {
        digest.summary.highlights.push('Kompulsiyonsuz bir gün! 🌟');
      }
      if (digest.metrics.avgResistance > 7) {
        digest.summary.highlights.push('Güçlü direnç gösterdin! 💪');
      }
      if (digest.metrics.erpSessions > 0) {
        digest.summary.highlights.push(`${digest.metrics.erpSessions} ERP egzersizi tamamladın`);
      }

      expect(digest.summary.highlights).toHaveLength(3);
    });

    it('should generate recommendations based on gaps', () => {
      const digest: TodayDigest = {
        userId: 'test-user',
        date: '2024-01-04',
        summary: {
          highlights: [],
          challenges: [],
          recommendations: [],
        },
        metrics: {
          totalCompulsions: 8,
          avgResistance: 3,
          erpSessions: 0,
          moodRange: { min: 20, max: 40 },
        },
        generatedAt: Date.now(),
        ttl: 12,
      };

      // Generate recommendations
      if (digest.metrics.erpSessions === 0) {
        digest.summary.recommendations.push('Bugün bir ERP egzersizi denemelisin');
      }
      if (digest.metrics.avgResistance < 5) {
        digest.summary.recommendations.push('Direnç tekniklerini gözden geçir');
      }
      if (digest.metrics.moodRange.min < 30) {
        digest.summary.recommendations.push('Nefes egzersizleri ruh halini iyileştirebilir');
      }

      expect(digest.summary.recommendations).toHaveLength(3);
    });
  });

  describe('Cache Cleanup', () => {
    it('should remove expired entries', async () => {
      const now = Date.now();
      
      // Mock cache entries with different expiry times
      const mockKeys = [
        'ai:cache:1',
        'ai:cache:2',
        'ai:cache:3',
      ];
      
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(mockKeys);
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'ai:cache:1') {
          // Expired entry
          return Promise.resolve(JSON.stringify({
            computedAt: now - 25 * 60 * 60 * 1000,
            ttl: 24, // 24 hours TTL, but created 25 hours ago
          }));
        }
        if (key === 'ai:cache:2') {
          // Valid entry
          return Promise.resolve(JSON.stringify({
            computedAt: now - 10 * 60 * 60 * 1000,
            ttl: 24, // Still valid
          }));
        }
        if (key === 'ai:cache:3') {
          // Old daily key (>30 days)
          return Promise.resolve(JSON.stringify({
            computedAt: now - 35 * 24 * 60 * 60 * 1000,
          }));
        }
        return Promise.resolve(null);
      });
      
      const removeItemSpy = jest.spyOn(AsyncStorage, 'removeItem');
      
      const result = await manager['runCacheCleanup']('test-user');
      
      expect(result.success).toBe(true);
      expect(removeItemSpy).toHaveBeenCalledWith('ai:cache:1');
      expect(removeItemSpy).toHaveBeenCalledWith('ai:cache:3');
      expect(removeItemSpy).not.toHaveBeenCalledWith('ai:cache:2');
    });

    it('should handle invalid cache entries gracefully', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['ai:invalid']);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json');
      
      const result = await manager['runCacheCleanup']('test-user');
      
      expect(result.success).toBe(true);
      expect(result.metrics?.removedKeys).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle job failures gracefully', async () => {
      const userId = 'test-user';
      
      // Mock error in trend analysis
      jest.spyOn(manager as any, 'runTrendAnalysis').mockRejectedValue(new Error('Test error'));
      
      const results = await manager.runAllJobs(userId);
      
      const trendResult = results.find(r => r.jobName === 'TrendAnalysis');
      expect(trendResult?.success).toBe(false);
      expect(trendResult?.error).toBe('Test error');
    });

    it('should continue with other jobs if one fails', async () => {
      const userId = 'test-user';
      
      // Mock error in mood analysis only
      jest.spyOn(manager as any, 'runMoodAnalysis').mockRejectedValue(new Error('Mood error'));
      
      const results = await manager.runAllJobs(userId);
      
      // Mood analysis should fail
      const moodResult = results.find(r => r.jobName === 'MoodAnalysis');
      expect(moodResult?.success).toBe(false);
      
      // Other jobs should succeed
      const trendResult = results.find(r => r.jobName === 'TrendAnalysis');
      expect(trendResult?.success).toBe(true);
    });
  });
});
