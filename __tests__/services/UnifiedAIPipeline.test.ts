/**
 * 🧪 UnifiedAIPipeline Unit Tests
 * Test rehberindeki tüm AI pipeline senaryolarını kapsayan testler
 */

import { UnifiedAIPipeline } from '../../services/ai/UnifiedAIPipeline';
import { trackAIInteraction } from '../../services/telemetry/aiTelemetry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { featureFlags } from '../../utils/featureFlags';

// Mock'lar
jest.mock('../../services/telemetry/aiTelemetry');
jest.mock('../../utils/featureFlags');
jest.mock('../../services/ai/CoreAnalysisService');

describe('UnifiedAIPipeline', () => {
  let pipeline: UnifiedAIPipeline;
  
  beforeEach(() => {
    jest.clearAllMocks();
    pipeline = new UnifiedAIPipeline();
    
    // Feature flag'i aktif et
    (featureFlags.isEnabled as jest.Mock).mockReturnValue(true);
  });
  
  afterEach(async () => {
    // Cache'i temizle
    await AsyncStorage.clear();
  });
  
  describe('process() method', () => {
    it('should process voice input correctly', async () => {
      const input = {
        userId: 'test-user-123',
        content: 'Bugün kendimi çok kaygılı hissediyorum',
        type: 'voice' as const,
        context: {
          source: 'mood' as const,
          timestamp: Date.now()
        }
      };
      
      const result = await pipeline.process(input);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('insights');
      expect(result.result).toHaveProperty('suggestions');
      expect(result.metadata).toHaveProperty('qualityLevel');
      expect(result.metadata).toHaveProperty('sampleSize');
      
      // Telemetry kontrolü
      expect(trackAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'UNIFIED_PIPELINE_STARTED'
        })
      );
      
      expect(trackAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'UNIFIED_PIPELINE_COMPLETED'
        })
      );
    });
    
    it('should process data input with analytics', async () => {
      const input = {
        userId: 'test-user-123',
        content: {
          moodEntries: [
            { value: 7, timestamp: Date.now() - 86400000 },
            { value: 5, timestamp: Date.now() - 172800000 },
            { value: 8, timestamp: Date.now() }
          ],
          cbtRecords: [],
          compulsions: []
        },
        type: 'data' as const,
        context: {
          source: 'today' as const
        }
      };
      
      const result = await pipeline.process(input);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('analytics');
      expect(result.result.analytics).toHaveProperty('mood');
      expect(result.result.analytics.mood).toHaveProperty('sampleSize', 3);
      expect(result.result.analytics.mood).toHaveProperty('volatility');
    });
    
    it('should handle mixed content (voice + data)', async () => {
      const input = {
        userId: 'test-user-123',
        content: {
          voice: 'Kompülsiyonlarım azaldı ama hala var',
          data: {
            compulsions: [
              { type: 'checking', intensity: 6, timestamp: Date.now() }
            ]
          }
        },
        type: 'mixed' as const,
        context: {
          source: 'tracking' as const
        }
      };
      
      const result = await pipeline.process(input);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('insights');
      expect(result.result).toHaveProperty('adaptiveSuggestion');
      expect(result.metadata.source).toBe('unified');
    });
    
    it('should use cache when available', async () => {
      const input = {
        userId: 'test-user-123',
        content: 'Test content',
        type: 'voice' as const,
        context: { source: 'mood' as const }
      };
      
      // İlk çağrı - cache'e yazılacak
      const result1 = await pipeline.process(input);
      expect(result1.metadata.source).toBe('unified');
      
      // İkinci çağrı - cache'den okunacak
      const result2 = await pipeline.process(input);
      expect(result2.metadata.source).toBe('cache');
      expect(result2.metadata.qualityLevel).toBe('medium');
    });
    
    it('should handle errors gracefully', async () => {
      const input = {
        userId: 'test-user-123',
        content: null, // Geçersiz content
        type: 'voice' as const,
        context: { source: 'mood' as const }
      };
      
      const result = await pipeline.process(input);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      // Error telemetry
      expect(trackAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'UNIFIED_PIPELINE_ERROR'
        })
      );
    });
    
    it('should fall back when feature flag is disabled', async () => {
      // Feature flag'i devre dışı bırak
      (featureFlags.isEnabled as jest.Mock).mockReturnValue(false);
      
      const input = {
        userId: 'test-user-123',
        content: 'Test',
        type: 'voice' as const,
        context: { source: 'mood' as const }
      };
      
      const result = await pipeline.process(input);
      
      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe('heuristic');
      expect(result.metadata.qualityLevel).toBe('low');
    });
  });
  
  describe('Quality Metadata', () => {
    it('should generate correct quality metadata for high sample size', async () => {
      const input = {
        userId: 'test-user-123',
        content: {
          moodEntries: Array(15).fill(null).map((_, i) => ({
            value: Math.floor(Math.random() * 10) + 1,
            timestamp: Date.now() - i * 86400000
          }))
        },
        type: 'data' as const,
        context: { source: 'mood' as const }
      };
      
      const result = await pipeline.process(input);
      
      expect(result.metadata.qualityLevel).toBe('high');
      expect(result.metadata.sampleSize).toBe(15);
      expect(result.metadata.freshnessMs).toBeLessThan(1000);
    });
    
    it('should generate correct quality metadata for medium sample size', async () => {
      const input = {
        userId: 'test-user-123',
        content: {
          moodEntries: Array(5).fill(null).map((_, i) => ({
            value: Math.floor(Math.random() * 10) + 1,
            timestamp: Date.now() - i * 86400000
          }))
        },
        type: 'data' as const,
        context: { source: 'mood' as const }
      };
      
      const result = await pipeline.process(input);
      
      expect(result.metadata.qualityLevel).toBe('medium');
      expect(result.metadata.sampleSize).toBe(5);
    });
    
    it('should generate correct quality metadata for low sample size', async () => {
      const input = {
        userId: 'test-user-123',
        content: {
          moodEntries: [
            { value: 5, timestamp: Date.now() }
          ]
        },
        type: 'data' as const,
        context: { source: 'mood' as const }
      };
      
      const result = await pipeline.process(input);
      
      expect(result.metadata.qualityLevel).toBe('low');
      expect(result.metadata.sampleSize).toBe(1);
    });
  });
  
  describe('Analytics Generation', () => {
    it('should generate mood analytics correctly', async () => {
      const moodData = [7, 5, 8, 6, 9, 4, 7];
      const input = {
        userId: 'test-user-123',
        content: {
          moodEntries: moodData.map((value, i) => ({
            value,
            timestamp: Date.now() - i * 86400000
          }))
        },
        type: 'data' as const,
        context: { source: 'mood' as const }
      };
      
      const result = await pipeline.process(input);
      
      const analytics = result.result.analytics.mood;
      expect(analytics.sampleSize).toBe(7);
      expect(analytics.volatility).toBeGreaterThan(0);
      expect(analytics.weeklyDelta).toBeDefined();
      expect(analytics.confidence).toBeGreaterThan(0.5);
    });
    
    it('should generate CBT analytics with mood improvements', async () => {
      const cbtRecords = [
        { moodBefore: 3, moodAfter: 6, timestamp: Date.now() - 86400000 },
        { moodBefore: 4, moodAfter: 7, timestamp: Date.now() - 172800000 },
        { moodBefore: 2, moodAfter: 5, timestamp: Date.now() }
      ];
      
      const input = {
        userId: 'test-user-123',
        content: { cbtRecords },
        type: 'data' as const,
        context: { source: 'cbt' as const }
      };
      
      const result = await pipeline.process(input);
      
      const analytics = result.result.analytics.cbt;
      expect(analytics.sampleSize).toBe(3);
      expect(analytics.averageImprovement).toBeCloseTo(3, 1);
    });
    
    it('should generate tracking analytics with patterns', async () => {
      const compulsions = [
        { type: 'checking', intensity: 7, timestamp: Date.now() },
        { type: 'washing', intensity: 5, timestamp: Date.now() - 86400000 },
        { type: 'checking', intensity: 8, timestamp: Date.now() - 172800000 },
        { type: 'ordering', intensity: 4, timestamp: Date.now() - 259200000 }
      ];
      
      const input = {
        userId: 'test-user-123',
        content: { compulsions },
        type: 'data' as const,
        context: { source: 'tracking' as const }
      };
      
      const result = await pipeline.process(input);
      
      const analytics = result.result.analytics.tracking;
      expect(analytics.sampleSize).toBe(4);
      expect(analytics.patterns).toHaveProperty('checking', 2);
      expect(analytics.patterns).toHaveProperty('washing', 1);
      expect(analytics.baselines).toBeDefined();
    });
  });
  
  describe('Progressive UI Pattern', () => {
    it('should provide immediate heuristic response', async () => {
      const input = {
        userId: 'test-user-123',
        content: 'Test',
        type: 'voice' as const,
        context: { source: 'mood' as const }
      };
      
      // Phase 1 - Hızlı yanıt
      const phase1Promise = pipeline.process({
        ...input,
        context: { ...input.context, progressive: true, phase: 1 }
      });
      
      const phase1Result = await phase1Promise;
      expect(phase1Result.metadata.source).toBe('heuristic');
      expect(phase1Result.metadata.responseTime).toBeLessThan(100);
    });
    
    it('should provide deep analysis in phase 2', async () => {
      const input = {
        userId: 'test-user-123',
        content: {
          moodEntries: Array(10).fill(null).map((_, i) => ({
            value: Math.floor(Math.random() * 10) + 1,
            timestamp: Date.now() - i * 86400000
          }))
        },
        type: 'data' as const,
        context: { source: 'today' as const }
      };
      
      // Phase 2 - Derin analiz
      const phase2Result = await pipeline.process({
        ...input,
        context: { ...input.context, progressive: true, phase: 2 }
      });
      
      expect(phase2Result.metadata.source).toBe('unified');
      expect(phase2Result.result.insights).toContain('ALL MODULE DATA');
    });
  });
  
  describe('Telemetry', () => {
    it('should track all pipeline events', async () => {
      const input = {
        userId: 'test-user-123',
        content: 'Test',
        type: 'voice' as const,
        context: { source: 'mood' as const }
      };
      
      await pipeline.process(input);
      
      // Start event
      expect(trackAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'UNIFIED_PIPELINE_STARTED',
          metadata: expect.objectContaining({
            inputType: 'voice',
            source: 'mood'
          })
        })
      );
      
      // Complete event
      expect(trackAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'UNIFIED_PIPELINE_COMPLETED',
          metadata: expect.objectContaining({
            success: true,
            qualityLevel: expect.any(String),
            sampleSize: expect.any(Number)
          })
        })
      );
    });
    
    it('should sanitize PII in telemetry', async () => {
      const input = {
        userId: 'user@example.com', // Email - PII
        content: 'Adım Ahmet ve telefon numaram 555-1234', // PII içerik
        type: 'voice' as const,
        context: { source: 'mood' as const }
      };
      
      await pipeline.process(input);
      
      // Telemetry'de PII olmamalı
      expect(trackAIInteraction).not.toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId: 'user@example.com'
          })
        })
      );
      
      expect(trackAIInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId: expect.stringMatching(/^user_[a-z0-9]+$/) // Sanitized ID
          })
        })
      );
    });
  });
});