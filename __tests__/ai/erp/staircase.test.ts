/**
 * 🧪 ERP Staircase Test Suite
 * 
 * Tests for deterministic difficulty progression
 */

import { ERPStaircase, SessionPerformance } from '@/features/ai/erp/staircase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/features/ai/telemetry/aiTelemetry');

describe('ERPStaircase', () => {
  let staircase: ERPStaircase;

  beforeEach(async () => {
    jest.clearAllMocks();
    staircase = ERPStaircase.getInstance();
    await staircase.initialize();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Difficulty Adjustment Rules', () => {
    it('should increase difficulty on successful completion', async () => {
      const performance: SessionPerformance = {
        completionRate: 0.8, // 80% completion
        anxietyReduction: 3,
        habituation: true,
        timeSpent: 15,
        targetTime: 15,
      };

      const adjustment = await staircase['calculateAdjustment'](
        5, // current difficulty
        performance
      );

      expect(adjustment.delta).toBe(1);
      expect(adjustment.newDifficulty).toBe(6);
      expect(adjustment.reason).toContain('Başarılı');
    });

    it('should decrease difficulty on early dropout', async () => {
      const performance: SessionPerformance = {
        completionRate: 0.2, // 20% completion
        anxietyReduction: 0,
        habituation: false,
        timeSpent: 3,
        targetTime: 15,
        dropoutReason: 'anxiety',
      };

      const adjustment = await staircase['calculateAdjustment'](
        5, // current difficulty
        performance
      );

      expect(adjustment.delta).toBe(-1);
      expect(adjustment.newDifficulty).toBe(4);
      expect(adjustment.reason).toContain('Erken bırakma');
    });

    it('should not change difficulty on plateau', async () => {
      const performance: SessionPerformance = {
        completionRate: 0.5, // 50% completion - plateau zone
        anxietyReduction: 1,
        habituation: false,
        timeSpent: 8,
        targetTime: 15,
      };

      const adjustment = await staircase['calculateAdjustment'](
        5, // current difficulty
        performance
      );

      expect(adjustment.delta).toBe(0);
      expect(adjustment.newDifficulty).toBe(5);
      expect(adjustment.plateauDetected).toBe(true);
    });

    it('should respect floor limit', async () => {
      const performance: SessionPerformance = {
        completionRate: 0.1, // Very poor performance
        anxietyReduction: 0,
        habituation: false,
        timeSpent: 1,
        targetTime: 15,
        dropoutReason: 'anxiety',
      };

      const adjustment = await staircase['calculateAdjustment'](
        1, // Already at floor
        performance
      );

      expect(adjustment.delta).toBe(0);
      expect(adjustment.newDifficulty).toBe(1);
      expect(adjustment.hitLimit).toBe('floor');
    });

    it('should respect ceiling limit', async () => {
      const performance: SessionPerformance = {
        completionRate: 1.0, // Perfect performance
        anxietyReduction: 5,
        habituation: true,
        timeSpent: 20,
        targetTime: 15,
      };

      const adjustment = await staircase['calculateAdjustment'](
        10, // Already at ceiling
        performance
      );

      expect(adjustment.delta).toBe(0);
      expect(adjustment.newDifficulty).toBe(10);
      expect(adjustment.hitLimit).toBe('ceiling');
    });

    it('should limit delta to ±1 per session', async () => {
      // Even with extreme performance, delta should be capped
      const excellentPerformance: SessionPerformance = {
        completionRate: 1.0,
        anxietyReduction: 10,
        habituation: true,
        timeSpent: 30,
        targetTime: 15,
      };

      const adjustment = await staircase['calculateAdjustment'](
        5,
        excellentPerformance
      );

      expect(adjustment.delta).toBe(1); // Max +1
      expect(adjustment.newDifficulty).toBe(6);
    });
  });

  describe('Plateau Detection', () => {
    it('should detect plateau after multiple sessions at same level', async () => {
      const userId = 'test-user';
      
      // Simulate 3 plateau sessions
      for (let i = 0; i < 3; i++) {
        const performance: SessionPerformance = {
          completionRate: 0.5,
          anxietyReduction: 1,
          habituation: false,
          timeSpent: 10,
          targetTime: 15,
        };

        await staircase['recordSession'](userId, 5, performance);
      }

      const history = await staircase['getUserHistory'](userId);
      expect(history.plateauCount).toBe(3);
    });

    it('should suggest intervention after extended plateau', async () => {
      const userId = 'test-user';
      
      // Set plateau count high
      const history = {
        userId,
        currentDifficulty: 5,
        lastSessionDate: new Date().toISOString(),
        sessionHistory: [],
        plateauCount: 5, // Extended plateau
        promotionStreak: 0,
        demotionStreak: 0,
      };

      await staircase['saveHistory'](userId, history);

      const recommendation = await staircase['getRecommendation'](userId);
      expect(recommendation).toContain('destek');
    });
  });

  describe('Streak Tracking', () => {
    it('should track promotion streak', async () => {
      const userId = 'test-user';
      
      // Simulate 3 successful sessions
      for (let i = 0; i < 3; i++) {
        const performance: SessionPerformance = {
          completionRate: 0.85,
          anxietyReduction: 3,
          habituation: true,
          timeSpent: 15,
          targetTime: 15,
        };

        await staircase['recordSession'](userId, 5 + i, performance);
      }

      const history = await staircase['getUserHistory'](userId);
      expect(history.promotionStreak).toBe(3);
      expect(history.demotionStreak).toBe(0);
    });

    it('should track demotion streak', async () => {
      const userId = 'test-user';
      
      // Simulate 2 failed sessions
      for (let i = 0; i < 2; i++) {
        const performance: SessionPerformance = {
          completionRate: 0.2,
          anxietyReduction: 0,
          habituation: false,
          timeSpent: 3,
          targetTime: 15,
          dropoutReason: 'anxiety',
        };

        await staircase['recordSession'](userId, 5 - i, performance);
      }

      const history = await staircase['getUserHistory'](userId);
      expect(history.demotionStreak).toBe(2);
      expect(history.promotionStreak).toBe(0);
    });

    it('should reset streak on opposite movement', async () => {
      const userId = 'test-user';
      
      // First a promotion
      await staircase['recordSession'](userId, 5, {
        completionRate: 0.85,
        anxietyReduction: 3,
        habituation: true,
        timeSpent: 15,
        targetTime: 15,
      });

      // Then a demotion
      await staircase['recordSession'](userId, 6, {
        completionRate: 0.2,
        anxietyReduction: 0,
        habituation: false,
        timeSpent: 3,
        targetTime: 15,
        dropoutReason: 'anxiety',
      });

      const history = await staircase['getUserHistory'](userId);
      expect(history.promotionStreak).toBe(0);
      expect(history.demotionStreak).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle first session for new user', async () => {
      const userId = 'new-user';
      const difficulty = await staircase['getCurrentDifficulty'](userId);
      
      expect(difficulty).toBe(5); // Default starting difficulty
    });

    it('should handle missing performance data gracefully', async () => {
      const performance: Partial<SessionPerformance> = {
        completionRate: 0.7,
        // Missing other fields
      };

      const adjustment = await staircase['calculateAdjustment'](
        5,
        performance as SessionPerformance
      );

      expect(adjustment).toBeDefined();
      expect(adjustment.newDifficulty).toBeGreaterThanOrEqual(1);
      expect(adjustment.newDifficulty).toBeLessThanOrEqual(10);
    });

    it('should handle concurrent sessions', async () => {
      const userId = 'test-user';
      
      // Simulate concurrent session attempts
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          staircase['recordSession'](userId, 5, {
            completionRate: 0.8,
            anxietyReduction: 2,
            habituation: true,
            timeSpent: 15,
            targetTime: 15,
          })
        );
      }

      await Promise.all(promises);
      
      const history = await staircase['getUserHistory'](userId);
      expect(history.sessionHistory.length).toBe(3);
    });
  });

  describe('Recommendations', () => {
    it('should recommend easier exercise after repeated failures', async () => {
      const userId = 'test-user';
      
      const history = {
        userId,
        currentDifficulty: 3,
        lastSessionDate: new Date().toISOString(),
        sessionHistory: [],
        plateauCount: 0,
        promotionStreak: 0,
        demotionStreak: 3, // Multiple failures
      };

      await staircase['saveHistory'](userId, history);

      const recommendation = await staircase['getRecommendation'](userId);
      expect(recommendation).toContain('daha kolay');
    });

    it('should encourage after successful streak', async () => {
      const userId = 'test-user';
      
      const history = {
        userId,
        currentDifficulty: 7,
        lastSessionDate: new Date().toISOString(),
        sessionHistory: [],
        plateauCount: 0,
        promotionStreak: 3, // Success streak
        demotionStreak: 0,
      };

      await staircase['saveHistory'](userId, history);

      const recommendation = await staircase['getRecommendation'](userId);
      expect(recommendation).toContain('harika');
    });
  });
});
