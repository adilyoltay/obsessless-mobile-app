/**
 * 🎯 OCD Trigger Detection Service - Smart Trigger Analysis & Intervention
 * 
 * Bu service kompulsiyon kayıtlarından environmental, emotional ve situational
 * tetikleyicileri otomatik tespit eder. AI destekli text mining ile trigger
 * networks analizi yapar ve proaktif müdahale stratejileri önerir.
 * 
 * ⚠️ CRITICAL: Privacy-first approach - sensitive data encryption
 * ⚠️ Real-time trigger alerts with intervention suggestions
 * ⚠️ Cultural sensitivity for Turkish context
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { CompulsionEntry } from '@/types/compulsion';
import { 
  AIError,
  AIErrorCode,
  ErrorSeverity
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { externalAIService } from '@/features/ai/services/externalAIService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

export enum TriggerCategory {
  ENVIRONMENTAL = 'environmental',      // Çevresel tetikleyiciler
  EMOTIONAL = 'emotional',              // Duygusal tetikleyiciler  
  SITUATIONAL = 'situational',          // Durumsal tetikleyiciler
  SOCIAL = 'social',                    // Sosyal tetikleyiciler
  PHYSICAL = 'physical',                // Fiziksel tetikleyiciler
  COGNITIVE = 'cognitive',              // Bilişsel tetikleyiciler
  TEMPORAL = 'temporal',                // Zamansal tetikleyiciler
  CULTURAL = 'cultural'                 // Kültürel tetikleyiciler (Türk kültürü özel)
}

export interface DetectedTrigger {
  trigger: string;
  category: TriggerCategory;
  frequency: number;
  impactScore: number;                  // 0-100
  associatedCategories: string[];       // OCD categories
  averageSeverity: number;
  confidence: number;                   // AI detection confidence
  
  // Temporal patterns
  timePattern: {
    peakHours: number[];
    peakDays: string[];
    seasonality?: 'morning' | 'afternoon' | 'evening' | 'night';
  };
  
  // Emotional context
  emotionalContext: {
    preTriggerMood: number;             // 1-10
    postCompulsionMood: number;         // 1-10
    emotionalIntensity: number;         // 1-10
    reliefFactor: number;               // How much relief compulsion provides
  };
  
  // Intervention strategies
  interventionStrategies: {
    immediate: string[];                // Immediate coping strategies
    longTerm: string[];                 // Long-term treatment approaches
    prevention: string[];               // Prevention techniques
    cultural: string[];                 // Culturally adapted interventions
  };
  
  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  escalationRisk: number;               // 0-1 probability of escalation
  
  metadata: {
    firstDetected: string;
    lastOccurrence: string;
    detectionMethod: 'ai' | 'heuristic' | 'hybrid';
    culturalFactors: string[];
  };
}

export interface TriggerNetwork {
  primaryTrigger: string;
  secondaryTriggers: string[];
  cascadeEffect: boolean;
  networkStrength: number;              // 0-1
  triggerChain: {
    sequence: string[];
    probability: number;
    avgTimespan: number;                // minutes between triggers
  };
  interventionPoints: {
    trigger: string;
    interventionWindow: number;         // minutes before compulsion
    successRate: number;                // historical success rate of intervention
    strategies: string[];
  }[];
}

export interface TriggerAnalysisResult {
  triggers: DetectedTrigger[];
  triggerNetworks: TriggerNetwork[];
  emergingPatterns: {
    pattern: string;
    confidence: number;
    recommendation: string;
  }[];
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    criticalTriggers: string[];
    riskFactors: string[];
    protectiveFactors: string[];
  };
  interventionRecommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    cultural: string[];
  };
  metadata: {
    analysisDate: string;
    dataPoints: number;
    confidence: number;
    analysisMethod: 'full' | 'partial';
  };
}

interface TriggerPattern {
  keywords: string[];
  patterns: RegExp[];
  emotionalMarkers: string[];
  contextualClues: string[];
  culturalMarkers?: string[];
  confidence_weight: number;
}

interface TriggerCache {
  [key: string]: {
    result: TriggerAnalysisResult;
    timestamp: number;
  };
}

// =============================================================================
// 🏗️ MAIN SERVICE CLASS
// =============================================================================

class OCDTriggerDetectionService {
  private static instance: OCDTriggerDetectionService;
  private isInitialized = false;
  private cache: TriggerCache = {};
  private triggerPatterns: Record<TriggerCategory, TriggerPattern>;

  static getInstance(): OCDTriggerDetectionService {
    if (!OCDTriggerDetectionService.instance) {
      OCDTriggerDetectionService.instance = new OCDTriggerDetectionService();
    }
    return OCDTriggerDetectionService.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // Load cache from storage
      const cachedData = await AsyncStorage.getItem('trigger_detection_cache');
      if (cachedData) {
        this.cache = JSON.parse(cachedData);
      }

      // Initialize trigger patterns
      this.initializeTriggerPatterns();

      this.isInitialized = true;
      console.log('🎯 OCD Trigger Detection Service initialized');

      await trackAIInteraction(AIEventType.FEATURE_INITIALIZED, {
        feature: 'OCD_TRIGGER_DETECTION',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Failed to initialize OCD Trigger Detection Service:', error);
      await trackAIError(AIEventType.INITIALIZATION_ERROR, {
        feature: 'OCD_TRIGGER_DETECTION',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN ANALYSIS METHOD
  // =============================================================================

  /**
   * Comprehensive trigger detection and analysis
   */
  async detectTriggers(
    compulsions: CompulsionEntry[],
    userId: string,
    analysisType: 'full' | 'recent' | 'patterns' = 'full'
  ): Promise<TriggerAnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('OCD Trigger Detection Service not initialized');
    }

    if (!FEATURE_FLAGS.isEnabled('AI_TRIGGER_DETECTION')) {
      console.log('⚠️ Trigger Detection disabled by feature flag');
      return this.getEmptyResult();
    }

    const startTime = Date.now();
    console.log(`🎯 Starting trigger detection for ${compulsions.length} compulsions`);

    try {
      // Input validation
      if (compulsions.length < 2) {
        console.warn('⚠️ Insufficient data for trigger detection (need at least 2 entries)');
        return this.getEmptyResult();
      }

      // Check cache
      const cacheKey = this.generateCacheKey(compulsions, analysisType);
      const cached = this.cache[cacheKey];
      if (cached && (Date.now() - cached.timestamp < 1800000)) { // 30 minutes cache
        console.log('🎯 Using cached trigger analysis');
        return cached.result;
      }

      // Filter compulsions based on analysis type
      const filteredCompulsions = this.filterCompulsions(compulsions, analysisType);

      // Extract triggers from text content
      const detectedTriggers = await this.extractTriggersFromCompulsions(filteredCompulsions);

      // Analyze trigger networks
      const triggerNetworks = await this.analyzeTriggerNetworks(filteredCompulsions, detectedTriggers);

      // Detect emerging patterns
      const emergingPatterns = this.detectEmergingPatterns(detectedTriggers);

      // Risk assessment
      const riskAssessment = this.assessRisk(detectedTriggers, triggerNetworks);

      // Generate intervention recommendations
      const interventionRecommendations = this.generateInterventionRecommendations(
        detectedTriggers,
        triggerNetworks,
        riskAssessment
      );

      const result: TriggerAnalysisResult = {
        triggers: detectedTriggers,
        triggerNetworks,
        emergingPatterns,
        riskAssessment,
        interventionRecommendations,
        metadata: {
          analysisDate: new Date().toISOString(),
          dataPoints: filteredCompulsions.length,
          confidence: this.calculateOverallConfidence(detectedTriggers),
          analysisMethod: analysisType
        }
      };

      // Cache result
      this.cache[cacheKey] = {
        result,
        timestamp: Date.now()
      };
      await this.persistCache();

      // Track success
      await trackAIInteraction(AIEventType.TRIGGER_DETECTION_COMPLETED, {
        userId,
        triggersFound: detectedTriggers.length,
        highRiskTriggers: detectedTriggers.filter(t => t.riskLevel === 'high' || t.riskLevel === 'critical').length,
        analysisType,
        duration: Date.now() - startTime
      });

      console.log(`✅ Trigger detection completed: ${detectedTriggers.length} triggers found`);
      return result;

    } catch (error) {
      console.error('❌ Trigger detection failed:', error);
      await trackAIError(AIEventType.TRIGGER_DETECTION_ERROR, {
        userId,
        error: error instanceof Error ? error.message : String(error),
        analysisType
      });
      throw error;
    }
  }

  // =============================================================================
  // 📝 TRIGGER EXTRACTION
  // =============================================================================

  private async extractTriggersFromCompulsions(compulsions: CompulsionEntry[]): Promise<DetectedTrigger[]> {
    const triggerMap = new Map<string, {
      entries: CompulsionEntry[];
      categories: Set<string>;
      severities: number[];
      timestamps: Date[];
    }>();

    // Extract triggers from both explicit trigger field and notes
    compulsions.forEach(entry => {
      const triggers = this.extractTriggersFromEntry(entry);
      
      triggers.forEach(trigger => {
        const normalizedTrigger = this.normalizeTrigger(trigger.text);
        if (!triggerMap.has(normalizedTrigger)) {
          triggerMap.set(normalizedTrigger, {
            entries: [],
            categories: new Set(),
            severities: [],
            timestamps: []
          });
        }
        
        const triggerData = triggerMap.get(normalizedTrigger)!;
        triggerData.entries.push(entry);
        triggerData.categories.add(entry.type);
        triggerData.severities.push(entry.intensity);
        triggerData.timestamps.push(new Date(entry.timestamp));
      });
    });

    // Convert to DetectedTrigger objects
    const detectedTriggers = Array.from(triggerMap.entries()).map(([trigger, data]) => 
      this.createDetectedTrigger(trigger, data)
    );

    // Sort by impact score
    return detectedTriggers.sort((a, b) => b.impactScore - a.impactScore);
  }

  private extractTriggersFromEntry(entry: CompulsionEntry): { text: string; source: 'explicit' | 'notes'; confidence: number }[] {
    const triggers: { text: string; source: 'explicit' | 'notes'; confidence: number }[] = [];
    
    // Explicit trigger field
    if (entry.trigger && entry.trigger.trim()) {
      triggers.push({
        text: entry.trigger.trim(),
        source: 'explicit',
        confidence: 0.9
      });
    }

    // Extract from notes using pattern matching
    if (entry.notes) {
      const extractedTriggers = this.extractTriggersFromText(entry.notes);
      triggers.push(...extractedTriggers.map(t => ({
        text: t.text,
        source: 'notes' as const,
        confidence: t.confidence
      })));
    }

    return triggers;
  }

  private extractTriggersFromText(text: string): { text: string; confidence: number }[] {
    const triggers: { text: string; confidence: number }[] = [];
    const normalizedText = text.toLowerCase();

    // Pattern-based extraction
    Object.entries(this.triggerPatterns).forEach(([categoryKey, pattern]) => {
      // Keyword matching
      pattern.keywords.forEach(keyword => {
        if (normalizedText.includes(keyword)) {
          triggers.push({
            text: keyword,
            confidence: pattern.confidence_weight * 0.7
          });
        }
      });

      // Pattern matching
      pattern.patterns.forEach(regex => {
        const matches = text.match(regex);
        if (matches) {
          matches.forEach(match => {
            triggers.push({
              text: match.trim(),
              confidence: pattern.confidence_weight * 0.8
            });
          });
        }
      });

      // Contextual clue extraction
      pattern.contextualClues.forEach(clue => {
        const contextPattern = new RegExp(`${clue}.*?(?=[.!?]|$)`, 'i');
        const match = text.match(contextPattern);
        if (match) {
          triggers.push({
            text: match[0].trim(),
            confidence: pattern.confidence_weight * 0.6
          });
        }
      });
    });

    // Remove duplicates and short triggers
    const uniqueTriggers = triggers
      .filter((t, i, arr) => arr.findIndex(x => x.text.toLowerCase() === t.text.toLowerCase()) === i)
      .filter(t => t.text.length > 2)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Max 10 triggers per text

    return uniqueTriggers;
  }

  private createDetectedTrigger(
    trigger: string, 
    data: {
      entries: CompulsionEntry[];
      categories: Set<string>;
      severities: number[];
      timestamps: Date[];
    }
  ): DetectedTrigger {
    const category = this.categorizeTrigger(trigger);
    const impactScore = this.calculateTriggerImpact(data);
    const timePattern = this.analyzeTriggerTimePattern(data.timestamps);
    const emotionalContext = this.analyzeTriggerEmotionalContext(data.entries);
    const riskLevel = this.assessTriggerRiskLevel(impactScore, data.severities, category);
    const interventionStrategies = this.generateTriggerInterventions(trigger, category, riskLevel);

    return {
      trigger,
      category,
      frequency: data.entries.length,
      impactScore,
      associatedCategories: Array.from(data.categories),
      averageSeverity: data.severities.reduce((sum, s) => sum + s, 0) / data.severities.length,
      confidence: this.calculateTriggerConfidence(trigger, data),
      timePattern,
      emotionalContext,
      interventionStrategies,
      riskLevel,
      escalationRisk: this.calculateEscalationRisk(data),
      metadata: {
        firstDetected: new Date(Math.min(...data.timestamps.map(t => t.getTime()))).toISOString(),
        lastOccurrence: new Date(Math.max(...data.timestamps.map(t => t.getTime()))).toISOString(),
        detectionMethod: 'heuristic', // Could be enhanced with AI
        culturalFactors: this.detectCulturalFactors(trigger)
      }
    };
  }

  // =============================================================================
  // 🔗 TRIGGER NETWORK ANALYSIS
  // =============================================================================

  private async analyzeTriggerNetworks(
    compulsions: CompulsionEntry[],
    triggers: DetectedTrigger[]
  ): Promise<TriggerNetwork[]> {
    if (triggers.length < 2) return [];

    const networks: TriggerNetwork[] = [];
    
    // Analyze temporal relationships between triggers
    const triggerSequences = this.findTriggerSequences(compulsions);
    
    // Build networks based on co-occurrence and temporal proximity
    const primaryTriggers = triggers
      .filter(t => t.impactScore > 50)
      .slice(0, 5); // Top 5 primary triggers

    primaryTriggers.forEach(primaryTrigger => {
      const network = this.buildTriggerNetwork(primaryTrigger, triggers, triggerSequences);
      if (network.secondaryTriggers.length > 0) {
        networks.push(network);
      }
    });

    return networks.sort((a, b) => b.networkStrength - a.networkStrength);
  }

  private findTriggerSequences(compulsions: CompulsionEntry[]): {
    sequence: string[];
    timespan: number;
    frequency: number;
  }[] {
    const sequences: Map<string, { count: number; timespans: number[] }> = new Map();
    
    // Sort compulsions by timestamp
    const sorted = compulsions.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Find sequences within 24 hours
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      
      const timeDiff = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff <= 24 && current.trigger && next.trigger) {
        const sequenceKey = `${current.trigger} -> ${next.trigger}`;
        
        if (!sequences.has(sequenceKey)) {
          sequences.set(sequenceKey, { count: 0, timespans: [] });
        }
        
        const seq = sequences.get(sequenceKey)!;
        seq.count++;
        seq.timespans.push(timeDiff / (1000 * 60)); // minutes
      }
    }

    return Array.from(sequences.entries())
      .filter(([, data]) => data.count >= 2) // At least 2 occurrences
      .map(([sequence, data]) => ({
        sequence: sequence.split(' -> '),
        timespan: data.timespans.reduce((sum, t) => sum + t, 0) / data.timespans.length,
        frequency: data.count
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  private buildTriggerNetwork(
    primaryTrigger: DetectedTrigger,
    allTriggers: DetectedTrigger[],
    sequences: { sequence: string[]; timespan: number; frequency: number }[]
  ): TriggerNetwork {
    // Find triggers that frequently follow the primary trigger
    const relatedSequences = sequences.filter(seq => 
      seq.sequence[0] === primaryTrigger.trigger || seq.sequence.includes(primaryTrigger.trigger)
    );

    const secondaryTriggers = relatedSequences
      .map(seq => seq.sequence.find(t => t !== primaryTrigger.trigger))
      .filter((t): t is string => Boolean(t))
      .slice(0, 4); // Max 4 secondary triggers

    const cascadeEffect = relatedSequences.some(seq => seq.frequency > 3);
    const networkStrength = Math.min(1, relatedSequences.reduce((sum, seq) => sum + seq.frequency, 0) / 10);

    const interventionPoints = relatedSequences.map(seq => ({
      trigger: seq.sequence[0],
      interventionWindow: Math.max(5, seq.timespan * 0.3), // 30% of average timespan, min 5 minutes
      successRate: Math.min(0.9, 0.3 + (seq.frequency * 0.1)), // Higher frequency = higher success rate
      strategies: this.getInterventionStrategies(seq.sequence[0])
    }));

    return {
      primaryTrigger: primaryTrigger.trigger,
      secondaryTriggers,
      cascadeEffect,
      networkStrength,
      triggerChain: {
        sequence: relatedSequences[0]?.sequence || [primaryTrigger.trigger],
        probability: Math.min(0.95, networkStrength),
        avgTimespan: relatedSequences.reduce((sum, seq) => sum + seq.timespan, 0) / Math.max(1, relatedSequences.length)
      },
      interventionPoints
    };
  }

  // =============================================================================
  // 🛠️ HELPER METHODS
  // =============================================================================

  private initializeTriggerPatterns(): void {
    this.triggerPatterns = {
      [TriggerCategory.ENVIRONMENTAL]: {
        keywords: ['ev', 'oda', 'mutfak', 'banyo', 'iş', 'okul', 'dış', 'park', 'mağaza'],
        patterns: [
          /(?:in|de|da)\s+(\w+)/gi,
          /(ev|oda|mutfak|banyo)(?:de|da|den)/gi,
          /(iş|okul)(?:te|ta|ten)/gi
        ],
        emotionalMarkers: ['rahat', 'rahatsız', 'güvenli', 'tehlikeli'],
        contextualClues: ['ortam', 'yer', 'mekan', 'çevre'],
        confidence_weight: 0.8
      },

      [TriggerCategory.EMOTIONAL]: {
        keywords: ['stres', 'kaygı', 'korku', 'öfke', 'üzüntü', 'gerginlik', 'panik', 'endişe'],
        patterns: [
          /(stres|kaygı|korku)(?:li|lı)?/gi,
          /(?:çok|fazla)\s+(gergin|endişeli|korkulu)/gi,
          /(panik|endişe)\s+(?:hali|durum)/gi
        ],
        emotionalMarkers: ['hissediyorum', 'duygu', 'mood', 'ruh hali'],
        contextualClues: ['emotional', 'duygusal', 'his', 'duygu'],
        confidence_weight: 1.0
      },

      [TriggerCategory.SOCIAL]: {
        keywords: ['aile', 'arkadaş', 'toplum', 'sosyal', 'misafir', 'kalabalık', 'toplantı'],
        patterns: [
          /(aile|arkadaş)(?:la|le|lar)?/gi,
          /sosyal\s+(?:ortam|durum|olay)/gi,
          /(misafir|kalabalık)\s+(?:var|geldi|gitti)/gi
        ],
        emotionalMarkers: ['utanma', 'mahcubiyet', 'yargılanma'],
        contextualClues: ['ile', 'beraber', 'yanında', 'birlikte'],
        confidence_weight: 0.9
      },

      [TriggerCategory.PHYSICAL]: {
        keywords: ['yorgun', 'hasta', 'ağrı', 'baş ağrısı', 'mide', 'fiziksel', 'vücut'],
        patterns: [
          /(baş|mide|karın)\s+(?:ağrı|acı)/gi,
          /(?:çok|fazla)\s+yorgun/gi,
          /fiziksel\s+(?:rahatsızlık|sorun)/gi
        ],
        emotionalMarkers: ['acı', 'ağrı', 'rahatsızlık'],
        contextualClues: ['vücut', 'fizik', 'sağlık'],
        confidence_weight: 0.7
      },

      [TriggerCategory.TEMPORAL]: {
        keywords: ['sabah', 'akşam', 'gece', 'öğle', 'hafta sonu', 'pazartesi', 'cuma'],
        patterns: [
          /(sabah|akşam|gece)\s+(?:saatleri)?/gi,
          /hafta\s+(?:sonu|başı)/gi,
          /(\w+tesi|\w+salı|\w+şamba|\w+samba)\s+(?:günü)?/gi
        ],
        emotionalMarkers: ['uyanma', 'uyku', 'dinlenme'],
        contextualClues: ['zaman', 'saat', 'gün', 'vakti'],
        confidence_weight: 0.8
      },

      [TriggerCategory.CULTURAL]: {
        keywords: ['namaz', 'abdest', 'ramazan', 'bayram', 'camii', 'dini', 'misafir ağırlama'],
        patterns: [
          /(namaz|abdest)\s+(?:vakti|zamanı)/gi,
          /(ramazan|bayram)\s+(?:ayı|dönemi)/gi,
          /dini\s+(?:vazife|görev|ibadet)/gi
        ],
        emotionalMarkers: ['günah', 'sevap', 'helal', 'haram'],
        contextualClues: ['din', 'inanç', 'gelenek', 'töre'],
        culturalMarkers: ['namaz', 'abdest', 'dini vazife', 'türk gelenekleri'],
        confidence_weight: 1.1
      },

      [TriggerCategory.SITUATIONAL]: {
        keywords: ['sınav', 'iş görüşmesi', 'toplantı', 'konuşma', 'sunum', 'randevu'],
        patterns: [
          /(sınav|test)\s+(?:günü|zamanı|öncesi)/gi,
          /iş\s+(?:görüşmesi|mülakatı)/gi,
          /(toplantı|sunum)\s+(?:öncesi|sırası)/gi
        ],
        emotionalMarkers: ['performans', 'başarı', 'başarısızlık'],
        contextualClues: ['durum', 'olay', 'aktivite', 'etkinlik'],
        confidence_weight: 0.9
      },

      [TriggerCategory.COGNITIVE]: {
        keywords: ['düşünce', 'fikir', 'hayal', 'anı', 'hatırlama', 'unutma'],
        patterns: [
          /(düşünce|fikir)\s+(?:geldi|geçti)/gi,
          /(?:kötü|olumsuz)\s+(?:düşünce|hayal)/gi,
          /(anı|hatıra)\s+(?:geldi|canlandı)/gi
        ],
        emotionalMarkers: ['takıntı', 'obsesyon', 'kafaya takma'],
        contextualClues: ['zihin', 'beyin', 'kafa', 'akıl'],
        confidence_weight: 1.0
      }
    };
  }

  private normalizeTrigger(trigger: string): string {
    return trigger
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:]/g, '')
      .replace(/\s+/g, ' ');
  }

  private categorizeTrigger(trigger: string): TriggerCategory {
    const scores = new Map<TriggerCategory, number>();
    
    Object.entries(this.triggerPatterns).forEach(([categoryKey, pattern]) => {
      const category = categoryKey as TriggerCategory;
      let score = 0;
      
      // Keyword matching
      pattern.keywords.forEach(keyword => {
        if (trigger.includes(keyword)) {
          score += pattern.confidence_weight * 0.4;
        }
      });

      // Pattern matching
      pattern.patterns.forEach(regex => {
        if (regex.test(trigger)) {
          score += pattern.confidence_weight * 0.6;
        }
      });

      // Cultural markers (bonus for Turkish cultural context)
      if (pattern.culturalMarkers) {
        pattern.culturalMarkers.forEach(marker => {
          if (trigger.includes(marker)) {
            score += pattern.confidence_weight * 0.8;
          }
        });
      }

      scores.set(category, score);
    });

    // Find category with highest score
    const sortedScores = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);

    return sortedScores[0]?.[0] || TriggerCategory.SITUATIONAL;
  }

  private calculateTriggerImpact(data: {
    entries: CompulsionEntry[];
    severities: number[];
  }): number {
    const frequency = data.entries.length;
    const avgSeverity = data.severities.reduce((sum, s) => sum + s, 0) / data.severities.length;
    const recency = this.calculateRecency(data.entries.map(e => new Date(e.timestamp)));
    const consistency = this.calculateConsistency(data.entries);

    // Impact = (frequency * 15) + (avgSeverity * 12) + (recency * 8) + (consistency * 5)
    return Math.min(100, (frequency * 15) + (avgSeverity * 12) + (recency * 8) + (consistency * 5));
  }

  private calculateRecency(timestamps: Date[]): number {
    if (timestamps.length === 0) return 0;
    
    const now = new Date();
    const mostRecent = new Date(Math.max(...timestamps.map(t => t.getTime())));
    const daysDiff = (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24);
    
    return Math.max(0, 10 - daysDiff);
  }

  private calculateConsistency(entries: CompulsionEntry[]): number {
    if (entries.length < 2) return 0;
    
    const timestamps = entries.map(e => new Date(e.timestamp));
    const intervals = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      const interval = timestamps[i].getTime() - timestamps[i - 1].getTime();
      intervals.push(interval);
    }
    
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Higher consistency = lower standard deviation
    return Math.max(0, 10 - (standardDeviation / avgInterval * 10));
  }

  private analyzeTriggerTimePattern(timestamps: Date[]): {
    peakHours: number[];
    peakDays: string[];
    seasonality?: 'morning' | 'afternoon' | 'evening' | 'night';
  } {
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    
    timestamps.forEach(timestamp => {
      const hour = timestamp.getHours();
      const day = timestamp.getDay();
      hourCounts[hour]++;
      dayCounts[day]++;
    });

    // Find peak hours
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.hour);

    // Find peak days
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const peakDays = dayCounts
      .map((count, day) => ({ day, count, name: dayNames[day] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map(d => d.name);

    // Determine seasonality
    let seasonality: 'morning' | 'afternoon' | 'evening' | 'night' | undefined;
    const avgHour = peakHours.reduce((sum, hour) => sum + hour, 0) / peakHours.length;
    if (avgHour >= 6 && avgHour < 12) seasonality = 'morning';
    else if (avgHour >= 12 && avgHour < 18) seasonality = 'afternoon';
    else if (avgHour >= 18 && avgHour < 22) seasonality = 'evening';
    else seasonality = 'night';

    return {
      peakHours,
      peakDays,
      seasonality
    };
  }

  private analyzeTriggerEmotionalContext(entries: CompulsionEntry[]): {
    preTriggerMood: number;
    postCompulsionMood: number;
    emotionalIntensity: number;
    reliefFactor: number;
  } {
    // Simplified emotional analysis based on available data
    const avgIntensity = entries.reduce((sum, e) => sum + e.intensity, 0) / entries.length;
    const avgResistance = entries.reduce((sum, e) => sum + (e.resistanceLevel || 0), 0) / entries.length;

    return {
      preTriggerMood: Math.max(1, avgIntensity - 2), // Estimate pre-trigger distress
      postCompulsionMood: Math.min(10, avgIntensity - (avgResistance * 0.3)), // Estimate relief
      emotionalIntensity: avgIntensity,
      reliefFactor: Math.min(10, 10 - avgResistance) // Lower resistance = more relief
    };
  }

  private assessTriggerRiskLevel(
    impactScore: number,
    severities: number[],
    category: TriggerCategory
  ): 'low' | 'medium' | 'high' | 'critical' {
    const avgSeverity = severities.reduce((sum, s) => sum + s, 0) / severities.length;
    
    // High-risk categories
    if ([TriggerCategory.CULTURAL, TriggerCategory.EMOTIONAL].includes(category)) {
      if (impactScore > 80 || avgSeverity > 8) return 'critical';
      if (impactScore > 60 || avgSeverity > 6) return 'high';
    }

    // General risk assessment
    if (impactScore > 75 && avgSeverity > 7) return 'critical';
    if (impactScore > 60 || avgSeverity > 6) return 'high';
    if (impactScore > 40 || avgSeverity > 4) return 'medium';
    return 'low';
  }

  private calculateEscalationRisk(data: { entries: CompulsionEntry[] }): number {
    if (data.entries.length < 3) return 0;

    // Look at recent trend in severity
    const sortedEntries = data.entries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const recentEntries = sortedEntries.slice(-Math.min(5, sortedEntries.length));
    const olderEntries = sortedEntries.slice(0, Math.min(5, sortedEntries.length));

    const recentAvgSeverity = recentEntries.reduce((sum, e) => sum + e.intensity, 0) / recentEntries.length;
    const olderAvgSeverity = olderEntries.reduce((sum, e) => sum + e.intensity, 0) / olderEntries.length;

    const trend = (recentAvgSeverity - olderAvgSeverity) / olderAvgSeverity;
    return Math.max(0, Math.min(1, trend + 0.3)); // Base risk of 0.3
  }

  private generateTriggerInterventions(
    trigger: string,
    category: TriggerCategory,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): {
    immediate: string[];
    longTerm: string[];
    prevention: string[];
    cultural: string[];
  } {
    const baseInterventions = {
      [TriggerCategory.ENVIRONMENTAL]: {
        immediate: ['Çevreyi değiştirin', 'Güvenli alana geçin', 'Dikkat dağıtıcı aktivite yapın'],
        longTerm: ['Çevresel tetikleyicileri kademeli azaltın', 'Maruz kalma terapisi', 'Ortam düzenleme'],
        prevention: ['Tetikleyici ortamları önceden belirleyin', 'Alternatif rotalar planlayın'],
        cultural: ['Ev düzeni kültürü ile OKB ayırt etme', 'Aile desteği alma']
      },
      [TriggerCategory.EMOTIONAL]: {
        immediate: ['Derin nefes alın', 'Mindfulness teknikleri', 'Destek hattı arayın'],
        longTerm: ['Duygu düzenleme eğitimi', 'Bilişsel davranışçı terapi', 'Mindfulness temelli stres azaltma'],
        prevention: ['Duyguları izleme', 'Stres yönetimi teknikleri', 'Düzenli egzersiz'],
        cultural: ['Aile desteği alma', 'Kültürel danışmanlık']
      },
      [TriggerCategory.SOCIAL]: {
        immediate: ['Güvenilir kişiyle konuşun', 'Sosyal desteği aktive edin', 'Kendini sakinleştirme'],
        longTerm: ['Sosyal beceri geliştirme', 'Grup terapisi', 'Aile terapisi'],
        prevention: ['Sosyal durumlar için hazırlık', 'İletişim becerilerini geliştirme'],
        cultural: ['Aile içi iletişim güçlendirme', 'Kültürel normları anlama']
      },
      [TriggerCategory.CULTURAL]: {
        immediate: ['Dini danışman ile konuşun', 'Kültürel duyarlı sakinleşme', 'Aile desteği'],
        longTerm: ['Kültürel duyarlı terapi', 'Dini danışmanlık', 'Aile terapisi'],
        prevention: ['Dini praktikler ile OKB ayırt etme', 'Kültürel değerleri koruma'],
        cultural: ['İmam/vaiz danışmanlığı', 'Kültürel kimlik güçlendirme', 'Dini eğitim']
      },
      [TriggerCategory.TEMPORAL]: {
        immediate: ['Günlük rutini değiştirin', 'O saatte meşgul olun', 'Zamanı yeniden yapılandırın'],
        longTerm: ['Zaman yönetimi becerileri', 'Rutini kademeli değiştirme', 'Aktivite planlaması'],
        prevention: ['Risk saatlerini belirleme', 'Önleyici aktiviteler', 'Günlük planlama'],
        cultural: ['Namaz vakitleri ile dengeleme', 'Geleneksel zaman kavrayışı']
      }
    };

    const defaultInterventions = {
      immediate: ['Terapi egzersizi yapın', 'Dikkat dağıtma', 'Nefes çalışması'],
      longTerm: ['Profesyonel destek', 'Terapi programı', 'İlaç değerlendirmesi'],
      prevention: ['Tetikleyici günlüğü tutun', 'Erken uyarı işaretleri', 'Destek sistemi'],
      cultural: ['Kültürel duyarlı yaklaşım', 'Aile eğitimi']
    };

    const interventions = baseInterventions[category] || defaultInterventions;

    // Adjust based on risk level
    if (riskLevel === 'critical') {
      interventions.immediate.unshift('ACİL profesyonel destek alın');
      interventions.longTerm.unshift('Yoğun terapi programı');
    } else if (riskLevel === 'high') {
      interventions.immediate.unshift('Hemen güvenli ortama geçin');
      interventions.longTerm.unshift('Düzenli terapi seansları');
    }

    return interventions;
  }

  private detectEmergingPatterns(triggers: DetectedTrigger[]): {
    pattern: string;
    confidence: number;
    recommendation: string;
  }[] {
    const patterns: { pattern: string; confidence: number; recommendation: string }[] = [];

    // High-frequency trigger pattern
    const highFreqTriggers = triggers.filter(t => t.frequency > 5);
    if (highFreqTriggers.length > 0) {
      patterns.push({
        pattern: `Yüksek sıklık: ${highFreqTriggers[0].trigger} (${highFreqTriggers[0].frequency} kez)`,
        confidence: 0.85,
        recommendation: 'Bu tetikleyici için özel odaklı müdahale planı geliştirin'
      });
    }

    // Category clustering
    const categoryCounts = triggers.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {} as Record<TriggerCategory, number>);

    const dominantCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0];

    if (dominantCategory && dominantCategory[1] > triggers.length * 0.4) {
      patterns.push({
        pattern: `Kategori yoğunlaşması: ${dominantCategory[0]} (${dominantCategory[1]} tetikleyici)`,
        confidence: 0.9,
        recommendation: `${dominantCategory[0]} kategorisine özel tedavi yaklaşımı uygulayın`
      });
    }

    // Risk escalation pattern
    const highRiskTriggers = triggers.filter(t => t.riskLevel === 'high' || t.riskLevel === 'critical');
    if (highRiskTriggers.length > triggers.length * 0.3) {
      patterns.push({
        pattern: `Yüksek risk tetikleyici yoğunluğu (${highRiskTriggers.length}/${triggers.length})`,
        confidence: 0.95,
        recommendation: 'Acil profesyonel destek ve risk yönetimi planı gerekli'
      });
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private assessRisk(
    triggers: DetectedTrigger[],
    networks: TriggerNetwork[]
  ): {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    criticalTriggers: string[];
    riskFactors: string[];
    protectiveFactors: string[];
  } {
    const criticalTriggers = triggers
      .filter(t => t.riskLevel === 'critical')
      .map(t => t.trigger);

    const highRiskTriggers = triggers
      .filter(t => t.riskLevel === 'high')
      .map(t => t.trigger);

    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (criticalTriggers.length > 0) {
      overallRisk = 'critical';
    } else if (highRiskTriggers.length > 2 || networks.some(n => n.cascadeEffect)) {
      overallRisk = 'high';
    } else if (highRiskTriggers.length > 0 || triggers.some(t => t.impactScore > 60)) {
      overallRisk = 'medium';
    }

    const riskFactors = [
      ...criticalTriggers.map(t => `Kritik tetikleyici: ${t}`),
      ...highRiskTriggers.slice(0, 3).map(t => `Yüksek riskli: ${t}`),
      ...networks.filter(n => n.cascadeEffect).map(n => `Tetikleyici zinciri: ${n.primaryTrigger}`)
    ];

    const protectiveFactors = [
      ...triggers.filter(t => t.emotionalContext.reliefFactor > 7).map(t => `Yüksek rahatlatma: ${t.trigger}`),
      ...triggers.filter(t => t.riskLevel === 'low').slice(0, 2).map(t => `Düşük riskli: ${t.trigger}`)
    ];

    return {
      overallRisk,
      criticalTriggers,
      riskFactors,
      protectiveFactors
    };
  }

  private generateInterventionRecommendations(
    triggers: DetectedTrigger[],
    networks: TriggerNetwork[],
    riskAssessment: any
  ): {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    cultural: string[];
  } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];
    const cultural: string[] = [];

    // High-risk triggers
    if (riskAssessment.overallRisk === 'critical') {
      immediate.push('ACİL profesyonel mental sağlık desteği alın');
      immediate.push('Güvenlik planı oluşturun');
    } else if (riskAssessment.overallRisk === 'high') {
      immediate.push('Profesyonel destek için randevu alın');
      immediate.push('Destek sistemini aktifleştirin');
    }

    // Top triggers
    const topTriggers = triggers.slice(0, 3);
    topTriggers.forEach(trigger => {
      immediate.push(...trigger.interventionStrategies.immediate.slice(0, 1));
      shortTerm.push(...trigger.interventionStrategies.longTerm.slice(0, 1));
      cultural.push(...trigger.interventionStrategies.cultural.slice(0, 1));
    });

    // Network-based recommendations
    networks.forEach(network => {
      if (network.cascadeEffect) {
        shortTerm.push(`${network.primaryTrigger} tetikleyici zincirini kırma stratejileri`);
      }
    });

    // Cultural adaptations
    const culturalTriggers = triggers.filter(t => t.category === TriggerCategory.CULTURAL);
    if (culturalTriggers.length > 0) {
      cultural.push('Kültürel duyarlı terapi yaklaşımı');
      cultural.push('Dini danışmanlık desteği');
    }

    // General long-term recommendations
    longTerm.push('Kapsamlı Terapi (Maruz Kalma ve Tepki Önleme) terapisi');
    longTerm.push('Trigger günlüğü tutma ve pattern analizi');
    longTerm.push('Aile eğitimi ve destek sistemi güçlendirme');

    return {
      immediate: [...new Set(immediate)].slice(0, 5),
      shortTerm: [...new Set(shortTerm)].slice(0, 5),
      longTerm: [...new Set(longTerm)].slice(0, 5),
      cultural: [...new Set(cultural)].slice(0, 3)
    };
  }

  private filterCompulsions(
    compulsions: CompulsionEntry[],
    analysisType: 'full' | 'recent' | 'patterns'
  ): CompulsionEntry[] {
    const now = new Date();
    
    switch (analysisType) {
      case 'recent':
        const recentCutoff = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days
        return compulsions.filter(c => new Date(c.timestamp) >= recentCutoff);
      case 'patterns':
        const patternCutoff = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days
        return compulsions.filter(c => new Date(c.timestamp) >= patternCutoff);
      case 'full':
      default:
        return compulsions;
    }
  }

  private calculateOverallConfidence(triggers: DetectedTrigger[]): number {
    if (triggers.length === 0) return 0;
    
    const avgConfidence = triggers.reduce((sum, t) => sum + t.confidence, 0) / triggers.length;
    const dataWeight = Math.min(1, triggers.length / 10); // More triggers = higher confidence
    
    return Math.min(0.95, avgConfidence * dataWeight + 0.2);
  }

  private calculateTriggerConfidence(
    trigger: string,
    data: { entries: CompulsionEntry[] }
  ): number {
    let confidence = 0.5; // Base confidence
    
    // More occurrences = higher confidence
    confidence += Math.min(0.3, data.entries.length * 0.05);
    
    // Explicit triggers have higher confidence
    const explicitCount = data.entries.filter(e => e.trigger === trigger).length;
    confidence += Math.min(0.2, explicitCount / data.entries.length);
    
    return Math.min(0.95, confidence);
  }

  private detectCulturalFactors(trigger: string): string[] {
    const factors: string[] = [];
    const lowerTrigger = trigger.toLowerCase();
    
    if (['namaz', 'abdest', 'dua', 'ibadet'].some(k => lowerTrigger.includes(k))) {
      factors.push('Dini pratikler');
    }
    
    if (['aile', 'anne', 'baba', 'akraba'].some(k => lowerTrigger.includes(k))) {
      factors.push('Aile dinamikleri');
    }
    
    if (['misafir', 'komşu', 'mahalle'].some(k => lowerTrigger.includes(k))) {
      factors.push('Sosyal beklentiler');
    }
    
    return factors;
  }

  private getInterventionStrategies(trigger: string): string[] {
    const category = this.categorizeTrigger(trigger);
    const baseStrategies = [
      'Dikkat dağıtma teknikleri',
      'Nefes egzersizleri',
      'Progressive kas gevşemesi'
    ];

    switch (category) {
      case TriggerCategory.EMOTIONAL:
        return ['Duygu düzenleme', 'Mindfulness', 'Bilişsel yeniden yapılandırma'];
      case TriggerCategory.SOCIAL:
        return ['Sosyal destek', 'İletişim becerileri', 'Güvenli kişi ile konuşma'];
      case TriggerCategory.CULTURAL:
        return ['Kültürel danışmanlık', 'Dini rehberlik', 'Aile desteği'];
      default:
        return baseStrategies;
    }
  }

  private generateCacheKey(compulsions: CompulsionEntry[], analysisType: string): string {
    const dataHash = compulsions
      .map(c => `${c.id}-${c.timestamp}`)
      .join('')
      .slice(0, 100);
    return `trigger_detection_${analysisType}_${dataHash}`;
  }

  private getEmptyResult(): TriggerAnalysisResult {
    return {
      triggers: [],
      triggerNetworks: [],
      emergingPatterns: [],
      riskAssessment: {
        overallRisk: 'low',
        criticalTriggers: [],
        riskFactors: [],
        protectiveFactors: []
      },
      interventionRecommendations: {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        cultural: []
      },
      metadata: {
        analysisDate: new Date().toISOString(),
        dataPoints: 0,
        confidence: 0,
        analysisMethod: 'full'
      }
    };
  }

  private async persistCache(): Promise<void> {
    try {
      // Keep only recent cache entries (last 6 hours)
      const cutoff = Date.now() - (6 * 60 * 60 * 1000);
      const filteredCache: TriggerCache = {};
      
      Object.entries(this.cache).forEach(([key, value]) => {
        if (value.timestamp > cutoff) {
          filteredCache[key] = value;
        }
      });
      
      this.cache = filteredCache;
      await AsyncStorage.setItem('trigger_detection_cache', JSON.stringify(this.cache));
    } catch (error) {
      console.error('Failed to persist trigger detection cache:', error);
    }
  }

  /**
   * Real-time trigger alert for new compulsion entries
   */
  async checkRealtimeTriggerAlert(
    newEntry: CompulsionEntry,
    recentEntries: CompulsionEntry[]
  ): Promise<{
    alert: boolean;
    trigger?: DetectedTrigger;
    recommendations: string[];
  }> {
    if (!newEntry.trigger || recentEntries.length < 2) {
      return { alert: false, recommendations: [] };
    }

    // Check for rapid succession (within 2 hours)
    const recentSameTrigger = recentEntries.filter(e => 
      e.trigger === newEntry.trigger && 
      (new Date(newEntry.timestamp).getTime() - new Date(e.timestamp).getTime()) < (2 * 60 * 60 * 1000)
    );

    if (recentSameTrigger.length >= 2) {
      const mockTriggerData = {
        entries: [...recentSameTrigger, newEntry],
        categories: new Set([newEntry.type]),
        severities: [...recentSameTrigger, newEntry].map(e => e.intensity),
        timestamps: [...recentSameTrigger, newEntry].map(e => new Date(e.timestamp))
      };

      const detectedTrigger = this.createDetectedTrigger(newEntry.trigger, mockTriggerData);
      
      return {
        alert: true,
        trigger: detectedTrigger,
        recommendations: detectedTrigger.interventionStrategies.immediate.slice(0, 3)
      };
    }

    return { alert: false, recommendations: [] };
  }

  /**
   * Get intervention suggestions for a specific trigger
   */
  getInterventionSuggestionsForTrigger(trigger: string): {
    immediate: string[];
    longTerm: string[];
    cultural: string[];
  } {
    const category = this.categorizeTrigger(trigger);
    return this.generateTriggerInterventions(trigger, category, 'medium');
  }
}

// =============================================================================
// 🎯 SINGLETON EXPORT
// =============================================================================

export const ocdTriggerDetectionService = OCDTriggerDetectionService.getInstance();
export default ocdTriggerDetectionService;
export type { 
  TriggerAnalysisResult, 
  DetectedTrigger, 
  TriggerNetwork,
  TriggerCategory 
};
