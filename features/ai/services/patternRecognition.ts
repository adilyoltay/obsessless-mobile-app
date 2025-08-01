/**
 * OKB Pattern Tanıma Servisi
 * 
 * KRITIK: Kullanıcı verilerini analiz ederek pattern'ler tespit eder
 * Privacy-first yaklaşım ile hassas veriler korunur
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  TherapeuticInsight,
  AIError,
  AIErrorCode
} from '@/features/ai/types';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';
import { logger } from '@/utils/logger';

// Pattern tipleri
export enum PatternType {
  TEMPORAL = 'temporal', // Zamansal pattern'ler
  TRIGGER = 'trigger', // Tetikleyici pattern'ler
  BEHAVIORAL = 'behavioral', // Davranışsal pattern'ler
  EMOTIONAL = 'emotional', // Duygusal pattern'ler
  COGNITIVE = 'cognitive', // Bilişsel pattern'ler
  SOCIAL = 'social', // Sosyal pattern'ler
  ENVIRONMENTAL = 'environmental' // Çevresel pattern'ler
}

// Pattern analiz sonucu
export interface PatternAnalysis {
  id: string;
  type: PatternType;
  name: string;
  description: string;
  confidence: number; // 0-1
  frequency: number; // Tekrarlanma sıklığı
  severity: number; // 1-10
  triggers: string[];
  manifestations: string[];
  timeline: PatternTimeline;
  insights: TherapeuticInsight[];
  recommendations: string[];
}

// Pattern zaman çizelgesi
export interface PatternTimeline {
  firstOccurrence: Date;
  lastOccurrence: Date;
  peakTimes: TimeWindow[];
  averageDuration: number; // dakika
  trend: 'increasing' | 'stable' | 'decreasing';
}

// Zaman penceresi
export interface TimeWindow {
  start: string; // "09:00"
  end: string; // "12:00"
  intensity: number; // 1-10
  dayOfWeek?: number[]; // 0-6 (Pazar-Cumartesi)
}

// Kompulsiyon verisi
export interface CompulsionData {
  id: string;
  type: string;
  timestamp: Date;
  duration: number;
  intensity: number;
  triggers: string[];
  location?: string;
  mood?: string;
  notes?: string;
}

// Pattern tespit kuralı
interface PatternRule {
  id: string;
  type: PatternType;
  name: string;
  detector: (data: CompulsionData[]) => PatternMatch | null;
  minDataPoints: number;
  confidenceThreshold: number;
}

// Pattern eşleşmesi
interface PatternMatch {
  confidence: number;
  evidence: string[];
  data: any;
}

class PatternRecognitionService {
  private static instance: PatternRecognitionService;
  private patternRules: PatternRule[] = [];
  private analysisCache: Map<string, PatternAnalysis> = new Map();
  
  private constructor() {
    this.initializeRules();
  }

  static getInstance(): PatternRecognitionService {
    if (!this.instance) {
      this.instance = new PatternRecognitionService();
    }
    return this.instance;
  }

  /**
   * Kompulsiyon verilerini analiz et
   */
  async analyzePatterns(
    data: CompulsionData[],
    userId: string
  ): Promise<PatternAnalysis[]> {
    if (!FEATURE_FLAGS.isEnabled('AI_INSIGHTS')) {
      return [];
    }

    logger.ai.info(`Analyzing patterns for user ${userId}`, {
      dataPoints: data.length
    });

    const patterns: PatternAnalysis[] = [];

    // Her kural için pattern tespiti yap
    for (const rule of this.patternRules) {
      if (data.length < rule.minDataPoints) {
        continue;
      }

      try {
        const match = rule.detector(data);
        
        if (match && match.confidence >= rule.confidenceThreshold) {
          const pattern = await this.createPatternAnalysis(
            rule,
            match,
            data
          );
          patterns.push(pattern);
        }
      } catch (error) {
        logger.ai.error(`Pattern detection failed for ${rule.name}`, error);
      }
    }

    // Pattern'leri öncelik sırasına göre sırala
    patterns.sort((a, b) => {
      // Önce severity, sonra confidence
      const severityDiff = b.severity - a.severity;
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    // Cache'e kaydet
    patterns.forEach(p => this.analysisCache.set(p.id, p));

    // Telemetri
    await trackAIInteraction(AIEventType.INSIGHT_GENERATED, {
      patterns_found: patterns.length,
      types: patterns.map(p => p.type)
    });

    return patterns;
  }

  /**
   * Belirli bir pattern'in detaylı analizini al
   */
  async getPatternDetails(patternId: string): Promise<PatternAnalysis | null> {
    return this.analysisCache.get(patternId) || null;
  }

  /**
   * Pattern trend analizi
   */
  async analyzeTrends(
    patterns: PatternAnalysis[],
    timeframe: number = 30 // gün
  ): Promise<TrendAnalysis> {
    const now = new Date();
    const startDate = new Date(now.getTime() - timeframe * 24 * 60 * 60 * 1000);

    // Trend hesaplama
    const overallTrend = this.calculateOverallTrend(patterns, startDate);
    const categoryTrends = this.calculateCategoryTrends(patterns);
    const predictions = this.generatePredictions(patterns, overallTrend);

    return {
      timeframe,
      overallTrend,
      categoryTrends,
      predictions,
      confidence: this.calculateTrendConfidence(patterns)
    };
  }

  /**
   * Kişiselleştirilmiş içgörüler üret
   */
  async generateInsights(
    patterns: PatternAnalysis[]
  ): Promise<TherapeuticInsight[]> {
    const insights: TherapeuticInsight[] = [];

    // En önemli pattern'ler için içgörü üret
    const topPatterns = patterns.slice(0, 5);

    for (const pattern of topPatterns) {
      // Pattern tipine göre içgörü oluştur
      const insight = this.createInsightForPattern(pattern);
      insights.push(insight);

      // İlişkili pattern'leri bul
      const relatedPatterns = this.findRelatedPatterns(pattern, patterns);
      if (relatedPatterns.length > 0) {
        insights.push(this.createRelationshipInsight(pattern, relatedPatterns));
      }
    }

    // Genel ilerleme içgörüsü
    if (patterns.length > 0) {
      insights.push(this.createProgressInsight(patterns));
    }

    return insights;
  }

  /**
   * Pattern kurallarını başlat
   */
  private initializeRules() {
    // Temporal pattern'ler
    this.patternRules.push({
      id: 'morning_spike',
      type: PatternType.TEMPORAL,
      name: 'Sabah Yoğunlaşması',
      minDataPoints: 10,
      confidenceThreshold: 0.7,
      detector: (data) => this.detectMorningSpike(data)
    });

    this.patternRules.push({
      id: 'evening_escalation',
      type: PatternType.TEMPORAL,
      name: 'Akşam Tırmanışı',
      minDataPoints: 10,
      confidenceThreshold: 0.7,
      detector: (data) => this.detectEveningEscalation(data)
    });

    // Trigger pattern'ler
    this.patternRules.push({
      id: 'stress_trigger',
      type: PatternType.TRIGGER,
      name: 'Stres Tetiklemesi',
      minDataPoints: 5,
      confidenceThreshold: 0.75,
      detector: (data) => this.detectStressTrigger(data)
    });

    this.patternRules.push({
      id: 'social_trigger',
      type: PatternType.TRIGGER,
      name: 'Sosyal Ortam Tetiklemesi',
      minDataPoints: 5,
      confidenceThreshold: 0.7,
      detector: (data) => this.detectSocialTrigger(data)
    });

    // Behavioral pattern'ler
    this.patternRules.push({
      id: 'ritual_chain',
      type: PatternType.BEHAVIORAL,
      name: 'Ritüel Zinciri',
      minDataPoints: 7,
      confidenceThreshold: 0.8,
      detector: (data) => this.detectRitualChain(data)
    });

    this.patternRules.push({
      id: 'avoidance_pattern',
      type: PatternType.BEHAVIORAL,
      name: 'Kaçınma Davranışı',
      minDataPoints: 5,
      confidenceThreshold: 0.75,
      detector: (data) => this.detectAvoidancePattern(data)
    });

    // Emotional pattern'ler
    this.patternRules.push({
      id: 'anxiety_spiral',
      type: PatternType.EMOTIONAL,
      name: 'Anksiyete Sarmalı',
      minDataPoints: 5,
      confidenceThreshold: 0.8,
      detector: (data) => this.detectAnxietySpiral(data)
    });

    // Cognitive pattern'ler
    this.patternRules.push({
      id: 'catastrophic_thinking',
      type: PatternType.COGNITIVE,
      name: 'Felaket Senaryoları',
      minDataPoints: 5,
      confidenceThreshold: 0.75,
      detector: (data) => this.detectCatastrophicThinking(data)
    });
  }

  // Pattern tespit metodları

  private detectMorningSpike(data: CompulsionData[]): PatternMatch | null {
    const morningData = data.filter(d => {
      const hour = new Date(d.timestamp).getHours();
      return hour >= 6 && hour <= 10;
    });

    if (morningData.length < 5) return null;

    const morningAverage = morningData.reduce((sum, d) => sum + d.intensity, 0) / morningData.length;
    const overallAverage = data.reduce((sum, d) => sum + d.intensity, 0) / data.length;

    if (morningAverage > overallAverage * 1.3) {
      return {
        confidence: Math.min(0.95, morningAverage / overallAverage),
        evidence: [
          `Sabah saatlerinde %${Math.round((morningAverage / overallAverage - 1) * 100)} daha yoğun`,
          `${morningData.length} sabah kaydı analiz edildi`
        ],
        data: {
          morningAverage,
          overallAverage,
          peakHour: this.findPeakHour(morningData)
        }
      };
    }

    return null;
  }

  private detectEveningEscalation(data: CompulsionData[]): PatternMatch | null {
    const eveningData = data.filter(d => {
      const hour = new Date(d.timestamp).getHours();
      return hour >= 18 && hour <= 23;
    });

    if (eveningData.length < 5) return null;

    // Yoğunluk artışını kontrol et
    const sortedByTime = eveningData.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let escalationCount = 0;
    for (let i = 1; i < sortedByTime.length; i++) {
      if (sortedByTime[i].intensity > sortedByTime[i - 1].intensity) {
        escalationCount++;
      }
    }

    const escalationRate = escalationCount / (sortedByTime.length - 1);
    
    if (escalationRate > 0.6) {
      return {
        confidence: escalationRate,
        evidence: [
          `Akşam saatlerinde %${Math.round(escalationRate * 100)} artış eğilimi`,
          `${eveningData.length} akşam kaydı analiz edildi`
        ],
        data: {
          escalationRate,
          averageIncrease: this.calculateAverageIncrease(sortedByTime)
        }
      };
    }

    return null;
  }

  private detectStressTrigger(data: CompulsionData[]): PatternMatch | null {
    const stressKeywords = ['stres', 'gergin', 'endişe', 'baskı', 'sınav', 'iş', 'toplantı'];
    
    const stressTriggered = data.filter(d => 
      d.triggers.some(t => 
        stressKeywords.some(keyword => t.toLowerCase().includes(keyword))
      ) ||
      (d.notes && stressKeywords.some(keyword => d.notes!.toLowerCase().includes(keyword)))
    );

    if (stressTriggered.length < 3) return null;

    const stressRate = stressTriggered.length / data.length;
    const avgStressIntensity = stressTriggered.reduce((sum, d) => sum + d.intensity, 0) / stressTriggered.length;
    const avgNormalIntensity = data.filter(d => !stressTriggered.includes(d))
      .reduce((sum, d, _, arr) => sum + d.intensity / arr.length, 0);

    if (stressRate > 0.3 && avgStressIntensity > avgNormalIntensity * 1.2) {
      return {
        confidence: Math.min(0.9, stressRate * (avgStressIntensity / avgNormalIntensity)),
        evidence: [
          `Kompulsiyonların %${Math.round(stressRate * 100)}'ü stres kaynaklı`,
          `Stresli durumlarda yoğunluk %${Math.round((avgStressIntensity / avgNormalIntensity - 1) * 100)} daha fazla`
        ],
        data: {
          stressRate,
          avgStressIntensity,
          commonStressTriggers: this.findCommonTriggers(stressTriggered)
        }
      };
    }

    return null;
  }

  private detectSocialTrigger(data: CompulsionData[]): PatternMatch | null {
    const socialKeywords = ['insanlar', 'topluluk', 'arkadaş', 'aile', 'misafir', 'dışarı', 'sosyal'];
    const socialLocations = ['restoran', 'kafe', 'alışveriş', 'toplantı', 'okul', 'iş'];

    const socialTriggered = data.filter(d => 
      d.triggers.some(t => 
        socialKeywords.some(keyword => t.toLowerCase().includes(keyword))
      ) ||
      (d.location && socialLocations.some(loc => d.location!.toLowerCase().includes(loc)))
    );

    if (socialTriggered.length < 3) return null;

    const socialRate = socialTriggered.length / data.length;
    
    if (socialRate > 0.25) {
      return {
        confidence: Math.min(0.85, socialRate * 2),
        evidence: [
          `Kompulsiyonların %${Math.round(socialRate * 100)}'ü sosyal ortamlarda`,
          `${socialTriggered.length} sosyal tetikleyici tespit edildi`
        ],
        data: {
          socialRate,
          commonLocations: this.findCommonLocations(socialTriggered),
          averageIntensity: socialTriggered.reduce((sum, d) => sum + d.intensity, 0) / socialTriggered.length
        }
      };
    }

    return null;
  }

  private detectRitualChain(data: CompulsionData[]): PatternMatch | null {
    // Zaman olarak yakın kompulsiyonları grupla
    const chains: CompulsionData[][] = [];
    const sorted = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentChain: CompulsionData[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const timeDiff = new Date(sorted[i].timestamp).getTime() - 
                      new Date(sorted[i - 1].timestamp).getTime();
      
      if (timeDiff < 30 * 60 * 1000) { // 30 dakika içinde
        currentChain.push(sorted[i]);
      } else {
        if (currentChain.length >= 3) {
          chains.push([...currentChain]);
        }
        currentChain = [sorted[i]];
      }
    }
    
    if (currentChain.length >= 3) {
      chains.push(currentChain);
    }

    if (chains.length === 0) return null;

    const avgChainLength = chains.reduce((sum, chain) => sum + chain.length, 0) / chains.length;
    
    if (avgChainLength >= 3) {
      return {
        confidence: Math.min(0.9, avgChainLength / 5),
        evidence: [
          `Ortalama ${Math.round(avgChainLength)} ardışık kompulsiyon`,
          `${chains.length} ritüel zinciri tespit edildi`
        ],
        data: {
          chainCount: chains.length,
          avgChainLength,
          longestChain: Math.max(...chains.map(c => c.length)),
          commonSequences: this.findCommonSequences(chains)
        }
      };
    }

    return null;
  }

  private detectAvoidancePattern(data: CompulsionData[]): PatternMatch | null {
    // Belirli konumlardan veya durumlardan kaçınma
    const locationCounts = new Map<string, number>();
    
    data.forEach(d => {
      if (d.location) {
        locationCounts.set(d.location, (locationCounts.get(d.location) || 0) + 1);
      }
    });

    // Az gidilen yerler
    const avoidedLocations = Array.from(locationCounts.entries())
      .filter(([_, count]) => count <= 2)
      .map(([location, _]) => location);

    if (avoidedLocations.length < 3) return null;

    // Notlarda kaçınma ifadeleri
    const avoidanceKeywords = ['gitmek istemiyorum', 'kaçınıyorum', 'uzak duruyorum', 'yapamıyorum'];
    const avoidanceNotes = data.filter(d => 
      d.notes && avoidanceKeywords.some(keyword => d.notes!.toLowerCase().includes(keyword))
    );

    if (avoidanceNotes.length >= 2) {
      return {
        confidence: 0.8,
        evidence: [
          `${avoidedLocations.length} lokasyondan kaçınma`,
          `${avoidanceNotes.length} kaçınma ifadesi`
        ],
        data: {
          avoidedLocations,
          avoidanceExpressions: avoidanceNotes.map(d => d.notes).filter(Boolean)
        }
      };
    }

    return null;
  }

  private detectAnxietySpiral(data: CompulsionData[]): PatternMatch | null {
    // Artan yoğunluk ve süre pattern'i
    const anxietyKeywords = ['panik', 'korku', 'endişe', 'kaygı', 'tedirgin'];
    
    const anxietyData = data.filter(d => 
      (d.mood && anxietyKeywords.some(keyword => d.mood!.toLowerCase().includes(keyword))) ||
      (d.notes && anxietyKeywords.some(keyword => d.notes!.toLowerCase().includes(keyword)))
    );

    if (anxietyData.length < 3) return null;

    // Yoğunluk artışını kontrol et
    const sorted = anxietyData.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let spiralCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].intensity > sorted[i - 1].intensity && 
          sorted[i].duration > sorted[i - 1].duration) {
        spiralCount++;
      }
    }

    const spiralRate = spiralCount / (sorted.length - 1);
    
    if (spiralRate > 0.5) {
      return {
        confidence: spiralRate,
        evidence: [
          `Anksiyete durumlarında %${Math.round(spiralRate * 100)} artış spirali`,
          `${anxietyData.length} anksiyete episodu`
        ],
        data: {
          spiralRate,
          avgIntensityIncrease: this.calculateAverageIncrease(sorted),
          peakIntensity: Math.max(...sorted.map(d => d.intensity))
        }
      };
    }

    return null;
  }

  private detectCatastrophicThinking(data: CompulsionData[]): PatternMatch | null {
    const catastrophicKeywords = [
      'felaket', 'korkunç', 'mahvoldum', 'öleceğim', 'hasta', 
      'tehlike', 'kötü şey', 'başıma gelecek'
    ];

    const catastrophicData = data.filter(d => 
      d.triggers.some(t => 
        catastrophicKeywords.some(keyword => t.toLowerCase().includes(keyword))
      ) ||
      (d.notes && catastrophicKeywords.some(keyword => d.notes!.toLowerCase().includes(keyword)))
    );

    if (catastrophicData.length < 3) return null;

    const catastrophicRate = catastrophicData.length / data.length;
    const avgIntensity = catastrophicData.reduce((sum, d) => sum + d.intensity, 0) / catastrophicData.length;

    if (catastrophicRate > 0.2 && avgIntensity > 6) {
      return {
        confidence: Math.min(0.85, catastrophicRate * (avgIntensity / 10)),
        evidence: [
          `Kompulsiyonların %${Math.round(catastrophicRate * 100)}'ünde felaket düşünceleri`,
          `Ortalama yoğunluk: ${avgIntensity.toFixed(1)}/10`
        ],
        data: {
          catastrophicRate,
          avgIntensity,
          commonThoughts: this.extractCommonThoughts(catastrophicData)
        }
      };
    }

    return null;
  }

  // Yardımcı metodlar

  private createPatternAnalysis(
    rule: PatternRule,
    match: PatternMatch,
    data: CompulsionData[]
  ): PatternAnalysis {
    const relevantData = this.filterRelevantData(data, rule, match);
    const timeline = this.createTimeline(relevantData);
    const severity = this.calculateSeverity(relevantData, match);

    return {
      id: `pattern_${rule.id}_${Date.now()}`,
      type: rule.type,
      name: rule.name,
      description: this.generateDescription(rule, match),
      confidence: match.confidence,
      frequency: relevantData.length,
      severity,
      triggers: this.extractTriggers(relevantData),
      manifestations: this.extractManifestations(relevantData),
      timeline,
      insights: this.generatePatternInsights(rule, match, timeline),
      recommendations: this.generateRecommendations(rule, match, severity)
    };
  }

  private filterRelevantData(
    data: CompulsionData[],
    rule: PatternRule,
    match: PatternMatch
  ): CompulsionData[] {
    // Rule tipine göre ilgili veriyi filtrele
    switch (rule.type) {
      case PatternType.TEMPORAL:
        return data; // Tüm veri ilgili
      case PatternType.TRIGGER:
        // Match'teki trigger'lara sahip veriler
        return data.filter(d => 
          d.triggers.some(t => match.data.commonTriggers?.includes(t))
        );
      default:
        return data;
    }
  }

  private createTimeline(data: CompulsionData[]): PatternTimeline {
    if (data.length === 0) {
      return {
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        peakTimes: [],
        averageDuration: 0,
        trend: 'stable'
      };
    }

    const sorted = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      firstOccurrence: new Date(sorted[0].timestamp),
      lastOccurrence: new Date(sorted[sorted.length - 1].timestamp),
      peakTimes: this.findPeakTimes(data),
      averageDuration: data.reduce((sum, d) => sum + d.duration, 0) / data.length,
      trend: this.calculateTrend(data)
    };
  }

  private findPeakTimes(data: CompulsionData[]): TimeWindow[] {
    const hourCounts = new Map<number, { count: number; totalIntensity: number }>();
    
    data.forEach(d => {
      const hour = new Date(d.timestamp).getHours();
      const current = hourCounts.get(hour) || { count: 0, totalIntensity: 0 };
      hourCounts.set(hour, {
        count: current.count + 1,
        totalIntensity: current.totalIntensity + d.intensity
      });
    });

    // En yoğun 3 saat dilimini bul
    const peaks = Array.from(hourCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([hour, stats]) => ({
        start: `${hour.toString().padStart(2, '0')}:00`,
        end: `${((hour + 1) % 24).toString().padStart(2, '0')}:00`,
        intensity: Math.round(stats.totalIntensity / stats.count)
      }));

    return peaks;
  }

  private calculateTrend(data: CompulsionData[]): 'increasing' | 'stable' | 'decreasing' {
    if (data.length < 5) return 'stable';

    const sorted = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

    const firstAvg = firstHalf.reduce((sum, d) => sum + d.intensity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.intensity, 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.2) return 'increasing';
    if (secondAvg < firstAvg * 0.8) return 'decreasing';
    return 'stable';
  }

  private calculateSeverity(data: CompulsionData[], match: PatternMatch): number {
    const avgIntensity = data.reduce((sum, d) => sum + d.intensity, 0) / data.length;
    const frequency = data.length;
    const confidence = match.confidence;

    // Weighted severity calculation
    const severity = (avgIntensity * 0.4) + 
                    (Math.min(frequency / 10, 1) * 3) + 
                    (confidence * 3);

    return Math.round(Math.min(10, severity));
  }

  private generateDescription(rule: PatternRule, match: PatternMatch): string {
    const descriptions = {
      [PatternType.TEMPORAL]: `Belirli zaman dilimlerinde tekrarlayan bir pattern tespit edildi. ${match.evidence[0]}`,
      [PatternType.TRIGGER]: `Spesifik tetikleyicilerle ilişkili bir pattern bulundu. ${match.evidence[0]}`,
      [PatternType.BEHAVIORAL]: `Davranışsal bir pattern zinciri gözlemlendi. ${match.evidence[0]}`,
      [PatternType.EMOTIONAL]: `Duygusal durumlarla bağlantılı bir pattern tespit edildi. ${match.evidence[0]}`,
      [PatternType.COGNITIVE]: `Düşünce kalıplarıyla ilişkili bir pattern bulundu. ${match.evidence[0]}`,
      [PatternType.SOCIAL]: `Sosyal durumlarla ilgili bir pattern gözlemlendi. ${match.evidence[0]}`,
      [PatternType.ENVIRONMENTAL]: `Çevresel faktörlerle bağlantılı bir pattern tespit edildi. ${match.evidence[0]}`
    };

    return descriptions[rule.type] || 'Pattern tespit edildi.';
  }

  private extractTriggers(data: CompulsionData[]): string[] {
    const triggerCounts = new Map<string, number>();
    
    data.forEach(d => {
      d.triggers.forEach(trigger => {
        triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
      });
    });

    return Array.from(triggerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trigger, _]) => trigger);
  }

  private extractManifestations(data: CompulsionData[]): string[] {
    const typeCounts = new Map<string, number>();
    
    data.forEach(d => {
      typeCounts.set(d.type, (typeCounts.get(d.type) || 0) + 1);
    });

    return Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type} (${count} kez)`);
  }

  private generatePatternInsights(
    rule: PatternRule,
    match: PatternMatch,
    timeline: PatternTimeline
  ): TherapeuticInsight[] {
    const insights: TherapeuticInsight[] = [];

    // Pattern tipine göre içgörü
    insights.push({
      type: 'pattern',
      content: this.getPatternSpecificInsight(rule, match),
      confidence: match.confidence,
      clinicalRelevance: 0.8
    });

    // Trend içgörüsü
    if (timeline.trend !== 'stable') {
      insights.push({
        type: 'progress',
        content: timeline.trend === 'decreasing' 
          ? 'Bu pattern\'in sıklığı azalıyor, bu harika bir gelişme!'
          : 'Bu pattern\'in sıklığı artıyor, müdahale stratejileri geliştirmeliyiz.',
        confidence: 0.7,
        clinicalRelevance: 0.9
      });
    }

    return insights;
  }

  private getPatternSpecificInsight(rule: PatternRule, match: PatternMatch): string {
    const insights = {
      'morning_spike': 'Sabah saatlerinde OKB belirtileriniz artıyor. Bu, uyku kalitesi veya sabah rutininizle ilgili olabilir.',
      'evening_escalation': 'Akşam saatlerinde belirtileriniz tırmanıyor. Günün stresi birikmiş olabilir.',
      'stress_trigger': 'Stres, OKB belirtilerinizi tetikleyen ana faktörlerden biri görünüyor.',
      'social_trigger': 'Sosyal ortamlar sizin için zorlayıcı olabiliyor. Sosyal anksiyete de eşlik ediyor olabilir.',
      'ritual_chain': 'Kompulsiyonlarınız zincirleme ritüeller oluşturuyor. Bir ritüeli kırmak diğerlerini de etkileyebilir.',
      'avoidance_pattern': 'Belirli durumlardan kaçınma davranışı gösteriyorsunuz. Bu kısa vadede rahatlama sağlasa da uzun vadede OKB\'yi güçlendirir.',
      'anxiety_spiral': 'Anksiyeteniz arttıkça kompulsiyonlarınız da artıyor. Anksiyete yönetimi önemli olacaktır.',
      'catastrophic_thinking': 'Felaket senaryoları düşünme eğiliminiz var. Bilişsel yeniden yapılandırma teknikleri faydalı olabilir.'
    };

    return insights[rule.id] || 'Bu pattern hakkında daha fazla veri toplandıkça daha spesifik içgörüler sunabileceğiz.';
  }

  private generateRecommendations(
    rule: PatternRule,
    match: PatternMatch,
    severity: number
  ): string[] {
    const baseRecommendations = this.getBaseRecommendations(rule);
    const severityRecommendations = this.getSeverityRecommendations(severity);
    
    return [...baseRecommendations, ...severityRecommendations];
  }

  private getBaseRecommendations(rule: PatternRule): string[] {
    const recommendations = {
      [PatternType.TEMPORAL]: [
        'Bu zaman dilimlerinde alternatif aktiviteler planlayın',
        'Tetikleyici saatlerde mindfulness egzersizleri yapın'
      ],
      [PatternType.TRIGGER]: [
        'Tetikleyicileri tanıyın ve hazırlıklı olun',
        'Tetikleyici durumlar için başa çıkma stratejileri geliştirin'
      ],
      [PatternType.BEHAVIORAL]: [
        'Ritüel zincirlerini kırmak için ara verme teknikleri kullanın',
        'Davranış zincirini başlatan ilk adımı engellemeye odaklanın'
      ],
      [PatternType.EMOTIONAL]: [
        'Duygu düzenleme tekniklerini öğrenin',
        'Duygusal tetikleyiciler için alternatif tepkiler geliştirin'
      ],
      [PatternType.COGNITIVE]: [
        'Düşünce kayıtları tutun',
        'Bilişsel çarpıtmaları tanımayı öğrenin'
      ],
      [PatternType.SOCIAL]: [
        'Sosyal durumlar için kademeli maruz bırakma planı yapın',
        'Sosyal destek ağınızı güçlendirin'
      ],
      [PatternType.ENVIRONMENTAL]: [
        'Çevresel tetikleyicileri minimize edin',
        'Güvenli alanlar oluşturun'
      ]
    };

    return recommendations[rule.type] || [];
  }

  private getSeverityRecommendations(severity: number): string[] {
    if (severity >= 8) {
      return [
        'Bu pattern için profesyonel destek almanızı öneriyoruz',
        'Acil müdahale planı oluşturun'
      ];
    } else if (severity >= 5) {
      return [
        'Bu pattern\'e odaklı çalışma yapmanız önemli',
        'Günlük takip ve müdahale rutini oluşturun'
      ];
    } else {
      return [
        'Bu pattern\'i gözlemlemeye devam edin',
        'Önleyici stratejiler uygulayın'
      ];
    }
  }

  // Trend analizi metodları

  private calculateOverallTrend(
    patterns: PatternAnalysis[],
    startDate: Date
  ): TrendDirection {
    const recentPatterns = patterns.filter(p => 
      p.timeline.lastOccurrence >= startDate
    );

    if (recentPatterns.length === 0) return 'stable';

    const trendCounts = {
      increasing: 0,
      stable: 0,
      decreasing: 0
    };

    recentPatterns.forEach(p => {
      trendCounts[p.timeline.trend]++;
    });

    if (trendCounts.increasing > trendCounts.decreasing * 1.5) return 'worsening';
    if (trendCounts.decreasing > trendCounts.increasing * 1.5) return 'improving';
    return 'stable';
  }

  private calculateCategoryTrends(patterns: PatternAnalysis[]): CategoryTrend[] {
    const categoryGroups = new Map<PatternType, PatternAnalysis[]>();
    
    patterns.forEach(p => {
      const group = categoryGroups.get(p.type) || [];
      group.push(p);
      categoryGroups.set(p.type, group);
    });

    return Array.from(categoryGroups.entries()).map(([type, patterns]) => ({
      category: type,
      trend: this.calculateGroupTrend(patterns),
      patternCount: patterns.length,
      avgSeverity: patterns.reduce((sum, p) => sum + p.severity, 0) / patterns.length
    }));
  }

  private calculateGroupTrend(patterns: PatternAnalysis[]): TrendDirection {
    const avgTrend = patterns.reduce((sum, p) => {
      switch (p.timeline.trend) {
        case 'increasing': return sum + 1;
        case 'decreasing': return sum - 1;
        default: return sum;
      }
    }, 0) / patterns.length;

    if (avgTrend > 0.3) return 'worsening';
    if (avgTrend < -0.3) return 'improving';
    return 'stable';
  }

  private generatePredictions(
    patterns: PatternAnalysis[],
    trend: TrendDirection
  ): TrendPrediction[] {
    const predictions: TrendPrediction[] = [];

    // Genel tahmin
    predictions.push({
      timeframe: 'next_week',
      prediction: trend === 'improving' 
        ? 'Mevcut ilerlemeniz devam ederse, önümüzdeki hafta belirtilerinizde azalma görebilirsiniz.'
        : trend === 'worsening'
        ? 'Mevcut trend devam ederse, önümüzdeki hafta zorlayıcı olabilir. Önleyici tedbirler alın.'
        : 'Belirtileriniz stabil görünüyor. Mevcut stratejilerinize devam edin.',
      confidence: 0.7,
      recommendations: this.getPredictionRecommendations(trend)
    });

    // Pattern bazlı tahminler
    const highSeverityPatterns = patterns.filter(p => p.severity >= 7);
    if (highSeverityPatterns.length > 0) {
      predictions.push({
        timeframe: 'next_month',
        prediction: 'Yüksek şiddetli pattern\'ler tespit edildi. Bunlara odaklanmazsak, genel durumunuz etkilenebilir.',
        confidence: 0.8,
        recommendations: [
          'Yüksek şiddetli pattern\'ler için eylem planı oluşturun',
          'Profesyonel destek almayı düşünün'
        ]
      });
    }

    return predictions;
  }

  private getPredictionRecommendations(trend: TrendDirection): string[] {
    switch (trend) {
      case 'improving':
        return [
          'Mevcut stratejilerinize devam edin',
          'Başarılarınızı kutlayın ve motivasyonunuzu koruyun',
          'Relapse önleme planı hazırlayın'
        ];
      case 'worsening':
        return [
          'Stres faktörlerini gözden geçirin',
          'Destek sisteminizi aktive edin',
          'Terapi seanslarınızın sıklığını artırmayı düşünün'
        ];
      default:
        return [
          'Düzenli takibe devam edin',
          'Yeni başa çıkma teknikleri deneyin',
          'Tetikleyicilere karşı uyanık olun'
        ];
    }
  }

  private calculateTrendConfidence(patterns: PatternAnalysis[]): number {
    if (patterns.length < 5) return 0.3;
    if (patterns.length < 10) return 0.5;
    if (patterns.length < 20) return 0.7;
    return 0.9;
  }

  // İçgörü üretme metodları

  private createInsightForPattern(pattern: PatternAnalysis): TherapeuticInsight {
    return {
      type: 'pattern',
      content: `${pattern.name}: ${pattern.description}`,
      confidence: pattern.confidence,
      clinicalRelevance: pattern.severity / 10,
      timestamp: new Date()
    };
  }

  private findRelatedPatterns(
    pattern: PatternAnalysis,
    allPatterns: PatternAnalysis[]
  ): PatternAnalysis[] {
    return allPatterns.filter(p => 
      p.id !== pattern.id &&
      (
        // Ortak tetikleyiciler
        p.triggers.some(t => pattern.triggers.includes(t)) ||
        // Yakın zaman dilimleri
        this.hasTimeOverlap(p.timeline.peakTimes, pattern.timeline.peakTimes)
      )
    );
  }

  private hasTimeOverlap(times1: TimeWindow[], times2: TimeWindow[]): boolean {
    return times1.some(t1 => 
      times2.some(t2 => {
        const start1 = parseInt(t1.start.split(':')[0]);
        const start2 = parseInt(t2.start.split(':')[0]);
        return Math.abs(start1 - start2) <= 2;
      })
    );
  }

  private createRelationshipInsight(
    pattern: PatternAnalysis,
    related: PatternAnalysis[]
  ): TherapeuticInsight {
    const relatedNames = related.map(p => p.name).join(', ');
    return {
      type: 'pattern',
      content: `${pattern.name} pattern'i şu pattern'lerle ilişkili görünüyor: ${relatedNames}. Bunları birlikte ele almak daha etkili olabilir.`,
      confidence: 0.75,
      clinicalRelevance: 0.85,
      timestamp: new Date()
    };
  }

  private createProgressInsight(patterns: PatternAnalysis[]): TherapeuticInsight {
    const avgSeverity = patterns.reduce((sum, p) => sum + p.severity, 0) / patterns.length;
    const improvingCount = patterns.filter(p => p.timeline.trend === 'decreasing').length;
    const worseningCount = patterns.filter(p => p.timeline.trend === 'increasing').length;

    let content: string;
    let clinicalRelevance: number;

    if (improvingCount > worseningCount) {
      content = `${improvingCount} pattern'de iyileşme görülüyor! Çabalarınız sonuç veriyor.`;
      clinicalRelevance = 0.9;
    } else if (worseningCount > improvingCount) {
      content = `${worseningCount} pattern'de artış var. Stratejilerinizi gözden geçirmenin zamanı olabilir.`;
      clinicalRelevance = 0.95;
    } else {
      content = `Pattern'leriniz genel olarak stabil. Küçük değişikliklerle ilerleme sağlayabilirsiniz.`;
      clinicalRelevance = 0.7;
    }

    return {
      type: 'progress',
      content,
      confidence: 0.8,
      clinicalRelevance,
      timestamp: new Date()
    };
  }

  // Utility metodlar

  private findPeakHour(data: CompulsionData[]): number {
    const hourCounts = new Map<number, number>();
    
    data.forEach(d => {
      const hour = new Date(d.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    let maxHour = 0;
    let maxCount = 0;
    
    hourCounts.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        maxHour = hour;
      }
    });

    return maxHour;
  }

  private calculateAverageIncrease(sortedData: CompulsionData[]): number {
    if (sortedData.length < 2) return 0;

    let totalIncrease = 0;
    let increaseCount = 0;

    for (let i = 1; i < sortedData.length; i++) {
      const diff = sortedData[i].intensity - sortedData[i - 1].intensity;
      if (diff > 0) {
        totalIncrease += diff;
        increaseCount++;
      }
    }

    return increaseCount > 0 ? totalIncrease / increaseCount : 0;
  }

  private findCommonTriggers(data: CompulsionData[]): string[] {
    const triggerCounts = new Map<string, number>();
    
    data.forEach(d => {
      d.triggers.forEach(trigger => {
        triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
      });
    });

    return Array.from(triggerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([trigger, _]) => trigger);
  }

  private findCommonLocations(data: CompulsionData[]): string[] {
    const locationCounts = new Map<string, number>();
    
    data.forEach(d => {
      if (d.location) {
        locationCounts.set(d.location, (locationCounts.get(d.location) || 0) + 1);
      }
    });

    return Array.from(locationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([location, _]) => location);
  }

  private findCommonSequences(chains: CompulsionData[][]): string[] {
    const sequenceCounts = new Map<string, number>();
    
    chains.forEach(chain => {
      const sequence = chain.map(c => c.type).join(' → ');
      sequenceCounts.set(sequence, (sequenceCounts.get(sequence) || 0) + 1);
    });

    return Array.from(sequenceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sequence, count]) => `${sequence} (${count} kez)`);
  }

  private extractCommonThoughts(data: CompulsionData[]): string[] {
    const thoughts: string[] = [];
    
    data.forEach(d => {
      if (d.notes) {
        // Basit cümle çıkarma - gerçek uygulamada NLP kullanılmalı
        const sentences = d.notes.split(/[.!?]+/).filter(s => s.trim().length > 10);
        thoughts.push(...sentences);
      }
    });

    // En sık geçen kelimeleri bul
    const wordCounts = new Map<string, number>();
    thoughts.forEach(thought => {
      thought.toLowerCase().split(/\s+/).forEach(word => {
        if (word.length > 4) { // Kısa kelimeleri atla
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      });
    });

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, _]) => word);
  }
}

// Types
interface TrendAnalysis {
  timeframe: number;
  overallTrend: TrendDirection;
  categoryTrends: CategoryTrend[];
  predictions: TrendPrediction[];
  confidence: number;
}

type TrendDirection = 'improving' | 'stable' | 'worsening';

interface CategoryTrend {
  category: PatternType;
  trend: TrendDirection;
  patternCount: number;
  avgSeverity: number;
}

interface TrendPrediction {
  timeframe: 'next_week' | 'next_month' | 'next_quarter';
  prediction: string;
  confidence: number;
  recommendations: string[];
}

// Singleton export
export const patternRecognitionService = PatternRecognitionService.getInstance(); 