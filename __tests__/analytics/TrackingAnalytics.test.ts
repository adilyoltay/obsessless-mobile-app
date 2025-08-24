/**
 * 🧪 Analytics Tests - Tracking Analytics
 * 
 * Tests for OCD tracking analytics, compulsion patterns,
 * daily volatility, resistance trends, and Quality Ribbon metadata
 */

import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { 
  generateCompulsions,
  mockAnalyticsResults,
  mockDateNow
} from '../fixtures/qualityRibbonFixtures';

// Mock dependencies
jest.mock('@/features/ai/telemetry/aiTelemetry');
jest.mock('@/services/supabase');

describe('Tracking Analytics Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDateNow(1640995200000); // Fixed timestamp: 2022-01-01 00:00:00
  });

  describe('Daily Pattern Analysis', () => {
    it('should group compulsions by day correctly', async () => {
      const compulsions = [
        { type: 'washing', timestamp: '2022-01-01T10:00:00Z' },
        { type: 'checking', timestamp: '2022-01-01T15:00:00Z' },
        { type: 'washing', timestamp: '2022-01-01T20:00:00Z' }, // Day 1: 3 compulsions
        { type: 'counting', timestamp: '2022-01-02T09:00:00Z' },
        { type: 'checking', timestamp: '2022-01-02T14:00:00Z' }, // Day 2: 2 compulsions
        { type: 'organizing', timestamp: '2022-01-03T11:00:00Z' } // Day 3: 1 compulsion
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      expect(result.analytics?.tracking).toMatchObject({
        sampleSize: 6, // Total compulsions
        volatility: expect.any(Number), // Daily count variation
        weeklyDelta: expect.any(Number),
        confidence: expect.any(Number),
        baselines: {
          compulsions: expect.any(Number) // Average daily count
        }
      });

      // Daily average: (3+2+1)/3 = 2.0
      expect(result.analytics.tracking.baselines.compulsions).toBeCloseTo(2.0, 1);
    });

    it('should handle single-day data', async () => {
      const compulsions = [
        { type: 'washing', timestamp: '2022-01-01T10:00:00Z' },
        { type: 'checking', timestamp: '2022-01-01T15:00:00Z' },
        { type: 'counting', timestamp: '2022-01-01T20:00:00Z' }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      expect(result.analytics?.tracking?.sampleSize).toBe(3);
      expect(result.analytics?.tracking?.volatility).toBe(0); // No daily variation
      expect(result.analytics?.tracking?.baselines?.compulsions).toBe(3); // All on one day
    });

    it('should skip analytics for empty data', async () => {
      const compulsions: any[] = [];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      expect(result.analytics?.tracking).toBeUndefined();
    });
  });

  describe('Volatility Calculation', () => {
    it('should calculate daily count volatility correctly', async () => {
      const compulsions = [
        // Day 1: 1 compulsion
        { type: 'washing', timestamp: '2022-01-01T10:00:00Z' },
        
        // Day 2: 5 compulsions
        { type: 'checking', timestamp: '2022-01-02T09:00:00Z' },
        { type: 'washing', timestamp: '2022-01-02T11:00:00Z' },
        { type: 'counting', timestamp: '2022-01-02T13:00:00Z' },
        { type: 'checking', timestamp: '2022-01-02T15:00:00Z' },
        { type: 'organizing', timestamp: '2022-01-02T17:00:00Z' },
        
        // Day 3: 2 compulsions
        { type: 'washing', timestamp: '2022-01-03T14:00:00Z' },
        { type: 'checking', timestamp: '2022-01-03T16:00:00Z' }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Daily counts: [1, 5, 2], mean = 2.67
      // Variance: ((1-2.67)² + (5-2.67)² + (2-2.67)²) / 3
      // = (2.78 + 5.44 + 0.45) / 3 = 2.89
      // Volatility (stddev) = √2.89 ≈ 1.7

      expect(result.analytics?.tracking?.volatility).toBeCloseTo(1.7, 1);
    });

    it('should handle consistent daily patterns (low volatility)', async () => {
      const compulsions = [
        // Day 1: 3 compulsions
        { type: 'washing', timestamp: '2022-01-01T10:00:00Z' },
        { type: 'checking', timestamp: '2022-01-01T15:00:00Z' },
        { type: 'counting', timestamp: '2022-01-01T20:00:00Z' },
        
        // Day 2: 3 compulsions
        { type: 'washing', timestamp: '2022-01-02T10:00:00Z' },
        { type: 'checking', timestamp: '2022-01-02T15:00:00Z' },
        { type: 'counting', timestamp: '2022-01-02T20:00:00Z' },
        
        // Day 3: 3 compulsions
        { type: 'washing', timestamp: '2022-01-03T10:00:00Z' },
        { type: 'checking', timestamp: '2022-01-03T15:00:00Z' },
        { type: 'counting', timestamp: '2022-01-03T20:00:00Z' }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // All days have same count = 0 volatility
      expect(result.analytics?.tracking?.volatility).toBe(0);
    });
  });

  describe('Weekly Delta Trends', () => {
    it('should calculate weekly trend correctly', async () => {
      const baseTimestamp = Date.now();
      
      // Recent 3 days (high activity)
      const recentCompulsions = [
        { type: 'washing', timestamp: new Date(baseTimestamp - 1*24*60*60*1000).toISOString() },
        { type: 'checking', timestamp: new Date(baseTimestamp - 1*24*60*60*1000).toISOString() },
        { type: 'counting', timestamp: new Date(baseTimestamp - 1*24*60*60*1000).toISOString() },
        { type: 'washing', timestamp: new Date(baseTimestamp - 2*24*60*60*1000).toISOString() },
        { type: 'checking', timestamp: new Date(baseTimestamp - 2*24*60*60*1000).toISOString() },
        { type: 'counting', timestamp: new Date(baseTimestamp - 3*24*60*60*1000).toISOString() }
      ]; // Recent avg: (3+2+1)/3 = 2.0
      
      // Previous 3 days (lower activity)
      const olderCompulsions = [
        { type: 'washing', timestamp: new Date(baseTimestamp - 4*24*60*60*1000).toISOString() },
        { type: 'checking', timestamp: new Date(baseTimestamp - 5*24*60*60*1000).toISOString() },
        { type: 'counting', timestamp: new Date(baseTimestamp - 6*24*60*60*1000).toISOString() }
      ]; // Previous avg: (1+1+1)/3 = 1.0

      const compulsions = [...recentCompulsions, ...olderCompulsions];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Weekly delta: 2.0 - 1.0 = 1.0 (increasing trend)
      expect(result.analytics?.tracking?.weeklyDelta).toBeCloseTo(1.0, 1);
    });

    it('should show negative delta for improving (decreasing) trend', async () => {
      const baseTimestamp = Date.now();
      
      // Recent 3 days (lower activity - improvement)
      const recentCompulsions = [
        { type: 'washing', timestamp: new Date(baseTimestamp - 1*24*60*60*1000).toISOString() }
        // Only 1 compulsion in recent days
      ];
      
      // Previous 3 days (higher activity)
      const olderCompulsions = [
        { type: 'washing', timestamp: new Date(baseTimestamp - 4*24*60*60*1000).toISOString() },
        { type: 'checking', timestamp: new Date(baseTimestamp - 4*24*60*60*1000).toISOString() },
        { type: 'counting', timestamp: new Date(baseTimestamp - 4*24*60*60*1000).toISOString() },
        { type: 'washing', timestamp: new Date(baseTimestamp - 5*24*60*60*1000).toISOString() },
        { type: 'checking', timestamp: new Date(baseTimestamp - 5*24*60*60*1000).toISOString() },
        { type: 'washing', timestamp: new Date(baseTimestamp - 6*24*60*60*1000).toISOString() },
        { type: 'checking', timestamp: new Date(baseTimestamp - 6*24*60*60*1000).toISOString() }
      ]; // Previous avg: (3+2+2)/3 = 2.33

      const compulsions = [...recentCompulsions, ...olderCompulsions];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Recent avg: (1+0+0)/3 = 0.33
      // Weekly delta: 0.33 - 2.33 = -2.0 (decreasing/improving trend)
      expect(result.analytics?.tracking?.weeklyDelta).toBeLessThan(0);
    });

    it('should handle insufficient data for weekly comparison', async () => {
      const compulsions = [
        { type: 'washing', timestamp: '2022-01-01T10:00:00Z' },
        { type: 'checking', timestamp: '2022-01-01T15:00:00Z' }
      ]; // Less than 6 days needed

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      expect(result.analytics?.tracking?.weeklyDelta).toBe(0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should scale confidence based on sample size', async () => {
      const testCases = [
        { compulsionCount: 5, expectedConfidenceRange: [0.50, 0.60] },
        { compulsionCount: 15, expectedConfidenceRange: [0.65, 0.75] },
        { compulsionCount: 30, expectedConfidenceRange: [0.70, 0.80] },
        { compulsionCount: 100, expectedConfidenceRange: [0.80, 0.80] } // Max cap
      ];

      for (const testCase of testCases) {
        const compulsions = generateCompulsions(testCase.compulsionCount);
        
        const result = await unifiedPipeline.process({
          userId: 'test-user',
          content: { compulsions },
          type: 'data',
          context: { source: 'today' }
        });

        const confidence = result.analytics?.tracking?.confidence || 0;
        expect(confidence).toBeGreaterThanOrEqual(testCase.expectedConfidenceRange[0]);
        expect(confidence).toBeLessThanOrEqual(testCase.expectedConfidenceRange[1]);
      }
    });

    it('should use conservative confidence scaling for tracking', async () => {
      // Tracking should be more conservative than other analytics
      const compulsions = generateCompulsions(10);
      
      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Should be lower than equivalent mood/CBT confidence
      expect(result.analytics?.tracking?.confidence).toBeLessThan(0.8);
    });
  });

  describe('Baseline Calculation', () => {
    it('should calculate daily average baseline correctly', async () => {
      const compulsions = [
        // Day 1: 4 compulsions
        { type: 'washing', timestamp: '2022-01-01T10:00:00Z' },
        { type: 'checking', timestamp: '2022-01-01T12:00:00Z' },
        { type: 'counting', timestamp: '2022-01-01T15:00:00Z' },
        { type: 'organizing', timestamp: '2022-01-01T18:00:00Z' },
        
        // Day 2: 2 compulsions
        { type: 'washing', timestamp: '2022-01-02T11:00:00Z' },
        { type: 'checking', timestamp: '2022-01-02T16:00:00Z' },
        
        // Day 3: 6 compulsions
        { type: 'washing', timestamp: '2022-01-03T09:00:00Z' },
        { type: 'checking', timestamp: '2022-01-03T11:00:00Z' },
        { type: 'counting', timestamp: '2022-01-03T13:00:00Z' },
        { type: 'organizing', timestamp: '2022-01-03T15:00:00Z' },
        { type: 'washing', timestamp: '2022-01-03T17:00:00Z' },
        { type: 'checking', timestamp: '2022-01-03T19:00:00Z' }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Daily average: (4+2+6)/3 = 4.0
      expect(result.analytics?.tracking?.baselines?.compulsions).toBeCloseTo(4.0, 1);
    });

    it('should round baseline to one decimal place', async () => {
      const compulsions = [
        // Day 1: 1 compulsion
        { type: 'washing', timestamp: '2022-01-01T10:00:00Z' },
        
        // Day 2: 2 compulsions
        { type: 'checking', timestamp: '2022-01-02T11:00:00Z' },
        { type: 'counting', timestamp: '2022-01-02T16:00:00Z' },
        
        // Day 3: 0 compulsions (empty day)
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Daily average: (1+2+0)/2 = 1.5 (only days with data counted)
      expect(result.analytics?.tracking?.baselines?.compulsions).toBe(1.5);
    });
  });

  describe('Quality Ribbon Integration', () => {
    it('should provide data for high-quality ribbon with rich dataset', async () => {
      const compulsions = generateCompulsions(50); // Rich dataset
      
      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      expect(result.analytics?.tracking).toMatchObject({
        sampleSize: 50,
        confidence: expect.any(Number),
        dataQuality: expect.any(Number)
      });

      // Should support high quality rating
      expect(result.analytics.tracking.sampleSize).toBeGreaterThan(20);
      expect(result.analytics.tracking.confidence).toBeGreaterThan(0.7);
    });

    it('should provide medium quality data for moderate dataset', async () => {
      const compulsions = generateCompulsions(12);
      
      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Should provide medium quality rating
      expect(result.analytics?.tracking?.confidence).toBeGreaterThan(0.5);
      expect(result.analytics?.tracking?.confidence).toBeLessThan(0.8);
      expect(result.analytics?.tracking?.sampleSize).toBe(12);
    });
  });

  describe('Edge Cases', () => {
    it('should handle compulsions without timestamps', async () => {
      const compulsions = [
        { type: 'washing' }, // No timestamp
        { type: 'checking', timestamp: '2022-01-01T10:00:00Z' },
        { type: 'counting' } // No timestamp
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Should only process entries with valid timestamps
      expect(result.analytics?.tracking?.sampleSize).toBe(3); // Total count includes all
      // But daily grouping only works with timestamped entries
    });

    it('should handle extreme daily variations', async () => {
      const compulsions = [
        // Day 1: 0 compulsions (no entries)
        
        // Day 2: 20 compulsions
        ...Array.from({ length: 20 }, (_, i) => ({
          type: 'washing',
          timestamp: `2022-01-02T${String(i % 24).padStart(2, '0')}:00:00Z`
        })),
        
        // Day 3: 1 compulsion
        { type: 'checking', timestamp: '2022-01-03T10:00:00Z' }
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Should handle extreme variations
      expect(result.analytics?.tracking?.volatility).toBeGreaterThan(5);
      expect(result.analytics?.tracking?.sampleSize).toBe(21);
    });

    it('should handle identical timestamps', async () => {
      const compulsions = [
        { type: 'washing', timestamp: '2022-01-01T10:00:00Z' },
        { type: 'checking', timestamp: '2022-01-01T10:00:00Z' }, // Same time
        { type: 'counting', timestamp: '2022-01-01T10:00:00Z' }  // Same time
      ];

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions },
        type: 'data',
        context: { source: 'today' }
      });

      // Should group all on same day
      expect(result.analytics?.tracking?.baselines?.compulsions).toBe(3);
      expect(result.analytics?.tracking?.volatility).toBe(0); // Single day
    });
  });

  describe('Performance', () => {
    it('should process large tracking datasets efficiently', async () => {
      const largeCompulsionDataset = generateCompulsions(2000);

      const startTime = Date.now();
      
      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: { compulsions: largeCompulsionDataset },
        type: 'data',
        context: { source: 'today' }
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(1500); // < 1.5 seconds
      expect(result.analytics?.tracking).toBeDefined();
    });

    it('should handle memory efficiently with large datasets', async () => {
      const massiveDataset = generateCompulsions(10000);

      await expect(
        unifiedPipeline.process({
          userId: 'test-user',
          content: { compulsions: massiveDataset },
          type: 'data',
          context: { source: 'today' }
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Integration with Other Analytics', () => {
    it('should work alongside mood and CBT analytics', async () => {
      const mixedData = {
        compulsions: generateCompulsions(10),
        cbtRecords: [
          { mood_before: 3, mood_after: 7 },
          { mood_before: 4, mood_after: 8 }
        ],
        moodEntries: [
          { mood: 5, timestamp: '2022-01-01T10:00:00Z' },
          { mood: 7, timestamp: '2022-01-01T15:00:00Z' }
        ]
      };

      const result = await unifiedPipeline.process({
        userId: 'test-user',
        content: mixedData,
        type: 'data',
        context: { source: 'today' }
      });

      // Should have all analytics types
      expect(result.analytics?.tracking).toBeDefined();
      expect(result.analytics?.cbt).toBeDefined();
      // Mood analytics depend on patterns processing
    });
  });
});
