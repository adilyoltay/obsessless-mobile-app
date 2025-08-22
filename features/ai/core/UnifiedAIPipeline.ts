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
    source: 'today' | 'tracking' | 'cbt' | 'mood';
    timestamp?: number;
    metadata?: Record<string, any>;
  };
}

export interface UnifiedPipelineResult {
  // Voice Analysis Results
  voice?: {
    category: 'MOOD' | 'CBT' | 'OCD' | 'BREATHWORK' | 'OTHER';
    confidence: number;
    suggestion?: string;
    route?: string;
  };
  
  // Pattern Recognition Results
  patterns?: {
    temporal: Array<{
      type: string;
      frequency: number;
      timeOfDay?: string;
      trend: 'increasing' | 'decreasing' | 'stable';
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
  };
  
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
  
  // CBT Analysis Results
  cbt?: {
    distortions: string[];
    reframes: string[];
    techniques: string[];
    confidence: number;
  };
  
  // Metadata
  metadata: {
    pipelineVersion: string;
    processedAt: number;
    cacheTTL: number;
    source: 'cache' | 'fresh';
    processingTime: number;
  };
}

// ============================================================================
// MAIN PIPELINE CLASS
// ============================================================================

export class UnifiedAIPipeline {
  private static instance: UnifiedAIPipeline;
  private cache: Map<string, { result: UnifiedPipelineResult; expires: number }> = new Map();
  
  // ✅ FIXED: Module-specific cache TTLs as per specification  
  private readonly MODULE_TTLS = {
    insights: 24 * 60 * 60 * 1000,    // 24 hours
    patterns: 12 * 60 * 60 * 1000,    // 12 hours  
    voice: 1 * 60 * 60 * 1000,        // 1 hour
    progress: 6 * 60 * 60 * 1000,     // 6 hours
    cbt: 24 * 60 * 60 * 1000,         // 24 hours (same as insights)
    default: 24 * 60 * 60 * 1000      // 24 hours fallback
  };
  
  private invalidationHooks: Map<string, () => void> = new Map();
  
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
        if (input.context?.source === 'cbt') return this.MODULE_TTLS.cbt;
        if (input.context?.source === 'tracking') return this.MODULE_TTLS.patterns;
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
          source: 'disabled',
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
    
    // 3. Cache the result with module-specific TTL
    const moduleTTL = this.getModuleTTL(input);
    this.setCache(cacheKey, result, moduleTTL);
    
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
        processingTime: Date.now() - startTime
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
        processingTime: 0 // Will be updated by main process method
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
    
    // 3. CBT Analysis (if relevant)
    if (this.shouldRunCBT(input)) {
      promises.push(
        this.processCBTAnalysis(input).then(cbt => {
          result.cbt = cbt;
        })
      );
    }
    
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
    
    // 4. Insights Generation (depends on patterns, so run after)
    if (result.patterns) {
      result.insights = await this.processInsightsGeneration(input, result.patterns);
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
        route: analysis.route
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
        }
        
        // if (content.erpSessions && Array.isArray(content.erpSessions)) { // Removed Terapi
          // patterns.temporal.push(...this.extractTerapiTemporalPatterns(content.erpSessions)); // Removed Terapi
          // patterns.metadata.dataPoints += content.erpSessions.length; // Removed Terapi
        // } // Removed Terapi
        
        // 2. BEHAVIORAL PATTERNS (Davranışsal kalıplar)
        if (content.compulsions) {
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
      
      // Try to use cbtEngine if available (fallback to built-in logic)
      try {
        const { cbtEngine } = await import('../engines/cbtEngine');
        
        if (cbtEngine.enabled) {
          const engineDistortions = await cbtEngine.detectDistortions(text);
          const engineReframes = await cbtEngine.suggestReframes(text, engineDistortions);
          
          // Merge engine results with built-in analysis
          analysis.distortions = [...analysis.distortions, ...engineDistortions.map(d => ({ name: d.name, confidence: d.confidence }))];
          analysis.reframes = [...analysis.reframes, ...engineReframes];
          analysis.metadata.confidence = Math.max(analysis.metadata.confidence, 0.85);
        }
      } catch (engineError) {
        console.warn('CBT Engine unavailable, using built-in analysis:', engineError);
      }
      
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
      
      // 1. TEMPORAL INSIGHTS (Zaman bazlı içgörüler)
      if (patterns.temporal && patterns.temporal.length > 0) {
        const temporalInsights = this.generateTemporalInsights(patterns.temporal);
        insights.therapeutic.push(...temporalInsights);
      }
      
      // 2. BEHAVIORAL INSIGHTS (Davranışsal içgörüler)
      if (patterns.behavioral && patterns.behavioral.length > 0) {
        const behavioralInsights = this.generateBehavioralInsights(patterns.behavioral);
        insights.behavioral.push(...behavioralInsights);
      }
      
      // 3. TRIGGER INSIGHTS (Tetik içgörüleri)
      if (patterns.triggers && patterns.triggers.length > 0) {
        const triggerInsights = this.generateTriggerInsights(patterns.triggers);
        insights.therapeutic.push(...triggerInsights);
      }
      
      // 4. SEVERITY PROGRESSION INSIGHTS (Şiddet seyri içgörüleri)
      if (patterns.severity && patterns.severity.length > 0) {
        const severityInsights = this.generateSeverityInsights(patterns.severity);
        insights.progress.push(...severityInsights);
      }
      
      // 5. ENVIRONMENTAL INSIGHTS (Çevresel içgörüler)
      if (patterns.environmental && patterns.environmental.length > 0) {
        const environmentalInsights = this.generateEnvironmentalInsights(patterns.environmental);
        insights.therapeutic.push(...environmentalInsights);
      }
      
      // 6. PROGRESS INSIGHTS (İlerleme içgörüleri)
      const progressInsights = this.generateProgressInsights(patterns, input);
      insights.progress.push(...progressInsights);
      
      // 7. MOTIVATIONAL INSIGHTS (Motivasyon içgörüleri)
      const motivationalInsights = this.generateMotivationalInsights(patterns);
      insights.motivational.push(...motivationalInsights);
      
      // 8. CROSS-PATTERN INSIGHTS (Çapraz kalıp analizi)
      const crossPatternInsights = this.generateCrossPatternInsights(patterns);
      insights.therapeutic.push(...crossPatternInsights);
      
      // 9. CALCULATE METADATA
      insights.metadata = this.calculateInsightsMetadata(insights);
      
      // 10. PRIORITIZE AND LIMIT INSIGHTS (En önemli içgörüleri seç)
      insights.therapeutic = this.prioritizeInsights(insights.therapeutic).slice(0, 5);
      insights.progress = insights.progress.slice(0, 3);
      insights.behavioral = insights.behavioral.slice(0, 3);
      insights.motivational = insights.motivational.slice(0, 2);
      
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
    // Group by hour of day
    const hourGroups = {};
    
    compulsions.forEach(c => {
      const hour = new Date(c.timestamp).getHours();
      hourGroups[hour] = (hourGroups[hour] || 0) + 1;
    });
    
    // Find peak hours
    const patterns = [];
    Object.entries(hourGroups).forEach(([hour, count]) => {
      if (count > 2) {
        patterns.push({
          type: 'peak_hour',
          frequency: count as number,
          timeOfDay: `${hour}:00`,
          trend: 'stable'
        });
      }
    });
    
    return patterns;
  }
  
  private extractBehavioralPatterns(compulsions: any[]): any[] {
    // Group by trigger
    const triggerGroups = {};
    
    compulsions.forEach(c => {
      const trigger = c.trigger || 'unknown';
      if (!triggerGroups[trigger]) {
        triggerGroups[trigger] = {
          count: 0,
          totalSeverity: 0
        };
      }
      triggerGroups[trigger].count++;
      triggerGroups[trigger].totalSeverity += c.severity || 5;
    });
    
    // Convert to patterns
    const patterns = [];
    Object.entries(triggerGroups).forEach(([trigger, data]: [string, any]) => {
      patterns.push({
        trigger,
        response: 'compulsion',
        frequency: data.count,
        severity: Math.round(data.totalSeverity / data.count)
      });
    });
    
    return patterns;
  }
  
  private shouldRunCBT(input: UnifiedPipelineInput): boolean {
    return input.type === 'voice' || 
           input.context?.source === 'cbt' ||
           (typeof input.content === 'string' && input.content.length > 50);
  }
  
  private getEnabledModules(): string[] {
    const modules = [];
    // ✅ FIXED: Use dedicated unified pipeline flags instead of legacy component flags
    if (FEATURE_FLAGS.isEnabled('AI_UNIFIED_VOICE')) modules.push('voice');
    if (FEATURE_FLAGS.isEnabled('AI_UNIFIED_PATTERNS')) modules.push('patterns');
    if (FEATURE_FLAGS.isEnabled('AI_UNIFIED_INSIGHTS')) modules.push('insights');
    if (FEATURE_FLAGS.isEnabled('AI_UNIFIED_CBT')) modules.push('cbt');
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
        return memoryCache.result;
      }
    }
    
    // 2. Check Supabase cache (persistent, shared across devices)
    try {
      const supabaseCached = await this.getFromSupabaseCache(key);
      if (supabaseCached) {
        // Restore to memory cache for faster future access (use default TTL for restored cache)
        this.cache.set(key, {
          result: supabaseCached,
          expires: Date.now() + this.MODULE_TTLS.default
        });
        
        console.log('📦 Cache restored from Supabase:', key.substring(0, 30) + '...');
        return supabaseCached;
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
          console.log('📱 Cache restored from AsyncStorage:', key.substring(0, 30) + '...');
          return parsed.result;
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
    const cacheTTL = ttl || this.MODULE_TTLS.default;
    
    // 1. Store in memory cache (fastest access)
    this.cache.set(key, {
      result,
      expires: Date.now() + cacheTTL
    });
    
    // 2. Persist to Supabase (shared across devices)
    this.setToSupabaseCache(key, result);
    
    // 3. Also persist to AsyncStorage for offline
    this.persistToStorage(key, result);
    
    console.log(`📦 Cache set with ${Math.round(cacheTTL / (60 * 60 * 1000))}h TTL:`, key.substring(0, 30) + '...');
  }
  
  private async persistToStorage(key: string, result: UnifiedPipelineResult): Promise<void> {
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          result,
          expires: Date.now() + this.DEFAULT_TTL
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
      const { data, error } = await supabaseService.client
        .from('ai_cache')
        .select('content, expires_at')  // 'content' not 'cached_result'
        .eq('cache_key', key)
        .maybeSingle();
      
      if (error) {
        console.warn('⚠️ Supabase cache read error:', error);
        return null;
      }
      
      if (!data) {
        return null; // Cache miss
      }
      
      // Check expiration
      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      if (now > expiresAt) {
        // Cleanup expired entry
        await supabaseService.client
          .from('ai_cache')
          .delete()
          .eq('cache_key', key);
        return null;
      }
      
      return data.content as UnifiedPipelineResult;  // Use 'content' column
    } catch (error) {
      console.warn('⚠️ Supabase cache read failed:', error);
      return null;
    }
  }
  
  private async setToSupabaseCache(key: string, result: UnifiedPipelineResult): Promise<void> {
    try {
      // Extract userId from key for proper RLS
      const userId = key.split(':')[1];
      const ttlHours = this.DEFAULT_TTL / (1000 * 60 * 60); // Convert ms to hours
      
      // ✅ FIXED: Use correct column names from ai_cache table schema
      const { error } = await supabaseService.client
        .from('ai_cache')
        .upsert({
          cache_key: key,
          user_id: userId,
          content: result,  // Use 'content' column
          computed_at: new Date().toISOString(),
          ttl_hours: Math.round(ttlHours),  // TTL in hours
          // expires_at is calculated automatically by trigger
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
  
  private setupInvalidationHooks(): void {
    // Hook: New compulsion recorded
    this.invalidationHooks.set('compulsion_added', () => {
      this.invalidateUserCache('patterns');
    });
    
    // Hook: CBT thought record created/updated
    this.invalidationHooks.set('cbt_record_added', () => {
      this.invalidateUserCache('insights');
    });
    
    // Hook: Mood entry added
    this.invalidationHooks.set('mood_added', () => {
      this.invalidateUserCache('all');
    });
    
    // Hook: Manual refresh requested
    this.invalidationHooks.set('manual_refresh', () => {
      this.cache.clear();
    });
    
    // REMOVED: therapy_completed - ERP module deleted
    // REMOVED: erp_completed - ERP module deleted
  }
  
  public triggerInvalidation(hook: string, userId?: string): void {
    const handler = this.invalidationHooks.get(hook);
    if (handler) {
      handler();
    }
    
    // Track invalidation
    trackAIInteraction(AIEventType.CACHE_INVALIDATION, {
      hook,
      userId,
      timestamp: Date.now()
    });
  }
  
  private invalidateUserCache(type: 'patterns' | 'insights' | 'all', userId?: string): void {
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (userId && !key.includes(userId)) return;
      
      if (type === 'all' || key.includes(type)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    // Also invalidate Supabase cache
    this.invalidateSupabaseCache(type, userId);
  }
  
  /**
   * 🗑️ Supabase Cache Invalidation
   */
  private async invalidateSupabaseCache(type: 'patterns' | 'insights' | 'all', userId?: string): Promise<void> {
    try {
      let query = supabaseService.client
        .from('ai_cache')
        .delete()
        .eq('cache_type', 'unified_pipeline');
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { error } = await query;
      
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

}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const unifiedPipeline = UnifiedAIPipeline.getInstance();
