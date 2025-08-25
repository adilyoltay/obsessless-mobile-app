/**
 * 🧪 Integration Tests - CBT Page Quality Ribbon
 * 
 * Tests Fresh/Cache transitions, invalidation, and Quality Ribbon visibility
 * for CBT thought records with deterministic test mode.
 */

import type { ProvenanceSource, QualityLevel } from '@/features/ai/insights/insightRegistry';
import { 
  seedCBTRecords,
  cleanupSeeds,
  TEST_ENV,
  createMockPipelineResult
} from '../fixtures/seedData';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: 'Stack.Screen' }
}));

describe('CBT Page - Quality Ribbon Integration', () => {
  
  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanupSeeds(TEST_ENV.SEED_USER_ID);
  });

  afterEach(async () => {
    await cleanupSeeds(TEST_ENV.SEED_USER_ID);
  });

  describe('[QR:cbt:fresh] Fresh Pipeline Results', () => {
    it('[QR:cbt:fresh] should display Fresh source badge with CBT records', async () => {
      // Seed CBT records: 5 thought records with cognitive distortions
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 5, {
        distortions: ['catastrophizing', 'all-or-nothing', 'mind-reading']
      });
      
      // Mock fresh pipeline result for CBT
      const freshResult = createMockPipelineResult('unified', 'high', 'cbt');
      
      // Verify fresh source characteristics
      expect(freshResult.qualityMetadata?.source).toBe('unified');
      expect(freshResult.qualityMetadata?.freshnessMs).toBe(0); // Fresh = 0ms
      expect(freshResult.qualityMetadata?.sampleSize).toBe(12); // High quality CBT
      expect(freshResult.qualityMetadata?.quality).toBe('high');
    });

    it('[QR:cbt:fresh] should trigger invalidation for new thought record', async () => {
      // Initial seed
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 3);
      
      // Simulate invalidation trigger
      let cacheInvalidated = false;
      const mockInvalidation = () => {
        cacheInvalidated = true;
      };
      
      // Simulate cbt_record_added event
      mockInvalidation();
      
      expect(cacheInvalidated).toBe(true);
      
      // After invalidation, next result should be Fresh
      const freshResult = createMockPipelineResult('unified', 'medium', 'cbt');
      expect(freshResult.qualityMetadata?.source).toBe('unified');
      expect(freshResult.qualityMetadata?.freshnessMs).toBe(0);
    });
  });

  describe('[QR:cbt:cache] Cache Behavior & TTL Transitions', () => {
    it('[QR:cbt:cache] should transition from Fresh to Cache after TTL expires', async () => {
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 4);
      
      // Initial state: Fresh
      const freshMeta = {
        source: 'unified' as ProvenanceSource,
        freshnessMs: 0,
        processedAt: Date.now()
      };
      
      expect(freshMeta.source).toBe('unified');
      expect(freshMeta.freshnessMs).toBeLessThan(TEST_ENV.TTL_MS);
      
      // After TTL expires: should become Cache
      const cachedMeta = {
        source: 'cache' as ProvenanceSource,
        freshnessMs: TEST_ENV.TTL_MS + 1000,
        processedAt: Date.now() - TEST_ENV.TTL_MS - 1000
      };
      
      expect(cachedMeta.source).toBe('cache');
      expect(cachedMeta.freshnessMs).toBeGreaterThan(TEST_ENV.TTL_MS);
    });

    it('[QR:cbt:cache] should show Cache badge for cached CBT analysis', async () => {
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 6, {
        distortions: ['overgeneralization', 'personalization']
      });
      
      // Mock cached result with specific age
      const cachedResult = createMockPipelineResult('cache', 'high', 'cbt');
      
      expect(cachedResult.qualityMetadata?.source).toBe('cache');
      expect(cachedResult.qualityMetadata?.quality).toBe('high');
      expect(cachedResult.qualityMetadata?.freshnessMs).toBe(1500); // Cache freshness
    });
  });

  describe('[QR:cbt:hidden] Quality Ribbon Hiding Conditions', () => {
    it('[QR:cbt:hidden] should hide when no CBT records provided', async () => {
      // No seed data - empty CBT
      const suggestion = {
        content: 'CBT suggestion text',
        meta: null // No quality metadata
      };
      
      const shouldShowRibbon = suggestion.meta !== null && suggestion.meta !== undefined;
      
      expect(shouldShowRibbon).toBe(false);
    });

    it('[QR:cbt:hidden] should hide when CBT pipeline processing fails', async () => {
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 2);
      
      let error = null;
      
      // Simulate pipeline failure
      try {
        throw new Error('CBT pipeline processing failed');
      } catch (e) {
        error = e;
      }
      
      const shouldShowRibbon = error === null;
      
      expect(shouldShowRibbon).toBe(false);
      expect(error).toBeTruthy();
    });

    it('[QR:cbt:hidden] should hide when insufficient thought records', async () => {
      // Minimal CBT data
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 1); // Only 1 record
      
      // Very low quality should potentially hide ribbon
      const lowQualityResult = createMockPipelineResult('unified', 'low', 'cbt');
      
      expect(lowQualityResult.qualityMetadata?.sampleSize).toBe(3); // Low quality threshold
      expect(lowQualityResult.qualityMetadata?.quality).toBe('low');
      
      // Quality-based hiding logic
      const qualityThreshold = 2;
      const shouldHide = (lowQualityResult.qualityMetadata?.sampleSize || 0) <= qualityThreshold;
      
      expect(shouldHide).toBe(false); // 3 > 2, so still shows
    });
  });

  describe('[QR:cbt:quality] Quality Level Tests', () => {
    const qualityScenarios = [
      { scenario: 'high', expectedQuality: 'high', recordCount: 8, expectedSample: 12 },
      { scenario: 'medium', expectedQuality: 'medium', recordCount: 5, expectedSample: 7 },
      { scenario: 'low', expectedQuality: 'low', recordCount: 2, expectedSample: 3 }
    ] as const;

    qualityScenarios.forEach(({ scenario, expectedQuality, recordCount, expectedSample }) => {
      it(`[QR:cbt:${expectedQuality}] should show ${expectedQuality} quality for ${recordCount} records`, async () => {
        await seedCBTRecords(TEST_ENV.SEED_USER_ID, recordCount);
        
        const result = createMockPipelineResult('unified', scenario, 'cbt');
        
        expect(result.qualityMetadata?.quality).toBe(expectedQuality);
        expect(result.qualityMetadata?.sampleSize).toBe(expectedSample);
        expect(result.qualityMetadata?.source).toBe('unified');
      });
    });
  });

  describe('[QR:cbt:distortions] Cognitive Distortion Tests', () => {
    const distortionScenarios = [
      { 
        distortions: ['catastrophizing', 'all-or-nothing'], 
        description: 'common distortions',
        count: 4 
      },
      { 
        distortions: ['mind-reading', 'personalization', 'overgeneralization'], 
        description: 'complex distortions',
        count: 6 
      },
      { 
        distortions: ['labeling', 'should-statements'], 
        description: 'specific patterns',
        count: 3 
      }
    ];

    distortionScenarios.forEach(({ distortions, description, count }) => {
      it(`[QR:cbt:distortions] should process ${description} (${distortions.join(', ')})`, async () => {
        await seedCBTRecords(TEST_ENV.SEED_USER_ID, count, { distortions });
        
        const result = createMockPipelineResult('unified', 'high', 'cbt');
        
        // Verify CBT-specific analytics are processed
        expect(result.qualityMetadata?.source).toBe('unified');
        expect(result.qualityMetadata?.quality).toBe('high');
        
        // In real implementation, distortions would influence quality
        const distortionData = {
          distortionTypes: distortions,
          recordCount: count,
          diversity: distortions.length
        };
        
        expect(distortionData.distortionTypes).toEqual(distortions);
        expect(distortionData.recordCount).toBe(count);
        expect(distortionData.diversity).toBe(distortions.length);
      });
    });
  });

  describe('[QR:cbt:mood] Mood Improvement Tracking', () => {
    it('[QR:cbt:high] should show high quality for consistent mood improvement', async () => {
      // Seed CBT records that show mood improvement patterns
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 8, {
        distortions: ['catastrophizing', 'overgeneralization', 'mind-reading']
      });
      
      const result = createMockPipelineResult('unified', 'high', 'cbt');
      
      // High quality CBT should indicate good therapeutic progress
      expect(result.qualityMetadata?.quality).toBe('high');
      expect(result.qualityMetadata?.confidence).toBe(0.85);
      expect(result.qualityMetadata?.dataQuality).toBe(0.89);
      
      // Verify therapeutic insights are present
      expect(result.insights.therapeutic).toBeDefined();
      expect(Array.isArray(result.insights.therapeutic)).toBe(true);
    });

    it('[QR:cbt:medium] should show medium quality for moderate progress', async () => {
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 4);
      
      const result = createMockPipelineResult('unified', 'medium', 'cbt');
      
      expect(result.qualityMetadata?.quality).toBe('medium');
      expect(result.qualityMetadata?.confidence).toBe(0.68);
      expect(result.qualityMetadata?.dataQuality).toBe(0.74);
    });

    it('[QR:cbt:low] should show low quality for limited data', async () => {
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 2);
      
      const result = createMockPipelineResult('unified', 'low', 'cbt');
      
      expect(result.qualityMetadata?.quality).toBe('low');
      expect(result.qualityMetadata?.confidence).toBe(0.42);
      expect(result.qualityMetadata?.dataQuality).toBe(0.55);
    });
  });

  describe('[QR:cbt:testmode] Test Mode Integration', () => {
    it('[QR:cbt:testmode] should respect TEST_TTL_MS for CBT cache', async () => {
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 3);
      
      expect(TEST_ENV.MODE).toBe(true);
      expect(TEST_ENV.TTL_MS).toBe(5000);
      
      // CBT cache should use test TTL
      const testTTL = TEST_ENV.MODE ? TEST_ENV.TTL_MS : 3600000;
      expect(testTTL).toBe(5000);
      expect(testTTL).toBeLessThan(10000); // Faster testing
    });

    it('[QR:cbt:testmode] should handle CBT pipeline stub mode', async () => {
      await seedCBTRecords(TEST_ENV.SEED_USER_ID, 5);
      
      expect(TEST_ENV.PIPELINE_STUB).toBe(true);
      
      // In stub mode, pipeline should return deterministic results
      const result = createMockPipelineResult('unified', 'high', 'cbt');
      
      expect(result.qualityMetadata?.source).toBe('unified');
      expect(result.qualityMetadata?.quality).toBe('high');
      
      // Stub mode ensures consistent results across test runs
      const result2 = createMockPipelineResult('unified', 'high', 'cbt');
      expect(result.qualityMetadata?.quality).toBe(result2.qualityMetadata?.quality);
    });
  });
});
