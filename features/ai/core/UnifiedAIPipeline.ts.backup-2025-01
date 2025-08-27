/**
 * 🚀 Unified AI Pipeline v1.0
 * 
 * Tüm AI analizlerini tek pipeline'da toplar:
 * - Voice Analysis (Unified Voice)
 * - Pattern Recognition
 * - Insights Generation
 * - CBT Analysis
 * 
 * ✅ FIXED: Module-specific cache TTLs implemented:
 * - Voice Analysis: 1h TTL
 * - Pattern Recognition: 12h TTL  
 * - Insights Generation: 24h TTL
 * - CBT Analysis: 24h TTL
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackAIInteraction, AIEventType } from '../telemetry/aiTelemetry';
import supabaseService from '@/services/supabase';
import { smartMoodJournalingService } from '../services/smartMoodJournalingService';

/**
 * Simple deterministic hash function for React Native
 * Replaces crypto module which is not available in React Native
 */
function simpleHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString(16);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UnifiedPipelineInput {
  userId: string;
  content: string | any; // Voice text, user data, etc.
  type: 'voice' | 'data' | 'mixed';
  context?: {
    source: 'today' | 'mood';
    timestamp?: number;
    metadata?: Record<string, any>;
    hints?: Record<string, any>;
  };
}

export interface UnifiedPipelineResult {
  // Voice Analysis Results
  voice?: {
    category: 'MOOD' | 'BREATHWORK' | 'OTHER';
    confidence: number;
    suggestion?: string;
    route?: string;
  };
  // Breathwork Analysis (optional)
  breathwork?: any;
  
  // 🚀 ENHANCED ANALYTICS: Clinical-grade mood analytics
  analytics?: {
    mood?: {
      weeklyDelta: number;
      volatility: number;
      baselines: {
        mood: number;
        energy: number;
        anxiety: number;
      };
      correlations: {
        moodEnergy?: {
          r: number | null;
          n: number;
          p?: number | null;
        };
        moodAnxiety?: {
          r: number | null;
          n: number;
          p?: number | null;
        };
        energyAnxiety?: {
          r: number | null;
          n: number;
          p?: number | null;
        };
      };
      profile?: {
        type: 'resilient' | 'stressed' | 'fatigued' | 'elevated' | 'stable' | 'volatile' | 'recovering';
        confidence: number;
        rationale: string[];
      };
      bestTimes?: {
        dayOfWeek?: string;
        timeOfDay?: string;
        confidence: number;
      };
      sampleSize: number;
      dataQuality: number;
      confidence: number;
    };
  };
  
  // Pattern Recognition Results (Enhanced for Dashboard)
  patterns?: {
    temporal: Array<{
      type: string;
      frequency?: number;
      timeOfDay?: string;
      trend?: 'increasing' | 'decreasing' | 'stable';
      // Enhanced mood pattern fields
      title?: string;
      description?: string;
      pattern?: string;
      confidence?: number;
      severity?: 'low' | 'medium' | 'high';
      actionable?: boolean;
      suggestion?: string;
      source?: string;
      // 🎯 Dashboard Ready Metrics
      dashboardMetrics?: {
        // Weekly Delta Metrics
        weeklyDelta?: number;
        currentWeekAvg?: number;
        previousWeekAvg?: number;
        trend?: 'improving' | 'declining' | 'stable';
        // MEA Correlation Metrics
        moodEnergyCorrelation?: number;
        moodAnxietyCorrelation?: number;
        energyAnxietyCorrelation?: number;
        emotionalProfile?: string;
        averageMood?: number;
        averageEnergy?: number;
        averageAnxiety?: number;
        // Daily Pattern Metrics
        dayOfWeek?: number;
        dayName?: string;
        significance?: 'positive' | 'negative' | 'neutral';
        sampleSize?: number;
        dataPoints?: number | { thisWeek: number; lastWeek: number };
      };
    }>;
    behavioral: Array<{
      trigger: string;
      response: string;
      frequency: number;
      severity: number;
    }>;
    environmental: Array<{
      location?: string;
      context: string;
      correlation: number;
    }>;
  } | Array<any>; // Allow flexible array format for mood patterns
  
  // Insights Results
  insights?: {
    therapeutic: Array<{
      text: string;
      category: string;
      priority: 'high' | 'medium' | 'low';
      actionable: boolean;
    }>;
    progress: Array<{
      metric: string;
      value: number;
      change: number;
      interpretation: string;
    }>;
  };
  
  // CBT analysis removed
  
  // Metadata
  metadata: {
    pipelineVersion: string;
    processedAt: number;
    cacheTTL: number;
    source: 'cache' | 'fresh';
    processingTime: number;
    // Progressive UI weighting: attach heuristic confidence when available
    heuristicConfidence?: number;
  };
}

// ============================================================================
// MAIN PIPELINE CLASS
// ============================================================================

export class UnifiedAIPipeline {
  private static instance: UnifiedAIPipeline;
  private cache: Map<string, { result: UnifiedPipelineResult; expires: number }> = new Map();
  
  // 🧪 Test mode detection
  private readonly isTestMode = process.env.TEST_MODE === '1';
  private readonly testTTL = parseInt(process.env.TEST_TTL_MS || '5000', 10);
  
  // ✅ FIXED: Module-specific cache TTLs as per specification  
  private readonly MODULE_TTLS = {
    insights: parseInt(process.env.PIPELINE_TTL_INSIGHTS_MS || String(24 * 60 * 60 * 1000), 10),
    patterns: parseInt(process.env.PIPELINE_TTL_PATTERNS_MS || String(12 * 60 * 60 * 1000), 10),
    voice: parseInt(process.env.PIPELINE_TTL_VOICE_MS || String(1 * 60 * 60 * 1000), 10),
    progress: parseInt(process.env.PIPELINE_TTL_PROGRESS_MS || String(6 * 60 * 60 * 1000), 10),
    // cbt removed
    default: parseInt(process.env.PIPELINE_TTL_DEFAULT_MS || String(24 * 60 * 60 * 1000), 10)
  };
  
  private invalidationHooks: Map<string, (userId?: string) => void> = new Map();
  
  private constructor() {
    this.setupInvalidationHooks();
    this.startCacheCleanup();
  }
  
  static getInstance(): UnifiedAIPipeline {
    if (!UnifiedAIPipeline.instance) {
      UnifiedAIPipeline.instance = new UnifiedAIPipeline();
    }
    return UnifiedAIPipeline.instance;
  }
  
  // ============================================================================
  // CACHE TTL MANAGEMENT
  // ============================================================================
  
  /**
   * Get module-specific TTL based on input type and content
   */
  private getModuleTTL(input: UnifiedPipelineInput): number {
    // Determine primary module based on input type
    switch (input.type) {
      case 'voice':
        return this.MODULE_TTLS.voice;
      case 'data':
        // For data inputs, determine by context source
        if (input.context?.source === 'mood') return this.MODULE_TTLS.patterns;
        // cbt/tracking removed
        return this.MODULE_TTLS.insights; // Default for data
      case 'mixed':
        // Mixed inputs typically generate insights
        return this.MODULE_TTLS.insights;
      default:
        return this.MODULE_TTLS.default;
    }
  }

  // ============================================================================
  // MAIN PROCESSING METHOD
  // ============================================================================
  
  async process(input: UnifiedPipelineInput): Promise<UnifiedPipelineResult> {
    const startTime = Date.now();
    
    // 🛡️ MASTER FEATURE FLAG CHECK - Critical: Pipeline must be enabled
    if (!FEATURE_FLAGS.isEnabled('AI_UNIFIED_PIPELINE')) {
      console.log('⚠️ UnifiedAIPipeline: Feature disabled, returning empty result');
      
      // Track disabled pipeline attempt
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_DISABLED, {
        userId: input.userId,
        inputType: input.type,
        pipeline: 'unified',
        reason: 'feature_flag_disabled',
        timestamp: startTime
      });
      
      // Return minimal empty result when disabled
      return {
        metadata: {
          pipelineVersion: '1.0.0',
          processedAt: Date.now(),
          cacheTTL: 0,
          source: 'cache',
          processingTime: Date.now() - startTime
        }
      };
    }
    
    const cacheKey = this.generateCacheKey(input);
    
    // 📊 Track pipeline start
    await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_STARTED, {
      userId: input.userId,
      inputType: input.type,
      pipeline: 'unified',
      cacheKey,
      timestamp: startTime
    });
    
    // 1. Check cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_CACHE_HIT, {
        userId: input.userId,
        pipeline: 'unified',
        cacheKey,
        processingTime: Date.now() - startTime
      });
      
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          source: 'cache'
        }
      };
    }
    
    // 2. Process through pipeline
    const result = await this.executePipeline(input);
    
    // 3. Smart cache with empty insights policy
    this.setCacheWithInsightsPolicy(cacheKey, result, input);
    
    // 4. Track pipeline completion telemetry
    const processingTime = Date.now() - startTime;
    await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_COMPLETED, {
      userId: input.userId,
      pipeline: 'unified',
      processingTime,
      modules: this.getEnabledModules(),
      cacheKey,
      resultSize: JSON.stringify(result).length
    });
    
    return {
      ...result,
      metadata: {
        ...result.metadata,
        source: 'fresh',
        processingTime: Date.now() - startTime,
        heuristicConfidence: (result as any)?.voice?.confidence ?? undefined
      }
    };
  }
  
  // ============================================================================
  // PIPELINE EXECUTION
  // ============================================================================
  
  private async executePipeline(input: UnifiedPipelineInput): Promise<UnifiedPipelineResult> {
    const startTime = Date.now();
    const moduleTTL = this.getModuleTTL(input);
    
    const result: UnifiedPipelineResult = {
      metadata: {
        pipelineVersion: '1.0.0',
        processedAt: Date.now(),
        cacheTTL: moduleTTL,
        source: 'fresh',
        processingTime: 0, // Will be updated by main process method
        heuristicConfidence: undefined
      }
    };
    
    // Run analyses in parallel where possible
    const promises: Promise<void>[] = [];
    
    // 1. Voice Analysis (if voice input)
    if (input.type === 'voice' || input.type === 'mixed') {
      promises.push(
        this.processVoiceAnalysis(input).then(voice => {
          result.voice = voice;
        })
      );
    }
    
    // 2. Pattern Recognition (always run)
    promises.push(
      this.processPatternRecognition(input).then(patterns => {
        result.patterns = patterns;
      })
    );
    
    // CBT analysis removed
    
    // 4. Breathwork Analysis (NEW - Week 2)
    if (this.shouldRunBreathwork(input)) {
      promises.push(
        this.processBreathworkAnalysis(input).then(breathwork => {
          result.breathwork = breathwork;
        })
      );
    }
    
    // Wait for parallel analyses
    await Promise.allSettled(promises);
    
    // 4. Insights Generation with Voice→Insights Bridge (depends on patterns, so run after)
    if (result.patterns) {
      // 🎯 Voice→Insights Bridge: Pass voice analysis results as hints for better insights
      const voiceHints = result.voice?.category ? {
        voiceCategory: result.voice.category,
        voiceConfidence: result.voice.confidence,
        voiceSuggestion: result.voice.suggestion
      } : undefined;
      
      const enhancedInput = voiceHints ? {
        ...input,
        context: {
          ...input.context,
          hints: voiceHints
        }
      } : input;
      
      result.insights = await this.processInsightsGeneration(enhancedInput, result.patterns);
    }
    
    // 📊 Extract analytics from patterns if available (mood analytics)
    if (result.patterns && Array.isArray(result.patterns)) {
      const patternsArray = result.patterns as any[];
      const moodAnalytics = patternsArray.find(p => p.moodAnalytics)?.moodAnalytics;
      if (moodAnalytics) {
        result.analytics = {
          mood: moodAnalytics
        };
        console.log('📊 Enhanced mood analytics attached to result');
      }
    } else if (result.patterns && (result.patterns as any).moodAnalytics) {
      result.analytics = {
        mood: (result.patterns as any).moodAnalytics
      };
    }
    
    // 📊 PHASE 2: Minimal analytics for CBT/Tracking (scaffold)
    // Generate basic analytics when input contains CBT or tracking data
    if (input.content && typeof input.content === 'object') {
      const content = input.content as any;
      
      // CBT analytics removed
      
      // Tracking/compulsion analytics removed
    }
    
    // Load lightweight user profile context (non-blocking)
    let userProfileCtx: any = null;
    try {
      const { loadUserProfileContext } = await import('@/features/ai/context/userProfileAdapter');
      userProfileCtx = await loadUserProfileContext(input.userId);
    } catch {}
    
    // After generating insights/suggestions, apply subtle weighting (non-breaking)
    if (!result.metadata) (result as any).metadata = {};
    if (userProfileCtx && result.analytics && userProfileCtx.remindersEnabled) {
      try {
        (result as any).metadata.reminderBoost = true;
      } catch {}
    }

    return result;
  }
  
  // ============================================================================
  // INDIVIDUAL PROCESSORS
  // ============================================================================
  
  private async processVoiceAnalysis(input: UnifiedPipelineInput): Promise<any> {
    try {
      // Import lazily for better performance
      const { unifiedVoiceAnalysis } = await import('../services/checkinService');
      
      // ✅ FIXED: Pass userId string instead of object to unifiedVoiceAnalysis 
      const analysis = await unifiedVoiceAnalysis(
        typeof input.content === 'string' ? input.content : JSON.stringify(input.content),
        input.userId  // Correct parameter: userId string, not object
      );
      
      return {
        category: analysis.type,
        confidence: analysis.confidence,
        suggestion: analysis.suggestion,
        route: (analysis as any).route
      };
    } catch (error) {
      console.warn('Voice analysis failed, using heuristic fallback:', error);
      
      // ✅ FIXED: Centralized heuristic fallback (moved from UI layer)
      return this.generateHeuristicVoiceAnalysis(
        typeof input.content === 'string' ? input.content : JSON.stringify(input.content)
      );
    }
  }
  
  private async processPatternRecognition(input: UnifiedPipelineInput): Promise<any> {
    try {
      const patterns = {
        temporal: [],
        behavioral: [],
        environmental: [],
        triggers: [],
        severity: [],
        metadata: {
          analysisTime: Date.now(),
          dataPoints: 0,
          confidence: 0
        }
      };
      
      // Extract patterns from user data
      if (typeof input.content === 'object') {
        const content = input.content;
        
        // 1. TEMPORAL PATTERNS (Zaman bazlı kalıplar)
        if (content.compulsions && Array.isArray(content.compulsions)) {
          patterns.temporal = this.extractTemporalPatterns(content.compulsions);
          patterns.metadata.dataPoints += content.compulsions.length;
        }
        
        if (content.moods && Array.isArray(content.moods)) {
          patterns.temporal.push(...this.extractMoodTemporalPatterns(content.moods));
          patterns.metadata.dataPoints += content.moods.length;
          
          // 📊 ENHANCED: Comprehensive mood analytics
          console.log(`🎯 Starting mood analytics processing for ${content.moods.length} mood entries`);
          const moodAnalytics = this.processMoodAnalytics(content.moods);
          console.log('📊 Mood analytics result:', moodAnalytics);
          if (moodAnalytics) {
            // Store analytics in result for dashboard consumption
            (patterns as any).moodAnalytics = moodAnalytics;
            (patterns.metadata as any).hasAdvancedAnalytics = true;
            
            // 📊 Telemetry: Track mood analytics computation
            try {
              trackAIInteraction(AIEventType.MOOD_ANALYTICS_COMPUTED, {
                weeklyDelta: moodAnalytics.weeklyDelta,
                volatility: moodAnalytics.volatility,
                profile: moodAnalytics.profile?.type,
                sampleSize: moodAnalytics.sampleSize,
                dataQuality: moodAnalytics.dataQuality,
                confidence: moodAnalytics.confidence,
                correlationsAvailable: Object.keys(moodAnalytics.correlations).length
              });
            } catch (telemetryError) {
              console.warn('⚠️ Mood analytics telemetry failed:', telemetryError);
            }
          }
        }
        
        // if (content.erpSessions && Array.isArray(content.erpSessions)) { // Removed Terapi
          // patterns.temporal.push(...this.extractTerapiTemporalPatterns(content.erpSessions)); // Removed Terapi
          // patterns.metadata.dataPoints += content.erpSessions.length; // Removed Terapi
        // } // Removed Terapi
        
        // 2. BEHAVIORAL PATTERNS (Davranışsal kalıplar)  
        if (content.compulsions && Array.isArray(content.compulsions)) {
          patterns.behavioral = this.extractBehavioralPatterns(content.compulsions);
        }
        
        // 3. ENVIRONMENTAL TRIGGERS (Çevresel tetikleyiciler)
        patterns.environmental = this.extractEnvironmentalTriggers(content);
        
        // 4. TRIGGER ANALYSIS (Tetik analizi)
        patterns.triggers = this.analyzeTriggers(content);
        
        // 5. SEVERITY PROGRESSION (Şiddet seyrı)
        patterns.severity = this.analyzeSeverityProgression(content);
        
        // 6. CALCULATE CONFIDENCE (Güven skoru hesaplama)
        patterns.metadata.confidence = this.calculatePatternConfidence(patterns.metadata.dataPoints);
      }
      
      // Handle text input (voice/notes)
      if (typeof input.content === 'string') {
        const textPatterns = this.extractTextPatterns(input.content);
        patterns.behavioral.push(...textPatterns.behavioral);
        patterns.triggers.push(...textPatterns.triggers);
        patterns.metadata.dataPoints += 1;
        patterns.metadata.confidence = 0.6; // Text analysis has medium confidence
      }
      
      return patterns;
    } catch (error) {
      console.error('Pattern recognition error:', error);
      return { 
        temporal: [], 
        behavioral: [], 
        environmental: [], 
        triggers: [],
        severity: [],
        metadata: { analysisTime: Date.now(), dataPoints: 0, confidence: 0 }
      };
    }
  }
  
  private async processCBTAnalysis(input: UnifiedPipelineInput): Promise<any> {
    try {
      // ✅ FIXED: Check if this is a progress analytics request
      if (typeof input.content === 'object' && input.content.analysisRequest === 'comprehensive_cbt_progress_analytics') {
        return await this.processCBTProgressAnalytics(input);
      }
      
      const text = typeof input.content === 'string' 
        ? input.content 
        : input.content.description || input.content.notes || '';
      
      if (!text || text.length < 5) {
        return null;
      }
      
      const analysis = {
        distortions: [],
        reframes: [],
        techniques: [],
        thoughtRecord: null,
        severity: 0,
        urgency: 'low',
        metadata: {
          analysisTime: Date.now(),
          textLength: text.length,
          confidence: 0
        }
      };
      
      // 1. COGNITIVE DISTORTION DETECTION
      const detectedDistortions = this.detectCognitiveDistortions(text);
      analysis.distortions = detectedDistortions;
      
      // 2. AUTOMATIC THOUGHT RECORD GENERATION
      if (detectedDistortions.length > 0) {
        analysis.thoughtRecord = this.generateThoughtRecord(text, detectedDistortions);
      }
      
      // 3. REFRAME SUGGESTIONS
      analysis.reframes = await this.generateCBTReframes(text, detectedDistortions);
      
      // 4. CBT TECHNIQUE RECOMMENDATIONS
      analysis.techniques = this.recommendCBTTechniques(detectedDistortions, text);
      
      // 5. SEVERITY ASSESSMENT
      analysis.severity = this.assessCognitiveDistortionSeverity(text, detectedDistortions);
      
      // 6. URGENCY CALCULATION
      analysis.urgency = this.calculateCBTUrgency(analysis.severity, detectedDistortions);
      
      // 7. CONFIDENCE CALCULATION
      analysis.metadata.confidence = this.calculateCBTConfidence(detectedDistortions, text.length);
      
      // CBT engine removed; rely on built-in heuristics only
      
      return analysis;
    } catch (error) {
      console.error('CBT analysis failed:', error);
      return null;
    }
  }

  private detectCognitiveDistortions(text: string): Array<{name: string, confidence: number, evidence: string[]}> {
    const distortions = [];
    const lowerText = text.toLowerCase();
    
    // Catastrophizing (Felaketleştirme)
    const catastrophizingPatterns = [
      { pattern: /ya\s+.*?olursa/gi, weight: 0.8 },
      { pattern: /kesin.*?olacak/gi, weight: 0.7 },
      { pattern: /felaket|korkunç|berbat/gi, weight: 0.6 },
      { pattern: /mahvol.*?|bitecek|dayanamam/gi, weight: 0.9 }
    ];
    
    const catastrophizingEvidence = [];
    let catastrophizingScore = 0;
    
    catastrophizingPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) {
        catastrophizingScore += matches.length * weight;
        catastrophizingEvidence.push(...matches);
      }
    });
    
    if (catastrophizingScore > 0.5) {
      distortions.push({
        name: 'catastrophizing',
        confidence: Math.min(catastrophizingScore, 1),
        evidence: catastrophizingEvidence.slice(0, 3) // Max 3 examples
      });
    }
    
    // All-or-Nothing Thinking (Hep-Hiç Düşünce)
    const allOrNothingPatterns = [
      { pattern: /asla.*?olmaz|hiçbir zaman/gi, weight: 0.8 },
      { pattern: /her zaman|hep|hiç/gi, weight: 0.6 },
      { pattern: /tamamen.*?başarısız|mükemmel.*?olmalı/gi, weight: 0.9 }
    ];
    
    const allOrNothingEvidence = [];
    let allOrNothingScore = 0;
    
    allOrNothingPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) {
        allOrNothingScore += matches.length * weight;
        allOrNothingEvidence.push(...matches);
      }
    });
    
    if (allOrNothingScore > 0.4) {
      distortions.push({
        name: 'all_or_nothing',
        confidence: Math.min(allOrNothingScore, 1),
        evidence: allOrNothingEvidence.slice(0, 3)
      });
    }
    
    // Mind Reading (Zihin Okuma)
    const mindReadingPatterns = [
      { pattern: /herkes.*?düşünüyor|kesin.*?düşünüyor/gi, weight: 0.8 },
      { pattern: /benden nefret|beni sevmiyor/gi, weight: 0.9 },
      { pattern: /yargılıyor|dalga geçiyor|aptal sanıyor/gi, weight: 0.7 }
    ];
    
    const mindReadingEvidence = [];
    let mindReadingScore = 0;
    
    mindReadingPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) {
        mindReadingScore += matches.length * weight;
        mindReadingEvidence.push(...matches);
      }
    });
    
    if (mindReadingScore > 0.4) {
      distortions.push({
        name: 'mind_reading',
        confidence: Math.min(mindReadingScore, 1),
        evidence: mindReadingEvidence.slice(0, 3)
      });
    }
    
    // Personalization (Kişiselleştirme)
    const personalizationPatterns = [
      { pattern: /benim yüzümden|benim suçum/gi, weight: 0.9 },
      { pattern: /ben sebep oldum|hep ben/gi, weight: 0.8 },
      { pattern: /benden kaynaklı/gi, weight: 0.7 }
    ];
    
    const personalizationEvidence = [];
    let personalizationScore = 0;
    
    personalizationPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) {
        personalizationScore += matches.length * weight;
        personalizationEvidence.push(...matches);
      }
    });
    
    if (personalizationScore > 0.4) {
      distortions.push({
        name: 'personalization',
        confidence: Math.min(personalizationScore, 1),
        evidence: personalizationEvidence.slice(0, 3)
      });
    }
    
    // Labeling (Etiketleme)
    const labelingPatterns = [
      { pattern: /ben.*?başarısızım|ben.*?aptalım/gi, weight: 0.9 },
      { pattern: /ben.*?değersizim|ben.*?beceriksizim/gi, weight: 0.9 },
      { pattern: /hiçbir işe yaramıyorum/gi, weight: 0.8 }
    ];
    
    const labelingEvidence = [];
    let labelingScore = 0;
    
    labelingPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) {
        labelingScore += matches.length * weight;
        labelingEvidence.push(...matches);
      }
    });
    
    if (labelingScore > 0.4) {
      distortions.push({
        name: 'labeling',
        confidence: Math.min(labelingScore, 1),
        evidence: labelingEvidence.slice(0, 3)
      });
    }
    
    return distortions;
  }

  private generateThoughtRecord(text: string, distortions: any[]): any {
    const primaryDistortion = distortions[0];
    if (!primaryDistortion) return null;
    
    return {
      automaticThought: text.substring(0, 200), // First 200 chars as automatic thought
      emotion: this.extractEmotionFromText(text),
      intensity: this.calculateEmotionalIntensity(text),
      distortion: primaryDistortion.name,
      evidence: primaryDistortion.evidence,
      balancedThought: '', // Will be filled by user or AI reframes
      createdAt: new Date().toISOString()
    };
  }

  private async generateCBTReframes(text: string, distortions: any[]): Promise<string[]> {
    const reframes = [];
    
    // Generate distortion-specific reframes
    distortions.forEach(distortion => {
      switch (distortion.name) {
        case 'catastrophizing':
          reframes.push(
            'Bu durumun gerçekte ne kadar kötü olabileceğini gerçekçi bir şekilde değerlendirebilirim.',
            'Geçmişte benzer durumlarla başa çıktığımı hatırlıyorum.',
            'En kötü senaryo gerçekleşse bile, bunun üstesinden gelme yolları vardır.'
          );
          break;
        case 'all_or_nothing':
          reframes.push(
            'Bu durum siyah-beyaz değil, grinin tonları var.',
            'Mükemmel olmak zorunda değilim, yeterince iyi olmak da değerlidir.',
            'Her şeyin bir spektrumu olduğunu hatırlamalıyım.'
          );
          break;
        case 'mind_reading':
          reframes.push(
            'Başkalarının ne düşündüğünü gerçekten bilemem.',
            'İnsanlar genellikle kendi sorunlarıyla meşguller, beni o kadar düşünmüyorlar.',
            'Varsayımlarım gerçek olmayabilir, doğrudan sormak daha iyi olabilir.'
          );
          break;
        case 'personalization':
          reframes.push(
            'Her şey benim kontrolümde değil ve her şeyden sorumlu değilim.',
            'Bu duruma birçok faktör katkıda bulunmuş olabilir.',
            'Kendimi gereksiz yere suçlamak yerine çözüm odaklı düşünebilirim.'
          );
          break;
        case 'labeling':
          reframes.push(
            'Ben bir davranışım değilim, bu sadece bir hata.',
            'Herkes hata yapar, bu beni kötü bir insan yapmaz.',
            'Kendimle daha şefkatli konuşmalıyım.'
          );
          break;
      }
    });
    
    // Generic reframes if no specific distortions
    if (reframes.length === 0) {
      reframes.push(
        'Bu düşüncenin bana ne kadar faydası var?',
        'Bu durumu daha dengeli bir şekilde nasıl değerlendirebilirim?',
        'En iyi arkadaşıma ne söylerdim?'
      );
    }
    
    // Remove duplicates and limit to 3
    return [...new Set(reframes)].slice(0, 3);
  }

  private recommendCBTTechniques(distortions: any[], text: string): Array<{name: string, description: string, priority: number}> {
    const techniques = [];
    const distortionNames = distortions.map(d => d.name);
    
    // Technique recommendations based on detected distortions
    if (distortionNames.includes('catastrophizing')) {
      techniques.push({
        name: 'Probability Estimation',
        description: 'Korkulan durumun gerçekleşme olasılığını gerçekçi bir şekilde değerlendirin (0-100%).',
        priority: 9
      });
      techniques.push({
        name: 'Decatastrophizing',
        description: 'En kötü senaryo gerçekleşse bile nasıl başa çıkabileceğinizi planlayın.',
        priority: 8
      });
    }
    
    if (distortionNames.includes('all_or_nothing')) {
      techniques.push({
        name: 'Continuum Technique',
        description: 'Durumu 0-100 skalasında değerlendirerek gri alanları keşfedin.',
        priority: 9
      });
    }
    
    if (distortionNames.includes('mind_reading')) {
      techniques.push({
        name: 'Evidence Testing',
        description: 'Başkalarının düşüncelerine dair varsayımlarınız için kanıt arayın.',
        priority: 8
      });
      techniques.push({
        name: 'Alternative Perspectives',
        description: 'Durumu farklı açılardan değerlendirin.',
        priority: 7
      });
    }
    
    // General techniques
    techniques.push({
      name: 'Thought Record',
      description: 'Düşüncelerinizi yazarak analiz edin ve dengeli alternatifler bulun.',
      priority: 6
    });
    
    techniques.push({
      name: 'Self-Compassion',
      description: 'Kendinize en iyi arkadaşınıza davranır gibi şefkatli davranın.',
      priority: 5
    });
    
    // Sort by priority and return top 3
    return techniques
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  }

  private assessCognitiveDistortionSeverity(text: string, distortions: any[]): number {
    if (distortions.length === 0) return 0;
    
    // Base severity from number of distortions
    let severity = Math.min(distortions.length * 2, 6);
    
    // Increase severity based on confidence
    const avgConfidence = distortions.reduce((sum, d) => sum + d.confidence, 0) / distortions.length;
    severity += avgConfidence * 2;
    
    // Increase severity for emotional intensity words
    const intensityWords = /çok|aşırı|korkunç|berbat|dayanamam|mahvoldum/gi;
    const intensityMatches = text.match(intensityWords);
    if (intensityMatches) {
      severity += Math.min(intensityMatches.length * 0.5, 2);
    }
    
    return Math.min(Math.round(severity), 10);
  }

  private calculateCBTUrgency(severity: number, distortions: any[]): 'low' | 'medium' | 'high' {
    if (severity >= 8) return 'high';
    if (severity >= 5) return 'medium';
    return 'low';
  }

  private calculateCBTConfidence(distortions: any[], textLength: number): number {
    if (distortions.length === 0) return 0.3;
    
    const avgDistortionConfidence = distortions.reduce((sum, d) => sum + d.confidence, 0) / distortions.length;
    const lengthBonus = Math.min(textLength / 100, 0.2); // Bonus for longer text
    
    return Math.min(avgDistortionConfidence + lengthBonus, 0.95);
  }

  /**
   * ✅ FIXED: Centralized heuristic voice fallback (moved from UI layer)
   * Generate basic heuristic analysis when sophisticated voice analysis fails
   */
  private generateHeuristicVoiceAnalysis(text: string): any {
    const lowerText = text.toLowerCase();
    
    // Simple keyword-based classification
    const moodKeywords = ['mutlu', 'üzgün', 'yorgun', 'iyi', 'kötü', 'harika', 'berbat', 'mükemmel', 'mood', 'hissediyorum'];
    const ocdKeywords = ['kompulsiyon', 'takıntı', 'kontrol', 'temizlik', 'yıkama', 'sayma', 'düzen', 'simetri'];
    const cbtKeywords = ['düşünce', 'olumsuz', 'kaygı', 'endişe', 'korku', 'çarpıtma', 'yanlış', 'doğru'];
    const breathworkKeywords = ['nefes', 'sakin', 'rahatlama', 'stres', 'gergin', 'soluk'];
    
    // Count keyword matches
    const moodCount = moodKeywords.filter(keyword => lowerText.includes(keyword)).length;
    const ocdCount = ocdKeywords.filter(keyword => lowerText.includes(keyword)).length;
    const cbtCount = cbtKeywords.filter(keyword => lowerText.includes(keyword)).length;
    const breathworkCount = breathworkKeywords.filter(keyword => lowerText.includes(keyword)).length;
    
    // Determine category based on highest count
    let category = 'MOOD'; // default
    let confidence = 0.3; // low confidence for heuristic
    let maxCount = moodCount;
    
    if (ocdCount > maxCount) {
      category = 'OCD';
      maxCount = ocdCount;
    }
    if (cbtCount > maxCount) {
      category = 'CBT';
      maxCount = cbtCount;
    }
    if (breathworkCount > maxCount) {
      category = 'BREATHWORK';
      maxCount = breathworkCount;
    }
    
    // Adjust confidence based on matches
    confidence = Math.min(0.6, 0.3 + (maxCount * 0.1));
    
    return {
      category,
      confidence,
      suggestion: 'Heuristic analysis tamamlandı',
      route: 'SUGGEST_SCREEN',
      extractedData: {
        mood: Math.max(1, Math.min(10, 5 + (maxCount - 2))), // 1-10 range, neutral=5
        trigger: category === 'OCD' ? 'compulsion_detected' :
                category === 'CBT' ? 'negative_thought' :
                category === 'BREATHWORK' ? 'anxiety_detected' : 'mood_expression'
      },
      metadata: {
        source: 'unified_heuristic_fallback',
        processingTime: 0,
        keywordMatches: { moodCount, ocdCount, cbtCount, breathworkCount }
      }
    };
  }

  private extractEmotionFromText(text: string): string {
    const emotions = {
      'üzgün': /üzgün|üzülü|kederli|melankolik/gi,
      'öfkeli': /öfkeli|sinirli|kızgın|rahatsız/gi,
      'kaygılı': /kaygılı|endişeli|gergin|stresli/gi,
      'korku': /korku|panik|dehşet/gi,
      'utanç': /utanç|mahcup|rezil/gi
    };
    
    for (const [emotion, pattern] of Object.entries(emotions)) {
      if (pattern.test(text)) {
        return emotion;
      }
    }
    
    return 'belirsiz';
  }

  private calculateEmotionalIntensity(text: string): number {
    const intensifiers = text.match(/çok|aşırı|son derece|fazlasıyla|tam/gi);
    const baseIntensity = 5;
    const intensifierBonus = intensifiers ? Math.min(intensifiers.length * 2, 4) : 0;
    
    return Math.min(baseIntensity + intensifierBonus, 10);
  }
  
  private async processInsightsGeneration(
    input: UnifiedPipelineInput, 
    patterns: any
  ): Promise<any> {
    try {
      const insights = {
        therapeutic: [],
        progress: [],
        behavioral: [],
        motivational: [],
        metadata: {
          generatedAt: Date.now(),
          confidence: 0,
          totalInsights: 0,
          categories: []
        }
      };
      
      // 1. VOICE-ENHANCED INSIGHTS (Ses analizi destekli)
      const voiceHints = input.context?.hints;
      if (voiceHints?.voiceCategory && voiceHints.voiceConfidence > 0.7) {
        const voiceEnhancedInsights = this.generateVoiceEnhancedInsights(voiceHints, patterns);
        insights.therapeutic.push(...voiceEnhancedInsights);
        console.log(`🎤 Added ${voiceEnhancedInsights.length} voice-enhanced insights for category: ${voiceHints.voiceCategory}`);
        
        // 📊 Track voice insights application
        try {
          await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
            userId: input.userId,
            source: 'voice_enhanced_insights',
            insightsHintsApplied: true,
            voiceCategory: voiceHints.voiceCategory,
            voiceConfidence: voiceHints.voiceConfidence,
            enhancedInsightsCount: voiceEnhancedInsights.length,
            originalPatternsCount: Object.keys(patterns).filter(k => patterns[k]?.length > 0).length
          });
        } catch (error) {
          console.warn('⚠️ Voice insights telemetry failed:', error);
        }
      }

      // 2. TEMPORAL INSIGHTS (Zaman bazlı içgörüler)
      if (patterns.temporal && patterns.temporal.length > 0) {
        const temporalInsights = this.generateTemporalInsights(patterns.temporal);
        insights.therapeutic.push(...temporalInsights);
      }
      
      // 3. BEHAVIORAL INSIGHTS (Davranışsal içgörüler)
      if (patterns.behavioral && patterns.behavioral.length > 0) {
        const behavioralInsights = this.generateBehavioralInsights(patterns.behavioral);
        insights.behavioral.push(...behavioralInsights);
      }
      
      // 4. TRIGGER INSIGHTS (Tetik içgörüleri)
      if (patterns.triggers && patterns.triggers.length > 0) {
        const triggerInsights = this.generateTriggerInsights(patterns.triggers);
        insights.therapeutic.push(...triggerInsights);
      }
      
      // 5. SEVERITY PROGRESSION INSIGHTS (Şiddet seyri içgörüleri)
      if (patterns.severity && patterns.severity.length > 0) {
        const severityInsights = this.generateSeverityInsights(patterns.severity);
        insights.progress.push(...severityInsights);
      }
      
      // 6. ENVIRONMENTAL INSIGHTS (Çevresel içgörüler)
      if (patterns.environmental && patterns.environmental.length > 0) {
        const environmentalInsights = this.generateEnvironmentalInsights(patterns.environmental);
        insights.therapeutic.push(...environmentalInsights);
      }
      
      // 7. PROGRESS INSIGHTS (İlerleme içgörüleri)
      const progressInsights = this.generateProgressInsights(patterns, input);
      insights.progress.push(...progressInsights);
      
      // 8. MOTIVATIONAL INSIGHTS (Motivasyon içgörüleri)
      const motivationalInsights = this.generateMotivationalInsights(patterns);
      insights.motivational.push(...motivationalInsights);
      
      // 9. CROSS-PATTERN INSIGHTS (Çapraz kalıp analizi)
      const crossPatternInsights = this.generateCrossPatternInsights(patterns);
      insights.therapeutic.push(...crossPatternInsights);
      
      // 10. CALCULATE METADATA
      insights.metadata = this.calculateInsightsMetadata(insights);
      
      // 11. PRIORITIZE AND LIMIT INSIGHTS (En önemli içgörüleri seç)
      insights.therapeutic = this.prioritizeInsights(insights.therapeutic).slice(0, 5);
      insights.progress = insights.progress.slice(0, 3);
      insights.behavioral = insights.behavioral.slice(0, 3);
      insights.motivational = insights.motivational.slice(0, 2);
      
      // 12. FALLBACK INSIGHT GENERATION (Boş sonuç önleme)
      const totalInsights = insights.therapeutic.length + insights.progress.length + 
                           insights.behavioral.length + insights.motivational.length;
      
      if (totalInsights === 0) {
        console.log('⚠️ No primary insights generated, adding fallback insights...');
        const fallbackInsights = this.generateFallbackInsights(patterns, input);
        insights.therapeutic.push(...fallbackInsights.therapeutic);
        insights.progress.push(...fallbackInsights.progress);
        
        // Track fallback usage for monitoring
        trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
          userId: input.userId,
          source: 'fallback',
          reason: 'no_primary_insights',
          insightsCount: fallbackInsights.therapeutic.length + fallbackInsights.progress.length,
          patternsAvailable: Object.keys(patterns).filter(k => patterns[k]?.length > 0)
        }).catch(console.warn);
      }
      
      return insights;
    } catch (error) {
      console.error('Insights generation failed:', error);
      return {
        therapeutic: [],
        progress: [],
        behavioral: [],
        motivational: [],
        metadata: {
          generatedAt: Date.now(),
          confidence: 0,
          totalInsights: 0,
          categories: []
        }
      };
    }
  }

  private generateTemporalInsights(temporalPatterns: any[]): any[] {
    const insights = [];
    
    temporalPatterns.forEach(pattern => {
      switch (pattern.type) {
        case 'peak_hour':
          insights.push({
            text: `Kompulsiyonlarınız genellikle ${pattern.timeOfDay} saatlerinde pik yapıyor. Bu saatlerde önceden hazırlanmak faydalı olabilir.`,
            category: 'temporal',
            priority: 'high',
            actionable: true,
            confidence: pattern.confidence,
            data: { peakTime: pattern.timeOfDay, frequency: pattern.frequency }
          });
          break;
        case 'peak_day':
          insights.push({
            text: `${pattern.dayOfWeek} günleri kompulsiyonlarınız daha sık görülüyor. Bu günler için özel stratejiler geliştirebilirsiniz.`,
            category: 'temporal',
            priority: 'medium',
            actionable: true,
            confidence: pattern.confidence,
            data: { peakDay: pattern.dayOfWeek, frequency: pattern.frequency }
          });
          break;
        case 'clustering':
          insights.push({
            text: 'Kompulsiyonlarınız kümelenmede meydana geliyor. Bir kompulsiyondan sonra diğerlerini tetiklemeyi önlemek için ara teknikler kullanabilirsiniz.',
            category: 'temporal',
            priority: 'high',
            actionable: true,
            confidence: pattern.confidence,
            data: { clusterCount: pattern.clusters.length }
          });
          break;
        case 'mood_trend':
          if (pattern.direction === 'improving') {
            insights.push({
              text: 'Ruh haliniz son zamanlarda iyileşme eğiliminde! Bu pozitif trendi sürdürmeye odaklanın.',
              category: 'progress',
              priority: 'high',
              actionable: false,
              confidence: pattern.confidence,
              data: { trend: pattern.direction, strength: pattern.strength }
            });
          } else if (pattern.direction === 'declining') {
            insights.push({
              text: 'Ruh halinizde düşüş gözleniyor. Destek stratejilerinizi devreye sokmak için uygun bir zaman olabilir.',
              category: 'alert',
              priority: 'high',
              actionable: true,
              confidence: pattern.confidence,
              data: { trend: pattern.direction, strength: pattern.strength }
            });
          }
          break;
        case 'therapy_progress':
          if (pattern.direction === 'improving') {
            insights.push({
              text: 'Terapi seanslarınızda ilerleme kaydediyorsunuz! Mevcut yaklaşımınızı sürdürün.',
              category: 'progress',
              priority: 'high',
              actionable: false,
              confidence: pattern.confidence,
              data: { direction: pattern.direction, consistency: pattern.consistency }
            });
          }
          break;
      }
    });
    
    return insights;
  }

  private generateBehavioralInsights(behavioralPatterns: any[]): any[] {
    const insights = [];
    
    behavioralPatterns.forEach(pattern => {
      switch (pattern.type) {
        case 'dominant_category':
          insights.push({
            text: `Kompulsiyonlarınızın %${pattern.percentage}'i ${pattern.category} kategorisinde. Bu alana özel müdahaleler geliştirebilirsiniz.`,
            category: 'behavioral',
            priority: 'high',
            actionable: true,
            confidence: pattern.confidence,
            data: { category: pattern.category, percentage: pattern.percentage }
          });
          break;
        case 'duration_pattern':
          if (pattern.trend === 'increasing') {
            insights.push({
              text: `Kompulsiyon süreleriniz artış eğiliminde (ortalama ${pattern.averageDuration} dakika). Durdurma stratejilerinizi gözden geçirin.`,
              category: 'behavioral',
              priority: 'medium',
              actionable: true,
              confidence: pattern.confidence,
              data: { averageDuration: pattern.averageDuration, trend: pattern.trend }
            });
          } else if (pattern.trend === 'decreasing') {
            insights.push({
              text: `Kompulsiyon süreleriniz azalıyor! Bu olumlu gelişimi sürdürün.`,
              category: 'progress',
              priority: 'medium',
              actionable: false,
              confidence: pattern.confidence,
              data: { averageDuration: pattern.averageDuration, trend: pattern.trend }
            });
          }
          break;
        case 'compulsion_indicator':
          insights.push({
            text: `${pattern.category} tipi kompulsiyonlara yönelik belirtiler tespit edildi. Bu alana özel egzersizler faydalı olabilir.`,
            category: 'behavioral',
            priority: 'medium',
            actionable: true,
            confidence: pattern.confidence,
            data: { category: pattern.category, intensity: pattern.intensity }
          });
          break;
      }
    });
    
    return insights;
  }

  private generateTriggerInsights(triggerPatterns: any[]): any[] {
    const insights = [];
    
    triggerPatterns.forEach(pattern => {
      switch (pattern.type) {
        case 'situational':
          insights.push({
            text: `"${pattern.description}" sıklıkla tetikleyici oluyor. Bu durumlar için önceden stratejiler hazırlayabilirsiniz.`,
            category: 'trigger',
            priority: 'medium',
            actionable: true,
            confidence: pattern.confidence,
            data: { trigger: pattern.description, frequency: pattern.frequency }
          });
          break;
        case 'emotional':
          const emotionTurkish = {
            'anxiety': 'kaygı',
            'stress': 'stres',
            'perfectionism': 'mükemmeliyetçilik'
          };
          insights.push({
            text: `${emotionTurkish[pattern.trigger] || pattern.trigger} durumlarında kompulsiyonlar tetikleniyor. Duygu düzenleme tekniklerini devreye alın.`,
            category: 'trigger',
            priority: 'high',
            actionable: true,
            confidence: pattern.confidence,
            data: { emotionalTrigger: pattern.trigger }
          });
          break;
        case 'location':
          insights.push({
            text: `${pattern.trigger} konumunda kompulsiyonlar sıklıkla görülüyor. Bu ortamda özel önlemler alabilirsiniz.`,
            category: 'trigger',
            priority: 'medium',
            actionable: true,
            confidence: pattern.confidence,
            data: { location: pattern.trigger, frequency: pattern.frequency }
          });
          break;
      }
    });
    
    return insights;
  }

  private generateSeverityInsights(severityPatterns: any[]): any[] {
    const insights = [];
    
    severityPatterns.forEach(pattern => {
      if (pattern.type === 'severity_trend') {
        switch (pattern.direction) {
          case 'improving':
            insights.push({
              metric: 'severity_trend',
              value: pattern.recentAverage,
              change: -pattern.strength,
              interpretation: `Şiddet düzeyinde iyileşme var! Son veriler ${pattern.recentAverage.toFixed(1)} ortalama gösteriyor.`,
              confidence: pattern.confidence
            });
            break;
          case 'worsening':
            insights.push({
              metric: 'severity_trend',
              value: pattern.recentAverage,
              change: pattern.strength,
              interpretation: `Şiddet düzeyinde artış gözleniyor. Destek stratejilerini devreye alma zamanı.`,
              confidence: pattern.confidence
            });
            break;
          case 'stable':
            insights.push({
              metric: 'severity_trend',
              value: pattern.recentAverage,
              change: 0,
              interpretation: 'Şiddet düzeyi stabil seyrediyor.',
              confidence: pattern.confidence
            });
            break;
        }
      }
    });
    
    return insights;
  }

  private generateEnvironmentalInsights(environmentalPatterns: any[]): any[] {
    const insights = [];
    
    environmentalPatterns.forEach(pattern => {
      if (pattern.type === 'location') {
        insights.push({
          text: `${pattern.trigger} konumunda kompulsiyonlar sık görülüyor. Bu ortamda tetik faktörlerini belirleyip önlem almayı düşünün.`,
          category: 'environmental',
          priority: 'medium',
          actionable: true,
          confidence: pattern.confidence,
          data: { location: pattern.trigger, frequency: pattern.frequency }
        });
      }
    });
    
    return insights;
  }

  private generateProgressInsights(patterns: any, input: UnifiedPipelineInput): any[] {
    const insights = [];
    
    // Data richness insight
    if (patterns.metadata && patterns.metadata.dataPoints > 10) {
      insights.push({
        metric: 'data_richness',
        value: patterns.metadata.dataPoints,
        change: 0,
        interpretation: `${patterns.metadata.dataPoints} veri noktası ile güçlü bir analiz yapabiliyoruz.`,
        confidence: 0.9
      });
    }
    
    // Pattern detection confidence
    if (patterns.metadata && patterns.metadata.confidence > 0.7) {
      insights.push({
        metric: 'pattern_confidence',
        value: Math.round(patterns.metadata.confidence * 100),
        change: 0,
        interpretation: `Kalıp tespitinde %${Math.round(patterns.metadata.confidence * 100)} güven düzeyi.`,
        confidence: patterns.metadata.confidence
      });
    }
    
    return insights;
  }

  private generateMotivationalInsights(patterns: any): any[] {
    const insights = [];
    
    // Encourage pattern awareness
    if (patterns.temporal && patterns.temporal.length > 0) {
      insights.push({
        text: 'Verilerinizi analiz etmek, kendi kalıplarınızı anlamanızı sağlıyor. Bu farkındalık iyileşmenin ilk adımıdır.',
        category: 'motivational',
        priority: 'low',
        actionable: false,
        confidence: 0.8
      });
    }
    
    // Encourage consistency
    if (patterns.metadata && patterns.metadata.dataPoints >= 5) {
      insights.push({
        text: 'Düzenli kayıt tutmaya devam ediyorsunuz. Bu tutarlılık uzun vadeli başarının anahtarı!',
        category: 'motivational',
        priority: 'low',
        actionable: false,
        confidence: 0.9
      });
    }
    
    return insights;
  }

  private generateCrossPatternInsights(patterns: any): any[] {
    const insights = [];
    
    // Cross-pattern analysis (temporal + behavioral)
    if (patterns.temporal && patterns.behavioral && patterns.temporal.length > 0 && patterns.behavioral.length > 0) {
      insights.push({
        text: 'Zaman kalıplarınız ile davranış örüntüleriniz arasında bağlantı var. Bu ilişkiyi anlayarak daha etkili stratejiler geliştirebilirsiniz.',
        category: 'complex_pattern',
        priority: 'medium',
        actionable: true,
        confidence: 0.7,
        data: { 
          temporalPatterns: patterns.temporal.length, 
          behavioralPatterns: patterns.behavioral.length 
        }
      });
    }
    
    // High severity with strong patterns
    if (patterns.severity && patterns.temporal && patterns.severity.length > 0) {
      const hasSeverePattern = patterns.severity.some(s => s.direction === 'worsening');
      if (hasSeverePattern) {
        insights.push({
          text: 'Şiddet artışı ile zaman kalıpları birleştiğinde, öngörülü müdahale planları önem kazanıyor.',
          category: 'strategic',
          priority: 'high',
          actionable: true,
          confidence: 0.8
        });
      }
    }
    
    return insights;
  }

  private calculateInsightsMetadata(insights: any): any {
    const allInsights = [
      ...insights.therapeutic,
      ...insights.progress,
      ...insights.behavioral,
      ...insights.motivational
    ];
    
    const categories = [...new Set(allInsights.map(insight => insight.category || 'unknown'))];
    const avgConfidence = allInsights.reduce((sum, insight) => 
      sum + (insight.confidence || 0.5), 0) / allInsights.length;
    
    return {
      generatedAt: Date.now(),
      confidence: avgConfidence || 0,
      totalInsights: allInsights.length,
      categories
    };
  }

  private prioritizeInsights(insights: any[]): any[] {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    
    return insights.sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // High priority first
      }
      
      // If same priority, sort by confidence
      return (b.confidence || 0) - (a.confidence || 0);
    });
  }
  
  /**
   * Determine if breathwork analysis should run
   */
  private shouldRunBreathwork(input: UnifiedPipelineInput): boolean {
    // Always check for breathwork opportunities
    return true;
  }
  
  /**
   * Process comprehensive breathwork analysis with new service integration
   */
  private async processBreathworkAnalysis(input: UnifiedPipelineInput): Promise<any> {
    try {
      // Extract context for breathwork suggestion
      const context = {
        moodScore: this.extractMoodFromInput(input),
        anxietyLevel: this.extractAnxietyFromInput(input),
        recentCompulsions: this.extractRecentCompulsions(input),
        userInput: typeof input.content === 'string' ? input.content : undefined
      };
      
      // Use new breathwork suggestion service
      try {
        const { breathworkSuggestionService } = await import('../services/breathworkSuggestionService');
        
        const suggestion = await breathworkSuggestionService.generateSuggestion({
          userId: input.userId,
          ...context,
          currentTime: new Date()
        });
        
        if (suggestion) {
          return {
            hasBreathworkSuggestion: true,
            suggestion: {
              id: suggestion.id,
              trigger: suggestion.trigger,
              protocol: suggestion.protocol,
              urgency: suggestion.urgency,
              customization: suggestion.customization,
              timing: suggestion.timing,
              metadata: {
                confidence: suggestion.trigger.confidence,
                source: 'ai_breathwork_service',
                generatedAt: suggestion.metadata.generatedAt,
                priority: suggestion.metadata.priority
              }
            },
            enhancement: {
              contextualRelevance: this.calculateBreathworkRelevance(context),
              fallbackProtocols: suggestion.metadata.fallbackOptions,
              adaptations: {
                userPreferences: true,
                urgencyAdjusted: suggestion.urgency !== 'low',
                protocolCustomized: suggestion.protocol.name !== 'box'
              }
            }
          };
        }
        
      } catch (serviceError) {
        console.warn('Breathwork service unavailable, using fallback:', serviceError);
        
        // Fallback to enhanced heuristic analysis
        return this.processBreathworkHeuristics(context);
      }
      
      return { hasBreathworkSuggestion: false };
      
    } catch (error) {
      console.error('Breathwork analysis failed:', error);
      return { hasBreathworkSuggestion: false, error: 'analysis_failed' };
    }
  }
  
  /**
   * Fallback breathwork analysis using heuristics
   */
  private processBreathworkHeuristics(context: any): any {
    const anxietyLevel = context.anxietyLevel || 5;
    const moodScore = context.moodScore;
    const recentCompulsions = context.recentCompulsions || 0;
    
    // Determine if breathwork is needed
    let needsBreathwork = false;
    let urgency: 'low' | 'medium' | 'high' = 'low';
    let triggerType = 'maintenance';
    
    if (anxietyLevel >= 8) {
      needsBreathwork = true;
      urgency = 'high';
      triggerType = 'anxiety';
    } else if (anxietyLevel >= 6) {
      needsBreathwork = true;
      urgency = 'medium';
      triggerType = 'anxiety';
    } else if (moodScore && moodScore <= 4) {
      needsBreathwork = true;
      urgency = 'medium';
      triggerType = 'low_mood';
    } else if (recentCompulsions >= 2) {
      needsBreathwork = true;
      urgency = 'medium';
      triggerType = 'post_compulsion';
    }
    
    if (!needsBreathwork) {
      return { hasBreathworkSuggestion: false };
    }
    
    // Select protocol based on context
    let protocol = 'box';
    if (anxietyLevel >= 8) protocol = 'quick_calm';
    else if (anxietyLevel >= 6) protocol = '4-7-8';
    else if (moodScore && moodScore <= 3) protocol = 'paced';
    
    return {
      hasBreathworkSuggestion: true,
      suggestion: {
        id: `heuristic_${Date.now()}`,
        trigger: { 
          type: triggerType, 
          confidence: anxietyLevel >= 7 ? 0.8 : 0.6,
          contextData: { anxietyLevel, moodScore, recentCompulsions }
        },
        protocol: { 
          name: protocol, 
          duration: protocol === 'quick_calm' ? 120 : 300 
        },
        urgency,
        metadata: {
          confidence: anxietyLevel >= 7 ? 0.8 : 0.6,
          source: 'heuristic_fallback',
          generatedAt: Date.now()
        }
      },
      enhancement: {
        contextualRelevance: this.calculateBreathworkRelevance(context),
        fallbackProtocols: ['box', 'paced'],
        adaptations: {
          userPreferences: false,
          urgencyAdjusted: urgency !== 'low',
          protocolCustomized: false
        }
      }
    };
  }
  
  private extractMoodFromInput(input: UnifiedPipelineInput): number | undefined {
    if (typeof input.content === 'object' && input.content.mood) {
      return input.content.mood;
    }
    
    if (typeof input.content === 'string') {
      // Simple mood extraction from text
      const text = input.content.toLowerCase();
      if (/çok.*?(kötü|berbat|mutsuz)/i.test(text)) return 2;
      if (/kötü|üzgün|keyifsiz/i.test(text)) return 4;
      if (/iyi|güzel|mutlu/i.test(text)) return 7;
      if (/(çok|aşırı).*?(iyi|mutlu|harika)/i.test(text)) return 9;
    }
    
    return undefined;
  }
  
  private extractAnxietyFromInput(input: UnifiedPipelineInput): number {
    if (typeof input.content === 'object' && input.content.anxiety) {
      return input.content.anxiety;
    }
    
    if (typeof input.content === 'string') {
      const text = input.content.toLowerCase();
      let anxietyScore = 0;
      
      // High anxiety indicators
      if (/panik|dehşet|korkunç|dayanamıyorum/i.test(text)) anxietyScore += 4;
      if (/kaygı|endişe|gergin/i.test(text)) anxietyScore += 2;
      if (/(çok|aşırı).*?(kaygılı|endişeli|gergin)/i.test(text)) anxietyScore += 3;
      if (/nefes.*?alamıyorum|çarpıntı|titreme/i.test(text)) anxietyScore += 3;
      
      return Math.min(anxietyScore, 10);
    }
    
    return 5; // Default neutral
  }
  
  private extractRecentCompulsions(input: UnifiedPipelineInput): number {
    if (typeof input.content === 'object' && input.content.compulsions) {
      if (Array.isArray(input.content.compulsions)) {
        // Count recent compulsions (last 24 hours)
        const yesterday = Date.now() - (24 * 60 * 60 * 1000);
        return input.content.compulsions.filter(c => 
          c.timestamp && new Date(c.timestamp).getTime() > yesterday
        ).length;
      }
    }
    
    if (typeof input.content === 'string') {
      // Simple compulsion indicators from text
      const compulsionWords = /kontrol.*?etti?m|tekrar.*?bakt?ım|yıka.*?dım|temizle.*?dim|say.*?dım/gi;
      const matches = input.content.match(compulsionWords);
      return matches ? matches.length : 0;
    }
    
    return 0;
  }
  
  private calculateBreathworkRelevance(context: any): number {
    let relevance = 0.3; // Base relevance
    
    if (context.anxietyLevel && context.anxietyLevel >= 6) relevance += 0.4;
    if (context.moodScore && context.moodScore <= 4) relevance += 0.3;
    if (context.recentCompulsions && context.recentCompulsions >= 1) relevance += 0.2;
    if (context.userInput && /nefes|sakin|rahatlat/i.test(context.userInput)) relevance += 0.3;
    
    return Math.min(relevance, 1.0);
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  private extractTemporalPatterns(compulsions: any[]): any[] {
    // Guard against undefined/null compulsions
    if (!compulsions || !Array.isArray(compulsions)) return [];
    
    // 🚀 PERFORMANCE OPTIMIZATION: Sample recent entries only
    // Recent patterns are more relevant and processing is much faster
    const SAMPLE_SIZE = 50; // Process max 50 recent entries instead of all 101+
    const recentCompulsions = compulsions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, SAMPLE_SIZE);
    
    // Group by hour of day
    const hourGroups = {};
    
    recentCompulsions.forEach(c => {
      const hour = new Date(c.timestamp).getHours();
      hourGroups[hour] = (hourGroups[hour] || 0) + 1;
    });
    
    // Find peak hours with early exit
    const patterns = [];
    const maxPatterns = 5; // Limit patterns to prevent over-processing
    
    Object.entries(hourGroups as any)
      .sort(([,a], [,b]) => (b as number) - (a as number)) // Sort by frequency
      .forEach(([hour, count]) => {
        if (patterns.length >= maxPatterns) return; // Early exit
        if ((count as number) > 2) {
          patterns.push({
            type: 'peak_hour',
            frequency: count as number,
            timeOfDay: `${hour}:00`,
            trend: 'stable',
            sampleSize: recentCompulsions.length
          });
        }
      });
    
    return patterns;
  }
  
  private extractBehavioralPatterns(compulsions: any[]): any[] {
    // Guard against undefined/null compulsions
    if (!compulsions || !Array.isArray(compulsions)) return [];
    
    // 🚀 PERFORMANCE OPTIMIZATION: Sample recent entries only
    const SAMPLE_SIZE = 50; // Process max 50 recent entries instead of all 101+
    const recentCompulsions = (compulsions as any[])
      .sort((a, b) => new Date((b as any).timestamp).getTime() - new Date((a as any).timestamp).getTime())
      .slice(0, SAMPLE_SIZE);
    
    // Group by trigger
    const triggerGroups = {};
    
    recentCompulsions.forEach(c => {
      const trigger = c.trigger || 'unknown';
      if (!triggerGroups[trigger]) {
        triggerGroups[trigger] = {
          count: 0,
          totalSeverity: 0
        };
      }
      triggerGroups[trigger].count++;
      triggerGroups[trigger].totalSeverity += this.getCompulsionSeverity(c);
    });
    
    // Convert to patterns with early exit
    const patterns = [];
    const maxPatterns = 6; // Limit patterns to prevent over-processing
    
    Object.entries(triggerGroups)
      .sort(([,a], [,b]) => (b as any).count - (a as any).count) // Sort by frequency
      .forEach(([trigger, data]: [string, any]) => {
        if (patterns.length >= maxPatterns) return; // Early exit
        if (data.count >= 2) { // Only include meaningful triggers
          patterns.push({
            trigger,
            response: 'compulsion',
            frequency: data.count,
            severity: Math.round(data.totalSeverity / data.count),
            sampleSize: recentCompulsions.length
          });
        }
      });
    
    return patterns;
  }
  
  private shouldRunCBT(input: UnifiedPipelineInput): boolean {
    return input.type === 'voice' || 
           (typeof input.content === 'string' && input.content.length > 50);
  }
  
  private getEnabledModules(): string[] {
    const modules = [];
    // ✅ FIXED: Use dedicated unified pipeline flags instead of legacy component flags
    if (FEATURE_FLAGS.isEnabled('AI_UNIFIED_VOICE')) modules.push('voice');
    if (FEATURE_FLAGS.isEnabled('AI_UNIFIED_PATTERNS')) modules.push('patterns');
    if (FEATURE_FLAGS.isEnabled('AI_UNIFIED_INSIGHTS')) modules.push('insights');
    // CBT module removed
    return modules;
  }
  
  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================
  
  private generateCacheKey(input: UnifiedPipelineInput): string {
    const data = {
      userId: input.userId,
      type: input.type,
      content: typeof input.content === 'string' 
        ? input.content.substring(0, 100) 
        : JSON.stringify(input.content).substring(0, 100),
      source: input.context?.source
    };
    
    return `unified:${input.userId}:${simpleHash(JSON.stringify(data))}`;
  }
  
  private async getFromCache(key: string): Promise<UnifiedPipelineResult | null> {
    // 1. Check in-memory cache first (fastest)
    const memoryCache = this.cache.get(key);
    
    if (memoryCache) {
      if (memoryCache.expires < Date.now()) {
        this.cache.delete(key);
      } else {
        // 🚫 NEGATIVE CACHE BYPASS: Skip empty insights with short TTL
        const insightsCount = this.countTotalInsights(memoryCache.result);
        const remainingTTL = memoryCache.expires - Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (insightsCount === 0 && remainingTTL < fiveMinutes) {
          console.log(`🚫 Bypassing negative cache: insightsCount=${insightsCount}, remainingTTL=${Math.round(remainingTTL/60000)}min`);
          this.cache.delete(key);
          // Skip this cache entry and continue to fresh generation
        } else {
          return memoryCache.result;
        }
      }
    }
    
    // 2. Check Supabase cache (persistent, shared across devices)
    try {
      const supabaseCached = await this.getFromSupabaseCache(key);
      if (supabaseCached) {
        // 🚫 NEGATIVE CACHE BYPASS: Check for empty insights before restoring
        const insightsCount = this.countTotalInsights(supabaseCached);
        
        if (insightsCount === 0) {
          console.log(`🚫 Bypassing negative Supabase cache: insightsCount=${insightsCount}`);
          // Don't restore empty cache to memory, continue to fresh generation
        } else {
          // Restore to memory cache for faster future access (use default TTL for restored cache)
          this.cache.set(key, {
            result: supabaseCached,
            expires: Date.now() + this.MODULE_TTLS.default
          });
          
          console.log('📦 Cache restored from Supabase:', key.substring(0, 30) + '...');
          return supabaseCached;
        }
      }
    } catch (error) {
      console.warn('⚠️ Supabase cache read failed:', error);
    }
    
    // 3. Check AsyncStorage cache (offline fallback)
    try {
      const offlineCache = await AsyncStorage.getItem(key);
      if (offlineCache) {
        const parsed = JSON.parse(offlineCache);
        if (parsed.expires > Date.now()) {
          // 🚫 NEGATIVE CACHE BYPASS: Check for empty insights before restoring
          const insightsCount = this.countTotalInsights(parsed.result);
          
          if (insightsCount === 0) {
            console.log(`🚫 Bypassing negative AsyncStorage cache: insightsCount=${insightsCount}`);
            await AsyncStorage.removeItem(key); // Clean up negative cache
            // Continue to fresh generation
          } else {
            console.log('📱 Cache restored from AsyncStorage:', key.substring(0, 30) + '...');
            return parsed.result;
          }
        } else {
          await AsyncStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('⚠️ AsyncStorage cache read failed:', error);
    }
    
    return null;
  }
  
  private setCache(key: string, result: UnifiedPipelineResult, ttl?: number): void {
    // ✅ FIXED: Use module-specific TTL instead of single DEFAULT_TTL
    // 🧪 TEST MODE: Override TTL for deterministic testing
    const cacheTTL = this.isTestMode ? this.testTTL : (ttl || this.MODULE_TTLS.default);
    
    // 1. Store in memory cache (fastest access)
    this.cache.set(key, {
      result,
      expires: Date.now() + cacheTTL
    });
    
    // 2. Persist to Supabase (shared across devices)
    this.setToSupabaseCache(key, result);
    
    // 3. Also persist to AsyncStorage for offline
    this.persistToStorage(key, result);
    
    const ttlDisplay = this.isTestMode 
      ? `${cacheTTL}ms (TEST MODE)` 
      : `${Math.round(cacheTTL / (60 * 60 * 1000))}h`;
    console.log(`📦 Cache set with ${ttlDisplay} TTL:`, key.substring(0, 30) + '...');
  }

  /**
   * 🧠 Smart caching with empty insights policy
   * - Don't cache results with 0 insights OR use short TTL (5-10 min)
   * - Use full TTL for meaningful insights
   */
  private setCacheWithInsightsPolicy(key: string, result: UnifiedPipelineResult, input: UnifiedPipelineInput): void {
    const insightsCount = this.countTotalInsights(result);
    const moduleTTL = this.getModuleTTL(input);
    
    // If no insights, use short TTL to prevent negative caching
    if (insightsCount === 0) {
      const shortTTL = this.isTestMode ? this.testTTL : 5 * 60 * 1000; // Test mode or 5 minutes
      const ttlDisplay = this.isTestMode ? `${shortTTL}ms (TEST)` : `${shortTTL / 60000}min`;
      console.log(`📦 Empty insights detected (${insightsCount}), using short TTL: ${ttlDisplay}`);
      this.setCache(key, result, shortTTL);
      
      // Track empty insights caching for monitoring
      trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId: input.userId,
        source: 'empty_cache_policy',
        insightsCount: 0,
        cacheKey: key,
        shortTTL: shortTTL
      }).catch(console.warn);
      
      return;
    }
    
    // Normal caching for meaningful results
    console.log(`📦 Caching meaningful insights (${insightsCount}), using full TTL: ${Math.round(moduleTTL / (60 * 60 * 1000))}h`);
    this.setCache(key, result, moduleTTL);
  }

  /**
   * 📊 Count total insights across all categories
   */
  private countTotalInsights(result: UnifiedPipelineResult): number {
    if (!result.insights) return 0;
    
    const { therapeutic = [], progress = [] } = result.insights;
    return therapeutic.length + progress.length;
  }

  /**
   * 🧹 Manual cache invalidation for cleaning up stale 0-insight entries
   * Called when user adds/removes data to refresh cache state
   */
  public async invalidateStaleCache(): Promise<{ invalidated: number; reason: string }> {
    let invalidatedCount = 0;
    const reason = 'manual_refresh_cleanup';
    
    try {
      // 1. Clean in-memory cache
      const memoryKeys = Array.from(this.cache.keys());
      for (const key of memoryKeys) {
        const cached = this.cache.get(key);
        if (cached && this.countTotalInsights(cached.result) === 0) {
          this.cache.delete(key);
          invalidatedCount++;
          console.log(`🧹 Invalidated stale memory cache: ${key.substring(0, 30)}...`);
        }
      }
      
      // 2. Clean AsyncStorage cache (0-insight entries)
      const allKeys = await AsyncStorage.getAllKeys();
      const unifiedKeys = allKeys.filter(key => key.startsWith('unified:'));
      
      for (const key of unifiedKeys) {
        try {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.result && this.countTotalInsights(parsed.result) === 0) {
              await AsyncStorage.removeItem(key);
              invalidatedCount++;
              console.log(`🧹 Removed stale AsyncStorage cache: ${key.substring(0, 30)}...`);
            }
          }
        } catch (error) {
          // Ignore individual key errors, continue cleanup
          console.warn(`⚠️ Failed to clean cache key ${key}:`, error);
        }
      }
      
      console.log(`✅ Cache cleanup completed: ${invalidatedCount} stale entries removed`);
      
      return { invalidated: invalidatedCount, reason };
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
      return { invalidated: invalidatedCount, reason: 'cleanup_failed' };
    }
  }

  /**
   * 📊 Analyze tracking trends for fallback patterns (moved from tracking screen)
   * Generates local heuristic patterns from compulsion data
   */
  private analyzeTrackingTrends(entries: any[]): any[] {
    if (!Array.isArray(entries) || entries.length < 5) return [];

    const patterns = [];
    
    // Time-based patterns
    const hourCounts = new Array(24).fill(0);
    entries.forEach(entry => {
      const timestamp = entry.timestamp || entry.created_at;
      const hour = new Date(timestamp).getHours();
      hourCounts[hour]++;
    });
    
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    if (peakHours[0].count >= 3) {
      patterns.push({
        type: 'time_pattern',
        title: `${peakHours[0].hour}:00 Saatinde Yoğunluk`,
        description: `En çok kompülsiyon ${peakHours[0].hour}:00 saatinde yaşanıyor (${peakHours[0].count} kez).`,
        suggestion: 'Bu saatlerde önleyici teknikler uygulayın.',
        confidence: 0.8,
        severity: 'medium'
      });
    }

    // Resistance trends
    const recentEntries = entries.slice(-10);
    const resistanceSum = recentEntries.reduce((sum, e) => sum + (e.resistanceLevel || e.resistance_level || 5), 0);
    const avgResistance = resistanceSum / recentEntries.length;
    
    if (avgResistance >= 7) {
      patterns.push({
        type: 'progress_pattern',
        title: 'Güçlü Direnç Trendi',
        description: `Son kompülsiyonlarda ortalama ${avgResistance.toFixed(1)} direnç seviyesi.`,
        suggestion: 'Mükemmel ilerleme! Bu motivasyonu koruyun.',
        confidence: 0.9,
        severity: 'positive'
      });
    } else if (avgResistance <= 3) {
      patterns.push({
        type: 'warning_pattern',
        title: 'Düşük Direnç Uyarısı',
        description: `Son kompülsiyonlarda ortalama ${avgResistance.toFixed(1)} direnç seviyesi.`,
        suggestion: 'Terapi egzersizleri ve mindfulness teknikleri deneyin.',
        confidence: 0.85,
        severity: 'warning'
      });
    }

    return patterns;
  }

  /**
   * 🔄 Generate fallback insights when primary analysis yields no results
   * Creates basic actionable insights from available patterns data
   */
  private generateFallbackInsights(patterns: any, input: UnifiedPipelineInput): any {
    const fallback = {
      therapeutic: [],
      progress: []
    };

    try {
      // 🎯 ENHANCED FALLBACK: Integrate tracking screen patterns
      if (input.content && typeof input.content === 'object' && Array.isArray(input.content.compulsions)) {
        const compulsions = input.content.compulsions;
        const trackingPatterns = this.analyzeTrackingTrends(compulsions);
        
        trackingPatterns.forEach(pattern => {
          const insight = {
            text: pattern.description + ' ' + pattern.suggestion,
            category: pattern.type,
            priority: pattern.severity === 'positive' ? 'high' : 'medium',
            actionable: true,
            confidence: pattern.confidence,
            source: 'fallback_tracking'
          };
          
          if (pattern.severity === 'positive') {
            fallback.progress.push(insight);
          } else {
            fallback.therapeutic.push(insight);
          }
        });
      }
      
      // 1. TEMPORAL PATTERN FALLBACKS (Original logic preserved)
      if (patterns.temporal && patterns.temporal.length > 0) {
        const peakPattern = patterns.temporal[0]; // Most significant temporal pattern
        if (peakPattern.type === 'peak_hour' || peakPattern.frequency > 2) {
          fallback.therapeutic.push({
            text: `${peakPattern.timeOfDay || 'Belirli saatlerde'} daha yoğun aktivite görülüyor. Bu zamanlarda destek stratejilerini hatırlamak faydalı olabilir.`,
            category: 'temporal_awareness',
            priority: 'medium',
            actionable: true,
            confidence: 0.7,
            source: 'fallback_temporal'
          });
        }
      }

      // 2. BEHAVIORAL PATTERN FALLBACKS  
      if (patterns.behavioral && patterns.behavioral.length > 0) {
        const dominantPattern = patterns.behavioral.sort((a, b) => (b.frequency || 0) - (a.frequency || 0))[0];
        if (dominantPattern.trigger && dominantPattern.frequency > 1) {
          fallback.therapeutic.push({
            text: `En sık görülen tetik "${dominantPattern.trigger}" için alternatif başa çıkma stratejileri geliştirmek yararlı olabilir.`,
            category: 'behavioral_insight',
            priority: 'medium', 
            actionable: true,
            confidence: 0.6,
            source: 'fallback_behavioral'
          });
        }
      }

      // 3. ENVIRONMENTAL/TRIGGER FALLBACKS
      if (patterns.triggers && patterns.triggers.length > 0) {
        const commonTrigger = patterns.triggers[0];
        fallback.therapeutic.push({
          text: `Çevresel faktörlerin etkisini fark etmek önemli bir adım. Tetikleyici durumları önceden tanımak güçlendirici olabilir.`,
          category: 'environmental_awareness',
          priority: 'low',
          actionable: true,
          confidence: 0.5,
          source: 'fallback_environmental'
        });
      }

      // 4. GENERAL PROGRESS FALLBACK (always available)
      if (input.context?.source) {
        fallback.progress.push({
          text: `Veri toplama ve takip süreci aktif. Bu tutarlılık, ilerlemeyi değerlendirmek için değerli bir kaynak oluşturuyor.`,
          category: 'progress_tracking',
          priority: 'low',
          actionable: true,
          confidence: 0.8,
          source: 'fallback_progress'
        });
      }

      // 5. DATA QUALITY INSIGHTS
      const dataPoints = patterns.metadata?.dataPoints || 0;
      if (dataPoints >= 5) {
        fallback.progress.push({
          text: `${dataPoints} veri noktası toplandı. Bu bilgiler zaman içinde daha detaylı kalıp analizi için yeterli olacak.`,
          category: 'data_sufficiency',
          priority: 'low',
          actionable: false,
          confidence: 0.9,
          source: 'fallback_data_quality'
        });
      }

      console.log(`🔄 Generated ${fallback.therapeutic.length + fallback.progress.length} fallback insights`);

    } catch (error) {
      console.warn('Fallback insight generation failed:', error);
      // Minimal safety fallback
      fallback.therapeutic.push({
        text: 'Veriler analiz ediliyor. Daha fazla veri toplandığında detaylı içgörüler sunulacak.',
        category: 'system_status',
        priority: 'low',
        actionable: false,
        confidence: 0.5,
        source: 'fallback_minimal'
      });
    }

    return fallback;
  }

  /**
   * 🎤 Generate insights enhanced by voice analysis results
   * Creates targeted insights based on detected voice category and confidence
   */
  private generateVoiceEnhancedInsights(voiceHints: any, patterns: any): any[] {
    const insights: any[] = [];

    try {
      const { voiceCategory, voiceConfidence, voiceSuggestion } = voiceHints;

      switch (voiceCategory) {
        case 'OCD':
          insights.push({
            text: `Ses analizinde OKB ile ilişkili içerik tespit edildi. ${voiceSuggestion || 'Mevcut başa çıkma stratejilerinizi hatırlamak faydalı olabilir.'}`,
            category: 'voice_ocd_detection', 
            priority: 'high',
            actionable: true,
            confidence: voiceConfidence,
            source: 'voice_enhanced'
          });
          
          // Add pattern-specific OCD insight if behavioral patterns exist
          if (patterns.behavioral && patterns.behavioral.length > 0) {
            const dominantPattern = patterns.behavioral[0];
            insights.push({
              text: `Davranışsal kalıplar ve ses analizi birlikte değerlendirildiğinde, "${dominantPattern.trigger || 'belirli durumlar'}" için ERP teknikleri uygulamak yararlı olabilir.`,
              category: 'voice_pattern_correlation',
              priority: 'medium',
              actionable: true,
              confidence: Math.min(voiceConfidence, 0.8),
              source: 'voice_enhanced'
            });
          }
          break;

        case 'CBT':
          insights.push({
            text: `Bilişsel distorsyonlar ile ilgili düşünceler tespit edildi. ${voiceSuggestion || 'Düşünce-duygu-davranış üçgenini incelemek faydalı olabilir.'}`,
            category: 'voice_cbt_detection',
            priority: 'high', 
            actionable: true,
            confidence: voiceConfidence,
            source: 'voice_enhanced'
          });
          break;

        case 'MOOD':
          insights.push({
            text: `Duygu durum ile ilgili ifadeler algılandı. ${voiceSuggestion || 'Mood tracking verileriniz ile birlikte değerlendirildiğinde daha detaylı analiz yapılabilir.'}`,
            category: 'voice_mood_detection',
            priority: 'medium',
            actionable: true,
            confidence: voiceConfidence,
            source: 'voice_enhanced'
          });
          break;

        case 'BREATHWORK':
          insights.push({
            text: `Nefes çalışması veya rahatlama ile ilgili gereksinim tespit edildi. ${voiceSuggestion || 'Derin nefes teknikleri şu anda yararlı olabilir.'}`,
            category: 'voice_breathwork_suggestion',
            priority: 'medium',
            actionable: true,
            confidence: voiceConfidence,
            source: 'voice_enhanced'
          });
          break;

        default:
          // Generic voice-detected insight
          if (voiceConfidence > 0.5) {
            insights.push({
              text: `Ses analizinde önemli içerik tespit edildi. Bu durum için mevcut destek stratejilerinizi kullanmayı değerlendirebilirsiniz.`,
              category: 'voice_general_detection',
              priority: 'low',
              actionable: true,
              confidence: voiceConfidence,
              source: 'voice_enhanced'
            });
          }
      }

    } catch (error) {
      console.warn('Voice-enhanced insight generation failed:', error);
    }

    return insights;
  }
  
  private async persistToStorage(key: string, result: UnifiedPipelineResult): Promise<void> {
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          result,
          expires: Date.now() + this.MODULE_TTLS.default
        })
      );
    } catch (error) {
      console.warn('Failed to persist to storage:', error);
    }
  }
  
  /**
   * 📦 Supabase Cache Layer - Persistent, Cross-Device Cache
   */
  private async getFromSupabaseCache(key: string): Promise<UnifiedPipelineResult | null> {
    try {
      // ✅ FIXED: Use correct column names from ai_cache table schema
      const { data, error } = await supabaseService.supabaseClient
        .from('ai_cache')
        .select('content')
        .eq('cache_key', key)
        .maybeSingle();
      
      if (error) {
        console.warn('⚠️ Supabase cache read error:', error);
        return null;
      }
      
      if (!data) {
        return null; // Cache miss
      }
      
      return (data as any).content as UnifiedPipelineResult;  // Use 'content' column
    } catch (error) {
      console.warn('⚠️ Supabase cache read failed:', error);
      return null;
    }
  }
  
  private async setToSupabaseCache(key: string, result: UnifiedPipelineResult): Promise<void> {
    try {
      // Extract userId from key for proper RLS
      const userId = key.split(':')[1];
      // Minimal upsert for compatibility across schemas (triggers may derive expires_at)
      
      // ✅ FIXED: Use correct column names from ai_cache table schema
      const { error } = await supabaseService.supabaseClient
        .from('ai_cache')
        .upsert({
          cache_key: key,
          user_id: userId,
          content: result
        }, {
          onConflict: 'cache_key'
        });
      
      if (error) {
        console.warn('⚠️ Supabase cache write error:', error);
      } else {
        console.log('📦 Cached to Supabase:', key.substring(0, 30) + '...');
      }
    } catch (error) {
      console.warn('⚠️ Supabase cache write failed:', error);
    }
  }
  
  // ============================================================================
  // INVALIDATION HOOKS
  // ============================================================================
  
  // ✅ F-03 FIX: Invalidation hooks now accept userId parameter
  private setupInvalidationHooks(): void {
    // Hook: New compulsion recorded
    this.invalidationHooks.set('compulsion_added', async (userId?: string) => {
      // ✅ FIXED: Invalidate patterns, insights, AND progress as per specification
      await this.invalidateUserCache('patterns', userId);
      await this.invalidateUserCache('insights', userId); 
      await this.invalidateUserCache('progress', userId);
      console.log('🔄 Cache invalidated: patterns + insights + progress (compulsion_added)');
    });
    
    // Hook: CBT thought record created/updated
    this.invalidationHooks.set('cbt_record_added', async (userId?: string) => {
      await this.invalidateUserCache('insights', userId);
    });
    
    // Hook: Mood entry added
    this.invalidationHooks.set('mood_added', async (userId?: string) => {
      await this.invalidateUserCache('all', userId);
    });
    
    // Hook: Manual refresh requested
    this.invalidationHooks.set('manual_refresh', () => {
      this.cache.clear();
    });
    
    // REMOVED: therapy_completed - ERP module deleted
    // REMOVED: erp_completed - ERP module deleted
  }
  
  // ✅ F-03 & F-08 FIX: triggerInvalidation with React Query integration
  public async triggerInvalidation(hook: string, userId?: string): Promise<void> {
    const handler = this.invalidationHooks.get(hook);
    if (handler) {
      await handler(userId); // ✅ Pass userId to handler
    }
    
    // ✅ F-08 FIX: Emit React Query cache invalidation
    try {
      const { emitAIInvalidation } = await import('@/hooks/useCacheInvalidation');
      emitAIInvalidation(hook, userId);
      console.log('🤖 React Query AI invalidation triggered:', hook);
    } catch (error) {
      console.warn('⚠️ Failed to emit AI cache invalidation:', error);
    }
    
    // Track invalidation
    await trackAIInteraction(AIEventType.CACHE_INVALIDATION, {
      hook,
      userId,
      timestamp: Date.now()
    });
  }
  
  private async invalidateUserCache(type: 'patterns' | 'insights' | 'progress' | 'voice' | 'all', userId?: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      // For unified pipeline cache keys, we need to match user and invalidate based on type
      if (userId && !key.includes(userId)) return;
      
      // Since unified pipeline cache keys are "unified:userId:hash", we need to invalidate differently
      if (type === 'all') {
        // Invalidate all unified pipeline keys for this user
        if (key.startsWith('unified:')) {
          keysToDelete.push(key);
        }
      } else {
        // For specific types, invalidate all unified keys (since they contain mixed data)
        // This ensures any cache that might contain the changed data type is cleared
        if (key.startsWith('unified:')) {
          keysToDelete.push(key);
        }
      }
    });
    
    const deletedCount = keysToDelete.length;
    keysToDelete.forEach(key => this.cache.delete(key));
    
    // 📊 CRITICAL FIX: Track cache invalidation telemetry
    if (deletedCount > 0) {
      await trackAIInteraction(AIEventType.CACHE_INVALIDATION, {
        userId: userId || 'unknown',
        invalidationType: type,
        keysDeleted: deletedCount,
        cacheKeys: keysToDelete.slice(0, 3), // First 3 keys for debugging
        timestamp: Date.now()
      });
      
      console.log(`🗑️ Cache invalidated: ${type} (${deletedCount} keys deleted)`);
    }
    
    // Also invalidate Supabase cache
    const normalizedType = (type === 'patterns' || type === 'insights' || type === 'all') ? type : 'all';
    await this.invalidateSupabaseCache(normalizedType, userId);
  }
  
  /**
   * 🗑️ Supabase Cache Invalidation
   */
  // ✅ F-03 FIX: Correct client getter and unified cache key filtering
  private async invalidateSupabaseCache(type: 'patterns' | 'insights' | 'all', userId?: string): Promise<void> {
    try {
      // ✅ Use correct client getter: supabaseService.supabaseClient (not .client)
      const likePattern = userId ? `unified:${userId}:%` : 'unified:%';
      const { error } = await supabaseService.supabaseClient
        .from('ai_cache')
        .delete()
        .like('cache_key', likePattern);
      
      if (error) {
        console.warn('⚠️ Supabase cache invalidation error:', error);
      } else {
        console.log(`🗑️ Supabase cache invalidated for ${type}${userId ? ` (user: ${userId})` : ''}`);
      }
    } catch (error) {
      console.warn('⚠️ Supabase cache invalidation failed:', error);
    }
  }
  
  // ============================================================================
  // CACHE CLEANUP
  // ============================================================================
  
  private startCacheCleanup(): void {
    // Run cleanup every hour
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      this.cache.forEach((value, key) => {
        if (value.expires < now) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => this.cache.delete(key));
      
      if (keysToDelete.length > 0) {
        console.log(`🧹 Cleaned ${keysToDelete.length} expired cache entries`);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  // ============================================================================
  // 🔮 PREDICTIVE MOOD INTERVENTION
  // ============================================================================

  /**
   * 🔮 Predictive Mood Intervention - AI-powered mood drop prediction and proactive interventions
   */
  async predictMoodIntervention(
    userId: string,
    recentMoodEntries: any[],
    currentMoodState?: any
  ): Promise<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    predictedDrop?: {
      likelihood: number;
      timeframe: string;
      severity: number;
    };
    interventions: Array<{
      type: 'immediate' | 'preventive' | 'emergency';
      priority: number;
      action: string;
      reason: string;
      effectivenessProbability: number;
    }>;
    riskFactors: Array<{
      factor: string;
      impact: number;
      confidence: number;
    }>;
    earlyWarning?: {
      triggered: boolean;
      message: string;
      urgency: 'low' | 'medium' | 'high';
    };
  }> {
    console.log('🔮 Starting predictive mood intervention analysis...');

    const startTime = Date.now();
    
    // Track intervention analysis start
    await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
      userId,
      dataType: 'predictive_mood_intervention',
      entryCount: recentMoodEntries.length,
      timestamp: startTime
    });

    try {
      // 1. ANALYZE RECENT TRENDS
      const trendAnalysis = this.analyzeMoodTrends(recentMoodEntries);
      
      // 2. IDENTIFY RISK FACTORS
      const riskFactors = this.identifyMoodRiskFactors(recentMoodEntries, trendAnalysis);
      
      // 3. CALCULATE RISK LEVEL
      const riskLevel = this.calculateMoodRiskLevel(riskFactors, trendAnalysis);
      
      // 4. PREDICT MOOD DROP
      const predictedDrop = this.predictMoodDrop(recentMoodEntries, trendAnalysis, riskFactors);
      
      // 5. GENERATE INTERVENTIONS
      const interventions = this.generateMoodInterventions(riskLevel, riskFactors, predictedDrop);
      
      // 6. EARLY WARNING SYSTEM
      const earlyWarning = this.checkEarlyWarningTriggers(riskLevel, predictedDrop, riskFactors);

      const result = {
        riskLevel,
        predictedDrop,
        interventions,
        riskFactors,
        earlyWarning
      };

      // Track successful intervention analysis
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId,
        source: 'predictive_mood_intervention',
        insightsCount: interventions.length,
        processingTime: Date.now() - startTime,
        riskLevel,
        earlyWarningTriggered: earlyWarning?.triggered || false
      });

      console.log(`✅ Predictive mood intervention completed: ${riskLevel} risk`);
      return result;

    } catch (error) {
      console.error('❌ Predictive mood intervention failed:', error);
      
      await trackAIInteraction(AIEventType.SYSTEM_ERROR, {
        userId,
        component: 'predictiveMoodIntervention',
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      });

      // Return safe fallback
      return {
        riskLevel: 'low',
        interventions: [{
          type: 'immediate',
          priority: 1,
          action: 'Düzenli mood takibine devam edin',
          reason: 'Veri analizi sırasında hata oluştu',
          effectivenessProbability: 0.5
        }],
        riskFactors: []
      };
    }
  }

  // ============================================================================
  // MOOD TREND ANALYSIS HELPERS
  // ============================================================================

  private analyzeMoodTrends(entries: any[]): {
    trend: 'declining' | 'stable' | 'improving';
    slope: number;
    volatility: number;
    recentAverage: number;
    weeklyChange: number;
  } {
    if (entries.length < 3) {
      return {
        trend: 'stable',
        slope: 0,
        volatility: 0,
        recentAverage: 50,
        weeklyChange: 0
      };
    }

    // Sort by timestamp
    const sortedEntries = entries.sort((a, b) => 
      new Date(a.timestamp || a.created_at).getTime() - 
      new Date(b.timestamp || b.created_at).getTime()
    );

    // Calculate trend (linear regression slope)
    const scores = sortedEntries.map(e => e.mood_score || e.mood || 50);
    const n = scores.length;
    const sumX = ((n - 1) * n) / 2; // 0 + 1 + 2 + ... + (n-1)
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = scores.reduce((sum, y, x) => sum + (x * y), 0);
    const sumXX = ((n - 1) * n * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Determine trend
    let trend: 'declining' | 'stable' | 'improving' = 'stable';
    if (slope < -2) trend = 'declining';
    else if (slope > 2) trend = 'improving';

    // Calculate volatility (standard deviation)
    const mean = sumY / n;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / n;
    const volatility = Math.sqrt(variance);

    // Recent average (last 3 entries)
    const recentEntries = sortedEntries.slice(-3);
    const recentAverage = recentEntries.reduce((sum, e) => sum + (e.mood_score || e.mood || 50), 0) / recentEntries.length;

    // Weekly change (if enough data)
    const weeklyChange = entries.length >= 7 
      ? (scores[scores.length - 1] - scores[Math.max(0, scores.length - 7)])
      : 0;

    return {
      trend,
      slope,
      volatility,
      recentAverage,
      weeklyChange
    };
  }

  private identifyMoodRiskFactors(entries: any[], trendAnalysis: any): Array<{
    factor: string;
    impact: number;
    confidence: number;
  }> {
    const riskFactors: Array<{ factor: string; impact: number; confidence: number }> = [];

    // 1. DECLINING TREND
    if (trendAnalysis.trend === 'declining' && Math.abs(trendAnalysis.slope) > 3) {
      riskFactors.push({
        factor: 'declining_trend',
        impact: Math.min(10, Math.abs(trendAnalysis.slope) / 2),
        confidence: 0.8
      });
    }

    // 2. HIGH VOLATILITY
    if (trendAnalysis.volatility > 15) {
      riskFactors.push({
        factor: 'high_volatility',
        impact: trendAnalysis.volatility / 5,
        confidence: 0.7
      });
    }

    // 3. LOW RECENT AVERAGE
    if (trendAnalysis.recentAverage < 35) {
      riskFactors.push({
        factor: 'low_recent_mood',
        impact: (50 - trendAnalysis.recentAverage) / 3,
        confidence: 0.9
      });
    }

    // 4. RECURRING PATTERNS
    const recurringLowDays = this.detectRecurringLowMoodDays(entries);
    if (recurringLowDays.length > 0) {
      riskFactors.push({
        factor: 'recurring_low_days',
        impact: recurringLowDays.length * 2,
        confidence: 0.6
      });
    }

    // 5. TRIGGER FREQUENCY
    const highImpactTriggers = this.analyzeHighImpactTriggers(entries);
    if (highImpactTriggers.length > 0) {
      riskFactors.push({
        factor: 'frequent_triggers',
        impact: highImpactTriggers.length * 1.5,
        confidence: 0.7
      });
    }

    return riskFactors;
  }

  private calculateMoodRiskLevel(riskFactors: any[], trendAnalysis: any): 'low' | 'medium' | 'high' | 'critical' {
    // Calculate total risk score
    const totalRisk = riskFactors.reduce((sum, factor) => 
      sum + (factor.impact * factor.confidence), 0
    );

    // Additional risk from trend analysis
    let trendRisk = 0;
    if (trendAnalysis.trend === 'declining') trendRisk += 5;
    if (trendAnalysis.recentAverage < 30) trendRisk += 10;
    if (trendAnalysis.volatility > 20) trendRisk += 5;

    const combinedRisk = totalRisk + trendRisk;

    if (combinedRisk >= 25) return 'critical';
    if (combinedRisk >= 15) return 'high';
    if (combinedRisk >= 8) return 'medium';
    return 'low';
  }

  private predictMoodDrop(entries: any[], trendAnalysis: any, riskFactors: any[]): {
    likelihood: number;
    timeframe: string;
    severity: number;
  } | undefined {
    // Only predict if there are sufficient risk indicators
    if (riskFactors.length === 0 || trendAnalysis.trend !== 'declining') {
      return undefined;
    }

    // Calculate likelihood based on risk factors
    const riskScore = riskFactors.reduce((sum, factor) => sum + factor.impact * factor.confidence, 0);
    const likelihood = Math.min(0.95, riskScore / 20);

    // Determine timeframe based on trend slope
    let timeframe = '1-2 hafta';
    if (Math.abs(trendAnalysis.slope) > 5) timeframe = '3-5 gün';
    else if (Math.abs(trendAnalysis.slope) > 3) timeframe = '1 hafta';

    // Predict severity of drop
    const currentLevel = trendAnalysis.recentAverage;
    const potentialDrop = Math.abs(trendAnalysis.slope) * 3; // 3 day projection
    const severity = Math.min(10, potentialDrop);

    return {
      likelihood,
      timeframe,
      severity
    };
  }

  private generateMoodInterventions(
    riskLevel: string, 
    riskFactors: any[], 
    predictedDrop?: any
  ): Array<{
    type: 'immediate' | 'preventive' | 'emergency';
    priority: number;
    action: string;
    reason: string;
    effectivenessProbability: number;
  }> {
    const interventions: any[] = [];

    // IMMEDIATE INTERVENTIONS
    if (riskLevel === 'high' || riskLevel === 'critical') {
      interventions.push({
        type: 'immediate',
        priority: 1,
        action: 'Hemen nefes egzersizi yapın (4-7-8 tekniği)',
        reason: 'Anksiyete ve stres seviyelerini hızla düşürür',
        effectivenessProbability: 0.85
      });

      interventions.push({
        type: 'immediate',
        priority: 2,
        action: 'Güvenilir bir arkadaş veya aile üyesi ile konuşun',
        reason: 'Sosyal destek mood iyileşmesinde kanıtlanmış etki gösterir',
        effectivenessProbability: 0.75
      });
    }

    // PREVENTIVE INTERVENTIONS
    if (riskLevel === 'medium' || riskLevel === 'high') {
      interventions.push({
        type: 'preventive',
        priority: 3,
        action: 'Günlük 10 dakika mindfulness meditasyonu başlatın',
        reason: 'Düzenli meditasyon mood stabilitesini artırır',
        effectivenessProbability: 0.70
      });

      interventions.push({
        type: 'preventive',
        priority: 4,
        action: 'Uyku rutininizi optimize edin (22:00-06:00)',
        reason: 'Düzenli uyku mood dengesi için kritik faktördür',
        effectivenessProbability: 0.80
      });
    }

    // RISK-SPECIFIC INTERVENTIONS
    riskFactors.forEach(factor => {
      switch (factor.factor) {
        case 'declining_trend':
          interventions.push({
            type: 'preventive',
            priority: 5,
            action: 'Haftalık mood tracking pattern analizi yapın',
            reason: 'Trendinizi anlayarak proaktif adımlar atabilirsiniz',
            effectivenessProbability: 0.65
          });
          break;
          
        case 'high_volatility':
          interventions.push({
            type: 'preventive',
            priority: 6,
            action: 'Günlük yaşam rutininizi standardize edin',
            reason: 'Düzenli rutinler mood dalgalanmalarını azaltır',
            effectivenessProbability: 0.60
          });
          break;

        case 'frequent_triggers':
          interventions.push({
            type: 'preventive',
            priority: 7,
            action: 'Tetikleyici durumlar için başa çıkma stratejileri geliştirin',
            reason: 'Proaktif strateji mood düşüşlerini önler',
            effectivenessProbability: 0.70
          });
          break;
      }
    });

    // EMERGENCY INTERVENTIONS
    if (riskLevel === 'critical') {
      interventions.push({
        type: 'emergency',
        priority: 0,
        action: 'Acil destek hatlarından yardım alın veya profesyonel destek arayın',
        reason: 'Kritik mood seviyelerinde profesyonel müdahale gereklidir',
        effectivenessProbability: 0.95
      });
    }

    return interventions.sort((a, b) => a.priority - b.priority);
  }

  private checkEarlyWarningTriggers(
    riskLevel: string, 
    predictedDrop: any, 
    riskFactors: any[]
  ): {
    triggered: boolean;
    message: string;
    urgency: 'low' | 'medium' | 'high';
  } | undefined {
    
    if (riskLevel === 'critical') {
      return {
        triggered: true,
        message: 'Kritik mood seviyesi tespit edildi. Lütfen hemen destek alın.',
        urgency: 'high'
      };
    }

    if (riskLevel === 'high' && predictedDrop?.likelihood > 0.7) {
      return {
        triggered: true,
        message: `Yüksek mood düşüş riski: ${predictedDrop.timeframe} içinde dikkatli olun.`,
        urgency: 'medium'
      };
    }

    if (riskLevel === 'medium' && riskFactors.length >= 3) {
      return {
        triggered: true,
        message: 'Birden fazla risk faktörü tespit edildi. Proaktif önlemler alın.',
        urgency: 'low'
      };
    }

    return undefined;
  }

  // Helper methods for risk factor detection
  private detectRecurringLowMoodDays(entries: any[]): string[] {
    const dayMoods: Record<number, number[]> = {};
    
    entries.forEach(entry => {
      const dayOfWeek = new Date(entry.timestamp || entry.created_at).getDay();
      const mood = entry.mood_score || entry.mood || 50;
      
      if (!dayMoods[dayOfWeek]) dayMoods[dayOfWeek] = [];
      dayMoods[dayOfWeek].push(mood);
    });

    const lowMoodDays: string[] = [];
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    Object.entries(dayMoods).forEach(([day, moods]) => {
      const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;
      if (avgMood < 40 && moods.length >= 2) {
        lowMoodDays.push(dayNames[parseInt(day)]);
      }
    });

    return lowMoodDays;
  }

  private analyzeHighImpactTriggers(entries: any[]): string[] {
    const triggerImpact: Record<string, { totalImpact: number; count: number }> = {};
    
    entries.forEach(entry => {
      if (entry.triggers && Array.isArray(entry.triggers)) {
        entry.triggers.forEach((trigger: string) => {
          const moodImpact = 50 - (entry.mood_score || entry.mood || 50);
          
          if (!triggerImpact[trigger]) {
            triggerImpact[trigger] = { totalImpact: 0, count: 0 };
          }
          
          triggerImpact[trigger].totalImpact += moodImpact;
          triggerImpact[trigger].count += 1;
        });
      }
    });

    return Object.entries(triggerImpact)
      .filter(([_, data]) => {
        const avgImpact = data.totalImpact / data.count;
        return avgImpact > 10 && data.count >= 2;
      })
      .map(([trigger, _]) => trigger);
  }

  // ============================================================================
  // 🔧 MISSING PATTERN EXTRACTION METHODS
  // ============================================================================



  /**
   * 📊 Extract enhanced mood temporal patterns with dashboard metrics
   * Generates comprehensive mood analytics for direct dashboard consumption
   */
  private extractMoodTemporalPatterns(moods: any[]): any[] {
    try {
      const patterns: any[] = [];
      if (!moods || moods.length === 0) return patterns;

      // 🚀 PERFORMANCE OPTIMIZATION: Sample recent mood entries only  
      const SAMPLE_SIZE = 30; // Process max 30 recent moods instead of all 78+
      const recentMoods = moods
        .filter(m => m.timestamp && m.mood_score !== undefined && m.energy_level !== undefined && m.anxiety_level !== undefined) // Filter valid MEA entries
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, SAMPLE_SIZE);

      if (recentMoods.length === 0) return patterns;

      // 📈 WEEKLY MOOD DELTA ANALYSIS
      const weeklyMoodDelta = this.calculateWeeklyMoodDelta(recentMoods);
      if (weeklyMoodDelta) {
        patterns.push({
          type: 'mood_weekly_delta',
          title: 'Haftalık Mood Değişimi',
          description: `Son hafta mood ortalaması: ${weeklyMoodDelta.thisWeek.toFixed(1)}, önceki hafta: ${weeklyMoodDelta.lastWeek.toFixed(1)}`,
          pattern: `Haftalık delta: ${weeklyMoodDelta.delta > 0 ? '+' : ''}${weeklyMoodDelta.delta.toFixed(1)}`,
          confidence: weeklyMoodDelta.confidence,
          severity: weeklyMoodDelta.delta < -10 ? 'high' : weeklyMoodDelta.delta < -5 ? 'medium' : 'low',
          actionable: Math.abs(weeklyMoodDelta.delta) > 5,
          suggestion: weeklyMoodDelta.delta < -10 ? 'Mood düşüş trendi - destek almayı değerlendir' :
                     weeklyMoodDelta.delta < -5 ? 'Hafif mood düşüşü - self-care rutinlerine odaklan' :
                     weeklyMoodDelta.delta > 10 ? 'Güzel mood artışı - bu pozitif durumu sürdür' : 
                     'Mood seviyesi stabil görünüyor',
          // 🎯 DASHBOARD READY METRICS
          dashboardMetrics: {
            weeklyDelta: weeklyMoodDelta.delta,
            currentWeekAvg: weeklyMoodDelta.thisWeek,
            previousWeekAvg: weeklyMoodDelta.lastWeek,
            trend: weeklyMoodDelta.delta > 5 ? 'improving' : weeklyMoodDelta.delta < -5 ? 'declining' : 'stable',
            dataPoints: weeklyMoodDelta.dataPoints
          },
          source: 'unified_pipeline'
        });
      }

      // 🔗 MEA CORRELATION ANALYSIS (Enhanced)
      const meaCorrelation = this.calculateMEACorrelations(recentMoods);
      if (meaCorrelation) {
        patterns.push({
          type: 'mood_mea_correlation',
          title: 'Mood-Enerji-Anksiyete İlişkisi',
          description: `MEA korelasyon analizi: ${meaCorrelation.profile}`,
          pattern: `Mood-Enerji: ${meaCorrelation.moodEnergy.toFixed(2)}, Mood-Anksiyete: ${meaCorrelation.moodAnxiety.toFixed(2)}`,
          confidence: meaCorrelation.confidence,
          severity: meaCorrelation.severity,
          actionable: meaCorrelation.actionable,
          suggestion: meaCorrelation.suggestion,
          // 🎯 DASHBOARD READY METRICS
          dashboardMetrics: {
            moodEnergyCorrelation: meaCorrelation.moodEnergy,
            moodAnxietyCorrelation: meaCorrelation.moodAnxiety,
            energyAnxietyCorrelation: meaCorrelation.energyAnxiety,
            emotionalProfile: meaCorrelation.profileType,
            averageMood: meaCorrelation.averages.mood,
            averageEnergy: meaCorrelation.averages.energy,
            averageAnxiety: meaCorrelation.averages.anxiety,
            dataPoints: recentMoods.length
          },
          source: 'unified_pipeline'
        });
      }

      // 📅 DAILY PATTERNS (Existing logic enhanced)
      const weeklyData: Record<number, { mood: number, energy: number, anxiety: number, count: number }> = {};
      recentMoods.forEach(m => {
        const dayOfWeek = new Date(m.timestamp).getDay();
        if (!weeklyData[dayOfWeek]) {
          weeklyData[dayOfWeek] = { mood: 0, energy: 0, anxiety: 0, count: 0 };
        }
        weeklyData[dayOfWeek].mood += m.mood_score;
        weeklyData[dayOfWeek].energy += m.energy_level;
        weeklyData[dayOfWeek].anxiety += m.anxiety_level;
        weeklyData[dayOfWeek].count += 1;
      });

      // Find significant daily patterns with enhanced metrics
      const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      const maxDailyPatterns = 3; // Limit daily patterns
      
      Object.entries(weeklyData)
        .sort(([,a], [,b]) => (b.mood / b.count) - (a.mood / a.count)) // Sort by avg mood
        .forEach(([day, data]) => {
          if (patterns.filter(p => p.type === 'mood_daily_pattern').length >= maxDailyPatterns) return; // Early exit
          const avgMood = data.mood / data.count;
          const avgEnergy = data.energy / data.count;
          const avgAnxiety = data.anxiety / data.count;
          
          if (data.count >= 2 && (avgMood > 70 || avgMood < 40)) { // Only significant patterns
            patterns.push({
              type: 'mood_daily_pattern',
              title: `${dayNames[parseInt(day)]} Günü Pattern'i`,
              description: `${dayNames[parseInt(day)]} günü mood ortalaması: ${avgMood.toFixed(1)}`,
              pattern: `${dayNames[parseInt(day)]}: M${avgMood.toFixed(1)}/E${avgEnergy.toFixed(1)}/A${avgAnxiety.toFixed(1)}`,
              confidence: Math.min(0.8, data.count / recentMoods.length * 7),
              severity: avgMood < 40 ? 'medium' : 'low',
              actionable: avgMood < 40,
              suggestion: avgMood < 40 ? `${dayNames[parseInt(day)]} günü mood desteği planlayabilirsin` : 
                         `${dayNames[parseInt(day)]} günü pozitif pattern'ini sürdür`,
              // 🎯 DASHBOARD READY METRICS
              dashboardMetrics: {
                dayOfWeek: parseInt(day),
                dayName: dayNames[parseInt(day)],
                averageMood: parseFloat(avgMood.toFixed(1)),
                averageEnergy: parseFloat(avgEnergy.toFixed(1)),
                averageAnxiety: parseFloat(avgAnxiety.toFixed(1)),
                sampleSize: data.count,
                significance: avgMood > 70 ? 'positive' : avgMood < 40 ? 'negative' : 'neutral'
              },
              source: 'unified_pipeline'
            });
          }
        });

      console.log(`📊 Extracted ${patterns.length} enhanced mood patterns with dashboard metrics`);
      return patterns;
    } catch (error) {
      console.warn('⚠️ Error extracting enhanced mood temporal patterns:', error);
      return [];
    }
  }

  /**
   * 📈 Calculate Weekly Mood Delta for dashboard metrics
   */
  private calculateWeeklyMoodDelta(moods: any[]): {
    delta: number;
    thisWeek: number;
    lastWeek: number;
    confidence: number;
    dataPoints: { thisWeek: number; lastWeek: number };
  } | null {
    try {
      if (moods.length < 5) return null;

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const thisWeekMoods = moods.filter(m => {
        const date = new Date(m.timestamp);
        return date >= oneWeekAgo && date <= now;
      });

      const lastWeekMoods = moods.filter(m => {
        const date = new Date(m.timestamp);
        return date >= twoWeeksAgo && date < oneWeekAgo;
      });

      if (thisWeekMoods.length === 0 || lastWeekMoods.length === 0) return null;

      const thisWeekAvg = thisWeekMoods.reduce((sum, m) => sum + m.mood_score, 0) / thisWeekMoods.length;
      const lastWeekAvg = lastWeekMoods.reduce((sum, m) => sum + m.mood_score, 0) / lastWeekMoods.length;
      const delta = thisWeekAvg - lastWeekAvg;

      // Confidence based on data points
      const minDataPoints = Math.min(thisWeekMoods.length, lastWeekMoods.length);
      const confidence = Math.min(0.9, minDataPoints / 7 * 0.8); // Max confidence with 7+ data points per week

      return {
        delta,
        thisWeek: thisWeekAvg,
        lastWeek: lastWeekAvg,
        confidence,
        dataPoints: {
          thisWeek: thisWeekMoods.length,
          lastWeek: lastWeekMoods.length
        }
      };
    } catch (error) {
      console.warn('⚠️ Error calculating weekly mood delta:', error);
      return null;
    }
  }

  /**
   * 🔗 Calculate enhanced MEA (Mood-Energy-Anxiety) correlations for dashboard
   */
  private calculateMEACorrelations(moods: any[]): {
    moodEnergy: number;
    moodAnxiety: number;
    energyAnxiety: number;
    profile: string;
    profileType: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
    actionable: boolean;
    suggestion: string;
    averages: { mood: number; energy: number; anxiety: number };
  } | null {
    try {
      if (moods.length < 5) return null;

      const moodScores = moods.map(m => m.mood_score);
      const energyLevels = moods.map(m => m.energy_level);
      const anxietyLevels = moods.map(m => m.anxiety_level);

      // Calculate Pearson correlation coefficients
      const moodEnergyCorr = this.calculatePearsonCorrelation(moodScores, energyLevels);
      const moodAnxietyCorr = this.calculatePearsonCorrelation(moodScores, anxietyLevels);
      const energyAnxietyCorr = this.calculatePearsonCorrelation(energyLevels, anxietyLevels);

      // Calculate averages
      const averages = {
        mood: moodScores.reduce((a, b) => a + b, 0) / moodScores.length,
        energy: energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length,
        anxiety: anxietyLevels.reduce((a, b) => a + b, 0) / anxietyLevels.length
      };

      // Enhanced profile determination
      let profileType = 'balanced';
      let profile = 'Dengeli Duygusal Profil';
      let severity: 'low' | 'medium' | 'high' = 'low';
      let suggestion = 'Duygusal dengen iyi görünüyor';
      let actionable = false;

      // Strong positive mood-energy + negative mood-anxiety = optimal
      if (moodEnergyCorr > 0.5 && moodAnxietyCorr < -0.3) {
        profileType = 'optimal';
        profile = 'Optimal Duygusal Denge';
        suggestion = 'Mükemmel! Mood yüksek→enerji artıyor, anksiyete azalıyor';
      }
      // Strong negative mood-energy + positive mood-anxiety = depression risk  
      else if (moodEnergyCorr < -0.3 && moodAnxietyCorr > 0.3) {
        profileType = 'depression_risk';
        profile = 'Depresif Eğilim Riski';
        severity = 'high';
        actionable = true;
        suggestion = 'Mood düştüğünde enerji de düşüyor, anksiyete artıyor - profesyonel destek değerlendir';
      }
      // High energy-anxiety correlation = manic tendency
      else if (energyAnxietyCorr > 0.6) {
        profileType = 'hyperarousal';
        profile = 'Yüksek Uyarılma Durumu';
        severity = 'medium';
        actionable = true;
        suggestion = 'Enerji ve anksiyete birlikte yükseliyor - sakinleştirici teknikler faydalı olabilir';
      }
      // Low mood with high anxiety correlation
      else if (averages.mood < 40 && Math.abs(moodAnxietyCorr) > 0.4) {
        profileType = 'anxious_low_mood';
        profile = 'Kaygılı Düşük Mood';
        severity = 'medium';
        actionable = true;
        suggestion = 'Düşük mood ve anksiyete ilişkisi tespit edildi - mood destekleyici aktiviteler dene';
      }
      // Very low correlations = disconnected emotional states
      else if (Math.abs(moodEnergyCorr) < 0.2 && Math.abs(moodAnxietyCorr) < 0.2) {
        profileType = 'disconnected';
        profile = 'Bağımsız Duygusal Durumlar';
        suggestion = 'Mood, enerji ve anksiyete bağımsız değişiyor - bu da normal olabilir';
      }

      const confidence = Math.min(0.9, moods.length / 20); // Higher confidence with more data

      return {
        moodEnergy: parseFloat(moodEnergyCorr.toFixed(3)),
        moodAnxiety: parseFloat(moodAnxietyCorr.toFixed(3)),
        energyAnxiety: parseFloat(energyAnxietyCorr.toFixed(3)),
        profile,
        profileType,
        confidence,
        severity,
        actionable,
        suggestion,
        averages: {
          mood: parseFloat(averages.mood.toFixed(1)),
          energy: parseFloat(averages.energy.toFixed(1)),
          anxiety: parseFloat(averages.anxiety.toFixed(1))
        }
      };
    } catch (error) {
      console.warn('⚠️ Error calculating MEA correlations:', error);
      return null;
    }
  }

  /**
   * 📊 Calculate Pearson correlation coefficient
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - meanX;
      const yDiff = y[i] - meanY;
      numerator += xDiff * yDiff;
      sumXSquared += xDiff * xDiff;
      sumYSquared += yDiff * yDiff;
    }

    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * 📊 Calculate p-value for Pearson correlation coefficient
   * Uses t-test approximation: t = r * sqrt(n-2) / sqrt(1-r²)
   */
  private calculateCorrelationPValue(r: number, n: number): number | null {
    if (n < 3 || Math.abs(r) >= 1) return null;
    
    try {
      const df = n - 2; // degrees of freedom
      const t = r * Math.sqrt(df) / Math.sqrt(1 - r * r);
      
      // Approximation of two-tailed t-test p-value using t-distribution
      const p = this.approximateTTestPValue(Math.abs(t), df);
      
      return Math.min(1, Math.max(0, p)); // Clamp between 0 and 1
    } catch (error) {
      console.warn('⚠️ P-value calculation failed:', error);
      return null;
    }
  }

  /**
   * 🧮 Approximate two-tailed t-test p-value
   * Uses simplified approximation for t-distribution
   */
  private approximateTTestPValue(t: number, df: number): number {
    // For large df (>30), normal approximation is reasonable
    if (df > 30) {
      return 2 * (1 - this.normalCDF(t));
    }
    
    // For small df, use lookup table approximation
    const criticalValues = [
      { df: 2, values: [4.303, 6.965, 9.925, 14.089] },   // p: [0.1, 0.05, 0.02, 0.01]
      { df: 3, values: [3.182, 4.541, 5.841, 7.453] },
      { df: 4, values: [2.776, 3.747, 4.604, 5.598] },
      { df: 5, values: [2.571, 3.365, 4.032, 4.773] },
      { df: 10, values: [2.228, 2.764, 3.169, 3.581] },
      { df: 20, values: [2.086, 2.528, 2.845, 3.153] },
      { df: 30, values: [2.042, 2.457, 2.750, 3.030] }
    ];

    // Find closest df
    const closest = criticalValues.reduce((prev, curr) => 
      Math.abs(curr.df - df) < Math.abs(prev.df - df) ? curr : prev
    );

    const pLevels = [0.1, 0.05, 0.02, 0.01];
    
    // Linear interpolation between p-values
    for (let i = 0; i < closest.values.length; i++) {
      if (t <= closest.values[i]) {
        if (i === 0) {
          // Above highest p-value, interpolate between 1.0 and 0.1
          const ratio = t / closest.values[0];
          return Math.max(0.1, 1.0 - ratio * 0.9);
        } else {
          // Interpolate between two p-values
          const prevT = i === 0 ? 0 : closest.values[i - 1];
          const currT = closest.values[i];
          const prevP = i === 0 ? 1.0 : pLevels[i - 1];
          const currP = pLevels[i];
          
          const ratio = (t - prevT) / (currT - prevT);
          return prevP - ratio * (prevP - currP);
        }
      }
    }
    
    // Below lowest critical value, very significant
    return 0.001;
  }

  /**
   * 🔢 Normal CDF approximation (cumulative distribution function)
   */
  private normalCDF(x: number): number {
    // Abramowitz and Stegun approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
    
    return x >= 0 ? 1 - prob : prob;
  }

  /**
   * 📊 COMPREHENSIVE MOOD ANALYTICS PROCESSOR
   * Implements clinical-grade mood analytics with volatility, profiles, and correlations
   */
  private processMoodAnalytics(moods: any[]): any | null {
    try {
      console.log(`📊 Starting comprehensive mood analytics for ${moods.length} entries`);
      
      if (!moods || moods.length < 3) {
        console.log('⚠️ Insufficient data for mood analytics');
        return null;
      }

      // 🚀 PERFORMANCE: Process only recent 50 entries
      const recentMoods = moods
        .filter(m => m.timestamp && m.mood_score !== undefined && m.energy_level !== undefined && m.anxiety_level !== undefined)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      if (recentMoods.length < 3) {
        return {
          weeklyDelta: 0,
          volatility: 0,
          baselines: { mood: 50, energy: 50, anxiety: 50 },
          correlations: {},
          sampleSize: recentMoods.length,
          dataQuality: 0.1,
          confidence: 0.1
        };
      }

      const sampleSize = recentMoods.length;
      
      // 1. 📈 WEEKLY DELTA CALCULATION
      const weeklyDelta = this.calculateAnalyticsWeeklyDelta(recentMoods);
      
      // 2. 🔥 VOLATILITY CALCULATION (Winsorized standard deviation)
      const volatility = this.calculateVolatility(recentMoods);
      
      // 3. 📊 BASELINES (14-day averages)
      const baselines = this.calculateBaselines(recentMoods);
      
      // 4. 🔗 MEA CORRELATIONS
      const correlations = this.calculateAnalyticsMEACorrelations(recentMoods);
      
      // 5. 📊 DATA QUALITY ASSESSMENT
      const dataQuality = this.assessDataQuality(recentMoods);
      
      // 6. 🧠 7 EMOTIONAL PROFILE CLASSIFICATION
      const profile = this.classifyEmotionalProfile(baselines, weeklyDelta, volatility, sampleSize);
      
      // 7. ⏰ BEST TIMES ANALYSIS
      const bestTimes = this.analyzeBestTimes(recentMoods);
      
      // 8. 🎯 GLOBAL CONFIDENCE CALCULATION
      const confidence = this.calculateGlobalConfidence(sampleSize, dataQuality, profile.confidence, correlations);

      const analytics = {
        weeklyDelta: parseFloat(weeklyDelta.toFixed(2)),
        volatility: parseFloat(volatility.toFixed(2)),
        baselines,
        correlations,
        profile,
        bestTimes,
        sampleSize,
        dataQuality: parseFloat(dataQuality.toFixed(3)),
        confidence: parseFloat(confidence.toFixed(3))
      };

      console.log('🎯 Mood analytics completed:', analytics);
      return analytics;
      
    } catch (error) {
      console.error('❌ Mood analytics processing failed:', error);
      return null;
    }
  }

  /**
   * Extract environmental triggers
   */
  private extractEnvironmentalTriggers(content: any): any[] {
    try {
      const triggers: any[] = [];
      
      // Environmental keywords
      const environmentalKeywords = [
        'ev', 'oda', 'mutfak', 'banyo', 'iş', 'okul', 'dışarı', 'araba', 'hastane', 'mağaza'
      ];

      // Check compulsions for environmental contexts
      if (content.compulsions && Array.isArray(content.compulsions)) {
        content.compulsions.forEach((c: any) => {
          const text = (c.notes || c.trigger || '').toLowerCase();
          environmentalKeywords.forEach(keyword => {
            if (text.includes(keyword)) {
              triggers.push({
                type: 'environmental',
                trigger: keyword,
                context: c.category || 'unknown',
                confidence: 0.7
              });
            }
          });
        });
      }

      // Check moods for environmental mentions
      if (content.moods && Array.isArray(content.moods)) {
        content.moods.forEach((m: any) => {
          const triggers_array = m.triggers || [];
          if (Array.isArray(triggers_array)) {
            triggers_array.forEach((trigger: string) => {
              const lowerTrigger = trigger.toLowerCase();
              environmentalKeywords.forEach(keyword => {
                if (lowerTrigger.includes(keyword)) {
                  triggers.push({
                    type: 'environmental',
                    trigger: keyword,
                    context: 'mood',
                    confidence: 0.8
                  });
                }
              });
            });
          }
        });
      }

      return triggers;
    } catch (error) {
      console.warn('⚠️ Error extracting environmental triggers:', error);
      return [];
    }
  }



  /**
   * Analyze triggers
   */
  private analyzeTriggers(content: any): any[] {
    try {
      const triggers: any[] = [];
      
      // Combine environmental and other triggers
      const envTriggers = this.extractEnvironmentalTriggers(content);
      triggers.push(...envTriggers);

      return triggers;
    } catch (error) {
      console.warn('⚠️ Error analyzing triggers:', error);
      return [];
    }
  }

  /**
   * Analyze severity progression
   */
  private analyzeSeverityProgression(content: any): any[] {
    try {
      const progression: any[] = [];
      
      if (content.compulsions && Array.isArray(content.compulsions)) {
        // Calculate average severity/resistance over time
        const sortedCompulsions = content.compulsions
          .filter((c: any) => c.timestamp && this.hasValidSeverity(c))
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (sortedCompulsions.length >= 3) {
          const first = sortedCompulsions.slice(0, Math.floor(sortedCompulsions.length / 3));
          const last = sortedCompulsions.slice(-Math.floor(sortedCompulsions.length / 3));

          const firstAvg = first.reduce((sum: number, c: any) => sum + this.getCompulsionSeverity(c), 0) / first.length;
          const lastAvg = last.reduce((sum: number, c: any) => sum + this.getCompulsionSeverity(c), 0) / last.length;

          if (Math.abs(lastAvg - firstAvg) > 0.5) {
            progression.push({
              type: 'severity_progression',
              trend: lastAvg > firstAvg ? 'improving' : 'declining',
              change: lastAvg - firstAvg,
              description: `Direnç seviyesi ${lastAvg > firstAvg ? 'artıyor' : 'azalıyor'}`,
              confidence: 0.8
            });
          }
        }
      }

      return progression;
    } catch (error) {
      console.warn('⚠️ Error analyzing severity progression:', error);
      return [];
    }
  }

  // ============================================================================
  // CBT PROGRESS ANALYTICS
  // ============================================================================
  
  /**
   * ✅ NEW: Process CBT Progress Analytics
   * Analyzes thought records to generate comprehensive progress insights
   */
  private async processCBTProgressAnalytics(input: UnifiedPipelineInput): Promise<any> {
    try {
      const content = input.content as any;
      const thoughtRecords = content.thoughtRecords || [];
      const timeframe = content.timeframe || 'month';
      
      console.log(`🧠 Processing CBT progress analytics for ${thoughtRecords.length} records`);
      
      if (thoughtRecords.length < 2) {
        return {
          distortionTrends: [],
          techniqueEffectiveness: [],
          progressAnalysis: 'Henüz yeterli veri yok. En az 2-3 düşünce kaydı gerekli.',
          recommendations: ['Düzenli düşünce kaydı tutmaya devam et'],
          riskLevel: 'low',
          nextFocus: 'Daha fazla düşünce kaydı tut',
          metadata: {
            analysisTime: Date.now(),
            recordCount: thoughtRecords.length,
            confidence: 0.3
          }
        };
      }
      
      // 1. DISTORTION TRENDS ANALYSIS
      const distortionTrends = this.analyzeCBTDistortionTrends(thoughtRecords);
      
      // 2. TECHNIQUE EFFECTIVENESS
      const techniqueEffectiveness = this.analyzeCBTTechniqueEffectiveness(thoughtRecords);
      
      // 3. PROGRESS ANALYSIS
      const progressAnalysis = this.generateCBTProgressAnalysis(thoughtRecords, timeframe);
      
      // 4. RECOMMENDATIONS
      const recommendations = this.generateCBTRecommendations(thoughtRecords, distortionTrends);
      
      // 5. RISK LEVEL ASSESSMENT
      const riskLevel = this.assessCBTRiskLevel(thoughtRecords);
      
      // 6. NEXT FOCUS AREA
      const nextFocus = this.determineCBTNextFocus(thoughtRecords, distortionTrends);
      
      return {
        distortionTrends,
        techniqueEffectiveness,
        progressAnalysis,
        recommendations,
        riskLevel,
        nextFocus,
        metadata: {
          analysisTime: Date.now(),
          recordCount: thoughtRecords.length,
          confidence: this.calculateCBTProgressConfidence(thoughtRecords)
        }
      };
      
    } catch (error) {
      console.error('❌ CBT Progress Analytics failed:', error);
      return {
        distortionTrends: [],
        techniqueEffectiveness: [],
        progressAnalysis: 'Analiz sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
        recommendations: ['Tekrar deneyebilirsin'],
        riskLevel: 'low',
        nextFocus: 'Sistem hatası nedeniyle belirlenemedi',
        metadata: {
          analysisTime: Date.now(),
          recordCount: 0,
          confidence: 0,
          error: error.message
        }
      };
    }
  }
  
  // CBT Analytics Helper Methods
  
  private analyzeCBTDistortionTrends(records: any[]): Array<{distortion: string; trend: 'improving' | 'declining' | 'stable'; change: number}> {
    const distortionCounts = new Map<string, number[]>();
    
    // Group by distortion type and time
    records.forEach((record, index) => {
      if (record.distortions && Array.isArray(record.distortions)) {
        record.distortions.forEach((distortion: string) => {
          if (!distortionCounts.has(distortion)) {
            distortionCounts.set(distortion, []);
          }
          distortionCounts.get(distortion)!.push(index);
        });
      }
    });
    
    const trends: Array<{distortion: string; trend: 'improving' | 'declining' | 'stable'; change: number}> = [];
    
    distortionCounts.forEach((occurrences, distortion) => {
      if (occurrences.length >= 2) {
        // Calculate frequency trend (early vs late records)
        const totalRecords = records.length;
        const midPoint = totalRecords / 2;
        
        const earlyOccurrences = occurrences.filter(idx => idx < midPoint).length;
        const lateOccurrences = occurrences.filter(idx => idx >= midPoint).length;
        
        const earlyRate = earlyOccurrences / Math.ceil(midPoint);
        const lateRate = lateOccurrences / Math.floor(totalRecords - midPoint);
        
        const change = lateRate - earlyRate;
        
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (change < -0.1) trend = 'improving'; // Less frequent = improving
        else if (change > 0.1) trend = 'declining'; // More frequent = declining
        
        trends.push({
          distortion,
          trend,
          change: Math.round(change * 100) / 100
        });
      }
    });
    
    // Sort by most significant changes
    return trends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5);
  }
  
  private analyzeCBTTechniqueEffectiveness(records: any[]): Array<{technique: string; effectiveness: number; confidence: number}> {
    const techniques: Array<{technique: string; effectiveness: number; confidence: number}> = [];
    
    // Calculate mood improvement as technique effectiveness
    const avgMoodImprovement = records.length > 0 
      ? records.reduce((sum, r) => sum + ((r.moodAfter || 5) - (r.moodBefore || 5)), 0) / records.length 
      : 0;
    
    if (avgMoodImprovement > 0) {
      techniques.push({
        technique: 'Düşünce Kaydı',
        effectiveness: Math.min(10, Math.round(avgMoodImprovement * 10) / 10),
        confidence: records.length >= 5 ? 0.9 : 0.6
      });
    }
    
    // Analyze evidence gathering technique
    const evidenceRecords = records.filter(r => r.evidenceFor && r.evidenceAgainst);
    if (evidenceRecords.length > 0) {
      const evidenceAvgImprovement = evidenceRecords.reduce(
        (sum, r) => sum + ((r.moodAfter || 5) - (r.moodBefore || 5)), 0
      ) / evidenceRecords.length;
      
      techniques.push({
        technique: 'Kanıt Toplama',
        effectiveness: Math.min(10, Math.round(evidenceAvgImprovement * 10) / 10),
        confidence: evidenceRecords.length >= 3 ? 0.8 : 0.5
      });
    }
    
    return techniques.slice(0, 3);
  }
  
  private generateCBTProgressAnalysis(records: any[], timeframe: string): string {
    const recordCount = records.length;
    const avgMoodImprovement = records.length > 0 
      ? records.reduce((sum, r) => sum + ((r.moodAfter || 5) - (r.moodBefore || 5)), 0) / records.length 
      : 0;
    
    const recentRecords = records.slice(0, Math.min(5, records.length));
    const recentAvgImprovement = recentRecords.length > 0
      ? recentRecords.reduce((sum, r) => sum + ((r.moodAfter || 5) - (r.moodBefore || 5)), 0) / recentRecords.length
      : 0;
    
    if (recordCount < 5) {
      return `${recordCount} düşünce kaydın var. CBT yolculuğunun başlangıcındasın ve ortalama ${avgMoodImprovement.toFixed(1)} puanlık mood iyileşmesi sağlıyorsun.`;
    } else if (avgMoodImprovement >= 2) {
      return `${recordCount} kayıtla güçlü bir ilerleme gösteriyorsun. Ortalama ${avgMoodImprovement.toFixed(1)} puanlık mood iyileşmesi, CBT tekniklerinin sana uygun olduğunu gösteriyor.`;
    } else if (avgMoodImprovement >= 1) {
      return `${recordCount} kayıtla istikrarlı bir gelişim süreci yaşıyorsun. ${avgMoodImprovement.toFixed(1)} puanlık ortalama iyileşme, düzenli pratikle artmaya devam edecek.`;
    } else {
      return `${recordCount} kayıt tamamladın. Mood iyileşmesi henüz beklenen seviyede değil ama bu normal - CBT becerileri zaman içinde gelişir.`;
    }
  }
  
  private generateCBTRecommendations(records: any[], distortionTrends: any[]): string[] {
    const recommendations: string[] = [];
    
    // Based on record frequency
    if (records.length < 10) {
      recommendations.push('Daha sık düşünce kaydı tutarak pattern\'lerin daha net görünmesini sağla');
    }
    
    // Based on mood improvement
    const avgMoodImprovement = records.reduce((sum, r) => sum + ((r.moodAfter || 5) - (r.moodBefore || 5)), 0) / records.length;
    if (avgMoodImprovement < 1) {
      recommendations.push('Kanıt toplama adımına daha fazla zaman ayırarak düşüncelerini daha objektif değerlendir');
    }
    
    // Based on distortion trends
    const decliningDistortions = distortionTrends.filter(d => d.trend === 'declining');
    if (decliningDistortions.length > 0) {
      recommendations.push(`${decliningDistortions[0].distortion} konusunda ekstra dikkat göster - sıklığı artış gösteriyor`);
    }
    
    // Evidence quality
    const evidenceRecords = records.filter(r => r.evidenceFor && r.evidenceAgainst);
    if (evidenceRecords.length < records.length * 0.7) {
      recommendations.push('Lehine ve aleyhine kanıtları daha düzenli doldurmaya odaklan');
    }
    
    return recommendations.slice(0, 3);
  }
  
  private assessCBTRiskLevel(records: any[]): 'low' | 'medium' | 'high' {
    const recentRecords = records.slice(0, 5);
    const avgMoodBefore = recentRecords.reduce((sum, r) => sum + (r.moodBefore || 5), 0) / recentRecords.length;
    const avgMoodImprovement = recentRecords.reduce((sum, r) => sum + ((r.moodAfter || 5) - (r.moodBefore || 5)), 0) / recentRecords.length;
    
    if (avgMoodBefore <= 3 && avgMoodImprovement < 0.5) {
      return 'high';
    } else if (avgMoodBefore <= 4 || avgMoodImprovement < 1) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  private determineCBTNextFocus(records: any[], distortionTrends: any[]): string {
    // Find most problematic distortion
    const decliningDistortions = distortionTrends.filter(d => d.trend === 'declining');
    if (decliningDistortions.length > 0) {
      return `${decliningDistortions[0].distortion} çarpıtmasına odaklan`;
    }
    
    // Based on evidence usage
    const evidenceRecords = records.filter(r => r.evidenceFor && r.evidenceAgainst);
    if (evidenceRecords.length < records.length * 0.5) {
      return 'Kanıt toplama becerilerin geliştir';
    }
    
    // Based on record frequency
    if (records.length < 15) {
      return 'Düzenli kayıt tutma alışkanlığın güçlendir';
    }
    
    return 'Reframe tekniklerini çeşitlendir';
  }
  
  private calculateCBTProgressConfidence(records: any[]): number {
    if (records.length < 3) return 0.3;
    if (records.length < 7) return 0.6;
    if (records.length < 15) return 0.8;
    return 0.9;
  }

  // ============================================================================
  // MISSING PATTERN ANALYSIS METHODS
  // ============================================================================

  /**
   * Calculate pattern confidence based on data points
   */
  private calculatePatternConfidence(dataPoints: number): number {
    if (dataPoints < 2) return 0.2;
    if (dataPoints < 5) return 0.4;
    if (dataPoints < 10) return 0.6;
    if (dataPoints < 20) return 0.8;
    return Math.min(0.95, 0.8 + (dataPoints - 20) * 0.01);
  }







  // (duplicate of extractEnvironmentalTriggers removed)

  /**
   * Extract mood-related temporal patterns by hour (OPTIMIZED - lightweight version)
   */
  private extractMoodTemporalPatternsByHour(data: any): any[] {
    const patterns = [];
    
    if (data.moods && Array.isArray(data.moods)) {
      // 🚀 PERFORMANCE: Sample only recent moods and limit processing
      const SAMPLE_SIZE = 20; // Much smaller sample for hourly analysis
      const recentMoods = data.moods
        .slice(0, SAMPLE_SIZE)
        .filter(mood => mood.timestamp || mood.created_at);
      
      if (recentMoods.length < 5) return []; // Early exit for insufficient data
      
      const moodsByHour = new Array(24).fill(0).map(() => ({ total: 0, count: 0 }));
      
      recentMoods.forEach(mood => {
        const hour = new Date(mood.timestamp || mood.created_at).getHours();
        moodsByHour[hour].total += mood.mood_score || 5;
        moodsByHour[hour].count += 1;
      });
      
      // Find significant low mood periods only (early exit)
      const hourlyAverages = moodsByHour
        .map((h, hour) => ({ hour, average: h.count > 0 ? h.total / h.count : 5, count: h.count }))
        .filter(h => h.count >= 2 && h.average < 4); // More restrictive filtering
      
      if (hourlyAverages.length > 0) {
        patterns.push({
          type: 'low_mood_temporal_hourly',
          hours: hourlyAverages.slice(0, 3).map(h => h.hour), // Limit to top 3
          averageScore: hourlyAverages.reduce((sum, h) => sum + h.average, 0) / hourlyAverages.length,
          confidence: Math.min(0.7, hourlyAverages.length / 10),
          sampleSize: recentMoods.length
        });
      }
    }
    
    return patterns;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private groupByTimeWindow(compulsions: any[], windowDays: number): any[][] {
    const windows: any[][] = [];
    const sortedCompulsions = [...compulsions].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    if (sortedCompulsions.length === 0) return windows;
    
    const startTime = new Date(sortedCompulsions[0].timestamp).getTime();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    
    let currentWindow: any[] = [];
    let currentWindowStart = startTime;
    
    sortedCompulsions.forEach(c => {
      const cTime = new Date(c.timestamp).getTime();
      if (cTime >= currentWindowStart + windowMs) {
        if (currentWindow.length > 0) windows.push(currentWindow);
        currentWindow = [c];
        currentWindowStart = Math.floor((cTime - startTime) / windowMs) * windowMs + startTime;
      } else {
        currentWindow.push(c);
      }
    });
    
    if (currentWindow.length > 0) windows.push(currentWindow);
    return windows;
  }

  /**
   * 📊 Extract resistance/severity value from compulsion with field name flexibility
   */
  private getCompulsionSeverity(compulsion: any): number {
    return compulsion.severity || compulsion.resistanceLevel || compulsion.resistance_level || compulsion.intensity || 5;
  }

  /**
   * 📊 Check if compulsion has valid severity/resistance data
   */
  private hasValidSeverity(compulsion: any): boolean {
    return compulsion.severity !== undefined || 
           compulsion.resistanceLevel !== undefined ||
           compulsion.resistance_level !== undefined ||
           compulsion.intensity !== undefined;
  }

  private calculateAverageSeverity(compulsions: any[]): number {
    if (!compulsions || !Array.isArray(compulsions) || compulsions.length === 0) return 0;
    const total = compulsions.reduce((sum, c) => sum + this.getCompulsionSeverity(c), 0);
    return total / compulsions.length;
  }

  private calculateTypeFrequency(compulsions: any[]): Record<string, number> {
    const freq: Record<string, number> = {};
    if (!compulsions || !Array.isArray(compulsions)) return freq;
    
    compulsions.forEach(c => {
      if (c.type) {
        freq[c.type] = (freq[c.type] || 0) + 1;
      }
    });
    return freq;
  }

  private extractDayOfWeekPattern(compulsions: any[]): any | null {
    if (!compulsions || !Array.isArray(compulsions)) return null;
    
    const dayCounts = new Array(7).fill(0);
    compulsions.forEach(c => {
      const day = new Date(c.timestamp).getDay();
      dayCounts[day]++;
    });
    
    const maxCount = Math.max(...dayCounts);
    const avgCount = dayCounts.reduce((sum, count) => sum + count, 0) / 7;
    
    if (maxCount > avgCount * 1.5) { // Significant deviation
      const peakDay = dayCounts.indexOf(maxCount);
      const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      
      return {
        type: 'day_of_week_pattern',
        peakDay: peakDay,
        dayName: dayNames[peakDay],
        frequency: maxCount,
        confidence: this.calculatePatternConfidence(maxCount)
      };
    }
    
    return null;
  }

  private extractTextPatterns(content: string): any {
    // Simple text pattern extraction for voice/notes input
    const patterns = {
      behavioral: [],
      triggers: []
    };
    
    const text = content.toLowerCase();
    
    // Behavioral pattern keywords
    const behavioralKeywords = ['tekrar', 'kontrol', 'temizlik', 'sayma', 'sıralama'];
    behavioralKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        patterns.behavioral.push({
          type: 'text_behavioral',
          keyword: keyword,
          context: text,
          confidence: 0.6
        });
      }
    });
    
    // Trigger pattern keywords
    const triggerKeywords = ['stres', 'endişe', 'korku', 'kirli', 'güvenlik'];
    triggerKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        patterns.triggers.push({
          type: 'text_trigger',
          trigger: keyword,
          context: text,
          confidence: 0.5
        });
      }
    });
    
    return patterns;
  }

  // ============================================================================
  // 📊 MOOD ANALYTICS MAIN PROCESSOR
  // ============================================================================
  
  /**
   * 🎯 Main mood analytics processor - generates clinical-grade insights
   */
  // duplicate removed

  // ============================================================================
  // 📊 MOOD ANALYTICS HELPER FUNCTIONS
  // ============================================================================

  /**
   * 📊 Calculate mood volatility using winsorized standard deviation
   */
  private calculateAnalyticsVolatility(moods: any[]): number {
    try {
      if (moods.length < 2) return 0;
      
      const scores = moods.map(m => m.mood_score).filter(s => s !== null && s !== undefined);
      if (scores.length < 2) return 0;
      
      // Winsorize at 5th and 95th percentiles to reduce outlier impact
      const sorted = [...scores].sort((a, b) => a - b);
      const p5Index = Math.floor(sorted.length * 0.05);
      const p95Index = Math.ceil(sorted.length * 0.95) - 1;
      const p5Value = sorted[p5Index];
      const p95Value = sorted[p95Index];
      
      const winsorized = scores.map(s => Math.min(Math.max(s, p5Value), p95Value));
      
      const mean = winsorized.reduce((sum, s) => sum + s, 0) / winsorized.length;
      const variance = winsorized.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / winsorized.length;
      
      return Math.sqrt(variance);
    } catch (error) {
      console.warn('⚠️ Volatility calculation failed:', error);
      return 0;
    }
  }

  /**
   * 📊 Calculate 14-day baselines for mood, energy, anxiety
   */
  private calculateAnalyticsBaselines(moods: any[]): any {
    try {
      if (moods.length === 0) return { mood: 50, energy: 50, anxiety: 50 };
      
      const recent14Days = moods.slice(0, Math.min(50, moods.length)); // Use available data
      
      const moodScores = recent14Days.map(m => m.mood_score).filter(s => s !== null && s !== undefined);
      const energyScores = recent14Days.map(m => m.energy_level).filter(s => s !== null && s !== undefined);
      const anxietyScores = recent14Days.map(m => m.anxiety_level).filter(s => s !== null && s !== undefined);
      
      return {
        mood: moodScores.length > 0 ? moodScores.reduce((sum, s) => sum + s, 0) / moodScores.length : 50,
        energy: energyScores.length > 0 ? energyScores.reduce((sum, s) => sum + s, 0) / energyScores.length : 50,
        anxiety: anxietyScores.length > 0 ? anxietyScores.reduce((sum, s) => sum + s, 0) / anxietyScores.length : 50
      };
    } catch (error) {
      console.warn('⚠️ Baselines calculation failed:', error);
      return { mood: 50, energy: 50, anxiety: 50 };
    }
  }

  /**
   * 📈 Calculate weekly mood delta with fallback for limited data
   */
  private calculateAnalyticsWeeklyDelta(moods: any[]): number {
    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      let thisWeekMoods = moods.filter(m => {
        const date = new Date(m.timestamp);
        return date >= oneWeekAgo && date <= now;
      });

      let lastWeekMoods = moods.filter(m => {
        const date = new Date(m.timestamp);
        return date >= twoWeeksAgo && date < oneWeekAgo;
      });

      // Fallback for limited data: degrade to 3+3 days
      if (thisWeekMoods.length < 2 || lastWeekMoods.length < 2) {
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        
        thisWeekMoods = moods.filter(m => {
          const date = new Date(m.timestamp);
          return date >= threeDaysAgo && date <= now;
        });
        
        lastWeekMoods = moods.filter(m => {
          const date = new Date(m.timestamp);
          return date >= sixDaysAgo && date < threeDaysAgo;
        });
      }

      if (thisWeekMoods.length === 0 || lastWeekMoods.length === 0) return 0;

      const thisWeekAvg = thisWeekMoods.reduce((sum, m) => sum + m.mood_score, 0) / thisWeekMoods.length;
      const lastWeekAvg = lastWeekMoods.reduce((sum, m) => sum + m.mood_score, 0) / lastWeekMoods.length;
      
      return thisWeekAvg - lastWeekAvg;
    } catch (error) {
      console.warn('⚠️ Weekly delta calculation failed:', error);
      return 0;
    }
  }

  /**
   * 🔥 Calculate volatility using winsorized standard deviation
   */
  private calculateVolatility(moods: any[]): number {
    try {
      if (moods.length < 3) return 0;
      
      // Use last 14 days of mood scores
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const recentMoods = moods.filter(m => new Date(m.timestamp) >= twoWeeksAgo);
      
      if (recentMoods.length < 3) return 0;
      
      const moodScores = recentMoods.map(m => m.mood_score);
      
      // Winsorize at 5th and 95th percentiles
      const sorted = [...moodScores].sort((a, b) => a - b);
      const p5Index = Math.floor(0.05 * sorted.length);
      const p95Index = Math.floor(0.95 * sorted.length);
      const p5Value = sorted[p5Index];
      const p95Value = sorted[p95Index];
      
      const winsorized = moodScores.map(score => {
        if (score < p5Value) return p5Value;
        if (score > p95Value) return p95Value;
        return score;
      });
      
      // Calculate standard deviation
      const mean = winsorized.reduce((sum, score) => sum + score, 0) / winsorized.length;
      const variance = winsorized.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / winsorized.length;
      
      return Math.sqrt(variance);
    } catch (error) {
      console.warn('⚠️ Volatility calculation failed:', error);
      return 0;
    }
  }

  /**
   * 📊 Calculate baselines (14-day averages)
   */
  private calculateBaselines(moods: any[]): { mood: number; energy: number; anxiety: number } {
    try {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const recentMoods = moods.filter(m => new Date(m.timestamp) >= twoWeeksAgo);
      
      if (recentMoods.length === 0) {
        return { mood: 50, energy: 50, anxiety: 50 };
      }
      
      const avgMood = recentMoods.reduce((sum, m) => sum + m.mood_score, 0) / recentMoods.length;
      const avgEnergy = recentMoods.reduce((sum, m) => sum + m.energy_level, 0) / recentMoods.length;
      const avgAnxiety = recentMoods.reduce((sum, m) => sum + m.anxiety_level, 0) / recentMoods.length;
      
      return {
        mood: parseFloat(avgMood.toFixed(1)),
        energy: parseFloat(avgEnergy.toFixed(1)),
        anxiety: parseFloat(avgAnxiety.toFixed(1))
      };
    } catch (error) {
      console.warn('⚠️ Baselines calculation failed:', error);
      return { mood: 50, energy: 50, anxiety: 50 };
    }
  }

  /**
   * 🔗 Calculate MEA correlations with n>=10 threshold
   */
  private calculateAnalyticsMEACorrelations(moods: any[]): any {
    try {
      const correlations: any = {};
      
      if (moods.length < 10) {
        return {
          moodEnergy: { r: null, n: moods.length, p: null },
          moodAnxiety: { r: null, n: moods.length, p: null },
          energyAnxiety: { r: null, n: moods.length, p: null }
        };
      }
      
      const moodScores = moods.map(m => m.mood_score);
      const energyLevels = moods.map(m => m.energy_level);
      const anxietyLevels = moods.map(m => m.anxiety_level);
      
      const moodEnergyR = this.calculatePearsonCorrelation(moodScores, energyLevels);
      const moodAnxietyR = this.calculatePearsonCorrelation(moodScores, anxietyLevels);
      const energyAnxietyR = this.calculatePearsonCorrelation(energyLevels, anxietyLevels);
      
      // Calculate p-values for each correlation
      const moodEnergyP = this.calculateCorrelationPValue(moodEnergyR, moods.length);
      const moodAnxietyP = this.calculateCorrelationPValue(moodAnxietyR, moods.length);
      const energyAnxietyP = this.calculateCorrelationPValue(energyAnxietyR, moods.length);

      return {
        moodEnergy: {
          r: parseFloat(moodEnergyR.toFixed(3)),
          n: moods.length,
          p: moodEnergyP ? parseFloat(moodEnergyP.toFixed(4)) : null
        },
        moodAnxiety: {
          r: parseFloat(moodAnxietyR.toFixed(3)),
          n: moods.length,
          p: moodAnxietyP ? parseFloat(moodAnxietyP.toFixed(4)) : null
        },
        energyAnxiety: {
          r: parseFloat(energyAnxietyR.toFixed(3)),
          n: moods.length,
          p: energyAnxietyP ? parseFloat(energyAnxietyP.toFixed(4)) : null
        }
      };
    } catch (error) {
      console.warn('⚠️ MEA correlations calculation failed:', error);
      return {};
    }
  }

  /**
   * 📊 Assess data quality (0-1 scale)
   */
  private assessDataQuality(moods: any[]): number {
    try {
      let qualityScore = 0;
      
      // Sample size component (0-0.4)
      const sampleSizeScore = Math.min(0.4, moods.length / 50 * 0.4);
      qualityScore += sampleSizeScore;
      
      // Missing data component (0-0.3)
      const completeMoods = moods.filter(m => 
        m.mood_score !== undefined && 
        m.energy_level !== undefined && 
        m.anxiety_level !== undefined
      );
      const missingRatio = 1 - (completeMoods.length / moods.length);
      const missingScore = Math.max(0, 0.3 - missingRatio * 0.3);
      qualityScore += missingScore;
      
      // Outlier component (0-0.3)
      const moodScores = completeMoods.map(m => m.mood_score);
      if (moodScores.length > 0) {
        const mean = moodScores.reduce((sum, score) => sum + score, 0) / moodScores.length;
        const std = Math.sqrt(moodScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / moodScores.length);
        const outliers = moodScores.filter(score => Math.abs(score - mean) > 2 * std);
        const outlierRatio = outliers.length / moodScores.length;
        const outlierScore = Math.max(0, 0.3 - outlierRatio * 0.3);
        qualityScore += outlierScore;
      }
      
      return Math.min(1, qualityScore);
    } catch (error) {
      console.warn('⚠️ Data quality assessment failed:', error);
      return 0.5; // Default middle score
    }
  }

  /**
   * 🧠 Classify emotional profile (7 types with priority)
   */
  private classifyEmotionalProfile(
    baselines: { mood: number; energy: number; anxiety: number },
    weeklyDelta: number,
    volatility: number,
    sampleSize: number
  ): { type: string; confidence: number; rationale: string[] } {
    try {
      const rationale: string[] = [];
      let profileType = 'stable';
      let confidence = 0.5;
      
      // Priority order: stressed > volatile > fatigued > recovering > resilient > elevated > stable
      
      // 1. STRESSED: baseline.mood < 40 AND baseline.anxiety > 60
      if (baselines.mood < 40 && baselines.anxiety > 60) {
        profileType = 'stressed';
        rationale.push(`Düşük mood (${baselines.mood}) ve yüksek anksiyete (${baselines.anxiety})`);
        confidence = 0.8;
      }
      // 2. VOLATILE: volatility > 15
      else if (volatility > 15) {
        profileType = 'volatile';
        rationale.push(`Yüksek mood volatilitesi (${volatility.toFixed(1)})`);
        confidence = 0.7;
      }
      // 3. FATIGUED: baseline.energy < 40 AND baseline.mood < 55
      else if (baselines.energy < 40 && baselines.mood < 55) {
        profileType = 'fatigued';
        rationale.push(`Düşük enerji (${baselines.energy}) ve orta-düşük mood (${baselines.mood})`);
        confidence = 0.75;
      }
      // 4. RECOVERING: weeklyDelta > 8 AND 40 ≤ baseline.mood ≤ 60
      else if (weeklyDelta > 8 && baselines.mood >= 40 && baselines.mood <= 60) {
        profileType = 'recovering';
        rationale.push(`Pozitif haftalık trend (+${weeklyDelta.toFixed(1)}) ve orta mood`);
        confidence = 0.7;
      }
      // 5. RESILIENT: baseline.mood > 60 AND volatility < 10 AND baseline.anxiety < 50
      else if (baselines.mood > 60 && volatility < 10 && baselines.anxiety < 50) {
        profileType = 'resilient';
        rationale.push(`Yüksek mood (${baselines.mood}), düşük volatilite (${volatility.toFixed(1)}), düşük anksiyete`);
        confidence = 0.85;
      }
      // 6. ELEVATED: baseline.mood > 70 AND volatility düşük
      else if (baselines.mood > 70 && volatility < 12) {
        profileType = 'elevated';
        rationale.push(`Yüksek mood seviyesi (${baselines.mood}) ve stabil durum`);
        confidence = 0.75;
      }
      // 7. STABLE: volatility < 8 AND |weeklyDelta| < 5 (default)
      else if (volatility < 8 && Math.abs(weeklyDelta) < 5) {
        profileType = 'stable';
        rationale.push(`Düşük volatilite (${volatility.toFixed(1)}) ve minimal haftalık değişim`);
        confidence = 0.6;
      }
      
      // Adjust confidence based on sample size
      const sampleSizeMultiplier = Math.min(1, sampleSize / 20);
      confidence = confidence * sampleSizeMultiplier;
      
      return {
        type: profileType,
        confidence: parseFloat(confidence.toFixed(3)),
        rationale
      };
    } catch (error) {
      console.warn('⚠️ Emotional profile classification failed:', error);
      return {
        type: 'stable',
        confidence: 0.3,
        rationale: ['Profil sınıflaması başarısız - varsayılan stabil profil']
      };
    }
  }

  /**
   * ⏰ Analyze best times (day of week and time of day)
   */
  private analyzeBestTimes(moods: any[]): { dayOfWeek?: string; timeOfDay?: string; confidence: number } {
    try {
      if (moods.length < 7) {
        return { confidence: 0.1 };
      }
      
      // Day of week analysis
      const dayStats: Record<number, { total: number; count: number }> = {};
      const hourStats: Record<number, { total: number; count: number }> = {};
      
      moods.forEach(m => {
        const date = new Date(m.timestamp);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        
        // Day stats
        if (!dayStats[dayOfWeek]) dayStats[dayOfWeek] = { total: 0, count: 0 };
        dayStats[dayOfWeek].total += m.mood_score;
        dayStats[dayOfWeek].count += 1;
        
        // Hour stats
        if (!hourStats[hour]) hourStats[hour] = { total: 0, count: 0 };
        hourStats[hour].total += m.mood_score;
        hourStats[hour].count += 1;
      });
      
      // Find best day
      let bestDay = '';
      let bestDayScore = 0;
      const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      
      Object.entries(dayStats).forEach(([day, stats]) => {
        if (stats.count >= 2) { // At least 2 data points
          const avgScore = stats.total / stats.count;
          if (avgScore > bestDayScore) {
            bestDayScore = avgScore;
            bestDay = dayNames[parseInt(day)];
          }
        }
      });
      
      // Find best time of day
      let bestTimeSlot = '';
      let bestTimeScore = 0;
      
      Object.entries(hourStats).forEach(([hour, stats]) => {
        if (stats.count >= 2) {
          const avgScore = stats.total / stats.count;
          if (avgScore > bestTimeScore) {
            bestTimeScore = avgScore;
            const h = parseInt(hour);
            if (h >= 6 && h < 12) bestTimeSlot = 'Sabah';
            else if (h >= 12 && h < 18) bestTimeSlot = 'Öğleden sonra';
            else if (h >= 18 && h < 22) bestTimeSlot = 'Akşam';
            else bestTimeSlot = 'Gece';
          }
        }
      });
      
      const confidence = Math.min(0.8, moods.length / 30 * 0.8);
      
      return {
        dayOfWeek: bestDay || undefined,
        timeOfDay: bestTimeSlot || undefined,
        confidence: parseFloat(confidence.toFixed(3))
      };
    } catch (error) {
      console.warn('⚠️ Best times analysis failed:', error);
      return { confidence: 0.1 };
    }
  }

  /**
   * 🎯 Calculate global confidence score
   */
  private calculateGlobalConfidence(
    sampleSize: number,
    dataQuality: number,
    profileConfidence: number,
    correlations: any
  ): number {
    try {
      // Sample size component (0-0.4)
      const sampleComponent = Math.min(0.4, sampleSize / 50 * 0.4);
      
      // Data quality component (0-0.3)
      const qualityComponent = dataQuality * 0.3;
      
      // Profile confidence component (0-0.2)
      const profileComponent = profileConfidence * 0.2;
      
      // Correlation signal strength component (0-0.1)
      let correlationComponent = 0;
      if (correlations.moodEnergy?.r !== null) {
        const avgCorrelationStrength = (
          Math.abs(correlations.moodEnergy?.r || 0) +
          Math.abs(correlations.moodAnxiety?.r || 0) +
          Math.abs(correlations.energyAnxiety?.r || 0)
        ) / 3;
        correlationComponent = avgCorrelationStrength * 0.1;
      }
      
      const totalConfidence = sampleComponent + qualityComponent + profileComponent + correlationComponent;
      
      return Math.min(0.95, totalConfidence);
    } catch (error) {
      console.warn('⚠️ Global confidence calculation failed:', error);
      return 0.3;
    }
  }
  /**
   * 📊 Assess data quality for analytics
   */
  private assessAnalyticsDataQuality(moods: any[]): number {
    try {
      if (moods.length === 0) return 0.1;
      
      let qualityScore = 0;
      
      // Sample size scoring
      if (moods.length >= 30) qualityScore += 0.4;
      else if (moods.length >= 14) qualityScore += 0.3;
      else if (moods.length >= 7) qualityScore += 0.2;
      else qualityScore += 0.1;
      
      // Missing data ratio
      const validMoodScores = moods.filter(m => m.mood_score !== null && m.mood_score !== undefined);
      const missingRatio = 1 - (validMoodScores.length / moods.length);
      const missingScore = Math.max(0, 0.3 - missingRatio * 0.3);
      qualityScore += missingScore;
      
      // Outlier detection
      if (validMoodScores.length >= 5) {
        const scores = validMoodScores.map(m => m.mood_score);
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const std = Math.sqrt(scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length);
        const outliers = scores.filter(score => Math.abs(score - mean) > 2 * std);
        const outlierRatio = outliers.length / scores.length;
        const outlierScore = Math.max(0, 0.3 - outlierRatio * 0.3);
        qualityScore += outlierScore;
      }
      
      return Math.min(1, qualityScore);
    } catch (error) {
      console.warn('⚠️ Analytics data quality assessment failed:', error);
      return 0.1;
    }
  }

  /**
   * 🧠 Classify analytics emotional profile (7 types with priority)
   */
  private classifyAnalyticsEmotionalProfile(
    moods: any[],
    baselines: { mood: number; energy: number; anxiety: number },
    weeklyDelta: number,
    volatility: number,
    correlations: any
  ): { type: string; confidence: number; rationale: string[] } {
    try {
      const rationale: string[] = [];
      let profileType = 'stable';
      let confidence = 0.5;
      
      // Priority order: stressed > volatile > fatigued > recovering > resilient > elevated > stable
      
      // 1. STRESSED: baseline.mood < 40 AND baseline.anxiety > 60
      if (baselines.mood < 40 && baselines.anxiety > 60) {
        profileType = 'stressed';
        rationale.push(`Düşük mood (${baselines.mood.toFixed(1)}) ve yüksek anksiyete (${baselines.anxiety.toFixed(1)})`);
        confidence = 0.8;
      }
      // 2. VOLATILE: volatility > 15
      else if (volatility > 15) {
        profileType = 'volatile';
        rationale.push(`Yüksek mood volatilitesi (${volatility.toFixed(1)})`);
        confidence = 0.7;
      }
      // 3. FATIGUED: baseline.energy < 40 AND baseline.mood < 55
      else if (baselines.energy < 40 && baselines.mood < 55) {
        profileType = 'fatigued';
        rationale.push(`Düşük enerji (${baselines.energy.toFixed(1)}) ve orta-düşük mood (${baselines.mood.toFixed(1)})`);
        confidence = 0.75;
      }
      // 4. RECOVERING: weeklyDelta > 8 AND 40 ≤ baseline.mood ≤ 60
      else if (weeklyDelta > 8 && baselines.mood >= 40 && baselines.mood <= 60) {
        profileType = 'recovering';
        rationale.push(`Pozitif haftalık trend (+${weeklyDelta.toFixed(1)}) ve orta mood (${baselines.mood.toFixed(1)})`);
        confidence = 0.6;
      }
      // 5. RESILIENT: baseline.mood ≥ 65 AND volatility ≤ 8 AND baseline.anxiety ≤ 40
      else if (baselines.mood >= 65 && volatility <= 8 && baselines.anxiety <= 40) {
        profileType = 'resilient';
        rationale.push(`Yüksek mood (${baselines.mood.toFixed(1)}), düşük volatilite (${volatility.toFixed(1)}) ve düşük anksiyete (${baselines.anxiety.toFixed(1)})`);
        confidence = 0.85;
      }
      // 6. ELEVATED: baseline.mood ≥ 70
      else if (baselines.mood >= 70) {
        profileType = 'elevated';
        rationale.push(`Yüksek mood baseline (${baselines.mood.toFixed(1)})`);
        confidence = 0.7;
      }
      // 7. STABLE: default case
      else {
        profileType = 'stable';
        rationale.push(`Dengeli duygusal durum (mood: ${baselines.mood.toFixed(1)}, volatilite: ${volatility.toFixed(1)})`);
        confidence = 0.5;
      }
      
      return { type: profileType, confidence, rationale };
    } catch (error) {
      console.warn('⚠️ Analytics emotional profile classification failed:', error);
      return { type: 'stable', confidence: 0.3, rationale: ['Analiz hatası nedeniyle varsayılan profil'] };
    }
  }

  /**
   * ⏰ Analyze best times for mood (day of week/time of day)
   */
  private analyzeAnalyticsBestTimes(moods: any[]): { dayOfWeek?: string; timeOfDay?: string; confidence: number } {
    try {
      if (moods.length < 7) return { confidence: 0.1 };
      
      const dayOfWeekCounts: { [key: string]: { count: number; avgMood: number } } = {};
      const timeOfDayCounts: { [key: string]: { count: number; avgMood: number } } = {};
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      moods.forEach(mood => {
        if (mood.mood_score && mood.created_at) {
          const date = new Date(mood.created_at);
          const dayOfWeek = dayNames[date.getDay()];
          const hour = date.getHours();
          const timeSlot = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
          
          // Day of week analysis
          if (!dayOfWeekCounts[dayOfWeek]) {
            dayOfWeekCounts[dayOfWeek] = { count: 0, avgMood: 0 };
          }
          dayOfWeekCounts[dayOfWeek].count++;
          dayOfWeekCounts[dayOfWeek].avgMood += mood.mood_score;
          
          // Time of day analysis
          if (!timeOfDayCounts[timeSlot]) {
            timeOfDayCounts[timeSlot] = { count: 0, avgMood: 0 };
          }
          timeOfDayCounts[timeSlot].count++;
          timeOfDayCounts[timeSlot].avgMood += mood.mood_score;
        }
      });
      
      // Calculate averages and find best times
      let bestDay = '';
      let bestDayMood = 0;
      Object.keys(dayOfWeekCounts).forEach(day => {
        const avgMood = dayOfWeekCounts[day].avgMood / dayOfWeekCounts[day].count;
        dayOfWeekCounts[day].avgMood = avgMood;
        if (avgMood > bestDayMood && dayOfWeekCounts[day].count >= 2) {
          bestDay = day;
          bestDayMood = avgMood;
        }
      });
      
      let bestTime = '';
      let bestTimeMood = 0;
      Object.keys(timeOfDayCounts).forEach(time => {
        const avgMood = timeOfDayCounts[time].avgMood / timeOfDayCounts[time].count;
        timeOfDayCounts[time].avgMood = avgMood;
        if (avgMood > bestTimeMood && timeOfDayCounts[time].count >= 2) {
          bestTime = time;
          bestTimeMood = avgMood;
        }
      });
      
      return {
        dayOfWeek: bestDay || undefined,
        timeOfDay: bestTime || undefined,
        confidence: Math.min(0.8, moods.length / 20) // Confidence increases with more data
      };
    } catch (error) {
      console.warn('⚠️ Analytics best times analysis failed:', error);
      return { confidence: 0.1 };
    }
  }

  /**
   * 🎯 Calculate global confidence score for analytics
   */
  private calculateAnalyticsGlobalConfidence(moods: any[], dataQuality: number, profile: any): number {
    try {
      let confidence = 0;
      
      // Base confidence from data quality (40% weight)
      confidence += dataQuality * 0.4;
      
      // Sample size confidence (30% weight)
      const sampleSize = moods.length;
      if (sampleSize >= 30) confidence += 0.3;
      else if (sampleSize >= 14) confidence += 0.2;
      else if (sampleSize >= 7) confidence += 0.1;
      else confidence += 0.05;
      
      // Profile confidence (20% weight)
      if (profile && profile.confidence) {
        confidence += profile.confidence * 0.2;
      }
      
      // Data recency boost (10% weight)
      const now = Date.now();
      const recentCount = moods.filter(m => {
        const moodTime = new Date(m.created_at).getTime();
        const daysDiff = (now - moodTime) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      }).length;
      
      if (recentCount >= 3) confidence += 0.1;
      else if (recentCount >= 1) confidence += 0.05;
      
      return Math.min(1, Math.max(0.1, confidence));
    } catch (error) {
      console.warn('⚠️ Analytics global confidence calculation failed:', error);
      return 0.3;
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const unifiedPipeline = UnifiedAIPipeline.getInstance();
