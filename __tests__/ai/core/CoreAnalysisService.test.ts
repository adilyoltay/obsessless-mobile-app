/**
 * 🧪 CoreAnalysisService Test Suite
 * 
 * Comprehensive tests for the unified AI analysis service
 */

import { CoreAnalysisServiceImpl } from '@/features/ai/core/CoreAnalysisService';
import { needsLLMAnalysis } from '@/features/ai/core/needsLLMAnalysis';
import { ModuleOrchestratorImpl } from '@/features/ai/core/ModuleOrchestrator';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/features/ai/telemetry/aiTelemetry', () => ({
  trackCacheEvent: jest.fn(),
  trackGatingDecision: jest.fn(),
  trackAIInteraction: jest.fn(),
  AIEventType: {
    SIMILARITY_DEDUP_HIT: 'similarity_dedup_hit',
  },
}));

describe('CoreAnalysisService', () => {
  let service: CoreAnalysisServiceImpl;

  beforeEach(async () => {
    // Clear mocks
    jest.clearAllMocks();
    
    // Initialize service
    service = new CoreAnalysisServiceImpl();
    await service.initialize();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Heuristic Classification', () => {
    it('should classify mood-related text correctly', async () => {
      const input = {
        kind: 'VOICE' as const,
        content: 'Bugün kendimi çok mutlu hissediyorum',
        userId: 'test-user',
        locale: 'tr-TR' as const,
        ts: Date.now(),
      };

      const result = await service.analyze(input);
      
      expect(result.quickClass).toBe('MOOD');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify CBT-related text correctly', async () => {
      const input = {
        kind: 'TEXT' as const,
        content: 'Herkes benden nefret ediyor diye düşünüyorum',
        userId: 'test-user',
        locale: 'tr-TR' as const,
        ts: Date.now(),
      };

      const result = await service.analyze(input);
      
      expect(result.quickClass).toBe('CBT');
      expect(result.payload).toBeDefined();
    });

    it('should classify OCD-related text correctly', async () => {
      const input = {
        kind: 'VOICE' as const,
        content: 'El yıkama kompulsiyonum bugün 15 kez oldu',
        userId: 'test-user',
        locale: 'tr-TR' as const,
        ts: Date.now(),
      };

      const result = await service.analyze(input);
      
      expect(result.quickClass).toBe('OCD');
      expect(result.route).toBe('AUTO_SAVE');
    });

    it('should classify therapy-related text correctly', async () => {
      const input = {
        kind: 'TEXT' as const,
        content: 'ERP egzersizinde 10 dakika dayandım',
        userId: 'test-user',
        locale: 'tr-TR' as const,
        ts: Date.now(),
      };

      const result = await service.analyze(input);
      
      expect(result.quickClass).toBe('ERP');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should classify breathwork suggestions correctly', async () => {
      const input = {
        kind: 'VOICE' as const,
        content: 'Çok stresli hissediyorum nefes alamıyorum',
        userId: 'test-user',
        locale: 'tr-TR' as const,
        ts: Date.now(),
      };

      const result = await service.analyze(input);
      
      expect(result.quickClass).toBe('BREATHWORK');
      expect(result.route).toBe('SUGGEST_BREATHWORK');
    });
  });

  describe('Cache Operations', () => {
    it('should return cached result when available', async () => {
      const input = {
        kind: 'TEXT' as const,
        content: 'Test content for caching',
        userId: 'test-user',
        locale: 'tr-TR' as const,
        ts: Date.now(),
      };

      // First call - should cache
      const result1 = await service.analyze(input);
      
      // Second call - should return from cache
      const result2 = await service.analyze(input);
      
      expect(result1.cacheKey).toBe(result2.cacheKey);
      expect(result2.source).toBe('cache');
    });

    it('should invalidate cache when requested', async () => {
      const cacheKey = 'test-cache-key';
      
      // Add to cache
      await service['cacheResult'](cacheKey, {
        quickClass: 'MOOD',
        confidence: 0.8,
        needsLLM: false,
        route: 'OPEN_SCREEN',
        payload: {},
        cacheKey,
        computedAt: Date.now(),
      });

      // Verify cached
      const cached = await service.getCached(cacheKey);
      expect(cached).toBeDefined();

      // Invalidate
      await service.invalidate([cacheKey]);

      // Verify invalidated
      const afterInvalidate = await service.getCached(cacheKey);
      expect(afterInvalidate).toBeNull();
    });
  });

  describe('Route Determination', () => {
    it('should route high confidence OCD to AUTO_SAVE', async () => {
      const input = {
        kind: 'VOICE' as const,
        content: 'Kapıyı 5 kez kontrol ettim direnç gösteremedim',
        userId: 'test-user',
        locale: 'tr-TR' as const,
        ts: Date.now(),
      };

      const result = await service.analyze(input);
      
      expect(result.quickClass).toBe('OCD');
      expect(result.route).toBe('AUTO_SAVE');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should route mood check to OPEN_SCREEN', async () => {
      const input = {
        kind: 'TEXT' as const,
        content: 'Duygu durumum iyi değil',
        userId: 'test-user',
        locale: 'tr-TR' as const,
        ts: Date.now(),
      };

      const result = await service.analyze(input);
      
      expect(result.quickClass).toBe('MOOD');
      expect(result.route).toBe('OPEN_SCREEN');
      expect(result.payload.screen).toBe('mood');
    });

    it('should suggest breathwork for anxiety', async () => {
      const input = {
        kind: 'VOICE' as const,
        content: 'Panik atak geçiriyorum nefes alamıyorum',
        userId: 'test-user',
        locale: 'tr-TR' as const,
        ts: Date.now(),
      };

      const result = await service.analyze(input);
      
      expect(result.quickClass).toBe('BREATHWORK');
      expect(result.route).toBe('SUGGEST_BREATHWORK');
      expect(result.payload.exercise).toBeDefined();
    });
  });
});

describe('needsLLMAnalysis', () => {
  it('should skip LLM for high confidence MOOD', () => {
    const result = needsLLMAnalysis({
      quickClass: 'MOOD',
      heuristicConfidence: 0.7,
      textLen: 50,
    });
    
    expect(result).toBe(false);
  });

  it('should skip LLM for high confidence BREATHWORK', () => {
    const result = needsLLMAnalysis({
      quickClass: 'BREATHWORK',
      heuristicConfidence: 0.65,
      textLen: 30,
    });
    
    expect(result).toBe(false);
  });

  it('should require LLM for long complex text', () => {
    const result = needsLLMAnalysis({
      quickClass: 'CBT',
      heuristicConfidence: 0.6,
      textLen: 300,
    });
    
    expect(result).toBe(true);
  });

  it('should require LLM for low confidence', () => {
    const result = needsLLMAnalysis({
      quickClass: 'OCD',
      heuristicConfidence: 0.4,
      textLen: 100,
    });
    
    expect(result).toBe(true);
  });

  it('should skip LLM if recently analyzed similar text', () => {
    const result = needsLLMAnalysis({
      quickClass: 'CBT',
      heuristicConfidence: 0.7,
      textLen: 150,
      lastSimilarHashAt: Date.now() - 30 * 60 * 1000, // 30 minutes ago
    });
    
    expect(result).toBe(false);
  });

  it('should require LLM for complex CBT/OCD/ERP even with medium confidence', () => {
    const resultCBT = needsLLMAnalysis({
      quickClass: 'CBT',
      heuristicConfidence: 0.75,
      textLen: 150,
    });
    
    const resultOCD = needsLLMAnalysis({
      quickClass: 'OCD',
      heuristicConfidence: 0.75,
      textLen: 150,
    });
    
    const resultERP = needsLLMAnalysis({
      quickClass: 'ERP',
      heuristicConfidence: 0.75,
      textLen: 150,
    });
    
    expect(resultCBT).toBe(true);
    expect(resultOCD).toBe(true);
    expect(resultERP).toBe(true);
  });
});

describe('ModuleOrchestrator', () => {
  let orchestrator: ModuleOrchestratorImpl;

  beforeEach(() => {
    orchestrator = new ModuleOrchestratorImpl();
  });

  it('should handle MOOD module correctly', async () => {
    const result = await orchestrator.handleModule('MOOD', {
      text: 'Kendimi mutlu hissediyorum',
      confidence: 0.8,
    });
    
    expect(result.route).toBe('OPEN_SCREEN');
    expect(result.payload.screen).toBe('mood');
    expect(result.payload.mood).toBeGreaterThan(50);
  });

  it('should handle CBT module correctly', async () => {
    const result = await orchestrator.handleModule('CBT', {
      text: 'Herkes bana kızgın',
      confidence: 0.7,
    });
    
    expect(result.route).toBe('OPEN_SCREEN');
    expect(result.payload.screen).toBe('cbt');
    expect(result.payload.params.thought).toBeDefined();
  });

  it('should handle OCD module correctly', async () => {
    const result = await orchestrator.handleModule('OCD', {
      text: 'El yıkama kompulsiyonu yaşadım',
      confidence: 0.85,
    });
    
    expect(result.route).toBe('AUTO_SAVE');
    expect(result.payload.category).toBeDefined();
    expect(result.payload.resistanceLevel).toBeDefined();
  });

  it('should handle ERP module correctly', async () => {
    const result = await orchestrator.handleModule('ERP', {
      text: 'ERP egzersizini tamamladım',
      confidence: 0.8,
    });
    
    expect(result.route).toBe('OPEN_SCREEN');
    expect(result.payload.screen).toBe('erp');
    expect(result.payload.params.sessionId).toBeDefined();
  });

  it('should handle BREATHWORK module correctly', async () => {
    const result = await orchestrator.handleModule('BREATHWORK', {
      text: 'Nefes alamıyorum çok stres',
      confidence: 0.9,
    });
    
    expect(result.route).toBe('SUGGEST_BREATHWORK');
    expect(result.payload.exercise).toBeDefined();
    expect(result.payload.duration).toBeDefined();
  });

  it('should handle timeout gracefully', async () => {
    // Mock a module that takes too long
    jest.spyOn(orchestrator as any, 'analyzeMood').mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 6000))
    );

    const result = await orchestrator.handleModule('MOOD', {
      text: 'Test timeout',
      confidence: 0.5,
    });
    
    expect(result.route).toBe('OPEN_SCREEN');
    expect(result.payload.screen).toBe('mood');
    expect(result.payload.message).toContain('zaman aşımı');
  });
});
