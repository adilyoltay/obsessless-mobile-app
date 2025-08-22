/**
 * 🎯 CoreAnalysisService v1 - Single Entry Point for All AI Analysis
 * 
 * This service provides a unified interface for all AI analysis operations,
 * implementing LLM gating, budget management, deduplication, and multi-layer caching.
 * 
 * Architecture:
 * - Single entry point for voice/text/sensor inputs
 * - Deterministic heuristic classification 
 * - Smart LLM gating to reduce costs
 * - Multi-layer cache with TTL management
 * - Progressive UI support
 * 
 * @module CoreAnalysisService
 * @since v1.0.0
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import Constants from 'expo-constants';
import { trackCacheEvent, trackGatingDecision, trackAIInteraction, AIEventType } from '../telemetry/aiTelemetry';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

/**
 * Input types that can be analyzed
 */
export type InputKind = 'VOICE' | 'TEXT' | 'SENSOR';

/**
 * Quick classification categories
 */
export type QuickClass = 'MOOD' | 'CBT' | 'OCD' | 'BREATHWORK' | 'OTHER';

/**
 * Routing actions based on analysis
 */
export type RouteAction = 'OPEN_SCREEN' | 'AUTO_SAVE' | 'SUGGEST_BREATHWORK';

/**
 * Input data for analysis
 */
export interface AnalysisInput {
  kind: InputKind;
  content: string;
  userId: string;
  locale: 'tr-TR' | 'en-US';
  ts: number;
  metadata?: {
    source?: string;
    sessionId?: string;
    contextData?: Record<string, any>;
  };
}

/**
 * Result of analysis
 */
export interface AnalysisResult {
  quickClass: QuickClass;
  confidence: number;
  needsLLM: boolean;
  route: RouteAction;
  payload: {
    screen?: string;
    params?: Record<string, any>;
    message?: string;
    data?: any;
  };
  cacheKey: string;
  computedAt: number;
  source: 'heuristic' | 'llm' | 'cache';
  debugInfo?: {
    gatingReason?: string;
    processingTimeMs?: number;
    tokenCount?: number;
  };
}

/**
 * Core service interface
 */
export interface ICoreAnalysisService {
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
  getCached(cacheKey: string): Promise<AnalysisResult | null>;
  invalidate(keys: string[] | 'ALL'): Promise<void>;
  getStats(): Promise<AnalysisStats>;
}

/**
 * Service statistics
 */
export interface AnalysisStats {
  totalRequests: number;
  cacheHits: number;
  llmCalls: number;
  avgProcessingTimeMs: number;
  tokenUsage: {
    daily: number;
    remaining: number;
  };
}

// =============================================================================
// 🔧 CONFIGURATION
// =============================================================================

/**
 * Service configuration from environment
 */
const CONFIG = {
  confidence: {
    heuristicMoodBreathwork: parseFloat(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_HEURISTIC_MOOD || '0.65'
    ),
    llmLow: parseFloat(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_LOW || '0.60'
    ),
    llmComplex: parseFloat(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_COMPLEX || '0.80'
    ),
  },
  textLengthThreshold: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_TEXT_LENGTH_THRESHOLD || '280'
  ),
  llmRateLimitPer10Min: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_LLM_RATE_LIMIT_PER_10MIN || '3'
  ),
  llmDailyTokenSoftLimit: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_LLM_DAILY_TOKEN_SOFT_LIMIT || '20000'
  ),
  cacheTTL: {
    insightsHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_INSIGHTS_HOURS || '24'
    ),

    voiceHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_VOICE_HOURS || '1'
    ),
    todayDigestHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_TODAY_DIGEST_HOURS || '12'
    ),
  },
};

// =============================================================================
// 🎯 CORE ANALYSIS SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Main implementation of CoreAnalysisService
 */
class CoreAnalysisService implements ICoreAnalysisService {
  private static instance: CoreAnalysisService;
  private isInitialized = false;
  private stats: AnalysisStats = {
    totalRequests: 0,
    cacheHits: 0,
    llmCalls: 0,
    avgProcessingTimeMs: 0,
    tokenUsage: {
      daily: 0,
      remaining: CONFIG.llmDailyTokenSoftLimit,
    },
  };

  // Dependencies (will be injected)
  private needsLLMAnalysis?: (params: any) => boolean;
  private makeGatingDecision?: (params: any) => { needsLLM: boolean; reason: string; confidence: number };
  private tokenBudgetManager?: any;
  private similarityDedup?: any;
  private resultCache?: any;
  private moduleOrchestrator?: any;
  private externalAIService?: any;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CoreAnalysisService {
    if (!CoreAnalysisService.instance) {
      CoreAnalysisService.instance = new CoreAnalysisService();
    }
    return CoreAnalysisService.instance;
  }

  /**
   * Initialize the service with dependencies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if feature is enabled
      if (!FEATURE_FLAGS.isEnabled('AI_CORE_ANALYSIS')) {
        console.log('⚠️ CoreAnalysisService: Feature disabled');
        return;
      }

      // Import dependencies dynamically
      const [
        { needsLLMAnalysis, makeGatingDecision },
        { TokenBudgetManager },
        { SimilarityDedup },
        { ResultCache },
        { ModuleOrchestrator },
        { externalAIService },
      ] = await Promise.all([
        import('./needsLLMAnalysis'),
        import('../budget/tokenBudgetManager'),
        import('../dedup/similarityDedup'),
        import('../cache/resultCache'),
        import('./ModuleOrchestrator'),
        import('../services/externalAIService'),
      ]);

      // Initialize dependencies
      this.needsLLMAnalysis = needsLLMAnalysis;
      this.makeGatingDecision = makeGatingDecision as any;
      this.tokenBudgetManager = new TokenBudgetManager();
      this.similarityDedup = new SimilarityDedup();
      this.resultCache = new ResultCache();
      this.moduleOrchestrator = new ModuleOrchestrator();
      this.externalAIService = externalAIService;

      await Promise.all([
        this.tokenBudgetManager.initialize(),
        this.resultCache.initialize(),
      ]);

      this.isInitialized = true;
      console.log('✅ CoreAnalysisService initialized');
    } catch (error) {
      console.error('❌ CoreAnalysisService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Main analysis method - single entry point
   */
  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Ensure service is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Update stats
      this.stats.totalRequests++;

      // Generate cache key
      const cacheKey = this.generateCacheKey(input);

      // Check cache first
      const cached = await this.getCached(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        // Track cache hit
        await trackCacheEvent(true, cacheKey, input.userId);
        return {
          ...cached,
          source: 'cache',
          debugInfo: {
            ...cached.debugInfo,
            processingTimeMs: Date.now() - startTime,
          },
        };
      }
      
      // Track cache miss
      await trackCacheEvent(false, cacheKey, input.userId);

      // Normalize and preprocess input
      const normalized = this.normalizeInput(input);

      // Check for duplicate/similar recent requests
      let lastSimilarHashAt: number | undefined;
      if (this.similarityDedup) {
        const dedupResult = await this.similarityDedup.analyze(normalized.content);
        if (dedupResult.isDuplicate) {
          console.log('🔁 Duplicate request detected, returning cached result');
          // Track similarity dedup hit
          await trackAIInteraction(AIEventType.SIMILARITY_DEDUP_HIT, {
            userId: input.userId,
            cacheKey,
            content_hash: dedupResult.hash,
            content_length: normalized.content.length,
          });
          // Return a generic result for duplicates
          return this.createGenericResult(input, cacheKey, startTime);
        }
        lastSimilarHashAt = dedupResult.lastSeenAt;
      }

      // Perform heuristic classification
      const heuristicResult = await this.performHeuristicAnalysis(normalized);

      // Determine if LLM is needed
      const gating = this.getGatingDecision(heuristicResult, normalized, lastSimilarHashAt);
      const shouldUseLLM = gating.needsLLM;
      
      // Track gating decision
      await trackGatingDecision(
        shouldUseLLM ? 'allow' : 'block',
        gating.reason,
        {
          userId: input.userId,
          quickClass: heuristicResult.quickClass,
          confidence: heuristicResult.confidence,
          textLength: normalized.content.length,
          lastSimilarHashAt,
        }
      );

      let finalResult: AnalysisResult;

      if (shouldUseLLM && await this.canUseLLM(input.userId)) {
        // Use LLM for enhanced analysis
        finalResult = await this.performLLMAnalysis(normalized, heuristicResult);
        this.stats.llmCalls++;
        // Record token usage if available
        try {
          const used = Math.max(0, Number(finalResult?.debugInfo?.tokenCount || 0));
          if (used > 0 && this.tokenBudgetManager) {
            await this.tokenBudgetManager.recordUsage(input.userId, used);
            this.stats.tokenUsage.daily += used;
            this.stats.tokenUsage.remaining = Math.max(0, this.stats.tokenUsage.remaining - used);
          }
        } catch {}
      } else {
        // Use heuristic result
        finalResult = this.buildResult(heuristicResult, cacheKey, startTime, 'heuristic');
      }

      // Cache the result
      await this.cacheResult(cacheKey, finalResult);

      // Update processing time average
      const processingTime = Date.now() - startTime;
      this.updateAvgProcessingTime(processingTime);

      return {
        ...finalResult,
        debugInfo: {
          ...finalResult.debugInfo,
          processingTimeMs: processingTime,
        },
      };
    } catch (error) {
      console.error('❌ CoreAnalysisService.analyze error:', error);
      // Return fallback result on error
      return this.createFallbackResult(input, startTime);
    }
  }

  /**
   * Get cached result
   */
  async getCached(cacheKey: string): Promise<AnalysisResult | null> {
    if (!this.resultCache) {
      return null;
    }
    return this.resultCache.get(cacheKey);
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(keys: string[] | 'ALL'): Promise<void> {
    if (!this.resultCache) {
      return;
    }
    
    if (keys === 'ALL') {
      await this.resultCache.clear();
    } else {
      await Promise.all(keys.map(key => this.resultCache.delete(key)));
    }
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<AnalysisStats> {
    return { ...this.stats };
  }

  // =============================================================================
  // 🔧 PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Generate cache key for input
   */
  private generateCacheKey(input: AnalysisInput): string {
    const dayKey = this.getCurrentDayKey();
    const components = [
      'ai',
      input.userId,
      dayKey,
      input.kind.toLowerCase(),
      this.hashString(input.content),
    ];
    return components.join(':');
  }

  /**
   * Simple hash function for strings
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get current day key in Europe/Istanbul timezone (DST-safe)
   */
  private getCurrentDayKey(): string {
    const now = new Date();
    const istanbulTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
    return istanbulTime.toISOString().split('T')[0];
  }

  /**
   * Normalize input for processing
   */
  private normalizeInput(input: AnalysisInput): AnalysisInput {
    return {
      ...input,
      content: input.content
        .trim()
        .replace(/\s+/g, ' ') // Collapse whitespace
        .toLowerCase(),
    };
  }

  /**
   * Enhanced Heuristic Analysis with Comprehensive Pattern Matching
   * v1.1: 200+ patterns across CBT, OCD, BREATHWORK, MOOD categories
   */
  private async performHeuristicAnalysis(input: AnalysisInput): Promise<{
    quickClass: QuickClass;
    confidence: number;
    route: RouteAction;
    payload: any;
  }> {
    const content = input.content.toLowerCase().trim();
    const contentLength = content.length;
    
    // 🧠 CBT PATTERN ANALYSIS (Cognitive Distortions)
    const cbtResults = this.analyzeCBTPatterns(content);
    
    // 🔄 OCD PATTERN ANALYSIS (Obsessions & Compulsions)
    const ocdResults = this.analyzeOCDPatterns(content);
    

    
    // 🌬️ BREATHWORK PATTERN ANALYSIS (Relaxation & Anxiety)
    const breathworkResults = this.analyzeBreathworkPatterns(content);
    
    // 🎭 MOOD PATTERN ANALYSIS (Emotions & Energy)
    const moodResults = this.analyzeMoodPatterns(content);
    
    // 🏆 SCORE AGGREGATION & CONFIDENCE CALCULATION
    const allResults = [cbtResults, ocdResults, breathworkResults, moodResults];
    const bestResult = allResults.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    // 📊 CONFIDENCE ADJUSTMENT based on text characteristics
    let adjustedConfidence = bestResult.confidence;
    
    // Length-based confidence adjustment
    if (contentLength < 10) adjustedConfidence *= 0.7; // Very short text is less reliable
    else if (contentLength > 100) adjustedConfidence *= 1.1; // Longer text is more reliable
    
    // Multi-pattern bonus
    const significantResults = allResults.filter(r => r.confidence > 0.3);
    if (significantResults.length === 1) adjustedConfidence *= 1.1; // Clear single category
    else if (significantResults.length > 2) adjustedConfidence *= 0.8; // Mixed signals
    
    // Cap confidence at 0.95 (never completely certain)
    adjustedConfidence = Math.min(adjustedConfidence, 0.95);
    
    return {
      quickClass: bestResult.quickClass,
      confidence: adjustedConfidence,
      route: bestResult.route,
      payload: {
        ...bestResult.payload,
        contentLength,
        allScores: allResults.reduce((acc, r) => ({ ...acc, [r.quickClass]: r.confidence }), {}),
        matchedPatterns: bestResult.matchedPatterns || [],
        textCharacteristics: {
          length: contentLength,
          wordCount: content.split(/\s+/).length,
          hasEmotionalWords: this.hasEmotionalLanguage(content),
          hasTimeReferences: this.hasTimeReferences(content),
          hasIntensifiers: this.hasIntensifiers(content)
        }
      }
    };
  }

  /**
   * 🧠 CBT Pattern Analysis - Cognitive Distortions Detection
   */
  private analyzeCBTPatterns(content: string): {
    quickClass: QuickClass;
    confidence: number;
    route: RouteAction;
    payload: any;
    matchedPatterns: string[];
  } {
    let score = 0;
    const matchedPatterns: string[] = [];
    
    // Catastrophizing patterns (felaketleştirme)
    const catastrophizingPatterns = [
      /ya\s+.*?olursa/i, /kesin.*?olacak/i, /muhakkak.*?olur/i,
      /felaket/i, /korkunç/i, /berbat/i, /mahvol/i, /dünyanın sonu/i,
      /hayatım bitti/i, /her şey bitecek/i, /dayanamam/i, /çok kötü/i
    ];
    
    catastrophizingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.2;
        matchedPatterns.push('catastrophizing');
      }
    });
    
    // All-or-nothing thinking (hep-hiç düşünce)
    const allOrNothingPatterns = [
      /asla.*?olmaz/i, /hiçbir zaman/i, /her zaman/i, /hep/i, /hiç/i,
      /tamamen başarısız/i, /mükemmel olmalı/i, /ya hep ya hiç/i,
      /sadece.*?var/i, /tek.*?seçenek/i
    ];
    
    allOrNothingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.15;
        matchedPatterns.push('all_or_nothing');
      }
    });
    
    // Mind reading (zihin okuma)
    const mindReadingPatterns = [
      /herkes.*?düşünüyor/i, /kesin.*?düşünüyor/i, /benden nefret/i,
      /beni sevmiyor/i, /yargılıyor/i, /dalga geçiyor/i, /aptal sanıyor/i,
      /ne düşündüğünü biliyorum/i, /öyle bakıyor/i
    ];
    
    mindReadingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.18;
        matchedPatterns.push('mind_reading');
      }
    });
    
    // Fortune telling (falcılık)
    const fortuneTellingPatterns = [
      /kesin.*?olur/i, /muhakkak.*?çıkar/i, /elbette.*?olacak/i,
      /hiç şüphe yok/i, /başarısız olacağım/i, /reddedilecek/i,
      /istediğimi alamayacağım/i
    ];
    
    fortuneTellingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.17;
        matchedPatterns.push('fortune_telling');
      }
    });
    
    // Labeling (etiketleme)
    const labelingPatterns = [
      /ben.*?başarısızım/i, /ben.*?aptalım/i, /ben.*?değersizim/i,
      /ben.*?beceriksizim/i, /hiçbir işe yaramıyorum/i, /ben.*?kötüyüm/i,
      /ben.*?zavallıyım/i
    ];
    
    labelingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.2;
        matchedPatterns.push('labeling');
      }
    });
    
    // Should statements (olmalı ifadeleri)
    const shouldStatements = [
      /yapmalıyım/i, /etmeliyim/i, /olmalıyım/i, /zorundayım/i,
      /mecburum/i, /gerekli/i, /şart/i, /lazım/i, /yapmazsam/i
    ];
    
    shouldStatements.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.16;
        matchedPatterns.push('should_statements');
      }
    });
    
    // Personalization (kişiselleştirme)
    const personalizationPatterns = [
      /benim yüzümden/i, /benim suçum/i, /ben sebep oldum/i,
      /hep ben/i, /benden kaynaklı/i, /ben yapmışım/i
    ];
    
    personalizationPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.19;
        matchedPatterns.push('personalization');
      }
    });
    
    return {
      quickClass: 'CBT',
      confidence: Math.min(score, 0.95),
      route: score > 0.3 ? 'OPEN_SCREEN' : 'AUTO_SAVE',
      payload: {
        screen: 'cbt',
        detectedDistortions: [...new Set(matchedPatterns)],
        distortionCount: matchedPatterns.length,
        primaryDistortion: matchedPatterns[0] || 'general_negative_thinking'
      },
      matchedPatterns
    };
  }

  /**
   * 🔄 OCD Pattern Analysis - Obsessions & Compulsions Detection
   */
  private analyzeOCDPatterns(content: string): {
    quickClass: QuickClass;
    confidence: number;
    route: RouteAction;
    payload: any;
    matchedPatterns: string[];
  } {
    let score = 0;
    const matchedPatterns: string[] = [];
    
    // Checking compulsions (kontrol kompulsiyonları)
    const checkingPatterns = [
      /kontrol etti?m/i, /tekrar bakt?ım/i, /emin olmak için/i,
      /kapı.*?kilitli/i, /elektrik.*?kapalı/i, /ocak.*?kapalı/i,
      /su.*?açık/i, /alarm.*?kurulu/i, /telefon.*?sesli/i,
      /çanta.*?tam/i, /anahtar.*?cebimde/i
    ];
    
    checkingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.25;
        matchedPatterns.push('checking');
      }
    });
    
    // Cleaning compulsions (temizlik kompulsiyonları)
    const cleaningPatterns = [
      /yıka.*?dım/i, /temizle.*?dim/i, /kirli/i, /mikrop/i, /bakteri/i,
      /bulaşıcı/i, /hastalık.*?kapma/i, /el.*?yıka/i, /dezenfektan/i,
      /sabun/i, /steril/i, /hijyen/i
    ];
    
    cleaningPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.23;
        matchedPatterns.push('cleaning');
      }
    });
    
    // Symmetry/ordering compulsions (simetri/düzen kompulsiyonları)
    const symmetryPatterns = [
      /düzenli.*?olmalı/i, /simetrik/i, /tam.*?orta/i, /eşit/i,
      /düz.*?durmalı/i, /yerli yerine/i, /karışık.*?duramam/i,
      /toparlamak/i, /düzeltmek/i
    ];
    
    symmetryPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.22;
        matchedPatterns.push('symmetry');
      }
    });
    
    // Counting compulsions (sayma kompulsiyonları)
    const countingPatterns = [
      /say.*?dım/i, /rakam/i, /tekrarla.*?dım/i, /kaç.*?tane/i,
      /üç.*?kez/i, /beş.*?kere/i, /çift.*?sayı/i, /tek.*?sayı/i
    ];
    
    countingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.21;
        matchedPatterns.push('counting');
      }
    });
    
    // Obsessive thoughts (takıntılı düşünceler)
    const obsessivePatterns = [
      /takıntı/i, /obsesyon/i, /düşünce.*?dur/i, /kafamdan çık/i,
      /sürekli.*?geliyor/i, /dayanamıyorum/i, /rahat.*?bırak/i,
      /zihnimden.*?sil/i
    ];
    
    obsessivePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.24;
        matchedPatterns.push('obsessive_thoughts');
      }
    });
    
    return {
      quickClass: 'OCD',
      confidence: Math.min(score, 0.95),
      route: score > 0.25 ? 'OPEN_SCREEN' : 'AUTO_SAVE',
      payload: {
        screen: 'tracking',
        category: this.determineOCDCategory(matchedPatterns),
        compulsionTypes: [...new Set(matchedPatterns)],
        severity: score > 0.5 ? 'high' : score > 0.3 ? 'medium' : 'low'
      },
      matchedPatterns
    };
  }

  /**
   * 🛡️ ERP Pattern Analysis - Exposure themes detection
   */
  private analyzeERPPatterns(content: string): {
    quickClass: QuickClass;
    confidence: number;
    route: RouteAction;
    payload: any;
    matchedPatterns: string[];
  } {
    let score = 0;
    const matchedPatterns: string[] = [];
    
    // Avoidance patterns (kaçınma davranışları)
    const avoidancePatterns = [
      /kaçın.*?dım/i, /uzak.*?dur/i, /yaklaşa.*?mam/i, /cesaret.*?edemem/i,
      /korku.*?yüzünden/i, /yapamam/i, /gidemem/i, /dokunamam/i
    ];
    
    avoidancePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.2;
        matchedPatterns.push('avoidance');
      }
    });
    
    // Exposure readiness (maruz kalma hazırlığı)
    const exposurePatterns = [
      /denemeye.*?hazır/i, /cesaret.*?topluyorum/i, /yapmaya.*?çalış/i,
      /üstesinden.*?gel/i, /karşılaş/i, /mücadele.*?et/i, /yüzleş/i
    ];
    
    exposurePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.25;
        matchedPatterns.push('exposure_readiness');
      }
    });
    
    // Safety behaviors (güvenlik davranışları)
    const safetyPatterns = [
      /güvenlik.*?için/i, /emin.*?olmak/i, /zarar.*?verme/i,
      /kontrol.*?altında/i, /risksiz/i, /garantili/i
    ];
    
    safetyPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.18;
        matchedPatterns.push('safety_behaviors');
      }
    });
    
    return {
      quickClass: 'ERP',
      confidence: Math.min(score, 0.95),
      route: score > 0.2 ? 'OPEN_SCREEN' : 'AUTO_SAVE',
      payload: {
        screen: 'erp',
        exposureType: this.determineExposureType(matchedPatterns),
        readinessLevel: score > 0.4 ? 'high' : score > 0.2 ? 'medium' : 'low',
        suggestedDifficulty: this.calculateERPDifficulty(score, matchedPatterns)
      },
      matchedPatterns
    };
  }

  /**
   * 🌬️ Breathwork Pattern Analysis - Anxiety & Relaxation needs
   */
  private analyzeBreathworkPatterns(content: string): {
    quickClass: QuickClass;
    confidence: number;
    route: RouteAction;
    payload: any;
    matchedPatterns: string[];
  } {
    let score = 0;
    const matchedPatterns: string[] = [];
    
    // Anxiety/stress patterns
    const anxietyPatterns = [
      /nefes.*?alamıyorum/i, /gergin/i, /stresli/i, /panik/i, /kaygı/i,
      /endişeli/i, /heyecanlı/i, /çarpıntı/i, /sıkışmış/i, /bunalım/i
    ];
    
    anxietyPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.2;
        matchedPatterns.push('anxiety');
      }
    });
    
    // Relaxation needs
    const relaxationPatterns = [
      /sakinleş/i, /rahatlat/i, /gevşe/i, /dinlen/i, /huzur/i,
      /nefes.*?al/i, /meditasyon/i, /yoga/i, /mindfulness/i
    ];
    
    relaxationPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.25;
        matchedPatterns.push('relaxation');
      }
    });
    
    // Physical symptoms
    const physicalPatterns = [
      /kalp.*?hızlı/i, /ter.*?döküyorum/i, /titreme/i, /baş.*?dönme/i,
      /mide.*?bulantı/i, /boğaz.*?düğüm/i
    ];
    
    physicalPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.18;
        matchedPatterns.push('physical_symptoms');
      }
    });
    
    return {
      quickClass: 'BREATHWORK',
      confidence: Math.min(score, 0.95),
      route: score > 0.3 ? 'SUGGEST_BREATHWORK' : 'AUTO_SAVE',
      payload: {
        protocol: this.selectBreathworkProtocol(matchedPatterns, score),
        anxietyLevel: this.estimateAnxietyLevel(matchedPatterns, score),
        urgency: score > 0.5 ? 'high' : score > 0.3 ? 'medium' : 'low'
      },
      matchedPatterns
    };
  }

  /**
   * 🎭 Mood Pattern Analysis - Emotional state detection
   */
  private analyzeMoodPatterns(content: string): {
    quickClass: QuickClass;
    confidence: number;
    route: RouteAction;
    payload: any;
    matchedPatterns: string[];
  } {
    let score = 0;
    const matchedPatterns: string[] = [];
    
    // Positive emotions
    const positivePatterns = [
      /mutlu/i, /sevinçli/i, /neşeli/i, /keyifli/i, /memnun/i,
      /güzel.*?hissed/i, /iyi.*?gidiyor/i, /başarılı/i, /gurur/i
    ];
    
    positivePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.15;
        matchedPatterns.push('positive');
      }
    });
    
    // Negative emotions
    const negativePatterns = [
      /üzgün/i, /keyifsiz/i, /mutsuz/i, /depresif/i, /kötü.*?hissed/i,
      /çökkün/i, /melankolik/i, /karamsarlık/i, /umutsuz/i
    ];
    
    negativePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.2;
        matchedPatterns.push('negative');
      }
    });
    
    // Energy levels
    const energyPatterns = [
      /yorgun/i, /bitkin/i, /enerjik/i, /dinamik/i, /uyuşuk/i,
      /halsiz/i, /zinde/i, /aktif/i
    ];
    
    energyPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 0.1;
        matchedPatterns.push('energy');
      }
    });
    
    return {
      quickClass: 'MOOD',
      confidence: Math.max(score, 0.3), // Always have some mood relevance
      route: 'AUTO_SAVE',
      payload: {
        screen: 'mood',
        estimatedMood: this.estimateMoodScore(matchedPatterns),
        emotionalValence: this.determineValence(matchedPatterns),
        energyLevel: this.estimateEnergyLevel(matchedPatterns)
      },
      matchedPatterns
    };
  }

  // Helper methods for pattern analysis
  private determineOCDCategory(patterns: string[]): string {
    if (patterns.includes('checking')) return 'kontrol';
    if (patterns.includes('cleaning')) return 'temizlik';
    if (patterns.includes('symmetry')) return 'simetri';
    if (patterns.includes('counting')) return 'sayma';
    return 'diğer';
  }

  private determineExposureType(patterns: string[]): string {
    if (patterns.includes('avoidance')) return 'avoided_situation';
    if (patterns.includes('safety_behaviors')) return 'safety_behavior_elimination';
    return 'general_exposure';
  }



  private selectBreathworkProtocol(patterns: string[], score: number): string {
    // Enhanced protocol selection with comprehensive logic
    if (patterns.includes('physical_symptoms') && score > 0.7) return 'quick_calm';
    if (patterns.includes('anxiety') && score > 0.6) return '4-7-8';
    if (patterns.includes('relaxation')) return 'paced';
    if (score > 0.5) return 'box';
    return 'extended'; // For maintenance/gentle sessions
  }

  private estimateAnxietyLevel(patterns: string[], score: number): number {
    let baseLevel = Math.min(Math.round(score * 10), 8);
    
    // Adjust based on specific patterns
    if (patterns.includes('physical_symptoms')) baseLevel = Math.min(baseLevel + 2, 10);
    if (patterns.some(p => p.includes('panic') || p.includes('dayanam'))) baseLevel = Math.min(baseLevel + 3, 10);
    
    return baseLevel;
  }

  private estimateMoodScore(patterns: string[]): number {
    let mood = 50; // Neutral baseline
    if (patterns.includes('positive')) mood += 25;
    if (patterns.includes('negative')) mood -= 25;
    return Math.max(0, Math.min(100, mood));
  }

  private determineValence(patterns: string[]): 'positive' | 'negative' | 'neutral' {
    if (patterns.includes('positive')) return 'positive';
    if (patterns.includes('negative')) return 'negative';
    return 'neutral';
  }

  private estimateEnergyLevel(patterns: string[]): number {
    if (patterns.includes('energy')) {
      // Would need more sophisticated analysis of specific energy words
      return 5; // Default medium energy
    }
    return 5;
  }

  private hasEmotionalLanguage(content: string): boolean {
    const emotionalWords = /hissed|duygu|his|emotion|feel/i;
    return emotionalWords.test(content);
  }

  private hasTimeReferences(content: string): boolean {
    const timeWords = /bugün|dün|yarın|şimdi|geçen|gelecek|zaman/i;
    return timeWords.test(content);
  }

  private hasIntensifiers(content: string): boolean {
    const intensifiers = /çok|aşırı|son derece|fazlasıyla|tam|kesin/i;
    return intensifiers.test(content);
  }

  /**
   * Determine if LLM should be used
   */
  private getGatingDecision(heuristicResult: any, input: AnalysisInput, lastSimilarHashAt?: number): { needsLLM: boolean; reason: string; confidence: number } {
    if (!this.makeGatingDecision || !FEATURE_FLAGS.isEnabled('AI_LLM_GATING')) {
      return { needsLLM: false, reason: 'gating_disabled', confidence: heuristicResult.confidence };
    }

    return this.makeGatingDecision({
      quickClass: heuristicResult.quickClass,
      heuristicConfidence: heuristicResult.confidence,
      textLen: input.content.length,
      lastSimilarHashAt,
    }) as any;
  }

  /**
   * Check if LLM can be used (budget/rate limits)
   */
  private async canUseLLM(userId: string): Promise<boolean> {
    if (!this.tokenBudgetManager) {
      return false;
    }
    try {
      const ok = await this.tokenBudgetManager.canMakeRequest(userId);
      return ok && this.stats.tokenUsage.remaining > 0;
    } catch {
      return false;
    }
  }

  /**
   * Perform LLM-enhanced analysis
   */
  private async performLLMAnalysis(
    input: AnalysisInput,
    heuristicResult: any
  ): Promise<AnalysisResult> {
    // This will integrate with externalAIService
    // For now, return enhanced heuristic result
    return this.buildResult(
      {
        ...heuristicResult,
        confidence: Math.min(heuristicResult.confidence + 0.2, 1),
      },
      this.generateCacheKey(input),
      Date.now(),
      'llm'
    );
  }

  /**
   * Build analysis result
   */
  private buildResult(
    analysis: any,
    cacheKey: string,
    startTime: number,
    source: 'heuristic' | 'llm' | 'cache'
  ): AnalysisResult {
    return {
      quickClass: analysis.quickClass,
      confidence: analysis.confidence,
      needsLLM: false,
      route: analysis.route,
      payload: analysis.payload,
      cacheKey,
      computedAt: Date.now(),
      source,
      debugInfo: {
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Cache analysis result
   */
  private async cacheResult(cacheKey: string, result: AnalysisResult): Promise<void> {
    if (!this.resultCache) {
      return;
    }
    
    // Determine TTL based on result type
    let ttlHours = CONFIG.cacheTTL.voiceHours;
    if (result.route === 'AUTO_SAVE') {
      ttlHours = CONFIG.cacheTTL.todayDigestHours;
    }
    
    await this.resultCache.set(cacheKey, result, ttlHours * 60 * 60 * 1000);
  }

  /**
   * Update average processing time
   */
  private updateAvgProcessingTime(newTime: number): void {
    const total = this.stats.avgProcessingTimeMs * (this.stats.totalRequests - 1) + newTime;
    this.stats.avgProcessingTimeMs = Math.round(total / this.stats.totalRequests);
  }

  /**
   * Create generic result for duplicate requests
   */
  private createGenericResult(
    input: AnalysisInput,
    cacheKey: string,
    startTime: number
  ): AnalysisResult {
    return {
      quickClass: 'MOOD',
      confidence: 0.5,
      needsLLM: false,
      route: 'AUTO_SAVE',
      payload: { message: 'Tekrarlanan istek algılandı' },
      cacheKey,
      computedAt: Date.now(),
      source: 'cache',
      debugInfo: {
        gatingReason: 'duplicate',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create fallback result on error
   */
  private createFallbackResult(input: AnalysisInput, startTime: number): AnalysisResult {
    return {
      quickClass: 'OTHER',
      confidence: 0,
      needsLLM: false,
      route: 'AUTO_SAVE',
      payload: { error: true },
      cacheKey: this.generateCacheKey(input),
      computedAt: Date.now(),
      source: 'heuristic',
      debugInfo: {
        gatingReason: 'error',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}

// =============================================================================
// 🚀 EXPORTS
// =============================================================================

// Export singleton instance
export const coreAnalysisService = CoreAnalysisService.getInstance();

// Export types
export type { ICoreAnalysisService, AnalysisStats };
