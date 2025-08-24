/**
 * 🧪 Analytics Tests - CBT Analytics
 * 
 * Tests for CBT analytics computation, mood before/after tracking,
 * volatility calculation, and Quality Ribbon metadata generation
 */

import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { 
  generateCBTRecords,
  mockAnalyticsResults,
  mockDateNow
} from '../fixtures/qualityRibbonFixtures';

// Mock dependencies
jest.mock('@/features/ai/telemetry/aiTelemetry');
jest.mock('@/services/supabase');

describe('CBT Analytics Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDateNow(1640995200000); // Fixed timestamp
  });

  describe('Mood Before/After Analysis', () => {
    it('should calculate mood improvement deltas correctly', async () => {
      const cbtRecords = [
        { mood_before: 3, mood_after: 7, timestamp: '2022-01-01T10:00:00Z' },
        { mood_before: 4, mood_after: 6, timestamp: '2022-01-01T14:00:00Z' },
        { mood_before: 2, mood_after: 8, timestamp: '2022-01-01T18:00:00Z' }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      expect(result.analytics?.cbt).toMatchObject({
        sampleSize: 3,
        volatility: expect.any(Number),
        weeklyDelta: expect.any(Number),
        confidence: expect.any(Number),
        baselines: {
          moodImprovement: expect.any(Number)
        }
      });

      // Verify average mood improvement
      const expectedImprovement = ((7-3) + (6-4) + (8-2)) / 3; // = 4
      expect(result.analytics.cbt.baselines.moodImprovement).toBeCloseTo(expectedImprovement);
    });

    it('should handle records without mood data', async () => {
      const cbtRecords = [
        { mood_before: 3, mood_after: 7 },
        { situation: 'Test', mood_before: null, mood_after: null }, // Invalid
        { mood_before: 5, mood_after: 8 }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      // Should only process valid records
      expect(result.analytics?.cbt?.sampleSize).toBe(2);
    });

    it('should skip analytics for insufficient data', async () => {
      const cbtRecords = []; // Empty

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      // Should not include CBT analytics
      expect(result.analytics?.cbt).toBeUndefined();
    });
  });

  describe('Volatility Calculation', () => {
    it('should calculate mood improvement volatility correctly', async () => {
      const cbtRecords = [
        { mood_before: 5, mood_after: 7 }, // +2 improvement
        { mood_before: 3, mood_after: 9 }, // +6 improvement  
        { mood_before: 6, mood_after: 6 }, // 0 improvement
        { mood_before: 4, mood_after: 5 }  // +1 improvement
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      // Deltas: [2, 6, 0, 1], mean = 2.25
      // Variance: ((2-2.25)² + (6-2.25)² + (0-2.25)² + (1-2.25)²) / 4
      // = (0.0625 + 14.0625 + 5.0625 + 1.5625) / 4 = 5.1875
      // Volatility (stddev) = √5.1875 ≈ 2.28

      expect(result.analytics?.cbt?.volatility).toBeCloseTo(2.3, 1);
    });

    it('should handle single record (no volatility)', async () => {
      const cbtRecords = [
        { mood_before: 3, mood_after: 7 }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      // Single record should have 0 volatility
      expect(result.analytics?.cbt?.volatility).toBe(0);
    });
  });

  describe('Weekly Delta Trends', () => {
    it('should calculate weekly delta for trend analysis', async () => {
      // Generate records spanning 2 weeks
      const baseTimestamp = Date.now();
      const cbtRecords = [
        // Week 1 (poor improvement)
        { mood_before: 5, mood_after: 6, timestamp: new Date(baseTimestamp - 13*24*60*60*1000).toISOString() },
        { mood_before: 4, mood_after: 5, timestamp: new Date(baseTimestamp - 12*24*60*60*1000).toISOString() },
        { mood_before: 6, mood_after: 6, timestamp: new Date(baseTimestamp - 10*24*60*60*1000).toISOString() },
        
        // Week 2 (better improvement)
        { mood_before: 3, mood_after: 8, timestamp: new Date(baseTimestamp - 6*24*60*60*1000).toISOString() },
        { mood_before: 4, mood_after: 9, timestamp: new Date(baseTimestamp - 4*24*60*60*1000).toISOString() },
        { mood_before: 2, mood_after: 7, timestamp: new Date(baseTimestamp - 2*24*60*60*1000).toISOString() }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      // Week 1 avg improvement: (1+1+0)/3 = 0.67
      // Week 2 avg improvement: (5+5+5)/3 = 5.0
      // Delta: 5.0 - 0.67 = 4.33

      expect(result.analytics?.cbt?.weeklyDelta).toBeGreaterThan(3);
      expect(result.analytics?.cbt?.weeklyDelta).toBeLessThan(5);
    });

    it('should handle insufficient data for weekly comparison', async () => {
      const cbtRecords = [
        { mood_before: 3, mood_after: 7, timestamp: new Date().toISOString() }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      // Should default to 0 for insufficient data
      expect(result.analytics?.cbt?.weeklyDelta).toBe(0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should scale confidence based on sample size', async () => {
      const testCases = [
        { recordCount: 2, expectedConfidenceRange: [0.55, 0.65] },
        { recordCount: 5, expectedConfidenceRange: [0.70, 0.80] },
        { recordCount: 15, expectedConfidenceRange: [0.75, 0.80] }, // Capped at 0.8
        { recordCount: 25, expectedConfidenceRange: [0.80, 0.80] }  // Max cap
      ];

      for (const testCase of testCases) {
        const cbtRecords = generateCBTRecords(testCase.recordCount);
        
        const result = await unifiedPipeline.process({
          userId: 'test-user',
          content: { cbtRecords },
          type: 'data',
          context: { source: 'today' }
        });

        const confidence = result.analytics?.cbt?.confidence || 0;
        expect(confidence).toBeGreaterThanOrEqual(testCase.expectedConfidenceRange[0]);
        expect(confidence).toBeLessThanOrEqual(testCase.expectedConfidenceRange[1]);
      }
    });
  });

  describe('Quality Ribbon Integration', () => {
    it('should provide sufficient data for high-quality ribbon', async () => {
      const cbtRecords = generateCBTRecords(10); // Rich dataset

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      expect(result.analytics?.cbt).toMatchObject({
        sampleSize: 10,
        confidence: expect.any(Number),
        dataQuality: expect.any(Number)
      });

      // Should have high enough values for "High" quality rating
      expect(result.analytics.cbt.confidence).toBeGreaterThan(0.7);
      expect(result.analytics.cbt.sampleSize).toBeGreaterThan(7);
    });

    it('should provide appropriate data for medium-quality ribbon', async () => {
      const cbtRecords = generateCBTRecords(4); // Moderate dataset

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      // Should provide medium quality rating
      expect(result.analytics?.cbt?.confidence).toBeGreaterThan(0.6);
      expect(result.analytics?.cbt?.confidence).toBeLessThan(0.8);
      expect(result.analytics?.cbt?.sampleSize).toBeGreaterThanOrEqual(3);
      expect(result.analytics?.cbt?.sampleSize).toBeLessThan(7);
    });
  });

  describe('Edge Cases', () => {
    it('should handle records with identical before/after moods', async () => {
      const cbtRecords = [
        { mood_before: 5, mood_after: 5 }, // No change
        { mood_before: 7, mood_after: 7 }, // No change
        { mood_before: 3, mood_after: 3 }  // No change
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      expect(result.analytics?.cbt?.baselines?.moodImprovement).toBe(0);
      expect(result.analytics?.cbt?.volatility).toBe(0); // No variation
    });

    it('should handle extreme mood improvements', async () => {
      const cbtRecords = [
        { mood_before: 1, mood_after: 10 }, // +9 improvement
        { mood_before: 2, mood_after: 10 }, // +8 improvement
        { mood_before: 1, mood_after: 9 }   // +8 improvement
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      // Should handle large improvements gracefully
      expect(result.analytics?.cbt?.baselines?.moodImprovement).toBeGreaterThan(7);
      expect(result.analytics?.cbt?.confidence).toBeGreaterThan(0.6);
    });

    it('should handle negative mood changes (worsening)', async () => {
      const cbtRecords = [
        { mood_before: 8, mood_after: 5 }, // -3 change
        { mood_before: 7, mood_after: 4 }, // -3 change
        { mood_before: 6, mood_after: 2 }  // -4 change
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords },
        type: 'data',
        context: { source: 'today' }
      });

      // Should handle negative trends
      expect(result.analytics?.cbt?.baselines?.moodImprovement).toBeLessThan(0);
      expect(result.analytics?.cbt?.volatility).toBeGreaterThan(0); // Still some variation
    });
  });

  describe('Performance', () => {
    it('should process large datasets efficiently', async () => {
      const largeCBTDataset = generateCBTRecords(1000);

      const startTime = Date.now();
      
      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { cbtRecords: largeCBTDataset },
        type: 'data',
        context: { source: 'today' }
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete within reasonable time
      expect(processingTime).toBeLessThan(1000); // < 1 second
      expect(result.analytics?.cbt).toBeDefined();
    });

    it('should handle memory efficiently with large datasets', async () => {
      const largeCBTDataset = generateCBTRecords(5000);

      // Should not throw memory errors
      await expect(
        unifiedPipeline.process({
          userId: 'test-user',
          content: { cbtRecords: largeCBTDataset },
          type: 'data',
          context: { source: 'today' }
        })
      ).resolves.not.toThrow();
    });
  });
});
