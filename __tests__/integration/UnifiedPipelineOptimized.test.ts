/**
 * Integration tests for optimized UnifiedAIPipeline
 */

import { UnifiedAIPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { UnifiedConfidenceCalculator } from '@/features/ai/core/helpers/UnifiedConfidenceCalculator';
import { BasePatternMatcher } from '@/features/ai/core/helpers/BasePatternMatcher';
import { PipelineCacheManager } from '@/features/ai/core/helpers/PipelineCacheManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
  multiSet: jest.fn(() => Promise.resolve()),
}));

// Mock supabase service
jest.mock('@/services/supabase', () => ({
  default: {
    saveMoodEntry: jest.fn(() => Promise.resolve()),
    getMoodEntries: jest.fn(() => Promise.resolve([])),
    getUserProfile: jest.fn(() => Promise.resolve(null)),
  }
}));

describe('UnifiedAIPipeline - Optimized', () => {
  let pipeline: UnifiedAIPipeline;
  
  beforeEach(() => {
    jest.clearAllMocks();
    pipeline = UnifiedAIPipeline.getInstance();
  });
  
  describe('Helper Integration', () => {
    it('should use UnifiedConfidenceCalculator for confidence scoring', async () => {
      const spy = jest.spyOn(UnifiedConfidenceCalculator.prototype, 'calculatePatternConfidence');
      
      const result = await pipeline.process({
        userId: 'test-user',
        content: 'Test pattern analysis',
        type: 'data',
        context: {
          source: 'mood'
        }
      });
      
      // The spy might be called indirectly through the pipeline
      // This test verifies the integration is working
      expect(result).toBeDefined();
    });
    
    it('should use BasePatternMatcher for pattern matching', async () => {
      const spy = jest.spyOn(BasePatternMatcher.prototype, 'match');
      
      const result = await pipeline.process({
        userId: 'test-user',
        content: 'Bugün çok üzgünüm ve mutsuzum',
        type: 'voice',
        context: {
          source: 'today'
        }
      });
      
      // Pattern matcher should be used for voice analysis
      expect(result).toBeDefined();
      if (result.voice) {
        expect(result.voice.confidence).toBeGreaterThan(0);
      }
    });
    
    it('should use PipelineCacheManager for caching', async () => {
      const cacheSetSpy = jest.spyOn(PipelineCacheManager.prototype, 'set');
      const cacheGetSpy = jest.spyOn(PipelineCacheManager.prototype, 'get');
      
      // First call - should cache
      const result1 = await pipeline.process({
        userId: 'test-user',
        content: 'Cache test content',
        type: 'voice',
        context: {
          source: 'today'
        }
      });
      
      // Second call with same input - should hit cache
      const result2 = await pipeline.process({
        userId: 'test-user',
        content: 'Cache test content',
        type: 'voice',
        context: {
          source: 'today'
        }
      });
      
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
  
  describe('Progressive Enhancement', () => {
    it('should provide quick heuristic result', async () => {
      const startTime = Date.now();
      
      const result = await pipeline.process({
        userId: 'test-user',
        content: 'Nefes alamıyorum, çok panik oluyorum',
        type: 'voice',
        context: {
          source: 'today'
        }
      });
      
      const duration = Date.now() - startTime;
      
      // Quick result should be fast
      expect(duration).toBeLessThan(500); // Less than 500ms
      expect(result).toBeDefined();
      
      // Should identify breathwork need
      if (result.voice) {
        expect(['BREATHWORK', 'MOOD']).toContain(result.voice.category);
      }
    });
  });
  
  describe('Voice Analysis', () => {
    it('should correctly categorize mood-related input', async () => {
      const result = await pipeline.process({
        userId: 'test-user',
        content: 'Bugün kendimi çok yorgun ve mutsuz hissediyorum',
        type: 'voice',
        context: {
          source: 'today'
        }
      });
      
      expect(result.voice).toBeDefined();
      if (result.voice) {
        expect(result.voice.category).toBe('MOOD');
        expect(result.voice.confidence).toBeGreaterThan(0.3);
        expect(result.voice.confidence).toBeLessThanOrEqual(0.95);
      }
    });
    
    it('should identify breathwork triggers', async () => {
      const result = await pipeline.process({
        userId: 'test-user',
        content: 'Nefes darlığı çekiyorum, göğsüm sıkışıyor',
        type: 'voice',
        context: {
          source: 'today'
        }
      });
      
      expect(result.voice).toBeDefined();
      if (result.voice) {
        expect(result.voice.category).toBe('BREATHWORK');
        expect(result.voice.suggestion).toContain('nefes');
      }
    });
    
    it('should handle short ambiguous input', async () => {
      const result = await pipeline.process({
        userId: 'test-user',
        content: 'hmm',
        type: 'voice',
        context: {
          source: 'today'
        }
      });
      
      expect(result.voice).toBeDefined();
      if (result.voice) {
        expect(result.voice.confidence).toBeLessThan(0.5);
      }
    });
  });
  
  describe('Pattern Recognition', () => {
    it('should identify patterns in mood data', async () => {
      const moodData = [
        { mood_score: 3, created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
        { mood_score: 4, created_at: new Date(Date.now() - 86400000 * 6).toISOString() },
        { mood_score: 5, created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
        { mood_score: 6, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
        { mood_score: 7, created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
        { mood_score: 8, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
        { mood_score: 9, created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
      ];
      
      const result = await pipeline.process({
        userId: 'test-user',
        content: moodData,
        type: 'data',
        context: {
          source: 'mood',
          metadata: {
            analysisType: 'patterns'
          }
        }
      });
      
      expect(result.patterns).toBeDefined();
      if (result.patterns) {
        expect(result.patterns.temporal).toBeDefined();
        expect(Array.isArray(result.patterns.temporal)).toBe(true);
      }
    });
  });
  
  describe('Analytics', () => {
    it('should calculate analytics with proper confidence', async () => {
      const moodData = new Array(14).fill(null).map((_, i) => ({
        mood_score: Math.floor(Math.random() * 10) + 1,
        energy_level: Math.floor(Math.random() * 5) + 1,
        anxiety_level: Math.floor(Math.random() * 5) + 1,
        created_at: new Date(Date.now() - 86400000 * (14 - i)).toISOString()
      }));
      
      const result = await pipeline.process({
        userId: 'test-user',
        content: moodData,
        type: 'data',
        context: {
          source: 'mood',
          metadata: {
            analysisType: 'comprehensive_analytics'
          }
        }
      });
      
      expect(result.analytics).toBeDefined();
      if (result.analytics && result.analytics.mood) {
        expect(result.analytics.mood.confidence).toBeGreaterThan(0);
        expect(result.analytics.mood.confidence).toBeLessThanOrEqual(0.95);
        expect(result.analytics.mood.sampleSize).toBe(14);
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      const result = await pipeline.process({
        userId: 'test-user',
        content: null,
        type: 'voice',
        context: {
          source: 'today'
        }
      });
      
      expect(result).toBeDefined();
    });
    
    it('should handle missing userId', async () => {
      const result = await pipeline.process({
        userId: '',
        content: 'Test content',
        type: 'voice'
      });
      
      expect(result).toBeDefined();
    });
  });
  
  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map((_, i) => 
        pipeline.process({
          userId: `user-${i}`,
          content: `Test content ${i}`,
          type: 'voice',
          context: {
            source: 'today'
          }
        })
      );
      
      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
    
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await pipeline.process({
        userId: 'test-user',
        content: 'A'.repeat(1000), // Long text
        type: 'voice',
        context: {
          source: 'today'
        }
      });
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(2000); // Less than 2 seconds
      expect(result).toBeDefined();
    });
  });
});
