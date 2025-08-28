/**
 * 🎯 JITAI Engine - Just-In-Time Adaptive Intervention System
 * 
 * Bu engine, optimal timing prediction ve intervention personalization
 * konusunda uzmanlaşmış bir sistemdir. Machine learning models ile
 * en etkili müdahale zamanlarını tahmin eder ve A/B testing framework'ü sağlar.
 * 
 * ⚠️ CRITICAL: Cultural sensitivity ve user autonomy preservation
 * ⚠️ Feature flag kontrolü: AI_JITAI_SYSTEM
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  CrisisRiskLevel,
  UserTherapeuticProfile,
  AIError,
  AIErrorCode,
  ErrorSeverity
} from '@/features/ai/types';
import { 
  AdaptiveIntervention,
  InterventionCategory,
  InterventionUrgency,
  adaptiveInterventionsEngine
} from '@/features/ai/interventions/adaptiveInterventions';
import { 
  ContextAnalysisResult,
  StressLevel,
  UserActivityState
} from '@/features/ai/context/contextIntelligence';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 JITAI TYPES & DEFINITIONS
// =============================================================================

/**
 * Timing prediction models
 */
export enum TimingModel {
  CIRCADIAN = 'circadian',           // Circadian rhythm based
  BEHAVIORAL = 'behavioral',         // User behavior patterns
  CONTEXTUAL = 'contextual',         // Environmental context
  STRESS_BASED = 'stress_based',     // Stress level patterns
  HYBRID = 'hybrid',                 // Combined approach
  MACHINE_LEARNING = 'ml'            // ML-based prediction
}

/**
 * Intervention effectiveness factors
 */
export enum EffectivenessFactor {
  TIME_OF_DAY = 'time_of_day',
  USER_ACTIVITY = 'user_activity',
  STRESS_LEVEL = 'stress_level',
  MOOD_STATE = 'mood_state',
  SOCIAL_CONTEXT = 'social_context',
  LOCATION_CONTEXT = 'location_context',
  RECENT_INTERVENTIONS = 'recent_interventions',
  HISTORICAL_RESPONSE = 'historical_response'
}

/**
 * A/B Test Configuration
 */
export interface ABTestConfig {
  testId: string;
  name: string;
  description: string;
  
  // Test parameters
  variants: {
    id: string;
    name: string;
    weight: number; // 0-1, total should sum to 1
    config: {
      interventionCategory?: InterventionCategory;
      timingDelay?: number; // milliseconds
      deliveryMethod?: string;
      contentVariation?: string;
      personalizedApproach?: string;
    };
  }[];
  
  // Test criteria
  targetPopulation: {
    userSegments: string[];
    inclusionCriteria: Record<string, any>;
    exclusionCriteria: Record<string, any>;
  };
  
  // Success metrics
  successMetrics: {
    primary: string; // e.g., 'intervention_completion_rate'
    secondary: string[];
    measurementWindow: number; // hours
  };
  
  // Test lifecycle
  startDate: Date;
  endDate: Date;
  minSampleSize: number;
  confidenceLevel: number; // 0.95 for 95%
  
  // Status
  isActive: boolean;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
}

/**
 * Timing Prediction Result
 */
export interface TimingPredictionResult {
  userId: string;
  predictionId: string;
  timestamp: Date;
  
  // Optimal timing
  optimalTiming: {
    recommendedTime: Date;
    confidence: number; // 0-1
    rationale: string;
    alternativeTimes: {
      time: Date;
      confidence: number;
      reason: string;
    }[];
  };
  
  // Effectiveness prediction
  effectivenessPrediction: {
    estimatedEffectiveness: number; // 0-1
    contributingFactors: {
      factor: EffectivenessFactor;
      impact: number; // -1 to 1
      confidence: number; // 0-1
    }[];
    riskFactors: string[];
    enhancementFactors: string[];
  };
  
  // Context analysis
  contextualFactors: {
    currentStressLevel: StressLevel;
    activityState: UserActivityState;
    timeOfDay: number;
    recentInterventionCount: number;
    historicalSuccessRate: number;
  };
  
  // Model information
  modelUsed: TimingModel;
  modelVersion: string;
  predictionQuality: number; // 0-1
}

/**
 * JITAI Configuration
 */
export interface JITAIConfig {
  enabled: boolean;
  
  // Prediction settings
  primaryTimingModel: TimingModel;
  fallbackModels: TimingModel[];
  predictionHorizon: number; // hours
  confidenceThreshold: number; // 0-1
  
  // Personalization
  enablePersonalization: boolean;
  personalizedFactors: EffectivenessFactor[];
  adaptationRate: number; // 0-1, how quickly to adapt to new data
  
  // A/B Testing
  enableABTesting: boolean;
  maxConcurrentTests: number;
  testParticipationRate: number; // 0-1
  
  // Cultural adaptation
  culturalSensitivity: boolean;
  culturalContext: 'turkish' | 'international' | 'adaptive';
  localizedTimingRules: boolean;
  
  // Safety and ethics
  respectUserBoundaries: boolean;
  maxInterventionsPerWindow: number;
  interventionCooldown: number; // minutes
  emergencyOverride: boolean;
  
  // Quality control
  enableQualityControl: boolean;
  minimumDataPoints: number;
  qualityThreshold: number; // 0-1
}

/**
 * JITAI Context
 */
export interface JITAIContext {
  userId: string;
  userProfile: UserTherapeuticProfile;
  currentContext: ContextAnalysisResult;
  
  // Historical data
  interventionHistory: {
    intervention: AdaptiveIntervention;
    effectiveness: number;
    contextAtTime: ContextAnalysisResult;
  }[];
  
  // Current state
  currentUserState: {
    isAppActive: boolean;
    lastInteraction: Date;
    recentMood: string;
    energyLevel: number;
    stressPattern: StressLevel[];
  };
  
  // Personalization data
  personalizationProfile: {
    preferredTimes: string[];
    responsiveStates: UserActivityState[];
    effectiveCategories: InterventionCategory[];
    culturalPreferences: Record<string, any>;
    communicationStyle: 'direct' | 'gentle' | 'encouraging';
  };
}

// =============================================================================
// 🎯 JITAI ENGINE IMPLEMENTATION
// =============================================================================

class JITAIEngine {
  private static instance: JITAIEngine;
  private isEnabled: boolean = false;
  private config: JITAIConfig;
  private activeABTests: Map<string, ABTestConfig> = new Map();
  private predictionCache: Map<string, TimingPredictionResult> = new Map();
  private personalizationProfiles: Map<string, any> = new Map();
  private effectivenessData: Map<string, any[]> = new Map();

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  static getInstance(): JITAIEngine {
    if (!JITAIEngine.instance) {
      JITAIEngine.instance = new JITAIEngine();
    }
    return JITAIEngine.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION & SETUP
  // =============================================================================

  /**
   * JITAI Engine'i başlat
   */
  async initialize(): Promise<void> {
    console.log('🎯 JITAI Engine: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_JITAI_SYSTEM')) {
        console.log('🚫 JITAI System disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      // Dependency check
      if (!adaptiveInterventionsEngine.enabled) {
        console.warn('⚠️ Adaptive Interventions Engine not available, JITAI will have limited functionality');
      }

      this.isEnabled = true;
      
      // Initialize A/B testing framework
      await this.initializeABTestingFramework();
      
      // Telemetry
      await trackAIInteraction(AIEventType.JITAI_INITIALIZED, {
        version: '1.0',
        primaryTimingModel: this.config.primaryTimingModel,
        abTestingEnabled: this.config.enableABTesting,
        culturalContext: this.config.culturalContext
      });

      console.log('✅ JITAI Engine initialized successfully');

    } catch (error) {
      console.error('❌ JITAI Engine initialization failed:', error);
      this.isEnabled = false;
      
      await trackAIError({
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: 'JITAI Engine başlatılamadı',
        severity: ErrorSeverity.HIGH,
        context: { component: 'JITAIEngine', method: 'initialize' }
      });
      
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN JITAI METHODS
  // =============================================================================

  /**
   * Predict optimal intervention timing - Ana metod
   */
  async predictOptimalTiming(context: JITAIContext): Promise<TimingPredictionResult> {
    if (!this.isEnabled) {
      const error: AIError = {
        code: AIErrorCode.FEATURE_DISABLED,
        message: 'JITAI Engine is not enabled',
        timestamp: new Date(),
        severity: ErrorSeverity.MEDIUM,
        recoverable: true
      };
      throw error;
    }

    // Robust context validation - prevent runtime crashes
    if (!context) {
      const error: AIError = {
        code: AIErrorCode.INVALID_INPUT,
        message: 'Context is required for timing prediction',
        timestamp: new Date(),
        severity: ErrorSeverity.HIGH,
        recoverable: false
      };
      await trackAIError(error);
      throw error;
    }

    // Check required fields to prevent "Cannot read property 'userState' of undefined"
    if (!context.currentContext?.userState) {
      const error: AIError = {
        code: AIErrorCode.INVALID_INPUT,
        message: 'Context must include currentContext.userState for timing prediction',
        timestamp: new Date(),
        severity: ErrorSeverity.HIGH,
        recoverable: true
      };
      await trackAIError(error);
      // Soft-fallback: normalize minimal context and return default prediction instead of throwing
      const minimal = this.normalizeContext((context as any) ?? ({} as any));
      const predictionId = `timing_${Date.now()}_${minimal.userId}`;
      const { recommendedTime, confidence, rationale } = this.defaultTimingPrediction(minimal);
      const result: TimingPredictionResult = {
        userId: minimal.userId,
        predictionId,
        timestamp: new Date(),
        optimalTiming: {
          recommendedTime,
          confidence,
          rationale,
          alternativeTimes: this.generateAlternativeTimes(minimal, recommendedTime)
        },
        effectivenessPrediction: this.predictInterventionEffectiveness(minimal, recommendedTime),
        contextualFactors: {
          currentStressLevel: minimal.currentContext.userState.stressLevel,
          activityState: minimal.currentContext.userState.activityState,
          timeOfDay: new Date().getHours(),
          recentInterventionCount: 0,
          historicalSuccessRate: this.calculateHistoricalSuccessRate(minimal)
        },
        modelUsed: this.config.primaryTimingModel,
        modelVersion: '1.0',
        predictionQuality: this.calculatePredictionQuality(minimal, confidence)
      };
      return result;
    }

    const safeContext: any = context || {} as any;
    const predictionId = `timing_${Date.now()}_${safeContext?.userId || 'unknown'}`;
    const startTime = Date.now();

    try {
      console.log(`🎯 Predicting optimal timing for user ${safeContext.userId || 'unknown'}`);

      // Guard: Context validation and normalization
      const normalized = this.normalizeContext(safeContext);
      if ((normalized as any).__incomplete) {
        // Telemetry for missing context
        await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'jitai_context_incomplete',
          missing: (normalized as any).__missing,
        });
      }

      // Check cache first
      const cached = this.predictionCache.get(normalized.userId);
      if (cached && this.isCacheValid(cached)) {
        console.log('📦 Using cached timing prediction');
        return cached;
      }

      // Select optimal timing model
      const model = this.selectOptimalTimingModel(normalized);
      
      // Generate timing prediction
      const prediction = await this.generateTimingPrediction(normalized, model, predictionId);
      
      // Apply A/B testing variations if applicable
      const finalPrediction = await this.applyABTestVariations(prediction, normalized);
      
      // Cache the result
      this.predictionCache.set(normalized.userId, finalPrediction);
      setTimeout(() => {
        this.predictionCache.delete(normalized.userId);
      }, 30 * 60 * 1000); // 30 minutes cache
      
      // Telemetry
      await trackAIInteraction(AIEventType.TIMING_PREDICTION_GENERATED, {
        userId: normalized.userId,
        predictionId,
        modelUsed: model,
        confidence: finalPrediction.optimalTiming.confidence,
        estimatedEffectiveness: finalPrediction.effectivenessPrediction.estimatedEffectiveness,
        latency: Date.now() - startTime
      });

      console.log(`✅ Timing prediction completed: ${finalPrediction.optimalTiming.confidence * 100}% confidence`);
      return finalPrediction;

    } catch (error) {
      console.error('❌ Timing prediction failed:', error);
      
      await trackAIError({
        code: AIErrorCode.PROCESSING_FAILED,
        message: 'Timing prediction başarısız',
        severity: ErrorSeverity.MEDIUM,
        context: { 
          component: 'JITAIEngine', 
          method: 'predictOptimalTiming',
          userId: safeContext?.userId,
          latency: Date.now() - startTime
        }
      });

      throw error;
    }
  }

  /**
   * Normalize/guard JITAI context to avoid runtime errors
   */
  private normalizeContext(context: JITAIContext): JITAIContext & { __incomplete?: boolean; __missing?: string[] } {
    const source: any = context ?? {} as any;
    const missing: string[] = [];
    const safeUserId = typeof source?.userId === 'string' && source.userId.length > 0 ? source.userId : 'unknown_user';
    const defaultState = {
      stressLevel: StressLevel.MODERATE,
      activityState: UserActivityState.UNKNOWN,
      energyLevel: 50,
    } as any;
    const baseCurrent = source?.currentContext || {};
    const baseUserState = baseCurrent.userState || {};
    if (!source || !source.currentContext) missing.push('currentContext');
    if (!baseCurrent.userState) missing.push('currentContext.userState');
    const normalized: any = {
      ...source,
      userId: safeUserId,
      currentContext: {
        ...baseCurrent,
        userState: {
          ...defaultState,
          ...baseUserState,
          stressLevel: baseUserState.stressLevel ?? StressLevel.MODERATE,
          activityState: baseUserState.activityState ?? UserActivityState.UNKNOWN,
          energyLevel: typeof baseUserState.energyLevel === 'number' ? baseUserState.energyLevel : 50,
        },
      },
      currentUserState: {
        isAppActive: source?.currentUserState?.isAppActive ?? false,
        lastInteraction: source?.currentUserState?.lastInteraction ?? new Date(Date.now() - 10 * 60 * 1000),
        recentMood: source?.currentUserState?.recentMood ?? 'neutral',
        energyLevel: source?.currentUserState?.energyLevel ?? 50,
        stressPattern: source?.currentUserState?.stressPattern ?? [StressLevel.MODERATE],
      },
      personalizationProfile: {
        preferredTimes: source?.personalizationProfile?.preferredTimes ?? [],
        responsiveStates: source?.personalizationProfile?.responsiveStates ?? [],
        effectiveCategories: source?.personalizationProfile?.effectiveCategories ?? [],
        culturalPreferences: source?.personalizationProfile?.culturalPreferences ?? {},
        communicationStyle: source?.personalizationProfile?.communicationStyle ?? 'gentle',
      },
      interventionHistory: source?.interventionHistory ?? [],
    };
    if (missing.length) {
      normalized.__incomplete = true;
      normalized.__missing = missing;
    }
    return normalized;
  }

  /**
   * Personalize intervention based on user history and preferences
   */
  async personalizeIntervention(
    baseIntervention: AdaptiveIntervention,
    context: JITAIContext,
    abTestVariant?: string
  ): Promise<AdaptiveIntervention> {
    
    if (!this.config.enablePersonalization) {
      return baseIntervention;
    }

    try {
      const personalizedIntervention = { ...baseIntervention };
      
      // Apply personalization based on user profile
      const personalization = await this.generatePersonalization(context, abTestVariant);
      
      // Adjust content
      personalizedIntervention.title = this.personalizeContent(
        personalizedIntervention.title, 
        personalization.contentStyle
      );
      
      personalizedIntervention.content = this.personalizeContent(
        personalizedIntervention.content,
        personalization.contentStyle
      );
      
      // Adjust timing
      if (personalization.timingAdjustment !== 0) {
        const newScheduledTime = new Date(
          personalizedIntervention.scheduledFor.getTime() + personalization.timingAdjustment
        );
        personalizedIntervention.scheduledFor = newScheduledTime;
      }
      
      // Adjust delivery method if needed
      if (personalization.preferredDeliveryMethod) {
        personalizedIntervention.deliveryMethod = personalization.preferredDeliveryMethod as any;
      }
      
      // Add personalization metadata
      personalizedIntervention.personalizedFor.previousEffectiveness = personalization.expectedEffectiveness;
      personalizedIntervention.adaptationHistory.push({
        timestamp: new Date(),
        adaptation: 'JITAI_PERSONALIZATION',
        reason: personalization.rationale
      });

      await trackAIInteraction(AIEventType.INTERVENTION_PERSONALIZED, {
        userId: context.userId,
        interventionId: personalizedIntervention.id,
        personalizationFactors: personalization.appliedFactors,
        expectedEffectiveness: personalization.expectedEffectiveness,
        abTestVariant
      });

      return personalizedIntervention;

    } catch (error) {
      console.warn('⚠️ Intervention personalization failed, using base intervention:', error);
      return baseIntervention;
    }
  }

  // =============================================================================
  // 🧪 A/B TESTING FRAMEWORK
  // =============================================================================

  /**
   * Initialize A/B testing framework
   */
  private async initializeABTestingFramework(): Promise<void> {
    if (!this.config.enableABTesting) return;

    // Load active tests (in real implementation, this would come from a database)
    const defaultTests = this.getDefaultABTests();
    
    for (const test of defaultTests) {
      if (test.isActive && test.status === 'running') {
        this.activeABTests.set(test.testId, test);
      }
    }

    console.log(`🧪 A/B Testing framework initialized with ${this.activeABTests.size} active tests`);
  }

  /**
   * Apply A/B test variations to timing prediction
   */
  private async applyABTestVariations(
    basePrediction: TimingPredictionResult,
    context: JITAIContext
  ): Promise<TimingPredictionResult> {
    
    if (!this.config.enableABTesting) return basePrediction;

    // Check if user should participate in any active tests
    for (const [testId, testConfig] of this.activeABTests) {
      if (this.shouldParticipateInTest(context.userId, testConfig)) {
        const variant = this.selectTestVariant(context.userId, testConfig);
        
        if (variant && variant.config.timingDelay) {
          const modifiedPrediction = { ...basePrediction };
          modifiedPrediction.optimalTiming.recommendedTime = new Date(
            modifiedPrediction.optimalTiming.recommendedTime.getTime() + variant.config.timingDelay
          );
          
          // Add A/B test metadata
          modifiedPrediction.predictionId += `_test_${testId}_${variant.id}`;
          
          await trackAIInteraction(AIEventType.AB_TEST_VARIATION_APPLIED, {
            userId: context.userId,
            testId,
            variantId: variant.id,
            originalTime: basePrediction.optimalTiming.recommendedTime.toISOString(),
            modifiedTime: modifiedPrediction.optimalTiming.recommendedTime.toISOString()
          });

          return modifiedPrediction;
        }
      }
    }

    return basePrediction;
  }

  // =============================================================================
  // 🔍 TIMING PREDICTION IMPLEMENTATION
  // =============================================================================

  /**
   * Generate timing prediction using selected model
   */
  private async generateTimingPrediction(
    context: JITAIContext,
    model: TimingModel,
    predictionId: string
  ): Promise<TimingPredictionResult> {
    // Guard: normalize context to ensure currentContext.userState exists
    const normalizedContext = this.normalizeContext((context as any) ?? ({} as any));

    const baseTime = new Date();
    let recommendedTime: Date;
    let confidence: number;
    let rationale: string;

    switch (model) {
      case TimingModel.CIRCADIAN:
        ({ recommendedTime, confidence, rationale } = this.circadianTimingPrediction(normalizedContext));
        break;
      case TimingModel.BEHAVIORAL:
        ({ recommendedTime, confidence, rationale } = this.behavioralTimingPrediction(normalizedContext));
        break;
      case TimingModel.CONTEXTUAL:
        ({ recommendedTime, confidence, rationale } = this.contextualTimingPrediction(normalizedContext));
        break;
      case TimingModel.STRESS_BASED:
        ({ recommendedTime, confidence, rationale } = this.stressBasedTimingPrediction(normalizedContext));
        break;
      case TimingModel.HYBRID:
        ({ recommendedTime, confidence, rationale } = this.hybridTimingPrediction(normalizedContext));
        break;
      case TimingModel.MACHINE_LEARNING:
        ({ recommendedTime, confidence, rationale } = await this.mlTimingPrediction(normalizedContext));
        break;
      default:
        ({ recommendedTime, confidence, rationale } = this.defaultTimingPrediction(normalizedContext));
    }

    // Generate effectiveness prediction
    const effectivenessPrediction = this.predictInterventionEffectiveness(normalizedContext, recommendedTime);
    
    // Generate alternative times
    const alternativeTimes = this.generateAlternativeTimes(normalizedContext, recommendedTime);

    const result: TimingPredictionResult = {
      userId: normalizedContext.userId,
      predictionId,
      timestamp: new Date(),
      
      optimalTiming: {
        recommendedTime,
        confidence,
        rationale,
        alternativeTimes
      },
      
      effectivenessPrediction,
      
      contextualFactors: {
        currentStressLevel: normalizedContext.currentContext.userState.stressLevel,
        activityState: normalizedContext.currentContext.userState.activityState,
        timeOfDay: new Date().getHours(),
        recentInterventionCount: this.getRecentInterventionCount(normalizedContext),
        historicalSuccessRate: this.calculateHistoricalSuccessRate(normalizedContext)
      },
      
      modelUsed: model,
      modelVersion: '1.0',
      predictionQuality: this.calculatePredictionQuality(normalizedContext, confidence)
    };

    return result;
  }

  /**
   * Circadian rhythm based timing prediction
   */
  private circadianTimingPrediction(context: JITAIContext): {
    recommendedTime: Date;
    confidence: number;
    rationale: string;
  } {
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    const now = new Date();
    const currentHour = now.getHours();
    
    // Optimal times based on circadian research
    const optimalHours = [9, 14, 18]; // Morning, afternoon, early evening
    const nextOptimalHour = optimalHours.find(hour => hour > currentHour) || optimalHours[0];
    
    const recommendedTime = new Date();
    if (nextOptimalHour <= currentHour) {
      recommendedTime.setDate(recommendedTime.getDate() + 1);
    }
    recommendedTime.setHours(nextOptimalHour, 0, 0, 0);
    
    return {
      recommendedTime,
      confidence: 0.75,
      rationale: `Circadian rhythm optimization: ${nextOptimalHour}:00 is optimal for alertness and receptivity`
    };
  }

  /**
   * Behavioral pattern based timing prediction
   */
  private behavioralTimingPrediction(context: JITAIContext): {
    recommendedTime: Date;
    confidence: number;
    rationale: string;
  } {
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    // Analyze user's historical app usage patterns
    const preferredTimes = ctx.personalizationProfile.preferredTimes;
    const now = new Date();
    
    if ((preferredTimes ?? []).length > 0) {
      const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const nextPreferredTime = preferredTimes.find(time => time > currentTimeStr);
      
      if (nextPreferredTime) {
        const [hours, minutes] = nextPreferredTime.split(':').map(Number);
        const recommendedTime = new Date();
        recommendedTime.setHours(hours, minutes, 0, 0);
        
        return {
          recommendedTime,
          confidence: 0.85,
          rationale: `Based on your usage patterns, ${nextPreferredTime} is your preferred time`
        };
      }
    }
    
    // Fallback to general behavioral patterns
    const recommendedTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    return {
      recommendedTime,
      confidence: 0.6,
      rationale: 'Based on general behavioral patterns, allowing time for current activity completion'
    };
  }

  /**
   * Contextual factors based timing prediction
   */
  private contextualTimingPrediction(context: JITAIContext): {
    recommendedTime: Date;
    confidence: number;
    rationale: string;
  } {
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    const now = new Date();
    const currentActivity = ctx.currentContext.userState.activityState;
    const stressLevel = ctx.currentContext.userState.stressLevel;
    
    let delayMinutes = 0;
    let rationale = '';
    let confidence = 0.7;

    // Activity-based adjustments
    switch (currentActivity) {
      case UserActivityState.WORKING:
        delayMinutes = 60; // Wait for work break
        rationale = 'Waiting for work break for better receptivity';
        break;
      case UserActivityState.SLEEPING:
        delayMinutes = 480; // 8 hours
        rationale = 'Waiting for user to wake up';
        confidence = 0.9;
        break;
      case UserActivityState.EXERCISING:
        delayMinutes = 30; // Wait for exercise completion
        rationale = 'Allowing exercise completion before intervention';
        break;
      case UserActivityState.SOCIALIZING:
        delayMinutes = 120; // Wait for social interaction to end
        rationale = 'Respecting social time, will intervene later';
        break;
      default:
        delayMinutes = 15; // Default small delay
        rationale = 'Short delay for context transition';
    }

    // Stress-based adjustments
    if (stressLevel === StressLevel.VERY_HIGH) {
      delayMinutes = Math.min(delayMinutes, 5); // Urgent intervention needed
      rationale = 'High stress detected, providing timely support';
      confidence = 0.85;
    }

    const recommendedTime = new Date(now.getTime() + delayMinutes * 60 * 1000);
    
    return {
      recommendedTime,
      confidence,
      rationale
    };
  }

  /**
   * Stress pattern based timing prediction
   */
  private stressBasedTimingPrediction(context: JITAIContext): {
    recommendedTime: Date;
    confidence: number;
    rationale: string;
  } {
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    const stressPattern = ctx.currentUserState?.stressPattern ?? [];
    const currentStress = ctx.currentContext.userState.stressLevel;
    
    // Predict when stress might be lower
    let optimalDelayMinutes = 30; // Default
    let confidence = 0.7;
    let rationale = 'Timing based on stress pattern analysis';

    if (currentStress === StressLevel.VERY_HIGH) {
      optimalDelayMinutes = 5; // Immediate intervention needed
      confidence = 0.9;
      rationale = 'Immediate intervention due to very high stress';
    } else if (currentStress === StressLevel.HIGH) {
      optimalDelayMinutes = 15; // Quick intervention
      confidence = 0.8;
      rationale = 'Early intervention for high stress management';
    } else if (stressPattern.length > 0) {
      // Analyze pattern to find optimal timing
      const averageStress = stressPattern.reduce((sum, level) => {
        const stressValue = this.stressLevelToValue(level);
        return sum + stressValue;
      }, 0) / stressPattern.length;
      
      const currentStressValue = this.stressLevelToValue(currentStress);
      
      if (currentStressValue < averageStress) {
        optimalDelayMinutes = 10; // Strike while stress is low
        confidence = 0.85;
        rationale = 'Current stress below average, optimal timing for intervention';
      } else {
        optimalDelayMinutes = 60; // Wait for stress to potentially decrease
        rationale = 'Waiting for stress level to decrease based on historical pattern';
      }
    }

    const recommendedTime = new Date(Date.now() + optimalDelayMinutes * 60 * 1000);
    
    return {
      recommendedTime,
      confidence,
      rationale
    };
  }

  /**
   * Hybrid model combining multiple approaches
   */
  private hybridTimingPrediction(context: JITAIContext): {
    recommendedTime: Date;
    confidence: number;
    rationale: string;
  } {
    // Get predictions from multiple models
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    const circadian = this.circadianTimingPrediction(ctx);
    const behavioral = this.behavioralTimingPrediction(ctx);
    const contextual = this.contextualTimingPrediction(ctx);
    const stressBased = this.stressBasedTimingPrediction(ctx);

    // Weight the predictions based on confidence and context
    const predictions = [
      { ...circadian, weight: 0.2 },
      { ...behavioral, weight: 0.3 },
      { ...contextual, weight: 0.3 },
      { ...stressBased, weight: 0.2 }
    ];

    // Calculate weighted average time
    const totalWeight = predictions.reduce((sum, p) => sum + p.weight * p.confidence, 0);
    const weightedTime = predictions.reduce((sum, p) => {
      const weight = (p.weight * p.confidence) / totalWeight;
      return sum + (p.recommendedTime.getTime() * weight);
    }, 0);

    const recommendedTime = new Date(weightedTime);
    const averageConfidence = predictions.reduce((sum, p) => sum + p.confidence * p.weight, 0);

    return {
      recommendedTime,
      confidence: Math.min(averageConfidence * 1.1, 1.0), // Boost for hybrid approach
      rationale: 'Hybrid model combining circadian, behavioral, contextual, and stress-based predictions'
    };
  }

  /**
   * Machine learning based timing prediction (simulated)
   */
  private async mlTimingPrediction(context: JITAIContext): Promise<{
    recommendedTime: Date;
    confidence: number;
    rationale: string;
  }> {
    // In a real implementation, this would use a trained ML model
    // For now, we'll simulate ML prediction based on historical data
    
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    const historicalData = ctx.interventionHistory;
    if (historicalData.length < 5) {
      // Not enough data for ML, fallback to hybrid
      return this.hybridTimingPrediction(ctx);
    }

    // Simulate ML analysis
    const avgEffectiveness = historicalData.reduce((sum, h) => sum + h.effectiveness, 0) / historicalData.length;
    const bestTimes = historicalData
      .filter(h => h.effectiveness > avgEffectiveness)
      .map(h => h.intervention.scheduledFor.getHours());

    if (bestTimes.length > 0) {
      const mostEffectiveHour = Math.round(bestTimes.reduce((sum, h) => sum + h, 0) / bestTimes.length);
      const recommendedTime = new Date();
      recommendedTime.setHours(mostEffectiveHour, 0, 0, 0);
      
      // If the time has passed today, schedule for tomorrow
      if (recommendedTime <= new Date()) {
        recommendedTime.setDate(recommendedTime.getDate() + 1);
      }

      return {
        recommendedTime,
        confidence: 0.88,
        rationale: `ML analysis of ${historicalData.length} historical interventions suggests ${mostEffectiveHour}:00 for optimal effectiveness`
      };
    }

    // Fallback if no clear pattern
    return this.hybridTimingPrediction(ctx);
  }

  /**
   * Default timing prediction fallback
   */
  private defaultTimingPrediction(context: JITAIContext): {
    recommendedTime: Date;
    confidence: number;
    rationale: string;
  } {
    const now = new Date();
    const recommendedTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes later
    
    return {
      recommendedTime,
      confidence: 0.5,
      rationale: 'Default timing: 30-minute delay for general intervention delivery'
    };
  }

  // =============================================================================
  // 🔧 HELPER METHODS
  // =============================================================================

  private selectOptimalTimingModel(context: JITAIContext): TimingModel {
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    // Simple model selection logic
    if ((ctx.interventionHistory?.length ?? 0) >= 10) {
      return TimingModel.MACHINE_LEARNING;
    }
    if (ctx.currentContext.userState.stressLevel === StressLevel.VERY_HIGH) {
      return TimingModel.STRESS_BASED;
    }
    if (ctx.currentUserState?.isAppActive) {
      return TimingModel.CONTEXTUAL;
    }
    return this.config.primaryTimingModel;
  }

  private predictInterventionEffectiveness(context: JITAIContext, timing: Date): TimingPredictionResult['effectivenessPrediction'] {
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    const contributingFactors: TimingPredictionResult['effectivenessPrediction']['contributingFactors'] = [];
    let estimatedEffectiveness = 0.7; // Base effectiveness

    // Time of day factor
    const hour = timing.getHours();
    let timeImpact = 0;
    if (hour >= 9 && hour <= 11) timeImpact = 0.2; // Morning boost
    else if (hour >= 14 && hour <= 16) timeImpact = 0.1; // Afternoon moderate
    else if (hour >= 18 && hour <= 20) timeImpact = 0.15; // Early evening good
    else if (hour >= 22 || hour <= 6) timeImpact = -0.3; // Late night/early morning negative

    contributingFactors.push({
      factor: EffectivenessFactor.TIME_OF_DAY,
      impact: timeImpact,
      confidence: 0.8
    });
    estimatedEffectiveness += timeImpact;

    // Stress level factor
    const stressLevel = ctx.currentContext.userState.stressLevel;
    let stressImpact = 0;
    switch (stressLevel) {
      case StressLevel.VERY_HIGH:
        stressImpact = 0.3; // High stress = high receptivity to help
        break;
      case StressLevel.HIGH:
        stressImpact = 0.2;
        break;
      case StressLevel.MODERATE:
        stressImpact = 0.0;
        break;
      case StressLevel.LOW:
      case StressLevel.VERY_LOW:
        stressImpact = -0.1; // Low stress = less perceived need
        break;
    }

    contributingFactors.push({
      factor: EffectivenessFactor.STRESS_LEVEL,
      impact: stressImpact,
      confidence: 0.9
    });
    estimatedEffectiveness += stressImpact;

    // Historical response factor
    const historicalSuccessRate = this.calculateHistoricalSuccessRate(ctx);
    const historyImpact = (historicalSuccessRate - 0.7) * 0.5; // Adjust based on historical performance

    contributingFactors.push({
      factor: EffectivenessFactor.HISTORICAL_RESPONSE,
      impact: historyImpact,
      confidence: context.interventionHistory.length > 5 ? 0.8 : 0.4
    });
    estimatedEffectiveness += historyImpact;

    // Normalize to 0-1 range
    estimatedEffectiveness = Math.max(0, Math.min(1, estimatedEffectiveness));

    return {
      estimatedEffectiveness,
      contributingFactors,
      riskFactors: this.identifyEffectivenessRiskFactors(ctx),
      enhancementFactors: this.identifyEffectivenessEnhancementFactors(ctx)
    };
  }

  private generateAlternativeTimes(context: JITAIContext, primaryTime: Date): TimingPredictionResult['optimalTiming']['alternativeTimes'] {
    const alternatives: TimingPredictionResult['optimalTiming']['alternativeTimes'] = [];
    
    // 1 hour earlier
    const earlier = new Date(primaryTime.getTime() - 60 * 60 * 1000);
    alternatives.push({
      time: earlier,
      confidence: 0.6,
      reason: '1 hour earlier alternative'
    });
    
    // 2 hours later
    const later = new Date(primaryTime.getTime() + 2 * 60 * 60 * 1000);
    alternatives.push({
      time: later,
      confidence: 0.65,
      reason: '2 hours later alternative'
    });
    
    // Next day same time
    const nextDay = new Date(primaryTime);
    nextDay.setDate(nextDay.getDate() + 1);
    alternatives.push({
      time: nextDay,
      confidence: 0.7,
      reason: 'Next day same time alternative'
    });

    return alternatives;
  }

  private async generatePersonalization(context: JITAIContext, abTestVariant?: string): Promise<{
    contentStyle: string;
    timingAdjustment: number;
    preferredDeliveryMethod?: string;
    expectedEffectiveness: number;
    appliedFactors: string[];
    rationale: string;
  }> {
    const appliedFactors: string[] = [];
    let timingAdjustment = 0;
    let expectedEffectiveness = 0.7;
    let contentStyle = context.personalizationProfile.communicationStyle;

    // Apply cultural adaptation
    if (this.config.culturalContext === 'turkish' || this.config.culturalContext === 'adaptive') {
      contentStyle = 'gentle'; // Turkish warm style mapped to gentle
      appliedFactors.push('cultural_adaptation');
    }

    // Apply historical effectiveness learning
    const histSuccessRate = this.calculateHistoricalSuccessRate(context);
    if (histSuccessRate > 0.8) {
      // User responds well, can use shorter delays
      timingAdjustment = -15 * 60 * 1000; // 15 minutes earlier
      expectedEffectiveness = 0.85;
      appliedFactors.push('high_historical_success');
    } else if (histSuccessRate < 0.5) {
      // User doesn't respond well, use longer delays and gentler approach
      timingAdjustment = 30 * 60 * 1000; // 30 minutes later
      contentStyle = 'gentle';
      expectedEffectiveness = 0.6;
      appliedFactors.push('low_historical_success');
    }

    // A/B test variations
    if (abTestVariant) {
      appliedFactors.push(`ab_test_${abTestVariant}`);
    }

    return {
      contentStyle,
      timingAdjustment,
      expectedEffectiveness,
      appliedFactors,
      rationale: `Personalization based on: ${appliedFactors.join(', ')}`
    };
  }

  private personalizeContent(content: string, style: string): string {
    switch (style) {
      case 'warm_turkish':
        return `💙 ${content}`;
      case 'gentle':
        return `🌸 ${content}`;
      case 'encouraging':
        return `🌟 ${content}`;
      case 'direct':
        return content;
      default:
        return content;
    }
  }

  private getDefaultConfig(): JITAIConfig {
    return {
      enabled: true,
      primaryTimingModel: TimingModel.HYBRID,
      fallbackModels: [TimingModel.CONTEXTUAL, TimingModel.BEHAVIORAL],
      predictionHorizon: 24,
      confidenceThreshold: 0.6,
      
      enablePersonalization: true,
      personalizedFactors: [
        EffectivenessFactor.TIME_OF_DAY,
        EffectivenessFactor.STRESS_LEVEL,
        EffectivenessFactor.HISTORICAL_RESPONSE
      ],
      adaptationRate: 0.1,
      
      enableABTesting: true,
      maxConcurrentTests: 3,
      testParticipationRate: 0.1,
      
      culturalSensitivity: true,
      culturalContext: 'turkish',
      localizedTimingRules: true,
      
      respectUserBoundaries: true,
      maxInterventionsPerWindow: 5,
      interventionCooldown: 60,
      emergencyOverride: true,
      
      enableQualityControl: true,
      minimumDataPoints: 5,
      qualityThreshold: 0.7
    };
  }

  private getDefaultABTests(): ABTestConfig[] {
    return [
      {
        testId: 'timing_delay_test_001',
        name: 'Optimal Timing Delay Test',
        description: 'Testing different timing delays for intervention delivery',
        variants: [
          {
            id: 'immediate',
            name: 'Immediate Delivery',
            weight: 0.33,
            config: { timingDelay: 0 }
          },
          {
            id: 'delayed_15min',
            name: '15 Minute Delay',
            weight: 0.33,
            config: { timingDelay: 15 * 60 * 1000 }
          },
          {
            id: 'delayed_30min',
            name: '30 Minute Delay',
            weight: 0.34,
            config: { timingDelay: 30 * 60 * 1000 }
          }
        ],
        targetPopulation: {
          userSegments: ['active_users'],
          inclusionCriteria: { min_app_usage_days: 7 },
          exclusionCriteria: { crisis_risk_level: 'high' }
        },
        successMetrics: {
          primary: 'intervention_completion_rate',
          secondary: ['user_satisfaction', 'effectiveness_rating'],
          measurementWindow: 24
        },
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        minSampleSize: 100,
        confidenceLevel: 0.95,
        isActive: false, // Disabled by default
        status: 'draft'
      }
    ];
  }

  private shouldParticipateInTest(userId: string, testConfig: ABTestConfig): boolean {
    // Simple hash-based participation
    const hash = this.simpleHash(userId + testConfig.testId);
    return (hash % 100) < (testConfig.targetPopulation.userSegments.length > 0 ? 10 : 0); // 10% participation for targeted segments
  }

  private selectTestVariant(userId: string, testConfig: ABTestConfig): ABTestConfig['variants'][0] | null {
    const hash = this.simpleHash(userId + testConfig.testId + 'variant');
    const randomValue = (hash % 100) / 100;
    
    let cumulativeWeight = 0;
    for (const variant of testConfig.variants) {
      cumulativeWeight += variant.weight;
      if (randomValue <= cumulativeWeight) {
        return variant;
      }
    }
    
    return testConfig.variants[0]; // Fallback
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private isCacheValid(cached: TimingPredictionResult): boolean {
    const now = Date.now();
    const cacheAge = now - cached.timestamp.getTime();
    return cacheAge < 30 * 60 * 1000; // 30 minutes
  }

  private getRecentInterventionCount(context: JITAIContext): number {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    return context.interventionHistory.filter(h => 
      h.intervention.createdAt.getTime() > twentyFourHoursAgo
    ).length;
  }

  private calculateHistoricalSuccessRate(context: JITAIContext): number {
    const history = context.interventionHistory ?? [];
    if (history.length === 0) return 0.7; // Default

    const completedInterventions = history.filter(h => h.effectiveness > 0.5);
    return completedInterventions.length / history.length;
  }

  private calculatePredictionQuality(context: JITAIContext, confidence: number): number {
    const dataQuality = Math.min(context.interventionHistory.length / 10, 1); // More data = better quality
    const contextCompleteness = this.calculateContextCompleteness(context);
    return (confidence + dataQuality + contextCompleteness) / 3;
  }

  private calculateContextCompleteness(context: JITAIContext): number {
    let completeness = 0;
    let totalFactors = 0;

    // Check available context factors
    const contextChecks = [
      context.currentContext?.userState?.stressLevel !== undefined,
      context.currentContext?.userState?.activityState !== undefined,
      context.currentUserState?.isAppActive !== undefined,
      (context.personalizationProfile?.preferredTimes ?? []).length > 0,
      (context.interventionHistory?.length ?? 0) > 0
    ];

    contextChecks.forEach(check => {
      totalFactors++;
      if (check) completeness++;
    });

    return completeness / totalFactors;
  }

  private stressLevelToValue(level: StressLevel): number {
    const mapping = {
      [StressLevel.VERY_LOW]: 0.1,
      [StressLevel.LOW]: 0.3,
      [StressLevel.MODERATE]: 0.5,
      [StressLevel.HIGH]: 0.7,
      [StressLevel.VERY_HIGH]: 0.9
    };
    return mapping[level] || 0.5;
  }

  private identifyEffectivenessRiskFactors(context: JITAIContext): string[] {
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    const riskFactors: string[] = [];
    
    if (ctx.currentContext.userState.energyLevel < 30) {
      riskFactors.push('Low energy levels may reduce intervention engagement');
    }
    
    if (ctx.currentUserState.recentMood === 'negative') {
      riskFactors.push('Negative mood may impact intervention receptivity');
    }
    
    const recentCount = this.getRecentInterventionCount(ctx);
    if (recentCount > 3) {
      riskFactors.push('High recent intervention frequency may cause fatigue');
    }
    
    return riskFactors;
  }

  private identifyEffectivenessEnhancementFactors(context: JITAIContext): string[] {
    const ctx = this.normalizeContext((context as any) ?? ({} as any));
    const enhancementFactors: string[] = [];
    
    if (ctx.currentContext.userState.stressLevel === StressLevel.HIGH || 
        ctx.currentContext.userState.stressLevel === StressLevel.VERY_HIGH) {
      enhancementFactors.push('High stress increases motivation for support');
    }
    
    if (ctx.currentUserState.isAppActive) {
      enhancementFactors.push('Active app usage indicates engagement readiness');
    }
    
    const histSuccessRate = this.calculateHistoricalSuccessRate(ctx);
    if (histSuccessRate > 0.7) {
      enhancementFactors.push('Strong historical response pattern');
    }
    
    return enhancementFactors;
  }

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  /**
   * JITAI Engine durumunu kontrol et
   */
  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_JITAI_SYSTEM');
  }

  /**
   * Configuration güncelle
   */
  updateConfiguration(newConfig: Partial<JITAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * A/B test başlat
   */
  async startABTest(testConfig: ABTestConfig): Promise<void> {
    testConfig.isActive = true;
    testConfig.status = 'running';
    this.activeABTests.set(testConfig.testId, testConfig);
    
    await trackAIInteraction(AIEventType.AB_TEST_STARTED, {
      testId: testConfig.testId,
      testName: testConfig.name,
      variantCount: testConfig.variants.length
    });
  }

  /**
   * A/B test durdur
   */
  async stopABTest(testId: string): Promise<void> {
    const test = this.activeABTests.get(testId);
    if (test) {
      test.isActive = false;
      test.status = 'completed';
      this.activeABTests.delete(testId);
      
      await trackAIInteraction(AIEventType.AB_TEST_STOPPED, {
        testId,
        testName: test.name
      });
    }
  }

  /**
   * Clear prediction cache
   */
  clearPredictionCache(): void {
    this.predictionCache.clear();
  }

  /**
   * Engine'i temizle
   */
  async shutdown(): Promise<void> {
    console.log('🎯 JITAI Engine: Shutting down...');
    this.isEnabled = false;
    this.activeABTests.clear();
    this.predictionCache.clear();
    this.personalizationProfiles.clear();
    this.effectivenessData.clear();
    
    await trackAIInteraction(AIEventType.JITAI_SHUTDOWN, {
      version: '1.0'
    });
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const jitaiEngine = JITAIEngine.getInstance();
export default jitaiEngine;