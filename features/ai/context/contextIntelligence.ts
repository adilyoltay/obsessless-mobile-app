/**
 * 🌍 Context Intelligence Engine - Environmental & Situational Awareness
 * 
 * Bu engine, kullanıcının çevresel faktörlerini, duygusal durumunu ve
 * bağlamsal bilgilerini analiz ederek proaktif terapötik destek sağlar.
 * Sprint 6'nın core component'i olarak real-time adaptive interventions'ı destekler.
 * 
 * ⚠️ CRITICAL: Privacy-first approach - minimal data collection, on-device processing
 * ⚠️ CRITICAL: dataMinimization - process data locally when possible
 * ⚠️ CRITICAL: Turkish language support for cultural sensitivity
 * ⚠️ Feature flag kontrolü: AI_CONTEXT_INTELLIGENCE
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  RiskLevel as CrisisRiskLevel,
  UserTherapeuticProfile,
  AIError,
  AIErrorCode,
  ErrorSeverity
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 CONTEXT INTELLIGENCE TYPES & DEFINITIONS
// =============================================================================

/**
 * Environmental factors affecting user state
 */
export enum EnvironmentalFactor {
  LOCATION = 'location',             // User location context
  TIME_OF_DAY = 'time_of_day',      // Circadian rhythm factors
  WEATHER = 'weather',               // Weather impact on mood
  SOCIAL_CONTEXT = 'social_context', // Social environment
  WORK_CONTEXT = 'work_context',     // Work/study environment
  HOME_CONTEXT = 'home_context',     // Home environment
  TRAVEL_CONTEXT = 'travel_context', // Travel/displacement
  ROUTINE_STATUS = 'routine_status'  // Routine disruption/maintenance
}

/**
 * User activity states
 */
export enum UserActivityState {
  SLEEPING = 'sleeping',
  WORKING = 'working',
  COMMUTING = 'commuting',
  EXERCISING = 'exercising',
  SOCIALIZING = 'socializing',
  RELAXING = 'relaxing',
  EATING = 'eating',
  USING_APP = 'using_app',
  UNKNOWN = 'unknown'
}

/**
 * Stress level indicators
 */
export enum StressLevel {
  VERY_LOW = 'very_low',      // 0-20%
  LOW = 'low',                // 21-40%
  MODERATE = 'moderate',      // 41-60%
  HIGH = 'high',              // 61-80%
  VERY_HIGH = 'very_high'     // 81-100%
}

/**
 * Context Analysis Result
 */
export interface ContextAnalysisResult {
  userId: string;
  timestamp: Date;
  analysisId: string;
  
  // Environmental context
  environmentalFactors: {
    factor: EnvironmentalFactor;
    value: string | number;
    confidence: number; // 0-1
    source: 'device' | 'user_input' | 'inferred' | 'api';
  }[];
  
  // User state
  userState: {
    activityState: UserActivityState;
    stressLevel: StressLevel;
    moodIndicator: 'positive' | 'neutral' | 'negative' | 'unknown';
    energyLevel: number; // 0-100
    socialEngagement: number; // 0-100
  };
  
  // Risk assessment
  riskAssessment: {
    overallRisk: CrisisRiskLevel;
    riskFactors: string[];
    protectiveFactors: string[];
    interventionUrgency: 'none' | 'low' | 'medium' | 'high' | 'immediate';
  };
  
  // Contextual insights
  insights: {
    keyObservations: string[];
    patterns: string[];
    recommendations: string[];
    predictedNeeds: string[];
  };
  
  // Privacy & data quality
  privacyLevel: 'minimal' | 'standard' | 'enhanced';
  dataQuality: number; // 0-1
  sources: string[];
}

/**
 * Context Intelligence Configuration
 */
export interface ContextIntelligenceConfig {
  enabled: boolean;
  privacyMode: 'strict' | 'balanced' | 'comprehensive';
  dataRetention: number; // hours
  analysisFrequency: number; // minutes
  
  // Feature toggles
  locationAnalysis: boolean;
  calendarIntegration: boolean;
  weatherIntegration: boolean;
  deviceStateAnalysis: boolean;
  appUsageAnalysis: boolean;
  
  // Sensitivity settings
  riskSensitivity: 'low' | 'medium' | 'high';
  interventionThreshold: number; // 0-1
  predictionHorizon: number; // hours
}

/**
 * Context Intelligence Context (meta!)
 */
export interface ContextIntelligenceContext {
  userId: string;
  userProfile: UserTherapeuticProfile;
  timeframe: {
    start: Date;
    end: Date;
    analysisDepth: 'quick' | 'standard' | 'comprehensive';
  };
  
  // Available data sources
  availableData: {
    deviceState: boolean;
    locationData: boolean;
    calendarData: boolean;
    weatherData: boolean;
    appUsageData: boolean;
    userInputData: boolean;
  };
  
  // User preferences
  userPreferences: {
    privacyLevel: 'minimal' | 'standard' | 'enhanced';
    analysisFrequency: 'real_time' | 'periodic' | 'on_demand';
    interventionStyle: 'proactive' | 'reactive' | 'manual';
  };
}

// =============================================================================
// 🌍 CONTEXT INTELLIGENCE ENGINE IMPLEMENTATION
// =============================================================================

class ContextIntelligenceEngine {
  private static instance: ContextIntelligenceEngine;
  private isEnabled: boolean = false;
  private config: ContextIntelligenceConfig;
  private analysisCache: Map<string, ContextAnalysisResult> = new Map();
  private activeAnalysis: Map<string, Promise<ContextAnalysisResult>> = new Map();

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  static getInstance(): ContextIntelligenceEngine {
    if (!ContextIntelligenceEngine.instance) {
      ContextIntelligenceEngine.instance = new ContextIntelligenceEngine();
    }
    return ContextIntelligenceEngine.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION & SETUP
  // =============================================================================

  /**
   * Context Intelligence Engine'i başlat
   */
  async initialize(): Promise<void> {
    if (__DEV__) console.log('🌍 Context Intelligence Engine: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_CONTEXT_INTELLIGENCE')) {
        if (__DEV__) console.log('🚫 Context Intelligence disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      // Privacy compliance check
      if (!this.validatePrivacyCompliance()) {
        if (__DEV__) console.warn('⚠️ Privacy compliance requirements not met');
        this.isEnabled = false;
        return;
      }

      this.isEnabled = true;
      
      // Telemetry
      await trackAIInteraction(AIEventType.CONTEXT_INTELLIGENCE_INITIALIZED, {
        version: '1.0',
        privacyMode: this.config.privacyMode,
        enabledFeatures: this.getEnabledFeatures()
      });

      if (__DEV__) console.log('✅ Context Intelligence Engine initialized successfully');

    } catch (error) {
      if (__DEV__) console.error('❌ Context Intelligence Engine initialization failed:', error);
      this.isEnabled = false;
      
      await trackAIError({
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: 'Context Intelligence Engine başlatılamadı',
        severity: ErrorSeverity.HIGH,
        context: { component: 'ContextIntelligenceEngine', method: 'initialize' }
      });
      
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN CONTEXT ANALYSIS METHODS
  // =============================================================================

  /**
   * Comprehensive context analysis - Ana metod
   */
  async analyzeContext(context: ContextIntelligenceContext): Promise<ContextAnalysisResult> {
    if (!this.isEnabled) {
      const error: AIError = {
        code: AIErrorCode.FEATURE_DISABLED,
        message: 'Context Intelligence Engine is not enabled',
        timestamp: new Date(),
        severity: ErrorSeverity.MEDIUM,
        recoverable: true
      };
      throw error;
    }

    const analysisId = `context_analysis_${Date.now()}_${context.userId}`;
    const startTime = Date.now();

    try {
      if (__DEV__) console.log(`🌍 Starting context analysis for user ${context.userId}`);

      // Check for existing analysis
      if (this.activeAnalysis.has(context.userId)) {
        if (__DEV__) console.log('⏳ Context analysis already in progress, waiting...');
        return await this.activeAnalysis.get(context.userId)!;
      }

      // Start analysis
      const analysisPromise = this.performContextAnalysis(context, analysisId, startTime);
      this.activeAnalysis.set(context.userId, analysisPromise);

      try {
        const result = await analysisPromise;
        
        // Cache results (with expiration)
        this.analysisCache.set(context.userId, result);
        setTimeout(() => {
          this.analysisCache.delete(context.userId);
        }, this.config.dataRetention * 60 * 60 * 1000); // Convert hours to ms
        
        // Telemetry
        await trackAIInteraction(AIEventType.CONTEXT_ANALYSIS_COMPLETED, {
          userId: context.userId,
          analysisId,
          overallRisk: result.riskAssessment.overallRisk,
          interventionUrgency: result.riskAssessment.interventionUrgency,
          dataQuality: result.dataQuality,
          latency: Date.now() - startTime,
          environmentalFactors: result.environmentalFactors.length,
          insights: result.insights.keyObservations.length
        });

        if (__DEV__) console.log(`✅ Context analysis completed: ${result.riskAssessment.overallRisk} risk level`);
        return result;

      } finally {
        this.activeAnalysis.delete(context.userId);
      }

    } catch (error) {
      if (__DEV__) console.error('❌ Context analysis failed:', error);
      
      await trackAIError({
        code: AIErrorCode.PROCESSING_FAILED,
        message: 'Context analysis başarısız',
        severity: ErrorSeverity.MEDIUM,
        context: { 
          component: 'ContextIntelligenceEngine', 
          method: 'analyzeContext',
          userId: context.userId,
          latency: Date.now() - startTime
        }
      });

      throw error;
    }
  }

  /**
   * Quick context check - Lightweight analysis
   */
  async quickContextCheck(userId: string): Promise<{
    riskLevel: CrisisRiskLevel;
    stressLevel: StressLevel;
    interventionRecommended: boolean;
    context: string;
  }> {
    try {
      // Check cache first
      const cachedResult = this.analysisCache.get(userId);
      if (cachedResult && this.isCacheValid(cachedResult)) {
        return {
          riskLevel: cachedResult.riskAssessment.overallRisk,
          stressLevel: cachedResult.userState.stressLevel,
          interventionRecommended: cachedResult.riskAssessment.interventionUrgency !== 'none',
          context: cachedResult.userState.activityState
        };
      }

      // Lightweight analysis
      const basicContext = await this.getBasicContext(userId);
      const riskLevel = this.assessBasicRisk(basicContext);
      const stressLevel = this.estimateStressLevel(basicContext);

      return {
        riskLevel,
        stressLevel,
        interventionRecommended: riskLevel !== CrisisRiskLevel.NONE || stressLevel === StressLevel.HIGH,
        context: basicContext.activityState
      };

    } catch (error) {
      console.warn('⚠️ Quick context check failed:', error);
      return {
        riskLevel: CrisisRiskLevel.NONE,
        stressLevel: StressLevel.MODERATE,
        interventionRecommended: false,
        context: 'unknown'
      };
    }
  }

  // =============================================================================
  // 🔍 CONTEXT ANALYSIS IMPLEMENTATION
  // =============================================================================

  /**
   * Actual context analysis implementation
   */
  private async performContextAnalysis(
    context: ContextIntelligenceContext,
    analysisId: string,
    startTime: number
  ): Promise<ContextAnalysisResult> {
    
    // 1. Environmental factor analysis
    const environmentalFactors = await this.analyzeEnvironmentalFactors(context);
    
    // 2. User state detection
    const userState = await this.detectUserState(context, environmentalFactors);
    
    // 3. Risk assessment
    const riskAssessment = await this.assessContextualRisk(context, environmentalFactors, userState);
    
    // 4. Generate contextual insights
    const insights = await this.generateContextualInsights(context, environmentalFactors, userState, riskAssessment);
    
    // 5. Calculate data quality
    const dataQuality = this.calculateDataQuality(context, environmentalFactors);

    const result: ContextAnalysisResult = {
      userId: context.userId,
      timestamp: new Date(),
      analysisId,
      environmentalFactors,
      userState,
      riskAssessment,
      insights,
      privacyLevel: context.userPreferences.privacyLevel,
      dataQuality,
      sources: this.getDataSources(context)
    };

    return result;
  }

  /**
   * Analyze environmental factors
   */
  private async analyzeEnvironmentalFactors(context: ContextIntelligenceContext): Promise<ContextAnalysisResult['environmentalFactors']> {
    const factors: ContextAnalysisResult['environmentalFactors'] = [];

    try {
      // Time of day analysis
      const timeOfDay = new Date().getHours();
      factors.push({
        factor: EnvironmentalFactor.TIME_OF_DAY,
        value: timeOfDay,
        confidence: 1.0,
        source: 'device'
      });

      // Location context (privacy-aware)
      if (this.config.locationAnalysis && context.availableData.locationData) {
        const locationContext = await this.analyzeLocationContext(context);
        if (locationContext) {
          factors.push({
            factor: EnvironmentalFactor.LOCATION,
            value: locationContext.type, // 'home', 'work', 'commute', 'unknown'
            confidence: locationContext.confidence,
            source: 'device'
          });
        }
      }

      // Weather analysis (if enabled)
      if (this.config.weatherIntegration) {
        const weatherImpact = await this.analyzeWeatherImpact();
        if (weatherImpact) {
          factors.push({
            factor: EnvironmentalFactor.WEATHER,
            value: weatherImpact.mood_impact, // 'positive', 'neutral', 'negative'
            confidence: weatherImpact.confidence,
            source: 'api'
          });
        }
      }

      // Routine status analysis
      const routineStatus = this.analyzeRoutineStatus(context);
      factors.push({
        factor: EnvironmentalFactor.ROUTINE_STATUS,
        value: routineStatus.status, // 'normal', 'disrupted', 'new'
        confidence: routineStatus.confidence,
        source: 'inferred'
      });

      // Social context (if calendar integration enabled)
      if (this.config.calendarIntegration && context.availableData.calendarData) {
        const socialContext = await this.analyzeSocialContext(context);
        if (socialContext) {
          factors.push({
            factor: EnvironmentalFactor.SOCIAL_CONTEXT,
            value: socialContext.type, // 'alone', 'family', 'work', 'social'
            confidence: socialContext.confidence,
            source: 'inferred'
          });
        }
      }

    } catch (error) {
      if (__DEV__) console.warn('⚠️ Environmental factor analysis failed:', error);
    }

    return factors;
  }

  /**
   * Detect user state
   */
  private async detectUserState(
    context: ContextIntelligenceContext,
    environmentalFactors: ContextAnalysisResult['environmentalFactors']
  ): Promise<ContextAnalysisResult['userState']> {
    
    // Activity state detection
    const activityState = this.detectActivityState(context, environmentalFactors);
    
    // Stress level estimation
    const stressLevel = this.estimateStressFromFactors(environmentalFactors);
    
    // Mood indicator inference
    const moodIndicator = this.inferMoodFromContext(context, environmentalFactors);
    
    // Energy level estimation
    const energyLevel = this.estimateEnergyLevel(environmentalFactors);
    
    // Social engagement assessment
    const socialEngagement = this.assessSocialEngagement(context, environmentalFactors);

    return {
      activityState,
      stressLevel,
      moodIndicator,
      energyLevel,
      socialEngagement
    };
  }

  /**
   * Assess contextual risk
   */
  private async assessContextualRisk(
    context: ContextIntelligenceContext,
    environmentalFactors: ContextAnalysisResult['environmentalFactors'],
    userState: ContextAnalysisResult['userState']
  ): Promise<ContextAnalysisResult['riskAssessment']> {
    
    const riskFactors: string[] = [];
    const protectiveFactors: string[] = [];
    let overallRiskScore = 0;

    // Analyze environmental risk factors
    environmentalFactors.forEach(factor => {
      const riskContribution = this.calculateEnvironmentalRisk(factor);
      overallRiskScore += riskContribution.score;
      
      if (riskContribution.score > 0.3) {
        riskFactors.push(riskContribution.description);
      } else if (riskContribution.score < -0.2) {
        protectiveFactors.push(riskContribution.description);
      }
    });

    // Analyze user state risk factors
    const stateRisk = this.calculateUserStateRisk(userState);
    overallRiskScore += stateRisk.score;
    riskFactors.push(...stateRisk.riskFactors);
    protectiveFactors.push(...stateRisk.protectiveFactors);

    // Determine overall risk level
    const overallRisk = this.mapScoreToRiskLevel(overallRiskScore);
    
    // Determine intervention urgency
    const interventionUrgency = this.determineInterventionUrgency(overallRisk, userState, riskFactors);

    return {
      overallRisk,
      riskFactors: [...new Set(riskFactors)], // Remove duplicates
      protectiveFactors: [...new Set(protectiveFactors)],
      interventionUrgency
    };
  }

  /**
   * Generate contextual insights
   */
  private async generateContextualInsights(
    context: ContextIntelligenceContext,
    environmentalFactors: ContextAnalysisResult['environmentalFactors'],
    userState: ContextAnalysisResult['userState'],
    riskAssessment: ContextAnalysisResult['riskAssessment']
  ): Promise<ContextAnalysisResult['insights']> {
    
    const keyObservations: string[] = [];
    const patterns: string[] = [];
    const recommendations: string[] = [];
    const predictedNeeds: string[] = [];

    // Generate key observations
    keyObservations.push(`User is currently ${userState.activityState} with ${userState.stressLevel} stress level`);
    
    if (userState.energyLevel < 30) {
      keyObservations.push('Low energy levels detected');
    }
    
    if (userState.socialEngagement < 20) {
      keyObservations.push('Limited social engagement observed');
    }

    // Identify patterns
    const timeOfDayFactor = environmentalFactors.find(f => f.factor === EnvironmentalFactor.TIME_OF_DAY);
    if (timeOfDayFactor && typeof timeOfDayFactor.value === 'number') {
      if (timeOfDayFactor.value >= 22 || timeOfDayFactor.value <= 6) {
        patterns.push('Late night or early morning usage pattern');
      }
    }

    const routineFactor = environmentalFactors.find(f => f.factor === EnvironmentalFactor.ROUTINE_STATUS);
    if (routineFactor && routineFactor.value === 'disrupted') {
      patterns.push('Routine disruption detected');
    }

    // Generate recommendations
    if (userState.stressLevel === StressLevel.HIGH || userState.stressLevel === StressLevel.VERY_HIGH) {
      recommendations.push('Consider stress reduction techniques');
      recommendations.push('Practice mindfulness or breathing exercises');
    }

    if (userState.energyLevel < 40) {
      recommendations.push('Focus on energy-building activities');
      recommendations.push('Consider gentle physical activity');
    }

    if (riskAssessment.overallRisk !== CrisisRiskLevel.NONE) {
      recommendations.push('Enhanced monitoring recommended');
      recommendations.push('Consider reaching out for support');
    }

    // Predict needs
    if (userState.activityState === UserActivityState.WORKING && userState.stressLevel === StressLevel.HIGH) {
      predictedNeeds.push('Work break intervention');
      predictedNeeds.push('Stress management support');
    }

    if (userState.socialEngagement < 30) {
      predictedNeeds.push('Social connection encouragement');
    }

    return {
      keyObservations,
      patterns,
      recommendations,
      predictedNeeds
    };
  }

  // =============================================================================
  // 🔧 HELPER METHODS
  // =============================================================================

  private getDefaultConfig(): ContextIntelligenceConfig {
    return {
      enabled: true,
      privacyMode: 'balanced',
      dataRetention: 24, // hours
      analysisFrequency: 15, // minutes
      
      locationAnalysis: false, // Privacy-first default
      calendarIntegration: false,
      weatherIntegration: false,
      deviceStateAnalysis: true,
      appUsageAnalysis: true,
      
      riskSensitivity: 'medium',
      interventionThreshold: 0.6,
      predictionHorizon: 4 // hours
    };
  }

  private validatePrivacyCompliance(): boolean {
    // Basic privacy compliance checks
    return this.config.privacyMode !== undefined && 
           this.config.dataRetention <= 72; // Max 72 hours retention
  }

  private getEnabledFeatures(): string[] {
    const features: string[] = [];
    if (this.config.locationAnalysis) features.push('location');
    if (this.config.calendarIntegration) features.push('calendar');
    if (this.config.weatherIntegration) features.push('weather');
    if (this.config.deviceStateAnalysis) features.push('device_state');
    if (this.config.appUsageAnalysis) features.push('app_usage');
    return features;
  }

  private async getBasicContext(userId: string): Promise<{ activityState: UserActivityState; timeOfDay: number }> {
    // Simplified context for quick checks
    const now = new Date();
    const hour = now.getHours();
    
    let activityState = UserActivityState.UNKNOWN;
    
    // Basic time-based activity inference
    if (hour >= 23 || hour <= 6) {
      activityState = UserActivityState.SLEEPING;
    } else if (hour >= 9 && hour <= 17) {
      activityState = UserActivityState.WORKING;
    } else {
      activityState = UserActivityState.RELAXING;
    }

    return {
      activityState,
      timeOfDay: hour
    };
  }

  private assessBasicRisk(basicContext: { activityState: UserActivityState; timeOfDay: number }): CrisisRiskLevel {
    // Very basic risk assessment
    if (basicContext.timeOfDay >= 1 && basicContext.timeOfDay <= 5) {
      return CrisisRiskLevel.LOW; // Late night usage might indicate distress
    }
    return CrisisRiskLevel.NONE;
  }

  private estimateStressLevel(basicContext: { activityState: UserActivityState; timeOfDay: number }): StressLevel {
    // Simplified stress estimation
    if (basicContext.activityState === UserActivityState.WORKING) {
      return StressLevel.MODERATE;
    }
    if (basicContext.timeOfDay >= 1 && basicContext.timeOfDay <= 5) {
      return StressLevel.HIGH;
    }
    return StressLevel.LOW;
  }

  private isCacheValid(cachedResult: ContextAnalysisResult): boolean {
    const now = Date.now();
    const cacheAge = now - cachedResult.timestamp.getTime();
    const maxAge = this.config.analysisFrequency * 60 * 1000; // Convert minutes to ms
    return cacheAge < maxAge;
  }

  // Placeholder methods for complex analysis (to be implemented)
  private async analyzeLocationContext(context: ContextIntelligenceContext): Promise<{ type: string; confidence: number } | null> {
    // Privacy-aware location analysis
    return null; // Disabled for privacy
  }

  private async analyzeWeatherImpact(): Promise<{ mood_impact: string; confidence: number } | null> {
    // Weather API integration (if enabled)
    return null; // Not implemented yet
  }

  private analyzeRoutineStatus(context: ContextIntelligenceContext): { status: string; confidence: number } {
    // Routine analysis based on historical patterns
    return { status: 'normal', confidence: 0.7 };
  }

  private async analyzeSocialContext(context: ContextIntelligenceContext): Promise<{ type: string; confidence: number } | null> {
    // Calendar-based social context analysis
    return null; // Not implemented yet
  }

  private detectActivityState(context: ContextIntelligenceContext, factors: ContextAnalysisResult['environmentalFactors']): UserActivityState {
    // Activity state detection based on environmental factors
    const timeOfDay = factors.find(f => f.factor === EnvironmentalFactor.TIME_OF_DAY);
    if (timeOfDay && typeof timeOfDay.value === 'number') {
      const hour = timeOfDay.value;
      if (hour >= 23 || hour <= 6) return UserActivityState.SLEEPING;
      if (hour >= 9 && hour <= 17) return UserActivityState.WORKING;
    }
    return UserActivityState.UNKNOWN;
  }

  private estimateStressFromFactors(factors: ContextAnalysisResult['environmentalFactors']): StressLevel {
    // Stress estimation from environmental factors
    let stressScore = 0;

    factors.forEach(factor => {
      switch (factor.factor) {
        case EnvironmentalFactor.ROUTINE_STATUS:
          if (factor.value === 'disrupted') stressScore += 0.3;
          break;
        case EnvironmentalFactor.TIME_OF_DAY:
          if (typeof factor.value === 'number' && (factor.value >= 1 && factor.value <= 5)) {
            stressScore += 0.4; // Late night usage
          }
          break;
      }
    });

    if (stressScore >= 0.8) return StressLevel.VERY_HIGH;
    if (stressScore >= 0.6) return StressLevel.HIGH;
    if (stressScore >= 0.4) return StressLevel.MODERATE;
    if (stressScore >= 0.2) return StressLevel.LOW;
    return StressLevel.VERY_LOW;
  }

  private inferMoodFromContext(context: ContextIntelligenceContext, factors: ContextAnalysisResult['environmentalFactors']): 'positive' | 'neutral' | 'negative' | 'unknown' {
    // Basic mood inference
    return 'neutral';
  }

  private estimateEnergyLevel(factors: ContextAnalysisResult['environmentalFactors']): number {
    // Energy level estimation (0-100)
    const timeOfDay = factors.find(f => f.factor === EnvironmentalFactor.TIME_OF_DAY);
    if (timeOfDay && typeof timeOfDay.value === 'number') {
      const hour = timeOfDay.value;
      if (hour >= 6 && hour <= 10) return 80; // Morning energy
      if (hour >= 14 && hour <= 16) return 60; // Afternoon dip
      if (hour >= 22 || hour <= 5) return 30; // Night/early morning
    }
    return 70; // Default moderate energy
  }

  private assessSocialEngagement(context: ContextIntelligenceContext, factors: ContextAnalysisResult['environmentalFactors']): number {
    // Social engagement assessment (0-100)
    return 50; // Default moderate engagement
  }

  private calculateEnvironmentalRisk(factor: ContextAnalysisResult['environmentalFactors'][0]): { score: number; description: string } {
    // Environmental risk calculation
    switch (factor.factor) {
      case EnvironmentalFactor.TIME_OF_DAY:
        if (typeof factor.value === 'number' && (factor.value >= 1 && factor.value <= 5)) {
          return { score: 0.4, description: 'Late night app usage detected' };
        }
        break;
      case EnvironmentalFactor.ROUTINE_STATUS:
        if (factor.value === 'disrupted') {
          return { score: 0.3, description: 'Routine disruption increases stress risk' };
        }
        break;
    }
    return { score: 0, description: 'Normal environmental factor' };
  }

  private calculateUserStateRisk(userState: ContextAnalysisResult['userState']): { 
    score: number; 
    riskFactors: string[]; 
    protectiveFactors: string[] 
  } {
    let score = 0;
    const riskFactors: string[] = [];
    const protectiveFactors: string[] = [];

    // Stress level risk
    switch (userState.stressLevel) {
      case StressLevel.VERY_HIGH:
        score += 0.8;
        riskFactors.push('Very high stress levels');
        break;
      case StressLevel.HIGH:
        score += 0.6;
        riskFactors.push('High stress levels');
        break;
      case StressLevel.LOW:
      case StressLevel.VERY_LOW:
        protectiveFactors.push('Low stress levels');
        break;
    }

    // Energy level
    if (userState.energyLevel < 30) {
      score += 0.3;
      riskFactors.push('Low energy levels');
    } else if (userState.energyLevel > 70) {
      protectiveFactors.push('Good energy levels');
    }

    // Social engagement
    if (userState.socialEngagement < 20) {
      score += 0.2;
      riskFactors.push('Low social engagement');
    } else if (userState.socialEngagement > 60) {
      protectiveFactors.push('Good social engagement');
    }

    return { score, riskFactors, protectiveFactors };
  }

  private mapScoreToRiskLevel(score: number): CrisisRiskLevel {
    if (score >= 0.8) return CrisisRiskLevel.HIGH;
    if (score >= 0.6) return CrisisRiskLevel.MEDIUM;
    if (score >= 0.3) return CrisisRiskLevel.LOW;
    return CrisisRiskLevel.NONE;
  }

  private determineInterventionUrgency(
    riskLevel: CrisisRiskLevel, 
    userState: ContextAnalysisResult['userState'], 
    riskFactors: string[]
  ): 'none' | 'low' | 'medium' | 'high' | 'immediate' {
    
    if (riskLevel === CrisisRiskLevel.HIGH) return 'immediate';
    if (riskLevel === CrisisRiskLevel.MEDIUM) return 'high';
    if (riskLevel === CrisisRiskLevel.LOW) return 'medium';
    
    if (userState.stressLevel === StressLevel.VERY_HIGH) return 'high';
    if (userState.stressLevel === StressLevel.HIGH) return 'medium';
    
    if (riskFactors.length >= 3) return 'medium';
    if (riskFactors.length >= 1) return 'low';
    
    return 'none';
  }

  private calculateDataQuality(context: ContextIntelligenceContext, factors: ContextAnalysisResult['environmentalFactors']): number {
    let qualityScore = 0;
    let totalFactors = 0;

    Object.entries(context.availableData).forEach(([key, available]) => {
      totalFactors++;
      if (available) qualityScore++;
    });

    // Boost score based on factor confidence
    const avgConfidence = factors.length > 0 ? 
      factors.reduce((sum, f) => sum + f.confidence, 0) / factors.length : 0.5;

    return Math.min((qualityScore / totalFactors) * avgConfidence, 1.0);
  }

  private getDataSources(context: ContextIntelligenceContext): string[] {
    const sources: string[] = [];
    if (context.availableData.deviceState) sources.push('device');
    if (context.availableData.locationData) sources.push('location');
    if (context.availableData.calendarData) sources.push('calendar');
    if (context.availableData.weatherData) sources.push('weather');
    if (context.availableData.appUsageData) sources.push('app_usage');
    if (context.availableData.userInputData) sources.push('user_input');
    return sources;
  }

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  /**
   * Context Intelligence durumunu kontrol et
   */
  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_CONTEXT_INTELLIGENCE');
  }

  /**
   * Configuration güncelle
   */
  updateConfiguration(newConfig: Partial<ContextIntelligenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ContextIntelligenceConfig {
    return { ...this.config };
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Engine'i temizle
   */
  async shutdown(): Promise<void> {
      if (__DEV__) console.log('🌍 Context Intelligence Engine: Shutting down...');
    this.isEnabled = false;
    this.analysisCache.clear();
    this.activeAnalysis.clear();
    
    await trackAIInteraction(AIEventType.CONTEXT_INTELLIGENCE_SHUTDOWN, {
      version: '1.0'
    });
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const contextIntelligenceEngine = ContextIntelligenceEngine.getInstance();
export default contextIntelligenceEngine;