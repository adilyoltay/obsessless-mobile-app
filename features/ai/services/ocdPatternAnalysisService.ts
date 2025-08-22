/**
 * 🧠 OCD Pattern Analysis Service - Advanced AI-Powered Pattern Recognition
 * 
 * Bu service kullanıcının kompulsiyon kayıtlarını derinlemesine analiz ederek
 * temporal patterns, trigger correlations ve severity progression tespit eder.
 * 
 * ⚠️ CRITICAL: UnifiedAIPipeline entegrasyonu zorunlu
 * ⚠️ Feature flag kontrolü: AI_OCD_PATTERN_ANALYSIS
 * ⚠️ Kültürel duyarlılık ve Türk kültürüne özel adaptasyonlar
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { CompulsionEntry } from '@/types/compulsion';
import { 
  OCDTemporalPattern,
  OCDTriggerAnalysis, 
  OCDCategoryDistribution,
  OCDPatternAnalysisResult,
  OCDSeverityProgression,
  OCDPredictiveInsights,
  AIError,
  AIErrorCode,
  ErrorSeverity
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

interface OCDTemporalPattern {
  type: 'daily_cycle' | 'weekly_pattern' | 'situational_trigger' | 'stress_related';
  peakTimes: string[];          // "08:00-10:00", "evening"
  frequency: number;            // times per day/week
  confidence: number;           // 0-1
  trend: 'increasing' | 'stable' | 'decreasing' | 'fluctuating';
  metadata: {
    analysisDate: string;
    dataPoints: number;
    timeRange: string;
  };
}

interface OCDTriggerAnalysis {
  triggers: {
    trigger: string;
    category: 'environmental' | 'emotional' | 'social' | 'physical' | 'temporal';
    frequency: number;
    impactScore: number;        // 0-100
    associatedCategories: string[];
    averageSeverity: number;
    timePattern: {
      peakHours: number[];
      peakDays: string[];
    };
    emotionalContext: {
      preTriggerAnxiety: number;
      postCompulsionRelief: number;
      emotionalIntensity: number;
    };
    interventionSuggestions: string[];
  }[];
  
  triggerNetworks: {
    primaryTrigger: string;
    secondaryTriggers: string[];
    cascadeEffect: boolean;
    networkStrength: number;
  }[];
}

interface OCDCategoryDistribution {
  distribution: {
    category: string;
    count: number;
    percentage: number;
    averageSeverity: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    lastOccurrence: string;
  }[];
  dominantCategory: string;
  diversity: number;              // Number of different categories
  concentration: number;          // % of dominant category
  emergingPatterns: string[];
}

interface OCDSeverityProgression {
  overall: {
    currentAverage: number;
    trend: 'improving' | 'worsening' | 'stable';
    changeRate: number;          // % change per week
    projectedNextWeek: number;
  };
  byCategory: Record<string, {
    average: number;
    trend: string;
    samples: number;
  }>;
  riskFactors: {
    factor: string;
    correlation: number;
    impact: 'low' | 'medium' | 'high';
  }[];
}

// =============================================================================
// 🏗️ MAIN SERVICE CLASS
// =============================================================================

class OCDPatternAnalysisService {
  private static instance: OCDPatternAnalysisService;
  private isInitialized = false;
  private analysisCache = new Map<string, any>();

  static getInstance(): OCDPatternAnalysisService {
    if (!OCDPatternAnalysisService.instance) {
      OCDPatternAnalysisService.instance = new OCDPatternAnalysisService();
    }
    return OCDPatternAnalysisService.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;
      
      // Initialize cache from storage
      const cachedData = await AsyncStorage.getItem('ocd_pattern_cache');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        this.analysisCache = new Map(parsed);
      }
      
      this.isInitialized = true;
      console.log('🧠 OCD Pattern Analysis Service initialized');
      
      await trackAIInteraction(AIEventType.FEATURE_INITIALIZED, {
        feature: 'OCD_PATTERN_ANALYSIS',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Failed to initialize OCD Pattern Analysis Service:', error);
      await trackAIError(AIEventType.INITIALIZATION_ERROR, {
        feature: 'OCD_PATTERN_ANALYSIS',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN ANALYSIS METHOD
  // =============================================================================

  /**
   * Comprehensive OCD pattern analysis
   */
  async analyzeCompulsionPatterns(
    compulsions: CompulsionEntry[],
    userId: string,
    analysisType: 'full' | 'temporal' | 'triggers' | 'categories' | 'severity' = 'full'
  ): Promise<OCDPatternAnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('OCD Pattern Analysis Service not initialized');
    }

    if (!FEATURE_FLAGS.isEnabled('AI_OCD_PATTERN_ANALYSIS')) {
      console.log('⚠️ OCD Pattern Analysis disabled by feature flag');
      return this.getEmptyAnalysisResult();
    }

    const startTime = Date.now();
    console.log(`🧠 Starting OCD pattern analysis for ${compulsions.length} compulsions`);

    try {
      // Input validation
      if (compulsions.length < 3) {
        console.warn('⚠️ Insufficient data for pattern analysis (need at least 3 entries)');
        return this.getEmptyAnalysisResult();
      }

      // Check cache
      const cacheKey = this.generateCacheKey(compulsions, analysisType);
      const cached = this.analysisCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < 3600000)) { // 1 hour cache
        console.log('📊 Using cached OCD pattern analysis');
        return cached.result;
      }

      const result: OCDPatternAnalysisResult = {
        temporalPatterns: [],
        triggerAnalysis: { triggers: [], triggerNetworks: [] },
        categoryDistribution: {
          distribution: [],
          dominantCategory: '',
          diversity: 0,
          concentration: 0,
          emergingPatterns: []
        },
        severityProgression: {
          overall: {
            currentAverage: 0,
            trend: 'stable',
            changeRate: 0,
            projectedNextWeek: 0
          },
          byCategory: {},
          riskFactors: []
        },
        predictiveInsights: {
          nextWeekRisk: 'medium',
          riskFactors: [],
          recommendations: [],
          confidence: 0
        },
        metadata: {
          analysisDate: new Date().toISOString(),
          dataPoints: compulsions.length,
          analysisType,
          confidence: 0,
          culturalFactors: {
            religiousComponent: false,
            familialInfluence: false,
            culturalNorms: false
          }
        }
      };

      // Run specific analyses based on request
      if (analysisType === 'full' || analysisType === 'temporal') {
        result.temporalPatterns = await this.analyzeTemporalPatterns(compulsions);
      }

      if (analysisType === 'full' || analysisType === 'triggers') {
        result.triggerAnalysis = await this.analyzeTriggerPatterns(compulsions);
      }

      if (analysisType === 'full' || analysisType === 'categories') {
        result.categoryDistribution = await this.analyzeCategoryDistribution(compulsions);
      }

      if (analysisType === 'full' || analysisType === 'severity') {
        result.severityProgression = await this.analyzeSeverityProgression(compulsions);
      }

      if (analysisType === 'full') {
        result.predictiveInsights = await this.generatePredictiveInsights(
          result.temporalPatterns,
          result.triggerAnalysis,
          result.severityProgression
        );
      }

      // Calculate overall confidence
      result.metadata.confidence = this.calculateOverallConfidence(result);

      // Detect cultural factors
      result.metadata.culturalFactors = this.detectCulturalFactors(compulsions);

      // Cache result
      this.analysisCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
      await this.persistCache();

      // Track success
      await trackAIInteraction(AIEventType.PATTERN_ANALYSIS_COMPLETED, {
        userId,
        analysisType,
        dataPoints: compulsions.length,
        duration: Date.now() - startTime,
        confidence: result.metadata.confidence
      });

      console.log(`✅ OCD pattern analysis completed in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error('❌ OCD pattern analysis failed:', error);
      await trackAIError(AIEventType.PATTERN_ANALYSIS_ERROR, {
        userId,
        error: error instanceof Error ? error.message : String(error),
        analysisType
      });
      throw error;
    }
  }

  // =============================================================================
  // 📊 TEMPORAL PATTERN ANALYSIS
  // =============================================================================

  private async analyzeTemporalPatterns(compulsions: CompulsionEntry[]): Promise<OCDTemporalPattern[]> {
    const patterns: OCDTemporalPattern[] = [];

    // Daily cycle analysis
    const dailyPattern = this.analyzeDailyCycle(compulsions);
    if (dailyPattern) patterns.push(dailyPattern);

    // Weekly pattern analysis
    const weeklyPattern = this.analyzeWeeklyCycle(compulsions);
    if (weeklyPattern) patterns.push(weeklyPattern);

    // Situational triggers
    const situationalPatterns = this.analyzeSituationalTriggers(compulsions);
    patterns.push(...situationalPatterns);

    return patterns;
  }

  private analyzeDailyCycle(compulsions: CompulsionEntry[]): OCDTemporalPattern | null {
    // Group by hour of day
    const hourlyDistribution = new Array(24).fill(0);
    compulsions.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      hourlyDistribution[hour]++;
    });

    const totalEntries = compulsions.length;
    const averagePerHour = totalEntries / 24;

    // Find peak hours (above 1.5x average)
    const peakHours = hourlyDistribution
      .map((count, hour) => ({ hour, count, percentage: (count / totalEntries) * 100 }))
      .filter(h => h.count > averagePerHour * 1.5)
      .sort((a, b) => b.count - a.count);

    if (peakHours.length === 0) return null;

    // Determine trend
    const recentEntries = compulsions.slice(-Math.min(20, Math.floor(compulsions.length * 0.3)));
    const olderEntries = compulsions.slice(0, Math.min(20, Math.floor(compulsions.length * 0.3)));
    
    const recentPeakHour = this.findPrimaryPeakHour(recentEntries);
    const olderPeakHour = this.findPrimaryPeakHour(olderEntries);
    
    let trend: 'increasing' | 'stable' | 'decreasing' | 'fluctuating' = 'stable';
    if (recentPeakHour !== olderPeakHour) {
      trend = 'fluctuating';
    }

    return {
      type: 'daily_cycle',
      peakTimes: peakHours.slice(0, 3).map(h => `${h.hour}:00`),
      frequency: peakHours[0].count,
      confidence: Math.min(0.9, peakHours[0].percentage / 50), // Confidence based on concentration
      trend,
      metadata: {
        analysisDate: new Date().toISOString(),
        dataPoints: compulsions.length,
        timeRange: '24h'
      }
    };
  }

  private analyzeWeeklyCycle(compulsions: CompulsionEntry[]): OCDTemporalPattern | null {
    if (compulsions.length < 14) return null; // Need at least 2 weeks of data

    // Group by day of week
    const weeklyDistribution = new Array(7).fill(0);
    compulsions.forEach(entry => {
      const dayOfWeek = new Date(entry.timestamp).getDay(); // 0 = Sunday
      weeklyDistribution[dayOfWeek]++;
    });

    const totalEntries = compulsions.length;
    const averagePerDay = totalEntries / 7;

    // Find peak days
    const peakDays = weeklyDistribution
      .map((count, day) => ({ 
        day, 
        count, 
        percentage: (count / totalEntries) * 100,
        dayName: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][day]
      }))
      .filter(d => d.count > averagePerDay * 1.3)
      .sort((a, b) => b.count - a.count);

    if (peakDays.length === 0) return null;

    return {
      type: 'weekly_pattern',
      peakTimes: peakDays.slice(0, 2).map(d => d.dayName),
      frequency: peakDays[0].count,
      confidence: Math.min(0.85, peakDays[0].percentage / 25),
      trend: this.calculateWeeklyTrend(compulsions),
      metadata: {
        analysisDate: new Date().toISOString(),
        dataPoints: compulsions.length,
        timeRange: 'weekly'
      }
    };
  }

  private analyzeSituationalTriggers(compulsions: CompulsionEntry[]): OCDTemporalPattern[] {
    const patterns: OCDTemporalPattern[] = [];
    
    // Analyze stress-related patterns
    const stressCompulsions = compulsions.filter(c => 
      c.notes?.toLowerCase().includes('stres') || 
      c.notes?.toLowerCase().includes('gergin') ||
      c.notes?.toLowerCase().includes('kaygı')
    );

    if (stressCompulsions.length >= 3) {
      patterns.push({
        type: 'stress_related',
        peakTimes: ['Stresli durumlar'],
        frequency: stressCompulsions.length,
        confidence: Math.min(0.8, stressCompulsions.length / compulsions.length * 2),
        trend: this.calculateStressTrend(stressCompulsions),
        metadata: {
          analysisDate: new Date().toISOString(),
          dataPoints: stressCompulsions.length,
          timeRange: 'situational'
        }
      });
    }

    return patterns;
  }

  // =============================================================================
  // 🎯 TRIGGER ANALYSIS
  // =============================================================================

  private async analyzeTriggerPatterns(compulsions: CompulsionEntry[]): Promise<OCDTriggerAnalysis> {
    const triggerMap = new Map<string, {
      compulsions: CompulsionEntry[],
      categories: Set<string>,
      severities: number[]
    }>();

    // Extract triggers from compulsions
    compulsions.forEach(entry => {
      if (entry.trigger) {
        const normalizedTrigger = this.normalizeTrigger(entry.trigger);
        if (!triggerMap.has(normalizedTrigger)) {
          triggerMap.set(normalizedTrigger, {
            compulsions: [],
            categories: new Set(),
            severities: []
          });
        }
        
        const triggerData = triggerMap.get(normalizedTrigger)!;
        triggerData.compulsions.push(entry);
        triggerData.categories.add(entry.type);
        triggerData.severities.push(entry.intensity);
      }
    });

    // Analyze triggers
    const triggers = Array.from(triggerMap.entries()).map(([trigger, data]) => ({
      trigger,
      category: this.categorizeTrigger(trigger),
      frequency: data.compulsions.length,
      impactScore: this.calculateTriggerImpact(data),
      associatedCategories: Array.from(data.categories),
      averageSeverity: data.severities.reduce((sum, s) => sum + s, 0) / data.severities.length,
      timePattern: this.analyzeTriggerTimePattern(data.compulsions),
      emotionalContext: this.analyzeTriggerEmotionalContext(data.compulsions),
      interventionSuggestions: this.generateTriggerInterventions(trigger, data)
    })).sort((a, b) => b.impactScore - a.impactScore);

    // Analyze trigger networks
    const triggerNetworks = this.analyzeTriggerNetworks(compulsions);

    return {
      triggers,
      triggerNetworks
    };
  }

  private normalizeTrigger(trigger: string): string {
    return trigger.toLowerCase().trim();
  }

  private categorizeTrigger(trigger: string): 'environmental' | 'emotional' | 'social' | 'physical' | 'temporal' {
    const environmentalKeywords = ['ev', 'oda', 'mutfak', 'banyo', 'iş', 'okul', 'dış'];
    const emotionalKeywords = ['stres', 'kaygı', 'üzgün', 'gergin', 'sinirli', 'korku'];
    const socialKeywords = ['arkadaş', 'aile', 'toplum', 'sosyal', 'misafir', 'kalabalık'];
    const physicalKeywords = ['yorgun', 'hasta', 'baş ağrısı', 'fiziksel'];
    const temporalKeywords = ['sabah', 'akşam', 'gece', 'hafta sonu'];

    if (environmentalKeywords.some(keyword => trigger.includes(keyword))) return 'environmental';
    if (emotionalKeywords.some(keyword => trigger.includes(keyword))) return 'emotional';
    if (socialKeywords.some(keyword => trigger.includes(keyword))) return 'social';
    if (physicalKeywords.some(keyword => trigger.includes(keyword))) return 'physical';
    if (temporalKeywords.some(keyword => trigger.includes(keyword))) return 'temporal';

    return 'emotional'; // default
  }

  // =============================================================================
  // 🏷️ CATEGORY DISTRIBUTION ANALYSIS
  // =============================================================================

  private async analyzeCategoryDistribution(compulsions: CompulsionEntry[]): Promise<OCDCategoryDistribution> {
    const categoryMap = new Map<string, {
      count: number,
      severities: number[],
      timestamps: Date[]
    }>();

    // Count compulsions by category
    compulsions.forEach(entry => {
      const category = entry.type;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          count: 0,
          severities: [],
          timestamps: []
        });
      }
      
      const categoryData = categoryMap.get(category)!;
      categoryData.count++;
      categoryData.severities.push(entry.intensity);
      categoryData.timestamps.push(new Date(entry.timestamp));
    });

    const totalEntries = compulsions.length;
    
    const distribution = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      percentage: (data.count / totalEntries) * 100,
      averageSeverity: data.severities.reduce((sum, s) => sum + s, 0) / data.severities.length,
      trend: this.calculateCategoryTrend(data.timestamps),
      lastOccurrence: new Date(Math.max(...data.timestamps.map(t => t.getTime()))).toISOString()
    })).sort((a, b) => b.count - a.count);

    const dominantCategory = distribution[0]?.category || '';
    const diversity = distribution.length;
    const concentration = distribution[0]?.percentage || 0;

    // Detect emerging patterns
    const emergingPatterns = this.detectEmergingPatterns(distribution);

    return {
      distribution,
      dominantCategory,
      diversity,
      concentration,
      emergingPatterns
    };
  }

  // =============================================================================
  // 📈 SEVERITY PROGRESSION ANALYSIS  
  // =============================================================================

  private async analyzeSeverityProgression(compulsions: CompulsionEntry[]): Promise<OCDSeverityProgression> {
    // Overall severity analysis
    const severities = compulsions.map(c => c.intensity);
    const currentAverage = severities.reduce((sum, s) => sum + s, 0) / severities.length;
    
    // Calculate trend
    const recentSeverities = severities.slice(-Math.min(10, severities.length));
    const olderSeverities = severities.slice(0, Math.min(10, severities.length));
    
    const recentAvg = recentSeverities.reduce((sum, s) => sum + s, 0) / recentSeverities.length;
    const olderAvg = olderSeverities.reduce((sum, s) => sum + s, 0) / olderSeverities.length;
    
    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    let changeRate = 0;
    
    if (recentAvg < olderAvg - 0.5) {
      trend = 'improving';
      changeRate = ((olderAvg - recentAvg) / olderAvg) * 100;
    } else if (recentAvg > olderAvg + 0.5) {
      trend = 'worsening';
      changeRate = ((recentAvg - olderAvg) / olderAvg) * 100;
    }

    // Project next week
    const projectedNextWeek = trend === 'improving' ? 
      currentAverage - (changeRate / 100 * currentAverage * 0.1) :
      trend === 'worsening' ?
      currentAverage + (changeRate / 100 * currentAverage * 0.1) :
      currentAverage;

    // By category analysis
    const byCategory: Record<string, { average: number; trend: string; samples: number }> = {};
    const categories = [...new Set(compulsions.map(c => c.type))];
    
    categories.forEach(category => {
      const categoryCompulsions = compulsions.filter(c => c.type === category);
      const categorySeverities = categoryCompulsions.map(c => c.intensity);
      
      byCategory[category] = {
        average: categorySeverities.reduce((sum, s) => sum + s, 0) / categorySeverities.length,
        trend: this.calculateCategoryTrend(categoryCompulsions.map(c => new Date(c.timestamp))),
        samples: categoryCompulsions.length
      };
    });

    // Risk factors
    const riskFactors = this.identifyRiskFactors(compulsions);

    return {
      overall: {
        currentAverage,
        trend,
        changeRate,
        projectedNextWeek
      },
      byCategory,
      riskFactors
    };
  }

  // =============================================================================
  // 🔮 PREDICTIVE INSIGHTS
  // =============================================================================

  private async generatePredictiveInsights(
    temporalPatterns: OCDTemporalPattern[],
    triggerAnalysis: OCDTriggerAnalysis,
    severityProgression: OCDSeverityProgression
  ): Promise<OCDPredictiveInsights> {
    // Assess next week risk
    let nextWeekRisk: 'low' | 'medium' | 'high' = 'medium';
    
    if (severityProgression.overall.trend === 'worsening') {
      nextWeekRisk = 'high';
    } else if (severityProgression.overall.trend === 'improving') {
      nextWeekRisk = 'low';
    }

    // Identify key risk factors
    const riskFactors = [
      ...severityProgression.riskFactors.map(rf => rf.factor),
      ...triggerAnalysis.triggers
        .filter(t => t.impactScore > 70)
        .map(t => t.trigger)
    ].slice(0, 5);

    // Generate recommendations
    const recommendations = this.generateActionableRecommendations(
      temporalPatterns,
      triggerAnalysis,
      severityProgression
    );

    // Calculate overall confidence
    const confidence = this.calculatePredictiveConfidence(
      temporalPatterns.length,
      triggerAnalysis.triggers.length,
      severityProgression.overall.trend
    );

    return {
      nextWeekRisk,
      riskFactors,
      recommendations,
      confidence
    };
  }

  // =============================================================================
  // 🛠️ HELPER METHODS
  // =============================================================================

  private findPrimaryPeakHour(compulsions: CompulsionEntry[]): number {
    const hourCounts = new Array(24).fill(0);
    compulsions.forEach(entry => {
      hourCounts[new Date(entry.timestamp).getHours()]++;
    });
    return hourCounts.indexOf(Math.max(...hourCounts));
  }

  private calculateWeeklyTrend(compulsions: CompulsionEntry[]): 'increasing' | 'stable' | 'decreasing' | 'fluctuating' {
    // Simple trend calculation based on recent vs older entries
    const midpoint = Math.floor(compulsions.length / 2);
    const recentCount = compulsions.slice(midpoint).length;
    const olderCount = compulsions.slice(0, midpoint).length;
    
    const diff = recentCount - olderCount;
    if (Math.abs(diff) < 2) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  }

  private calculateStressTrend(stressCompulsions: CompulsionEntry[]): 'increasing' | 'stable' | 'decreasing' | 'fluctuating' {
    if (stressCompulsions.length < 4) return 'stable';
    
    const recent = stressCompulsions.slice(-Math.floor(stressCompulsions.length / 2));
    const older = stressCompulsions.slice(0, Math.floor(stressCompulsions.length / 2));
    
    return recent.length > older.length ? 'increasing' : 'decreasing';
  }

  private calculateTriggerImpact(data: { compulsions: CompulsionEntry[], severities: number[] }): number {
    const frequency = data.compulsions.length;
    const avgSeverity = data.severities.reduce((sum, s) => sum + s, 0) / data.severities.length;
    const recency = this.calculateRecency(data.compulsions.map(c => new Date(c.timestamp)));
    
    // Impact = (frequency * 20) + (avgSeverity * 8) + (recency * 12)
    return Math.min(100, (frequency * 20) + (avgSeverity * 8) + (recency * 12));
  }

  private calculateRecency(timestamps: Date[]): number {
    if (timestamps.length === 0) return 0;
    
    const now = new Date();
    const mostRecent = new Date(Math.max(...timestamps.map(t => t.getTime())));
    const daysDiff = (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24);
    
    // Recent = higher score, older = lower score
    return Math.max(0, 10 - daysDiff);
  }

  private analyzeTriggerTimePattern(compulsions: CompulsionEntry[]): { peakHours: number[]; peakDays: string[] } {
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    
    compulsions.forEach(entry => {
      const date = new Date(entry.timestamp);
      hourCounts[date.getHours()]++;
      dayCounts[date.getDay()]++;
    });
    
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.hour);
    
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const peakDays = dayCounts
      .map((count, day) => ({ day, count, name: dayNames[day] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map(d => d.name);
    
    return { peakHours, peakDays };
  }

  private analyzeTriggerEmotionalContext(compulsions: CompulsionEntry[]): {
    preTriggerAnxiety: number;
    postCompulsionRelief: number;
    emotionalIntensity: number;
  } {
    // Simplified emotional analysis based on intensity and notes
    const avgIntensity = compulsions.reduce((sum, c) => sum + c.intensity, 0) / compulsions.length;
    const avgResistance = compulsions.reduce((sum, c) => sum + (c.resistanceLevel || 0), 0) / compulsions.length;
    
    return {
      preTriggerAnxiety: avgIntensity,
      postCompulsionRelief: Math.max(0, avgIntensity - 2), // Assumed relief
      emotionalIntensity: avgIntensity
    };
  }

  private generateTriggerInterventions(trigger: string, data: { compulsions: CompulsionEntry[] }): string[] {
    const interventions: string[] = [];
    const category = this.categorizeTrigger(trigger);
    
    switch (category) {
      case 'environmental':
        interventions.push('Çevresel tetikleyiciyi değiştirmeyi deneyin');
        interventions.push('O ortamda mindfulness teknikleri uygulayın');
        break;
      case 'emotional':
        interventions.push('Duygu düzenleme teknikleri öğrenin');
        interventions.push('Nefes egzersizleri yapın');
        break;
      case 'social':
        interventions.push('Sosyal destek sisteminizi güçlendirin');
        interventions.push('İletişim becerilerinizi geliştirin');
        break;
      case 'temporal':
        interventions.push('O zaman diliminde önleyici aktiviteler planlayın');
        interventions.push('Günlük rutininizi optimize edin');
        break;
      default:
        interventions.push('Terapi egzersizleri deneyin');
        interventions.push('Terapist desteği alın');
    }
    
    return interventions;
  }

  private analyzeTriggerNetworks(compulsions: CompulsionEntry[]): {
    primaryTrigger: string;
    secondaryTriggers: string[];
    cascadeEffect: boolean;
    networkStrength: number;
  }[] {
    // Simplified network analysis
    const triggerCounts = new Map<string, number>();
    
    compulsions.forEach(c => {
      if (c.trigger) {
        const trigger = this.normalizeTrigger(c.trigger);
        triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
      }
    });
    
    const sortedTriggers = Array.from(triggerCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    if (sortedTriggers.length < 2) return [];
    
    return [{
      primaryTrigger: sortedTriggers[0][0],
      secondaryTriggers: sortedTriggers.slice(1, 4).map(t => t[0]),
      cascadeEffect: sortedTriggers[0][1] > sortedTriggers[1][1] * 2,
      networkStrength: Math.min(1, sortedTriggers[0][1] / compulsions.length * 5)
    }];
  }

  private calculateCategoryTrend(timestamps: Date[]): 'increasing' | 'decreasing' | 'stable' {
    if (timestamps.length < 4) return 'stable';
    
    const sorted = timestamps.sort((a, b) => a.getTime() - b.getTime());
    const midpoint = Math.floor(sorted.length / 2);
    const recentCount = sorted.slice(midpoint).length;
    const olderCount = sorted.slice(0, midpoint).length;
    
    const diff = recentCount - olderCount;
    if (Math.abs(diff) < 2) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  }

  private detectEmergingPatterns(distribution: any[]): string[] {
    const patterns: string[] = [];
    
    // Look for categories with increasing trend
    const emergingCategories = distribution.filter(d => 
      d.trend === 'increasing' && d.percentage < 30 && d.count >= 2
    );
    
    if (emergingCategories.length > 0) {
      patterns.push(`${emergingCategories[0].category} kategorisinde artış`);
    }
    
    // Look for diversity patterns
    if (distribution.length > 5) {
      patterns.push('Yüksek kategori çeşitliliği');
    }
    
    return patterns;
  }

  private identifyRiskFactors(compulsions: CompulsionEntry[]): {
    factor: string;
    correlation: number;
    impact: 'low' | 'medium' | 'high';
  }[] {
    const riskFactors: { factor: string; correlation: number; impact: 'low' | 'medium' | 'high' }[] = [];
    
    // High intensity compulsions
    const highIntensityCount = compulsions.filter(c => c.intensity >= 8).length;
    if (highIntensityCount > compulsions.length * 0.3) {
      riskFactors.push({
        factor: 'Yüksek şiddetli kompulsiyonlar',
        correlation: highIntensityCount / compulsions.length,
        impact: 'high'
      });
    }
    
    // Low resistance
    const lowResistanceCount = compulsions.filter(c => (c.resistanceLevel || 0) <= 3).length;
    if (lowResistanceCount > compulsions.length * 0.4) {
      riskFactors.push({
        factor: 'Düşük direnç seviyeleri',
        correlation: lowResistanceCount / compulsions.length,
        impact: 'medium'
      });
    }
    
    return riskFactors;
  }

  private generateActionableRecommendations(
    temporalPatterns: OCDTemporalPattern[],
    triggerAnalysis: OCDTriggerAnalysis,
    severityProgression: OCDSeverityProgression
  ): string[] {
    const recommendations: string[] = [];
    
    // Temporal recommendations
    if (temporalPatterns.length > 0) {
      const mainPattern = temporalPatterns[0];
      if (mainPattern.type === 'daily_cycle') {
        recommendations.push(`${mainPattern.peakTimes[0]} saatlerinde önleyici teknikler uygulayın`);
      }
    }
    
    // Trigger recommendations
    const topTrigger = triggerAnalysis.triggers[0];
    if (topTrigger) {
      recommendations.push(`"${topTrigger.trigger}" tetikleyicisi için ${topTrigger.interventionSuggestions[0]}`);
    }
    
    // Severity recommendations
    if (severityProgression.overall.trend === 'worsening') {
      recommendations.push('Terapi egzersizlerini artırın');
      recommendations.push('Profesyonel destek almayı düşünün');
    } else if (severityProgression.overall.trend === 'improving') {
      recommendations.push('Mevcut stratejileri sürdürün');
      recommendations.push('İlerlemenizi kutlayın');
    }
    
    return recommendations.slice(0, 5); // Max 5 recommendations
  }

  private calculatePredictiveConfidence(
    temporalPatternsCount: number,
    triggersCount: number,
    trend: string
  ): number {
    let confidence = 0.5; // Base confidence
    
    // More patterns = higher confidence
    confidence += Math.min(0.3, temporalPatternsCount * 0.1);
    confidence += Math.min(0.2, triggersCount * 0.02);
    
    // Clear trend = higher confidence
    if (trend !== 'stable') {
      confidence += 0.1;
    }
    
    return Math.min(0.95, confidence);
  }

  private calculateOverallConfidence(result: OCDPatternAnalysisResult): number {
    let confidence = 0.5;
    
    // Data volume
    confidence += Math.min(0.3, result.metadata.dataPoints * 0.01);
    
    // Pattern diversity
    confidence += Math.min(0.2, result.temporalPatterns.length * 0.05);
    confidence += Math.min(0.2, result.triggerAnalysis.triggers.length * 0.02);
    
    return Math.min(0.95, confidence);
  }

  private detectCulturalFactors(compulsions: CompulsionEntry[]): {
    religiousComponent: boolean;
    familialInfluence: boolean;
    culturalNorms: boolean;
  } {
    const allText = compulsions.map(c => `${c.notes || ''} ${c.trigger || ''}`).join(' ').toLowerCase();
    
    const religiousKeywords = ['namaz', 'abdest', 'günah', 'allah', 'dua', 'ibadet', 'temizlik'];
    const familialKeywords = ['aile', 'anne', 'baba', 'ev', 'misafir', 'akraba'];
    const culturalKeywords = ['komşu', 'mahalle', 'toplum', 'gelenek', 'görenekler'];
    
    return {
      religiousComponent: religiousKeywords.some(keyword => allText.includes(keyword)),
      familialInfluence: familialKeywords.some(keyword => allText.includes(keyword)),
      culturalNorms: culturalKeywords.some(keyword => allText.includes(keyword))
    };
  }

  private generateCacheKey(compulsions: CompulsionEntry[], analysisType: string): string {
    const dataHash = compulsions.map(c => `${c.id}-${c.timestamp}`).join('').slice(0, 100);
    return `ocd_pattern_${analysisType}_${dataHash}`;
  }

  private getEmptyAnalysisResult(): OCDPatternAnalysisResult {
    return {
      temporalPatterns: [],
      triggerAnalysis: { triggers: [], triggerNetworks: [] },
      categoryDistribution: {
        distribution: [],
        dominantCategory: '',
        diversity: 0,
        concentration: 0,
        emergingPatterns: []
      },
      severityProgression: {
        overall: {
          currentAverage: 0,
          trend: 'stable',
          changeRate: 0,
          projectedNextWeek: 0
        },
        byCategory: {},
        riskFactors: []
      },
      predictiveInsights: {
        nextWeekRisk: 'medium',
        riskFactors: [],
        recommendations: [],
        confidence: 0
      },
      metadata: {
        analysisDate: new Date().toISOString(),
        dataPoints: 0,
        analysisType: 'full',
        confidence: 0,
        culturalFactors: {
          religiousComponent: false,
          familialInfluence: false,
          culturalNorms: false
        }
      }
    };
  }

  private async persistCache(): Promise<void> {
    try {
      const cacheData = Array.from(this.analysisCache.entries());
      await AsyncStorage.setItem('ocd_pattern_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to persist OCD pattern cache:', error);
    }
  }
}

// =============================================================================
// 🎯 TYPE DEFINITIONS FOR EXPORT
// =============================================================================

interface OCDPatternAnalysisResult {
  temporalPatterns: OCDTemporalPattern[];
  triggerAnalysis: OCDTriggerAnalysis;
  categoryDistribution: OCDCategoryDistribution;
  severityProgression: OCDSeverityProgression;
  predictiveInsights: OCDPredictiveInsights;
  metadata: {
    analysisDate: string;
    dataPoints: number;
    analysisType: string;
    confidence: number;
    culturalFactors: {
      religiousComponent: boolean;
      familialInfluence: boolean;
      culturalNorms: boolean;
    };
  };
}

interface OCDPredictiveInsights {
  nextWeekRisk: 'low' | 'medium' | 'high';
  riskFactors: string[];
  recommendations: string[];
  confidence: number;
}

// =============================================================================
// 🎯 SINGLETON EXPORT
// =============================================================================

export const ocdPatternAnalysisService = OCDPatternAnalysisService.getInstance();
export type { OCDPatternAnalysisResult, OCDTemporalPattern, OCDTriggerAnalysis, OCDPredictiveInsights };
