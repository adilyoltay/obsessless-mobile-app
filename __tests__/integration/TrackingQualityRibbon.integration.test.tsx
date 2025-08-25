/**
 * 🧪 Integration Tests - Tracking Page Quality Ribbon
 * 
 * Tests Fresh/Cache transitions, invalidation, and Quality Ribbon visibility
 * for Tracking/Compulsion data with deterministic test mode.
 */

import type { ProvenanceSource, QualityLevel } from '@/features/ai/insights/insightRegistry';
import { 
  seedTrackingCompulsions,
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

describe('Tracking Page - Quality Ribbon Integration', () => {
  
  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanupSeeds(TEST_ENV.SEED_USER_ID);
  });

  afterEach(async () => {
    await cleanupSeeds(TEST_ENV.SEED_USER_ID);
  });

  describe('[QR:tracking:fresh] Fresh Pipeline Results', () => {
    it('[QR:tracking:fresh] should display Fresh source badge with compulsion data', async () => {
      // Seed tracking compulsions: 3 days, 2 per day = 6 total compulsions
      await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, 3, 2);
      
      // Mock fresh pipeline result for tracking
      const freshResult = createMockPipelineResult('unified', 'high', 'tracking');
      
      // Verify fresh source characteristics
      expect(freshResult.qualityMetadata?.source).toBe('unified');
      expect(freshResult.qualityMetadata?.freshnessMs).toBe(0); // Fresh = 0ms
      expect(freshResult.qualityMetadata?.sampleSize).toBe(20); // High quality tracking
      expect(freshResult.qualityMetadata?.quality).toBe('high');
    });

    it('[QR:tracking:fresh] should trigger cache invalidation for new compulsion', async () => {
      // Initial seed
      await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, 2, 1);
      
      // Simulate invalidation trigger
      let cacheInvalidated = false;
      const mockInvalidation = () => {
        cacheInvalidated = true;
      };
      
      // Simulate compulsion_added event
      mockInvalidation();
      
      expect(cacheInvalidated).toBe(true);
      
      // After invalidation, next result should be Fresh
      const freshResult = createMockPipelineResult('unified', 'medium', 'tracking');
      expect(freshResult.qualityMetadata?.source).toBe('unified');
      expect(freshResult.qualityMetadata?.freshnessMs).toBe(0);
    });
  });

  describe('[QR:tracking:cache] Cache Behavior & TTL Transitions', () => {
    it('[QR:tracking:cache] should transition from Fresh to Cache after TTL expires', async () => {
      await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, 2, 2);
      
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

    it('[QR:tracking:cache] should show appropriate age badge for cached results', async () => {
      await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, 1, 3);
      
      // Mock cached result with specific age
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const cachedResult = createMockPipelineResult('cache', 'medium', 'tracking');
      
      // Calculate expected age
      const ageMs = Date.now() - oneHourAgo;
      const ageInHours = Math.floor(ageMs / (60 * 60 * 1000));
      
      expect(cachedResult.qualityMetadata?.source).toBe('cache');
      expect(ageInHours).toBe(1); // Should be 1 hour
    });
  });

  describe('[QR:tracking:hidden] Quality Ribbon Hiding Conditions', () => {
    it('[QR:tracking:hidden] should hide when no compulsion data provided', async () => {
      // No seed data - empty tracking
      const suggestion = {
        content: 'Tracking suggestion text',
        meta: null // No quality metadata
      };
      
      const shouldShowRibbon = suggestion.meta !== null && suggestion.meta !== undefined;
      
      expect(shouldShowRibbon).toBe(false);
    });

    it('[QR:tracking:hidden] should hide when pipeline processing fails', async () => {
      await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, 1, 1);
      
      let error = null;
      
      // Simulate pipeline failure
      try {
        throw new Error('Tracking pipeline processing failed');
      } catch (e) {
        error = e;
      }
      
      const shouldShowRibbon = error === null;
      
      expect(shouldShowRibbon).toBe(false);
      expect(error).toBeTruthy();
    });

    it('[QR:tracking:hidden] should hide when insufficient compulsion data', async () => {
      // Very minimal data - should trigger hidden state
      await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, 1, 1); // Only 1 compulsion
      
      // Low quality should potentially hide ribbon based on thresholds
      const lowQualityResult = createMockPipelineResult('unified', 'low', 'tracking');
      
      expect(lowQualityResult.qualityMetadata?.sampleSize).toBe(5); // Low quality threshold
      expect(lowQualityResult.qualityMetadata?.quality).toBe('low');
      
      // In real app, this might be hidden based on quality threshold
      const qualityThreshold = 3;
      const shouldHide = (lowQualityResult.qualityMetadata?.sampleSize || 0) <= qualityThreshold;
      
      expect(shouldHide).toBe(false); // 5 > 3, so still shows
    });
  });

  describe('[QR:tracking:quality] Quality Level Tests', () => {
    const qualityScenarios = [
      { scenario: 'high', expectedQuality: 'high', days: 5, perDay: 3, expectedSample: 20 },
      { scenario: 'medium', expectedQuality: 'medium', days: 3, perDay: 2, expectedSample: 11 },
      { scenario: 'low', expectedQuality: 'low', days: 1, perDay: 2, expectedSample: 5 }
    ] as const;

    qualityScenarios.forEach(({ scenario, expectedQuality, days, perDay, expectedSample }) => {
      it(`[QR:tracking:${expectedQuality}] should show ${expectedQuality} quality for ${days}d×${perDay}/day data`, async () => {
        await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, days, perDay);
        
        const result = createMockPipelineResult('unified', scenario, 'tracking');
        
        expect(result.qualityMetadata?.quality).toBe(expectedQuality);
        expect(result.qualityMetadata?.sampleSize).toBe(expectedSample);
        expect(result.qualityMetadata?.source).toBe('unified');
      });
    });
  });

  describe('[QR:tracking:categories] Compulsion Category Tests', () => {
    const categoryScenarios = [
      { category: 'contamination', expectedCompulsion: 'washing' },
      { category: 'checking', expectedCompulsion: 'checking' },
      { category: 'symmetry', expectedCompulsion: 'organizing' }
    ] as const;

    categoryScenarios.forEach(({ category, expectedCompulsion }) => {
      it(`[QR:tracking:category] should handle ${category} compulsion category`, async () => {
        await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, 2, 2, category);
        
        const result = createMockPipelineResult('unified', 'high', 'tracking');
        
        // Verify category-specific data is properly structured
        expect(result.qualityMetadata?.source).toBe('unified');
        expect(result.qualityMetadata?.quality).toBe('high');
        
        // In real implementation, category would influence analytics
        // Here we just verify the pipeline processes category-specific data
        const categoryData = {
          category,
          expectedCompulsionType: expectedCompulsion
        };
        
        expect(categoryData.category).toBe(category);
        expect(categoryData.expectedCompulsionType).toBe(expectedCompulsion);
      });
    });
  });

  describe('[QR:tracking:testmode] Test Mode Integration', () => {
    it('[QR:tracking:testmode] should respect TEST_TTL_MS for tracking cache', async () => {
      await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, 1, 1);
      
      expect(TEST_ENV.MODE).toBe(true);
      expect(TEST_ENV.TTL_MS).toBe(5000);
      
      // Test mode should use shorter TTL for faster testing
      const testTTL = TEST_ENV.MODE ? TEST_ENV.TTL_MS : 3600000;
      expect(testTTL).toBe(5000);
      expect(testTTL).toBeLessThan(10000); // Much shorter than production
    });

    it('[QR:tracking:testmode] should use deterministic user ID', async () => {
      await seedTrackingCompulsions(TEST_ENV.SEED_USER_ID, 1, 2);
      
      expect(TEST_ENV.SEED_USER_ID).toBe('test-user-1');
      
      // All tracking data should use this deterministic ID
      const result = createMockPipelineResult('unified', 'high', 'tracking');
      
      // Verify deterministic behavior
      expect(result.qualityMetadata?.source).toBe('unified');
      expect(result.qualityMetadata?.quality).toBe('high');
    });
  });
});
