/**
 * Test suite for UnifiedConfidenceCalculator
 */

import { UnifiedConfidenceCalculator } from '@/features/ai/core/helpers/UnifiedConfidenceCalculator';

describe('UnifiedConfidenceCalculator', () => {
  let calculator: UnifiedConfidenceCalculator;

  beforeEach(() => {
    calculator = new UnifiedConfidenceCalculator();
  });

  describe('calculate', () => {
    it('should return low confidence for minimal evidence', () => {
      const result = calculator.calculate({
        type: 'voice',
        evidenceCount: 1,
        textLength: 5
      });

      expect(result).toBeLessThan(0.5);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should return high confidence for strong evidence', () => {
      const result = calculator.calculate({
        type: 'voice',
        evidenceCount: 10,
        textLength: 200,
        quality: 0.9
      });

      expect(result).toBeGreaterThan(0.8);
      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should never exceed MAX_CONFIDENCE', () => {
      const result = calculator.calculate({
        type: 'voice',
        evidenceCount: 100,
        textLength: 1000,
        quality: 1.0,
        patternMatches: 50
      });

      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should handle pattern type correctly', () => {
      const result = calculator.calculate({
        type: 'pattern',
        dataPoints: 15,
        evidenceCount: 5,
        quality: 0.7
      });

      expect(result).toBeGreaterThan(0.5);
      expect(result).toBeLessThan(0.9);
    });

    it('should handle CBT type with text length', () => {
      const result = calculator.calculate({
        type: 'cbt',
        evidenceCount: 3,
        textLength: 150,
        patternMatches: 4
      });

      expect(result).toBeGreaterThan(0.4);
      expect(result).toBeLessThan(0.85);
    });

    it('should handle global analytics type', () => {
      const result = calculator.calculate({
        type: 'global',
        sampleSize: 30,
        quality: 0.8,
        dataPoints: 25,
        correlations: {
          moodEnergy: 0.7,
          moodAnxiety: -0.6,
          energyAnxiety: -0.5
        }
      });

      expect(result).toBeGreaterThan(0.6);
      expect(result).toBeLessThanOrEqual(0.95);
    });
  });

  describe('calculateWithDetails', () => {
    it('should return detailed confidence result', () => {
      const result = calculator.calculateWithDetails({
        type: 'voice',
        evidenceCount: 3,
        textLength: 50
      });

      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('uncertainty');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('shouldAbstain');

      expect(result.factors).toHaveProperty('base');
      expect(result.factors).toHaveProperty('evidence');
      expect(result.factors).toHaveProperty('quality');
      expect(result.factors).toHaveProperty('adjustment');
    });

    it('should recommend abstain for low evidence', () => {
      const result = calculator.calculateWithDetails({
        type: 'voice',
        evidenceCount: 0,
        textLength: 3
      });

      expect(result.shouldAbstain).toBe(true);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should not abstain for strong evidence', () => {
      const result = calculator.calculateWithDetails({
        type: 'pattern',
        evidenceCount: 10,
        dataPoints: 20,
        quality: 0.85
      });

      expect(result.shouldAbstain).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('backwards compatibility methods', () => {
    it('should support calculateVoiceConfidence', () => {
      const result = calculator.calculateVoiceConfidence('This is a test text', 3);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should support calculatePatternConfidence', () => {
      const result = calculator.calculatePatternConfidence(15);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should support calculateCBTConfidence', () => {
      const distortions = [
        { confidence: 0.7 },
        { confidence: 0.8 },
        { confidence: 0.6 }
      ];
      const result = calculator.calculateCBTConfidence(distortions, 200);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should support calculateCBTProgressConfidence', () => {
      const records = new Array(10).fill({});
      const result = calculator.calculateCBTProgressConfidence(records);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should support calculateGlobalConfidence', () => {
      const result = calculator.calculateGlobalConfidence(
        25, // sampleSize
        0.75, // dataQuality
        0.8, // profileConfidence
        {
          moodEnergy: 0.6,
          moodAnxiety: -0.5
        }
      );
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should support calculateAnalyticsGlobalConfidence', () => {
      const moods = new Array(20).fill({ created_at: new Date().toISOString() });
      const result = calculator.calculateAnalyticsGlobalConfidence(
        moods,
        0.7,
        { confidence: 0.8 }
      );
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(0.95);
    });
  });

  describe('edge cases', () => {
    it('should handle zero evidence gracefully', () => {
      const result = calculator.calculate({
        type: 'voice',
        evidenceCount: 0
      });

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(0.5);
    });

    it('should handle missing optional parameters', () => {
      const result = calculator.calculate({
        type: 'mood'
      });

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should handle very large values', () => {
      const result = calculator.calculate({
        type: 'global',
        sampleSize: 10000,
        dataPoints: 10000,
        evidenceCount: 10000
      });

      expect(result).toBeLessThanOrEqual(0.95);
    });
  });
});
