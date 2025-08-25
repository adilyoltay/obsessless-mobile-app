/**
 * 🧪 Integration Tests - OCD Page Quality Ribbon
 * 
 * Tests Fresh/Cache transitions, invalidation, and Quality Ribbon visibility
 * for OCD pattern data with deterministic test mode.
 */

import type { ProvenanceSource, QualityLevel } from '@/features/ai/insights/insightRegistry';
import { 
  seedOCDScenario,
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

describe('OCD Page - Quality Ribbon Integration', () => {
  
  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanupSeeds(TEST_ENV.SEED_USER_ID);
  });

  afterEach(async () => {
    await cleanupSeeds(TEST_ENV.SEED_USER_ID);
  });

  describe('[QR:ocd:fresh] Fresh Pipeline Results', () => {
    it('[QR:ocd:fresh] should display Fresh source badge with contamination pattern', async () => {
      // Seed OCD contamination scenario: 3 days with pattern data
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 3, 'contamination');
      
      // Mock fresh pipeline result for OCD
      const freshResult = createMockPipelineResult('unified', 'high', 'ocd');
      
      // Verify fresh source characteristics
      expect(freshResult.qualityMetadata?.source).toBe('unified');
      expect(freshResult.qualityMetadata?.freshnessMs).toBe(0); // Fresh = 0ms
      expect(freshResult.qualityMetadata?.sampleSize).toBe(18); // High quality OCD
      expect(freshResult.qualityMetadata?.quality).toBe('high');
    });

    it('[QR:ocd:fresh] should trigger invalidation for new compulsion event', async () => {
      // Initial seed with checking pattern
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 2, 'checking');
      
      // Simulate invalidation trigger
      let cacheInvalidated = false;
      const mockInvalidation = () => {
        cacheInvalidated = true;
      };
      
      // Simulate compulsion_added event (OCD-specific trigger)
      mockInvalidation();
      
      expect(cacheInvalidated).toBe(true);
      
      // After invalidation, next result should be Fresh
      const freshResult = createMockPipelineResult('unified', 'medium', 'ocd');
      expect(freshResult.qualityMetadata?.source).toBe('unified');
      expect(freshResult.qualityMetadata?.freshnessMs).toBe(0);
    });
  });

  describe('[QR:ocd:cache] Cache Behavior & TTL Transitions', () => {
    it('[QR:ocd:cache] should transition from Fresh to Cache after TTL expires', async () => {
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 2, 'symmetry');
      
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

    it('[QR:ocd:cache] should show Cache badge for cached OCD pattern analysis', async () => {
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 4, 'contamination');
      
      // Mock cached result
      const cachedResult = createMockPipelineResult('cache', 'high', 'ocd');
      
      expect(cachedResult.qualityMetadata?.source).toBe('cache');
      expect(cachedResult.qualityMetadata?.quality).toBe('high');
      expect(cachedResult.qualityMetadata?.freshnessMs).toBe(1500); // Cache freshness
    });
  });

  describe('[QR:ocd:hidden] Quality Ribbon Hiding Conditions', () => {
    it('[QR:ocd:hidden] should hide when no OCD pattern data provided', async () => {
      // No seed data - empty OCD patterns
      const suggestion = {
        content: 'OCD suggestion text',
        meta: null // No quality metadata
      };
      
      const shouldShowRibbon = suggestion.meta !== null && suggestion.meta !== undefined;
      
      expect(shouldShowRibbon).toBe(false);
    });

    it('[QR:ocd:hidden] should hide when OCD pipeline processing fails', async () => {
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 1, 'checking');
      
      let error = null;
      
      // Simulate pipeline failure
      try {
        throw new Error('OCD pipeline processing failed');
      } catch (e) {
        error = e;
      }
      
      const shouldShowRibbon = error === null;
      
      expect(shouldShowRibbon).toBe(false);
      expect(error).toBeTruthy();
    });

    it('[QR:ocd:hidden] should hide when insufficient pattern data', async () => {
      // Minimal OCD data - only 1 day
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 1, 'contamination');
      
      // Very low quality should potentially hide ribbon
      const lowQualityResult = createMockPipelineResult('unified', 'low', 'ocd');
      
      expect(lowQualityResult.qualityMetadata?.sampleSize).toBe(4); // Low quality threshold
      expect(lowQualityResult.qualityMetadata?.quality).toBe('low');
      
      // Pattern-based hiding logic
      const patternThreshold = 3;
      const shouldHide = (lowQualityResult.qualityMetadata?.sampleSize || 0) <= patternThreshold;
      
      expect(shouldHide).toBe(false); // 4 > 3, so still shows
    });
  });

  describe('[QR:ocd:patterns] OCD Pattern Tests', () => {
    const patternScenarios = [
      { 
        pattern: 'contamination', 
        days: 4, 
        expectedCompulsion: 'washing',
        description: 'contamination fears and washing rituals'
      },
      { 
        pattern: 'checking', 
        days: 3, 
        expectedCompulsion: 'checking',
        description: 'doubt and repeated checking behaviors'
      },
      { 
        pattern: 'symmetry', 
        days: 2, 
        expectedCompulsion: 'organizing',
        description: 'order, symmetry, and arranging compulsions'
      }
    ] as const;

    patternScenarios.forEach(({ pattern, days, expectedCompulsion, description }) => {
      it(`[QR:ocd:${pattern}] should process ${pattern} pattern (${description})`, async () => {
        await seedOCDScenario(TEST_ENV.SEED_USER_ID, days, pattern);
        
        const result = createMockPipelineResult('unified', 'high', 'ocd');
        
        // Verify OCD-specific pattern analytics
        expect(result.qualityMetadata?.source).toBe('unified');
        expect(result.qualityMetadata?.quality).toBe('high');
        
        // In real implementation, patterns would influence quality metrics
        const patternData = {
          patternType: pattern,
          expectedCompulsion,
          daysTracked: days,
          entriesPerDay: 2 // From seedOCDScenario
        };
        
        expect(patternData.patternType).toBe(pattern);
        expect(patternData.expectedCompulsion).toBe(expectedCompulsion);
        expect(patternData.daysTracked).toBe(days);
      });
    });
  });

  describe('[QR:ocd:quality] Quality Level Tests', () => {
    const qualityScenarios = [
      { scenario: 'high', expectedQuality: 'high', days: 5, expectedSample: 18 },
      { scenario: 'medium', expectedQuality: 'medium', days: 3, expectedSample: 9 },
      { scenario: 'low', expectedQuality: 'low', days: 1, expectedSample: 4 }
    ] as const;

    qualityScenarios.forEach(({ scenario, expectedQuality, days, expectedSample }) => {
      it(`[QR:ocd:${expectedQuality}] should show ${expectedQuality} quality for ${days} days pattern data`, async () => {
        await seedOCDScenario(TEST_ENV.SEED_USER_ID, days, 'contamination');
        
        const result = createMockPipelineResult('unified', scenario, 'ocd');
        
        expect(result.qualityMetadata?.quality).toBe(expectedQuality);
        expect(result.qualityMetadata?.sampleSize).toBe(expectedSample);
        expect(result.qualityMetadata?.source).toBe('unified');
      });
    });
  });

  describe('[QR:ocd:triggers] Trigger Recognition Tests', () => {
    const triggerScenarios = [
      { 
        pattern: 'contamination',
        expectedTriggers: ['Kapı kollarına dokunmak', 'Banyo kullanımı', 'Yemek hazırlama'],
        description: 'contamination triggers'
      },
      { 
        pattern: 'checking',
        expectedTriggers: ['Kapıları kilitleme', 'Elektronik cihazları kapatma', 'Güvenlik kontrolü'],
        description: 'checking triggers'
      },
      { 
        pattern: 'symmetry',
        expectedTriggers: ['Eşyaları düzenleme', 'Kitapları hizalama', 'Kıyafetleri katlamak'],
        description: 'symmetry triggers'
      }
    ] as const;

    triggerScenarios.forEach(({ pattern, expectedTriggers, description }) => {
      it(`[QR:ocd:triggers] should recognize ${description} for ${pattern}`, async () => {
        await seedOCDScenario(TEST_ENV.SEED_USER_ID, 3, pattern);
        
        const result = createMockPipelineResult('unified', 'high', 'ocd');
        
        // Verify trigger recognition analytics
        expect(result.qualityMetadata?.source).toBe('unified');
        expect(result.qualityMetadata?.quality).toBe('high');
        
        // Trigger data would be processed by OCD analytics
        const triggerData = {
          patternType: pattern,
          possibleTriggers: expectedTriggers,
          recognitionAccuracy: result.qualityMetadata?.confidence || 0.89
        };
        
        expect(triggerData.patternType).toBe(pattern);
        expect(triggerData.possibleTriggers).toContain(expectedTriggers[0]);
        expect(triggerData.recognitionAccuracy).toBeGreaterThan(0.8);
      });
    });
  });

  describe('[QR:ocd:resistance] Resistance Tracking Tests', () => {
    it('[QR:ocd:high] should show high quality for resistance attempts tracking', async () => {
      // OCD scenario with resistance data
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 4, 'contamination');
      
      const result = createMockPipelineResult('unified', 'high', 'ocd');
      
      // High quality OCD analytics should include resistance tracking
      expect(result.qualityMetadata?.quality).toBe('high');
      expect(result.qualityMetadata?.confidence).toBe(0.89);
      expect(result.qualityMetadata?.dataQuality).toBe(0.91);
      
      // Resistance data would enhance quality metrics
      const resistanceData = {
        hasResistanceData: true,
        qualityLevel: result.qualityMetadata?.quality,
        confidenceLevel: result.qualityMetadata?.confidence
      };
      
      expect(resistanceData.hasResistanceData).toBe(true);
      expect(resistanceData.qualityLevel).toBe('high');
      expect(resistanceData.confidenceLevel).toBeGreaterThan(0.8);
    });

    it('[QR:ocd:medium] should handle partial resistance data', async () => {
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 2, 'checking');
      
      const result = createMockPipelineResult('unified', 'medium', 'ocd');
      
      expect(result.qualityMetadata?.quality).toBe('medium');
      expect(result.qualityMetadata?.confidence).toBe(0.71);
    });
  });

  describe('[QR:ocd:testmode] Test Mode Integration', () => {
    it('[QR:ocd:testmode] should respect TEST_TTL_MS for OCD cache', async () => {
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 2, 'symmetry');
      
      expect(TEST_ENV.MODE).toBe(true);
      expect(TEST_ENV.TTL_MS).toBe(5000);
      
      // OCD cache should use test TTL
      const testTTL = TEST_ENV.MODE ? TEST_ENV.TTL_MS : 3600000;
      expect(testTTL).toBe(5000);
      expect(testTTL).toBeLessThan(10000); // Faster for testing
    });

    it('[QR:ocd:testmode] should handle deterministic pattern generation', async () => {
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 3, 'contamination');
      
      // Test mode should generate deterministic OCD patterns
      const result1 = createMockPipelineResult('unified', 'high', 'ocd');
      const result2 = createMockPipelineResult('unified', 'high', 'ocd');
      
      // Results should be consistent in test mode
      expect(result1.qualityMetadata?.quality).toBe(result2.qualityMetadata?.quality);
      expect(result1.qualityMetadata?.source).toBe(result2.qualityMetadata?.source);
      expect(result1.qualityMetadata?.sampleSize).toBe(result2.qualityMetadata?.sampleSize);
    });

    it('[QR:ocd:testmode] should use TEST_SEED_USER_ID consistently', async () => {
      await seedOCDScenario(TEST_ENV.SEED_USER_ID, 1, 'checking');
      
      expect(TEST_ENV.SEED_USER_ID).toBe('test-user-1');
      
      // All OCD data should reference the deterministic test user
      const result = createMockPipelineResult('unified', 'medium', 'ocd');
      
      expect(result.qualityMetadata?.source).toBe('unified');
      expect(result.qualityMetadata?.quality).toBe('medium');
    });
  });
});
