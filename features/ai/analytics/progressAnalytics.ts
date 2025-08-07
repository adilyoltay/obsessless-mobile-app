/**
 * 📈 Progress Analytics - Therapeutic Outcome Tracking & Analysis
 * 
 * Bu sistem, kullanıcının OKB ile mücadelesindeki ilerlemesini çok boyutlu
 * olarak analiz eder. CBT Engine, Pattern Recognition ve Insights Engine'den
 * gelen verileri birleştirerek comprehensive progress tracking sağlar.
 * 
 * ⚠️ CRITICAL: Terapötik outcome metrics evidence-based standartlara uygun
 * ⚠️ Feature flag kontrolü: AI_PROGRESS_ANALYTICS
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage, 
  ConversationContext, 
  UserTherapeuticProfile,
  AIError,
  AIErrorCode,
  ErrorSeverity,
  CrisisRiskLevel
} from '@/features/ai/types';
import { CBTTechnique, CognitiveDistortion } from '@/features/ai/engines/cbtEngine';
import { InsightCategory, IntelligentInsight } from '@/features/ai/engines/insightsEngineV2';
import { DetectedPattern, PatternType, PatternSeverity } from '@/features/ai/services/patternRecognitionV2';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 PROGRESS ANALYTICS DEFINITIONS & TYPES
// =============================================================================

/**
 * Progress tracking kategorileri
 */
export enum ProgressCategory {
  SYMPTOM_SEVERITY = 'symptom_severity',           // Belirti şiddeti
  FUNCTIONAL_IMPROVEMENT = 'functional_improvement', // İşlevsel iyileşme
  COGNITIVE_FLEXIBILITY = 'cognitive_flexibility',   // Bilişsel esneklik
  BEHAVIORAL_CHANGE = 'behavioral_change',          // Davranışsal değişim
  EMOTIONAL_REGULATION = 'emotional_regulation',    // Duygu düzenleme
  SOCIAL_FUNCTIONING = 'social_functioning',        // Sosyal işlevsellik
  QUALITY_OF_LIFE = 'quality_of_life',             // Yaşam kalitesi
  SELF_EFFICACY = 'self_efficacy',                 // Öz-yeterlik
  TREATMENT_ENGAGEMENT = 'treatment_engagement',    // Tedavi katılımı
  RELAPSE_PREVENTION = 'relapse_prevention'        // Relaps önleme
}

/**
 * Progress measurement metrics
 */
export enum ProgressMetric {
  Y_BOCS_SCORE = 'y_bocs_score',                   // Yale-Brown OCD Scale
  COMPULSION_FREQUENCY = 'compulsion_frequency',    // Kompulsiyon sıklığı
  DISTORTION_REDUCTION = 'distortion_reduction',   // Çarpıtma azalması
  CBT_SKILL_USAGE = 'cbt_skill_usage',             // CBT beceri kullanımı
  APP_ENGAGEMENT = 'app_engagement',                // Uygulama katılımı
  CRISIS_EPISODES = 'crisis_episodes',              // Kriz episodları
  ACHIEVEMENT_COUNT = 'achievement_count',          // Başarı sayısı
  INSIGHT_UTILIZATION = 'insight_utilization',     // İçgörü kullanımı
  PATTERN_AWARENESS = 'pattern_awareness',          // Pattern farkındalığı
  THERAPEUTIC_ALLIANCE = 'therapeutic_alliance'     // Terapötik ittifak
}

/**
 * Progress time periods
 */
export enum ProgressTimeframe {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime'
}

/**
 * Progress trend analysis
 */
export enum ProgressTrend {
  SIGNIFICANT_IMPROVEMENT = 'significant_improvement',    // %25+ iyileşme
  MODERATE_IMPROVEMENT = 'moderate_improvement',          // %10-25 iyileşme
  SLIGHT_IMPROVEMENT = 'slight_improvement',              // %5-10 iyileşme
  STABLE = 'stable',                                     // ±%5 değişim
  SLIGHT_DECLINE = 'slight_decline',                     // %5-10 kötüleşme
  MODERATE_DECLINE = 'moderate_decline',                 // %10-25 kötüleşme
  SIGNIFICANT_DECLINE = 'significant_decline'            // %25+ kötüleşme
}

/**
 * Progress data point
 */
export interface ProgressDataPoint {
  id: string;
  userId: string;
  category: ProgressCategory;
  metric: ProgressMetric;
  
  // Values
  value: number;
  normalizedValue: number; // 0-100 scale for comparison
  percentChange?: number;  // Change from previous measurement
  
  // Context
  timestamp: Date;
  timeframe: ProgressTimeframe;
  measurementSource: 'user_input' | 'app_behavior' | 'ai_analysis' | 'assessment';
  confidence: number; // 0-1 confidence in measurement accuracy
  
  // Metadata
  contextualFactors: string[]; // Factors affecting this measurement
  interventionsActive: CBTTechnique[]; // Active CBT techniques during measurement
  userMood?: string;
  crisisLevel: CrisisRiskLevel;
  
  // Validation
  clinicallySignificant: boolean;
  reliabilityScore: number; // 0-1 data reliability
  outlier: boolean; // Is this an outlier measurement?
}

/**
 * Progress analytics result
 */
export interface ProgressAnalyticsResult {
  userId: string;
  analysisId: string;
  generatedAt: Date;
  timeframe: {
    start: Date;
    end: Date;
    period: ProgressTimeframe;
  };
  
  // Overall progress
  overallProgress: {
    score: number; // 0-100 overall progress score
    trend: ProgressTrend;
    changePercent: number;
    clinicalSignificance: 'significant' | 'moderate' | 'minimal' | 'none';
  };
  
  // Category-specific progress
  categoryProgress: {
    category: ProgressCategory;
    score: number;
    trend: ProgressTrend;
    keyMetrics: {
      metric: ProgressMetric;
      value: number;
      change: number;
      trend: ProgressTrend;
    }[];
    insights: string[];
  }[];
  
  // Predictive analytics
  predictions: {
    nextMonthTrend: ProgressTrend;
    riskFactors: string[];
    protectiveFactors: string[];
    recommendedInterventions: CBTTechnique[];
    confidenceLevel: number;
  };
  
  // Achievements & milestones
  achievements: {
    recentAchievements: string[];
    upcomingMilestones: string[];
    streaks: {
      type: string;
      count: number;
      isActive: boolean;
    }[];
  };
  
  // Quality metrics
  dataQuality: {
    completeness: number; // 0-1
    reliability: number;  // 0-1
    recency: number;      // 0-1
    consistency: number;  // 0-1
  };
}

/**
 * Progress tracking context
 */
export interface ProgressTrackingContext {
  userId: string;
  userProfile: UserTherapeuticProfile;
  timeframe: {
    start: Date;
    end: Date;
    analysisDepth: 'quick' | 'standard' | 'comprehensive';
  };
  dataSource: {
    messages: AIMessage[];
    compulsions: any[];
    assessments: any[];
    achievements: any[];
    insights: IntelligentInsight[];
    patterns: DetectedPattern[];
    userEvents: any[];
  };
  comparisonBaseline?: Date; // For trend analysis
  includePredicitive?: boolean;
  focusCategories?: ProgressCategory[];
}

// =============================================================================
// 📈 PROGRESS ANALYTICS IMPLEMENTATION
// =============================================================================

class ProgressAnalytics {
  private static instance: ProgressAnalytics;
  private isEnabled: boolean = false;
  private dataCache: Map<string, ProgressDataPoint[]> = new Map();
  private analysisCache: Map<string, ProgressAnalyticsResult> = new Map();
  private baselineMetrics: Map<string, Map<ProgressMetric, number>> = new Map();

  private constructor() {}

  static getInstance(): ProgressAnalytics {
    if (!ProgressAnalytics.instance) {
      ProgressAnalytics.instance = new ProgressAnalytics();
    }
    return ProgressAnalytics.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION & SETUP
  // =============================================================================

  /**
   * Progress Analytics'i başlat
   */
  async initialize(): Promise<void> {
    console.log('📈 Progress Analytics: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_PROGRESS_ANALYTICS')) {
        console.log('🚫 Progress Analytics disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      this.isEnabled = true;
      
      // Telemetry
      await trackAIInteraction(AIEventType.PROGRESS_ANALYTICS_INITIALIZED, {
        version: '2.0'
      });

      console.log('✅ Progress Analytics initialized successfully');

    } catch (error) {
      console.error('❌ Progress Analytics initialization failed:', error);
      this.isEnabled = false;
      
      await trackAIError({
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: 'Progress Analytics başlatılamadı',
        severity: ErrorSeverity.HIGH,
        context: { component: 'ProgressAnalytics', method: 'initialize' }
      });
      
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN PROGRESS ANALYSIS METHODS
  // =============================================================================

  /**
   * Comprehensive progress analysis - Ana metod
   */
  async analyzeProgress(context: ProgressTrackingContext): Promise<ProgressAnalyticsResult> {
    if (!this.isEnabled) {
      throw new AIError(AIErrorCode.FEATURE_DISABLED, 'Progress Analytics is not enabled');
    }

    const analysisId = `progress_${Date.now()}_${context.userId}`;
    const startTime = Date.now();

    try {
      console.log(`📈 Starting progress analysis for user ${context.userId}`);

      // 1. Generate progress data points
      const dataPoints = await this.generateProgressDataPoints(context);
      
      // 2. Calculate category-specific progress
      const categoryProgress = await this.calculateCategoryProgress(dataPoints, context);
      
      // 3. Compute overall progress score
      const overallProgress = this.calculateOverallProgress(categoryProgress, context);
      
      // 4. Predictive analytics (if enabled)
      let predictions = null;
      if (context.includePredicitive) {
        predictions = await this.generatePredictiveAnalytics(dataPoints, categoryProgress, context);
      }
      
      // 5. Achievements & milestones
      const achievements = await this.analyzeAchievements(context);
      
      // 6. Data quality assessment
      const dataQuality = this.assessDataQuality(dataPoints, context);

      const result: ProgressAnalyticsResult = {
        userId: context.userId,
        analysisId,
        generatedAt: new Date(),
        timeframe: {
          start: context.timeframe.start,
          end: context.timeframe.end,
          period: this.determineTimeframePeriod(context.timeframe.start, context.timeframe.end)
        },
        overallProgress,
        categoryProgress,
        predictions: predictions || this.getDefaultPredictions(),
        achievements,
        dataQuality
      };

      // Cache results
      this.dataCache.set(context.userId, dataPoints);
      this.analysisCache.set(analysisId, result);

      // Telemetry
      await trackAIInteraction(AIEventType.PROGRESS_ANALYSIS_COMPLETED, {
        userId: context.userId,
        analysisId,
        overallScore: overallProgress.score,
        trend: overallProgress.trend,
        categoriesAnalyzed: categoryProgress.length,
        dataPointsGenerated: dataPoints.length,
        latency: Date.now() - startTime,
        dataQuality: dataQuality.completeness
      });

      console.log(`✅ Progress analysis completed: Overall score ${overallProgress.score}/100`);
      return result;

    } catch (error) {
      console.error('❌ Progress analysis failed:', error);
      
      await trackAIError({
        code: AIErrorCode.PROCESSING_FAILED,
        message: 'Progress analysis başarısız',
        severity: ErrorSeverity.MEDIUM,
        context: { 
          component: 'ProgressAnalytics', 
          method: 'analyzeProgress',
          userId: context.userId,
          latency: Date.now() - startTime
        }
      });

      throw error;
    }
  }

  // =============================================================================
  // 📊 DATA POINT GENERATION
  // =============================================================================

  /**
   * Progress data points oluştur
   */
  private async generateProgressDataPoints(context: ProgressTrackingContext): Promise<ProgressDataPoint[]> {
    const dataPoints: ProgressDataPoint[] = [];

    try {
      // Message-based metrics
      const messageMetrics = this.extractMessageBasedMetrics(context);
      dataPoints.push(...messageMetrics);

      // Compulsion frequency metrics
      const compulsionMetrics = this.extractCompulsionMetrics(context);
      dataPoints.push(...compulsionMetrics);

      // Assessment-based metrics (Y-BOCS, etc.)
      const assessmentMetrics = this.extractAssessmentMetrics(context);
      dataPoints.push(...assessmentMetrics);

      // Behavioral engagement metrics
      const engagementMetrics = this.extractEngagementMetrics(context);
      dataPoints.push(...engagementMetrics);

      // Pattern awareness metrics
      const patternMetrics = this.extractPatternMetrics(context);
      dataPoints.push(...patternMetrics);

      // Insight utilization metrics
      const insightMetrics = this.extractInsightMetrics(context);
      dataPoints.push(...insightMetrics);

      console.log(`📊 Generated ${dataPoints.length} progress data points`);

    } catch (error) {
      console.warn('⚠️ Progress data point generation failed:', error);
    }

    return dataPoints;
  }

  private extractMessageBasedMetrics(context: ProgressTrackingContext): ProgressDataPoint[] {
    const dataPoints: ProgressDataPoint[] = [];
    const messages = context.dataSource.messages;

    if (messages.length === 0) return dataPoints;

    // App engagement metric
    const engagementScore = Math.min((messages.length / 7) * 10, 100); // Normalize to daily usage
    
    dataPoints.push({
      id: `engagement_${Date.now()}`,
      userId: context.userId,
      category: ProgressCategory.TREATMENT_ENGAGEMENT,
      metric: ProgressMetric.APP_ENGAGEMENT,
      value: messages.length,
      normalizedValue: engagementScore,
      timestamp: new Date(),
      timeframe: ProgressTimeframe.WEEKLY,
      measurementSource: 'app_behavior',
      confidence: 0.9,
      contextualFactors: ['message_frequency'],
      interventionsActive: [],
      crisisLevel: CrisisRiskLevel.NONE,
      clinicallySignificant: engagementScore > 50,
      reliabilityScore: 0.85,
      outlier: false
    });

    // Communication quality (simplified sentiment analysis)
    const positiveKeywords = ['iyi', 'başardım', 'rahat', 'umutlu', 'güçlü'];
    const negativeKeywords = ['kötü', 'endişeli', 'korku', 'çaresiz', 'zor'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      positiveKeywords.forEach(word => {
        if (content.includes(word)) positiveCount++;
      });
      negativeKeywords.forEach(word => {
        if (content.includes(word)) negativeCount++;
      });
    });

    const emotionalBalanceScore = positiveCount > 0 ? 
      (positiveCount / (positiveCount + negativeCount)) * 100 : 50;

    dataPoints.push({
      id: `emotional_balance_${Date.now()}`,
      userId: context.userId,
      category: ProgressCategory.EMOTIONAL_REGULATION,
      metric: ProgressMetric.Y_BOCS_SCORE, // Proxy metric
      value: emotionalBalanceScore,
      normalizedValue: emotionalBalanceScore,
      timestamp: new Date(),
      timeframe: ProgressTimeframe.WEEKLY,
      measurementSource: 'ai_analysis',
      confidence: 0.6,
      contextualFactors: ['message_sentiment'],
      interventionsActive: [],
      crisisLevel: CrisisRiskLevel.NONE,
      clinicallySignificant: Math.abs(emotionalBalanceScore - 50) > 20,
      reliabilityScore: 0.7,
      outlier: false
    });

    return dataPoints;
  }

  private extractCompulsionMetrics(context: ProgressTrackingContext): ProgressDataPoint[] {
    const dataPoints: ProgressDataPoint[] = [];
    const compulsions = context.dataSource.compulsions;

    if (compulsions.length === 0) return dataPoints;

    const dailyAverage = compulsions.length / 7;
    const frequencyScore = Math.max(100 - (dailyAverage * 5), 0); // Lower frequency = higher score

    dataPoints.push({
      id: `compulsion_freq_${Date.now()}`,
      userId: context.userId,
      category: ProgressCategory.SYMPTOM_SEVERITY,
      metric: ProgressMetric.COMPULSION_FREQUENCY,
      value: compulsions.length,
      normalizedValue: frequencyScore,
      timestamp: new Date(),
      timeframe: ProgressTimeframe.WEEKLY,
      measurementSource: 'user_input',
      confidence: 0.95,
      contextualFactors: ['compulsion_logging'],
      interventionsActive: [],
      crisisLevel: CrisisRiskLevel.NONE,
      clinicallySignificant: dailyAverage > 5,
      reliabilityScore: 0.9,
      outlier: dailyAverage > 20
    });

    return dataPoints;
  }

  private extractAssessmentMetrics(context: ProgressTrackingContext): ProgressDataPoint[] {
    const dataPoints: ProgressDataPoint[] = [];
    const assessments = context.dataSource.assessments;

    // Y-BOCS Score tracking (simulated)
    if (assessments.length > 0) {
      const latestAssessment = assessments[assessments.length - 1];
      const score = latestAssessment.score || 20; // Default moderate score
      const normalizedScore = Math.max(100 - (score * 2.5), 0); // Inverse scoring

      dataPoints.push({
        id: `ybocs_${Date.now()}`,
        userId: context.userId,
        category: ProgressCategory.SYMPTOM_SEVERITY,
        metric: ProgressMetric.Y_BOCS_SCORE,
        value: score,
        normalizedValue: normalizedScore,
        timestamp: new Date(latestAssessment.date),
        timeframe: ProgressTimeframe.MONTHLY,
        measurementSource: 'assessment',
        confidence: 0.98,
        contextualFactors: ['formal_assessment'],
        interventionsActive: [],
        crisisLevel: CrisisRiskLevel.NONE,
        clinicallySignificant: true,
        reliabilityScore: 0.95,
        outlier: false
      });
    }

    return dataPoints;
  }

  private extractEngagementMetrics(context: ProgressTrackingContext): ProgressDataPoint[] {
    const dataPoints: ProgressDataPoint[] = [];
    const achievements = context.dataSource.achievements;

    // Achievement count as engagement metric
    const achievementScore = Math.min(achievements.length * 10, 100);
    
    dataPoints.push({
      id: `achievements_${Date.now()}`,
      userId: context.userId,
      category: ProgressCategory.SELF_EFFICACY,
      metric: ProgressMetric.ACHIEVEMENT_COUNT,
      value: achievements.length,
      normalizedValue: achievementScore,
      timestamp: new Date(),
      timeframe: ProgressTimeframe.WEEKLY,
      measurementSource: 'app_behavior',
      confidence: 0.8,
      contextualFactors: ['achievement_system'],
      interventionsActive: [],
      crisisLevel: CrisisRiskLevel.NONE,
      clinicallySignificant: achievements.length > 5,
      reliabilityScore: 0.85,
      outlier: false
    });

    return dataPoints;
  }

  private extractPatternMetrics(context: ProgressTrackingContext): ProgressDataPoint[] {
    const dataPoints: ProgressDataPoint[] = [];
    const patterns = context.dataSource.patterns;

    if (patterns.length > 0) {
      // Pattern awareness score
      const validatedPatterns = patterns.filter(p => !p.needsValidation);
      const awarenessScore = validatedPatterns.length > 0 ? 
        (validatedPatterns.length / patterns.length) * 100 : 0;

      dataPoints.push({
        id: `pattern_awareness_${Date.now()}`,
        userId: context.userId,
        category: ProgressCategory.COGNITIVE_FLEXIBILITY,
        metric: ProgressMetric.PATTERN_AWARENESS,
        value: patterns.length,
        normalizedValue: awarenessScore,
        timestamp: new Date(),
        timeframe: ProgressTimeframe.WEEKLY,
        measurementSource: 'ai_analysis',
        confidence: 0.75,
        contextualFactors: ['pattern_recognition'],
        interventionsActive: [],
        crisisLevel: CrisisRiskLevel.NONE,
        clinicallySignificant: awarenessScore > 70,
        reliabilityScore: 0.8,
        outlier: false
      });
    }

    return dataPoints;
  }

  private extractInsightMetrics(context: ProgressTrackingContext): ProgressDataPoint[] {
    const dataPoints: ProgressDataPoint[] = [];
    const insights = context.dataSource.insights;

    if (insights.length > 0) {
      // Insight utilization (shown insights with positive feedback)
      const shownInsights = insights.filter(i => i.shown);
      const positiveInsights = insights.filter(i => i.userFeedback === 'helpful');
      const utilizationScore = shownInsights.length > 0 ? 
        (positiveInsights.length / shownInsights.length) * 100 : 0;

      dataPoints.push({
        id: `insight_utilization_${Date.now()}`,
        userId: context.userId,
        category: ProgressCategory.TREATMENT_ENGAGEMENT,
        metric: ProgressMetric.INSIGHT_UTILIZATION,
        value: insights.length,
        normalizedValue: utilizationScore,
        timestamp: new Date(),
        timeframe: ProgressTimeframe.WEEKLY,
        measurementSource: 'app_behavior',
        confidence: 0.85,
        contextualFactors: ['insight_engagement'],
        interventionsActive: [],
        crisisLevel: CrisisRiskLevel.NONE,
        clinicallySignificant: utilizationScore > 60,
        reliabilityScore: 0.8,
        outlier: false
      });
    }

    return dataPoints;
  }

  // =============================================================================
  // 📊 PROGRESS CALCULATION METHODS
  // =============================================================================

  /**
   * Category-specific progress hesapla
   */
  private async calculateCategoryProgress(
    dataPoints: ProgressDataPoint[], 
    context: ProgressTrackingContext
  ): Promise<ProgressAnalyticsResult['categoryProgress']> {
    const categoryProgress: ProgressAnalyticsResult['categoryProgress'] = [];

    // Group data points by category
    const categorizedData = this.groupDataPointsByCategory(dataPoints);

    for (const [category, points] of categorizedData.entries()) {
      if (points.length === 0) continue;

      // Calculate category score (average of normalized values)
      const categoryScore = points.reduce((sum, point) => sum + point.normalizedValue, 0) / points.length;

      // Calculate trend
      const trend = this.calculateTrendForCategory(points, context);

      // Extract key metrics
      const keyMetrics = this.extractKeyMetricsForCategory(points);

      // Generate insights
      const insights = this.generateCategoryInsights(category, points, trend);

      categoryProgress.push({
        category,
        score: Math.round(categoryScore),
        trend,
        keyMetrics,
        insights
      });
    }

    return categoryProgress;
  }

  /**
   * Overall progress hesapla
   */
  private calculateOverallProgress(
    categoryProgress: ProgressAnalyticsResult['categoryProgress'],
    context: ProgressTrackingContext
  ): ProgressAnalyticsResult['overallProgress'] {
    if (categoryProgress.length === 0) {
      return {
        score: 50,
        trend: ProgressTrend.STABLE,
        changePercent: 0,
        clinicalSignificance: 'none'
      };
    }

    // Weighted average of category scores
    const weights = this.getCategoryWeights();
    let totalScore = 0;
    let totalWeight = 0;

    categoryProgress.forEach(catProgress => {
      const weight = weights[catProgress.category] || 1;
      totalScore += catProgress.score * weight;
      totalWeight += weight;
    });

    const overallScore = totalScore / totalWeight;

    // Calculate overall trend
    const trendCounts = new Map<ProgressTrend, number>();
    categoryProgress.forEach(catProgress => {
      trendCounts.set(catProgress.trend, (trendCounts.get(catProgress.trend) || 0) + 1);
    });

    const overallTrend = Array.from(trendCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0]; // Most common trend

    // Calculate change percent (simplified)
    const changePercent = this.calculateOverallChangePercent(categoryProgress);

    // Determine clinical significance
    const clinicalSignificance = this.determineClinicalSignificance(overallScore, changePercent);

    return {
      score: Math.round(overallScore),
      trend: overallTrend,
      changePercent,
      clinicalSignificance
    };
  }

  // =============================================================================
  // 🔮 PREDICTIVE ANALYTICS
  // =============================================================================

  /**
   * Predictive analytics generate et
   */
  private async generatePredictiveAnalytics(
    dataPoints: ProgressDataPoint[],
    categoryProgress: ProgressAnalyticsResult['categoryProgress'],
    context: ProgressTrackingContext
  ): Promise<ProgressAnalyticsResult['predictions']> {
    // Simplified predictive model
    const recentTrends = categoryProgress.map(cat => cat.trend);
    const improvingTrends = recentTrends.filter(trend => 
      trend === ProgressTrend.SIGNIFICANT_IMPROVEMENT || 
      trend === ProgressTrend.MODERATE_IMPROVEMENT ||
      trend === ProgressTrend.SLIGHT_IMPROVEMENT
    ).length;

    const decliningTrends = recentTrends.filter(trend => 
      trend === ProgressTrend.SIGNIFICANT_DECLINE || 
      trend === ProgressTrend.MODERATE_DECLINE ||
      trend === ProgressTrend.SLIGHT_DECLINE
    ).length;

    let nextMonthTrend: ProgressTrend;
    if (improvingTrends > decliningTrends) {
      nextMonthTrend = ProgressTrend.MODERATE_IMPROVEMENT;
    } else if (decliningTrends > improvingTrends) {
      nextMonthTrend = ProgressTrend.SLIGHT_DECLINE;
    } else {
      nextMonthTrend = ProgressTrend.STABLE;
    }

    // Risk factors (simplified)
    const riskFactors: string[] = [];
    if (decliningTrends > 2) {
      riskFactors.push('Multiple declining metrics');
    }
    
    const compulsionData = dataPoints.find(dp => dp.metric === ProgressMetric.COMPULSION_FREQUENCY);
    if (compulsionData && compulsionData.normalizedValue < 60) {
      riskFactors.push('High compulsion frequency');
    }

    // Protective factors
    const protectiveFactors: string[] = [];
    if (improvingTrends > 2) {
      protectiveFactors.push('Multiple improving metrics');
    }
    
    const engagementData = dataPoints.find(dp => dp.metric === ProgressMetric.APP_ENGAGEMENT);
    if (engagementData && engagementData.normalizedValue > 70) {
      protectiveFactors.push('High engagement level');
    }

    // Recommended interventions
    const recommendedInterventions: CBTTechnique[] = [];
    if (riskFactors.length > 0) {
      recommendedInterventions.push(CBTTechnique.MINDFULNESS_INTEGRATION);
      recommendedInterventions.push(CBTTechnique.COGNITIVE_RESTRUCTURING);
    }

    return {
      nextMonthTrend,
      riskFactors,
      protectiveFactors,
      recommendedInterventions,
      confidenceLevel: 0.65 // Moderate confidence for simplified model
    };
  }

  // =============================================================================
  // 🏆 ACHIEVEMENTS ANALYSIS
  // =============================================================================

  /**
   * Achievements & milestones analiz et
   */
  private async analyzeAchievements(context: ProgressTrackingContext): Promise<ProgressAnalyticsResult['achievements']> {
    const achievements = context.dataSource.achievements;
    
    // Recent achievements (last week)
    const recentAchievements = achievements
      .filter((a: any) => new Date(a.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .map((a: any) => a.name || 'Unnamed achievement');

    // Upcoming milestones (simplified)
    const upcomingMilestones = [
      'Complete 7-day streak',
      'Achieve 10 insights viewed',
      'Complete pattern recognition',
      'Y-BOCS improvement milestone'
    ];

    // Streaks (simplified)
    const streaks = [
      {
        type: 'Daily app usage',
        count: 5,
        isActive: true
      },
      {
        type: 'Compulsion logging',
        count: 3,
        isActive: true
      }
    ];

    return {
      recentAchievements,
      upcomingMilestones,
      streaks
    };
  }

  // =============================================================================
  // 🔧 HELPER METHODS
  // =============================================================================

  private groupDataPointsByCategory(dataPoints: ProgressDataPoint[]): Map<ProgressCategory, ProgressDataPoint[]> {
    const grouped = new Map<ProgressCategory, ProgressDataPoint[]>();
    
    dataPoints.forEach(point => {
      if (!grouped.has(point.category)) {
        grouped.set(point.category, []);
      }
      grouped.get(point.category)!.push(point);
    });

    return grouped;
  }

  private calculateTrendForCategory(points: ProgressDataPoint[], context: ProgressTrackingContext): ProgressTrend {
    if (points.length < 2) return ProgressTrend.STABLE;

    // Simplified trend calculation
    const latestValue = points[points.length - 1].normalizedValue;
    const previousValue = points[0].normalizedValue;
    const changePercent = ((latestValue - previousValue) / previousValue) * 100;

    if (changePercent >= 25) return ProgressTrend.SIGNIFICANT_IMPROVEMENT;
    if (changePercent >= 10) return ProgressTrend.MODERATE_IMPROVEMENT;
    if (changePercent >= 5) return ProgressTrend.SLIGHT_IMPROVEMENT;
    if (changePercent <= -25) return ProgressTrend.SIGNIFICANT_DECLINE;
    if (changePercent <= -10) return ProgressTrend.MODERATE_DECLINE;
    if (changePercent <= -5) return ProgressTrend.SLIGHT_DECLINE;
    return ProgressTrend.STABLE;
  }

  private extractKeyMetricsForCategory(points: ProgressDataPoint[]): ProgressAnalyticsResult['categoryProgress'][0]['keyMetrics'] {
    return points.map(point => ({
      metric: point.metric,
      value: point.value,
      change: point.percentChange || 0,
      trend: this.calculateTrendForCategory([point], {} as any)
    }));
  }

  private generateCategoryInsights(
    category: ProgressCategory, 
    points: ProgressDataPoint[], 
    trend: ProgressTrend
  ): string[] {
    const insights: string[] = [];

    switch (category) {
      case ProgressCategory.SYMPTOM_SEVERITY:
        if (trend === ProgressTrend.MODERATE_IMPROVEMENT || trend === ProgressTrend.SIGNIFICANT_IMPROVEMENT) {
          insights.push('Belirti şiddetinde anlamlı iyileşme gözleniyor');
        }
        break;
      case ProgressCategory.TREATMENT_ENGAGEMENT:
        const engagementPoint = points.find(p => p.metric === ProgressMetric.APP_ENGAGEMENT);
        if (engagementPoint && engagementPoint.normalizedValue > 80) {
          insights.push('Yüksek tedavi katılımı devam ediyor');
        }
        break;
      default:
        insights.push(`${category} kategorisinde ${trend} trend gözleniyor`);
    }

    return insights;
  }

  private getCategoryWeights(): Record<ProgressCategory, number> {
    return {
      [ProgressCategory.SYMPTOM_SEVERITY]: 3,           // Highest weight
      [ProgressCategory.FUNCTIONAL_IMPROVEMENT]: 2.5,
      [ProgressCategory.BEHAVIORAL_CHANGE]: 2,
      [ProgressCategory.EMOTIONAL_REGULATION]: 2,
      [ProgressCategory.COGNITIVE_FLEXIBILITY]: 1.5,
      [ProgressCategory.TREATMENT_ENGAGEMENT]: 1.5,
      [ProgressCategory.QUALITY_OF_LIFE]: 1.5,
      [ProgressCategory.SELF_EFFICACY]: 1,
      [ProgressCategory.SOCIAL_FUNCTIONING]: 1,
      [ProgressCategory.RELAPSE_PREVENTION]: 1
    };
  }

  private calculateOverallChangePercent(categoryProgress: ProgressAnalyticsResult['categoryProgress']): number {
    // Simplified change percent calculation
    const scores = categoryProgress.map(cat => cat.score);
    if (scores.length === 0) return 0;
    
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return (avgScore - 50) * 2; // Normalize around 50 baseline
  }

  private determineClinicalSignificance(score: number, changePercent: number): 'significant' | 'moderate' | 'minimal' | 'none' {
    if (Math.abs(changePercent) >= 30) return 'significant';
    if (Math.abs(changePercent) >= 15) return 'moderate';
    if (Math.abs(changePercent) >= 5) return 'minimal';
    return 'none';
  }

  private determineTimeframePeriod(start: Date, end: Date): ProgressTimeframe {
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diffDays <= 1) return ProgressTimeframe.DAILY;
    if (diffDays <= 7) return ProgressTimeframe.WEEKLY;
    if (diffDays <= 31) return ProgressTimeframe.MONTHLY;
    if (diffDays <= 93) return ProgressTimeframe.QUARTERLY;
    return ProgressTimeframe.YEARLY;
  }

  private assessDataQuality(dataPoints: ProgressDataPoint[], context: ProgressTrackingContext): ProgressAnalyticsResult['dataQuality'] {
    const totalSources = 6; // messages, compulsions, assessments, achievements, insights, patterns
    const availableSources = [
      context.dataSource.messages.length > 0,
      context.dataSource.compulsions.length > 0,
      context.dataSource.assessments.length > 0,
      context.dataSource.achievements.length > 0,
      context.dataSource.insights.length > 0,
      context.dataSource.patterns.length > 0
    ].filter(Boolean).length;

    const completeness = availableSources / totalSources;
    const reliability = dataPoints.length > 0 ? 
      dataPoints.reduce((sum, dp) => sum + dp.reliabilityScore, 0) / dataPoints.length : 0;
    
    // Recency: How recent is the latest data
    const latestTimestamp = Math.max(...dataPoints.map(dp => dp.timestamp.getTime()));
    const daysSinceLatest = (Date.now() - latestTimestamp) / (1000 * 60 * 60 * 24);
    const recency = Math.max(1 - (daysSinceLatest / 7), 0); // Decay over 7 days

    // Consistency: How consistent are the measurements
    const confidence = dataPoints.length > 0 ?
      dataPoints.reduce((sum, dp) => sum + dp.confidence, 0) / dataPoints.length : 0;

    return {
      completeness,
      reliability,
      recency,
      consistency: confidence
    };
  }

  private getDefaultPredictions(): ProgressAnalyticsResult['predictions'] {
    return {
      nextMonthTrend: ProgressTrend.STABLE,
      riskFactors: [],
      protectiveFactors: ['Continued engagement'],
      recommendedInterventions: [CBTTechnique.MINDFULNESS_INTEGRATION],
      confidenceLevel: 0.5
    };
  }

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  /**
   * Progress Analytics durumunu kontrol et
   */
  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_PROGRESS_ANALYTICS');
  }

  /**
   * User için progress data al
   */
  getUserProgressData(userId: string): ProgressDataPoint[] {
    return this.dataCache.get(userId) || [];
  }

  /**
   * Analysis sonucu al
   */
  getAnalysisResult(analysisId: string): ProgressAnalyticsResult | undefined {
    return this.analysisCache.get(analysisId);
  }

  /**
   * Service'i temizle
   */
  async shutdown(): Promise<void> {
    console.log('📈 Progress Analytics: Shutting down...');
    this.isEnabled = false;
    this.dataCache.clear();
    this.analysisCache.clear();
    this.baselineMetrics.clear();
    
    await trackAIInteraction(AIEventType.PROGRESS_ANALYTICS_SHUTDOWN, {
      version: '2.0'
    });
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const progressAnalytics = ProgressAnalytics.getInstance();
export default progressAnalytics;
export { 
  ProgressCategory,
  ProgressMetric,
  ProgressTimeframe,
  ProgressTrend,
  type ProgressDataPoint,
  type ProgressAnalyticsResult,
  type ProgressTrackingContext
};