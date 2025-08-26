/**
 * ⚡ Adaptive Interventions Engine - Real-time Therapeutic Support
 * 
 * Bu engine, Context Intelligence'dan gelen bilgileri kullanarak
 * kullanıcıya real-time, context-aware terapötik müdahaleler sağlar.
 * Sprint 6'nın core innovation'ı olan adaptive intervention sistemi.
 * 
 * ⚠️ CRITICAL: User autonomy preservation - always allow override
 * ⚠️ Feature flag kontrolü: AI_ADAPTIVE_INTERVENTIONS
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  RiskLevel as CrisisRiskLevel,
  UserTherapeuticProfile,
  AIError,
  AIErrorCode,
  ErrorSeverity
} from '@/features/ai/types';
// CBTTechnique moved: use InterventionType from types
import { InterventionType as CBTTechnique } from '@/features/ai/types';
import { 
  ContextAnalysisResult, 
  StressLevel, 
  UserActivityState,
  contextIntelligenceEngine 
} from '@/features/ai/context/contextIntelligence';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 ADAPTIVE INTERVENTIONS TYPES & DEFINITIONS
// =============================================================================

/**
 * Intervention categories
 */
export enum InterventionCategory {
  CRISIS_SUPPORT = 'crisis_support',           // Emergency support
  STRESS_REDUCTION = 'stress_reduction',       // Stress management
  MOOD_REGULATION = 'mood_regulation',         // Mood support
  ENERGY_BOOST = 'energy_boost',              // Energy enhancement
  SOCIAL_CONNECTION = 'social_connection',     // Social support
  MINDFULNESS = 'mindfulness',                // Mindfulness practices
  CBT_TECHNIQUE = 'cbt_technique',            // CBT interventions
  BEHAVIORAL_ACTIVATION = 'behavioral_activation', // Activity engagement
  ROUTINE_SUPPORT = 'routine_support',         // Routine maintenance
  SLEEP_HYGIENE = 'sleep_hygiene'             // Sleep support
}

/**
 * Intervention delivery methods
 */
export enum InterventionDelivery {
  TEXT_MESSAGE = 'text_message',       // Text-based intervention
  VOICE_PROMPT = 'voice_prompt',       // Voice-based guidance
  VISUAL_GUIDE = 'visual_guide',       // Visual instructions
  HAPTIC_FEEDBACK = 'haptic_feedback', // Tactile cues
  PUSH_NOTIFICATION = 'push_notification', // System notification
  IN_APP_MODAL = 'in_app_modal',       // Modal dialog
  GENTLE_REMINDER = 'gentle_reminder',  // Subtle reminder
  BREATHING_EXERCISE = 'breathing_exercise', // Guided breathing
  AUDIO_MEDITATION = 'audio_meditation'  // Audio guidance
}

/**
 * Intervention urgency levels
 */
export enum InterventionUrgency {
  IMMEDIATE = 'immediate',      // <30 seconds
  HIGH = 'high',               // <2 minutes
  MEDIUM = 'medium',           // <5 minutes
  LOW = 'low',                 // <15 minutes
  SCHEDULED = 'scheduled'      // Planned timing
}

/**
 * Adaptive Intervention
 */
export interface AdaptiveIntervention {
  id: string;
  userId: string;
  category: InterventionCategory;
  urgency: InterventionUrgency;
  
  // Content
  title: string;
  content: string;
  instructions: string[];
  duration: number; // seconds
  
  // Delivery
  deliveryMethod: InterventionDelivery;
  scheduledFor: Date;
  expiresAt: Date;
  canBeDelayed: boolean;
  allowUserOverride: boolean;
  
  // Context
  triggeredBy: {
    contextAnalysisId: string;
    riskLevel: CrisisRiskLevel;
    stressLevel: StressLevel;
    activityState: UserActivityState;
    triggerFactors: string[];
  };
  
  // Personalization
  personalizedFor: {
    userProfile: UserTherapeuticProfile;
    preferredStyle: 'gentle' | 'direct' | 'encouraging';
    culturalContext: 'turkish' | 'international';
    previousEffectiveness: number; // 0-1
  };
  
  // Effectiveness tracking
  delivery: {
    delivered: boolean;
    deliveredAt?: Date;
    viewedAt?: Date;
    completedAt?: Date;
    userResponse?: 'completed' | 'dismissed' | 'delayed' | 'ignored';
    effectivenessRating?: number; // 1-5
    followUpRequired: boolean;
  };
  
  // Metadata
  createdAt: Date;
  cbtTechnique?: CBTTechnique;
  relatedInterventions: string[];
  adaptationHistory: {
    timestamp: Date;
    adaptation: string;
    reason: string;
  }[];
}

/**
 * Intervention Configuration
 */
export interface InterventionConfig {
  enabled: boolean;
  userAutonomyLevel: 'high' | 'medium' | 'low';
  maxInterventionsPerHour: number;
  maxInterventionsPerDay: number;
  
  // Timing preferences
  respectQuietHours: boolean;
  quietHours: {
    start: string; // "22:00"
    end: string;   // "08:00"
  };
  
  // Delivery preferences
  preferredDeliveryMethods: InterventionDelivery[];
  allowInAppInterruptions: boolean;
  allowNotifications: boolean;
  enableHapticFeedback: boolean;
  
  // Personalization
  adaptToUserFeedback: boolean;
  learnFromEffectiveness: boolean;
  culturalAdaptation: boolean;
  
  // Safety
  crisisOverride: boolean; // Allow crisis interventions anytime
  emergencyContacts: string[];
  escalationProtocol: boolean;
}

/**
 * Intervention Context
 */
export interface InterventionContext {
  userId: string;
  userProfile: UserTherapeuticProfile;
  currentContext: ContextAnalysisResult;
  userConfig: InterventionConfig;
  
  // Recent history
  recentInterventions: AdaptiveIntervention[];
  recentUserActivity: {
    lastAppUsage: Date;
    currentScreen?: string;
    sessionDuration: number;
  };
  
  // Real-time state
  deviceState: {
    batteryLevel: number;
    isCharging: boolean;
    networkConnected: boolean;
    inFocus: boolean;
  };
}

// =============================================================================
// ⚡ ADAPTIVE INTERVENTIONS ENGINE IMPLEMENTATION
// =============================================================================

class AdaptiveInterventionsEngine {
  private static instance: AdaptiveInterventionsEngine;
  private isEnabled: boolean = false;
  private interventionQueue: Map<string, AdaptiveIntervention[]> = new Map();
  private activeInterventions: Map<string, AdaptiveIntervention> = new Map();
  private userConfigs: Map<string, InterventionConfig> = new Map();
  private effectivenessHistory: Map<string, { interventionId: string; effectiveness: number; timestamp: Date }[]> = new Map();

  private constructor() {}

  static getInstance(): AdaptiveInterventionsEngine {
    if (!AdaptiveInterventionsEngine.instance) {
      AdaptiveInterventionsEngine.instance = new AdaptiveInterventionsEngine();
    }
    return AdaptiveInterventionsEngine.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION & SETUP
  // =============================================================================

  /**
   * Adaptive Interventions Engine'i başlat
   */
  async initialize(): Promise<void> {
    console.log('⚡ Adaptive Interventions Engine: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_ADAPTIVE_INTERVENTIONS')) {
        console.log('🚫 Adaptive Interventions disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      // Context Intelligence dependency check
      if (!contextIntelligenceEngine.enabled) {
        console.warn('⚠️ Context Intelligence Engine not available, limited functionality');
      }

      this.isEnabled = true;
      
      // Start intervention delivery loop
      this.startInterventionDeliveryLoop();
      
      // Telemetry
      await trackAIInteraction(AIEventType.ADAPTIVE_INTERVENTIONS_INITIALIZED, {
        version: '1.0',
        contextIntelligenceAvailable: contextIntelligenceEngine.enabled
      });

      console.log('✅ Adaptive Interventions Engine initialized successfully');

    } catch (error) {
      console.error('❌ Adaptive Interventions Engine initialization failed:', error);
      this.isEnabled = false;
      
      await trackAIError({
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: 'Adaptive Interventions Engine başlatılamadı',
        severity: ErrorSeverity.HIGH,
        context: { component: 'AdaptiveInterventionsEngine', method: 'initialize' }
      });
      
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN INTERVENTION METHODS
  // =============================================================================

  /**
   * Context-based intervention triggering - Ana metod
   */
  async triggerContextualIntervention(context: InterventionContext): Promise<AdaptiveIntervention | null> {
    if (!this.isEnabled) {
      const err: AIError = {
        code: AIErrorCode.FEATURE_DISABLED,
        message: 'Adaptive Interventions Engine is not enabled',
        timestamp: new Date(),
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
      };
      throw err;
    }

    const startTime = Date.now();

    try {
      console.log(`⚡ Triggering contextual intervention for user ${context.userId}`);

      // Rate limiting check
      if (!this.checkInterventionRateLimit(context)) {
        console.log('🚫 Intervention rate limit exceeded');
        return null;
      }

      // Analyze intervention need
      const interventionNeed = await this.analyzeInterventionNeed(context);
      if (!interventionNeed.required) {
        console.log('ℹ️ No intervention required at this time');
        return null;
      }

      // Generate adaptive intervention
      const intervention = await this.generateAdaptiveIntervention(context, interventionNeed);
      if (!intervention) {
        console.log('⚠️ Failed to generate appropriate intervention');
        return null;
      }

      // Schedule delivery
      await this.scheduleIntervention(intervention);

      // Telemetry
      await trackAIInteraction(AIEventType.INTERVENTION_TRIGGERED, {
        userId: context.userId,
        interventionId: intervention.id,
        category: intervention.category,
        urgency: intervention.urgency,
        deliveryMethod: intervention.deliveryMethod,
        contextRiskLevel: context.currentContext.riskAssessment.overallRisk,
        contextStressLevel: context.currentContext.userState.stressLevel,
        latency: Date.now() - startTime
      });

      console.log(`✅ Intervention scheduled: ${intervention.category} (${intervention.urgency})`);
      return intervention;

    } catch (error) {
      console.error('❌ Contextual intervention failed:', error);
      
      await trackAIError({
        code: AIErrorCode.PROCESSING_FAILED,
        message: 'Contextual intervention başarısız',
        severity: ErrorSeverity.MEDIUM,
        context: { 
          component: 'AdaptiveInterventionsEngine', 
          method: 'triggerContextualIntervention',
          userId: context.userId,
          latency: Date.now() - startTime
        }
      });

      return null;
    }
  }

  /**
   * Immediate crisis intervention
   */
  async triggerCrisisIntervention(
    userId: string, 
    riskLevel: CrisisRiskLevel, 
    urgentFactors: string[]
  ): Promise<AdaptiveIntervention> {
    const intervention: AdaptiveIntervention = {
      id: `crisis_${Date.now()}_${userId}`,
      userId,
      category: InterventionCategory.CRISIS_SUPPORT,
      urgency: InterventionUrgency.IMMEDIATE,
      
      title: '🛡️ Acil Destek',
      content: 'Zor bir anla geçtiğinizi fark ediyorum. Buradayım ve size yardımcı olmak istiyorum.',
      instructions: [
        'Derin nefes alın: 4 saniye içeri çekin',
        '4 saniye nefesi tutun',
        '6 saniye dışarı verin',
        'Bu egzersizi 3 kez tekrarlayın',
        'Güvenli olduğunuzu hatırlayın'
      ],
      duration: 300, // 5 minutes
      
      deliveryMethod: InterventionDelivery.IN_APP_MODAL,
      scheduledFor: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      canBeDelayed: false,
      allowUserOverride: false, // Crisis interventions are mandatory
      
      triggeredBy: {
        contextAnalysisId: `crisis_${Date.now()}`,
        riskLevel,
        stressLevel: StressLevel.VERY_HIGH,
        activityState: UserActivityState.UNKNOWN,
        triggerFactors: urgentFactors
      },
      
      personalizedFor: {
        userProfile: {} as UserTherapeuticProfile, // Will be filled
        preferredStyle: 'direct',
        culturalContext: 'turkish',
        previousEffectiveness: 0.9 // Crisis interventions are highly effective
      },
      
      delivery: {
        delivered: false,
        followUpRequired: true
      },
      
      createdAt: new Date(),
      cbtTechnique: CBTTechnique.MINDFULNESS_TRAINING,
      relatedInterventions: [],
      adaptationHistory: []
    };

    // Immediate delivery for crisis
    await this.deliverImmediateIntervention(intervention);
    
    await trackAIInteraction(AIEventType.PREVENTIVE_INTERVENTION_TRIGGERED, {
      userId,
      interventionId: intervention.id,
      riskLevel,
      urgentFactors
    });

    return intervention;
  }

  // =============================================================================
  // 🔍 INTERVENTION ANALYSIS & GENERATION
  // =============================================================================

  /**
   * Analyze intervention need
   */
  private async analyzeInterventionNeed(context: InterventionContext): Promise<{
    required: boolean;
    priority: InterventionUrgency;
    suggestedCategories: InterventionCategory[];
    rationale: string;
  }> {
    const analysis = context.currentContext;
    const userState = analysis.userState;
    const riskAssessment = analysis.riskAssessment;

    // Crisis-level intervention need
    if (riskAssessment.overallRisk === CrisisRiskLevel.HIGH) {
      return {
        required: true,
        priority: InterventionUrgency.IMMEDIATE,
        suggestedCategories: [InterventionCategory.CRISIS_SUPPORT],
        rationale: 'High crisis risk detected'
      };
    }

    // High stress intervention
    if (userState.stressLevel === StressLevel.VERY_HIGH || userState.stressLevel === StressLevel.HIGH) {
      return {
        required: true,
        priority: userState.stressLevel === StressLevel.VERY_HIGH ? InterventionUrgency.HIGH : InterventionUrgency.MEDIUM,
        suggestedCategories: [InterventionCategory.STRESS_REDUCTION, InterventionCategory.MINDFULNESS],
        rationale: `${userState.stressLevel} stress level detected`
      };
    }

    // Low energy intervention
    if (userState.energyLevel < 30) {
      return {
        required: true,
        priority: InterventionUrgency.LOW,
        suggestedCategories: [InterventionCategory.ENERGY_BOOST, InterventionCategory.BEHAVIORAL_ACTIVATION],
        rationale: 'Low energy levels detected'
      };
    }

    // Social isolation intervention
    if (userState.socialEngagement < 20) {
      return {
        required: true,
        priority: InterventionUrgency.LOW,
        suggestedCategories: [InterventionCategory.SOCIAL_CONNECTION],
        rationale: 'Low social engagement detected'
      };
    }

    // Late night usage intervention
    const timeOfDayFactor = analysis.environmentalFactors.find(f => f.factor === 'time_of_day');
    if (timeOfDayFactor && typeof timeOfDayFactor.value === 'number') {
      const hour = timeOfDayFactor.value;
      if (hour >= 23 || hour <= 5) {
        return {
          required: true,
          priority: InterventionUrgency.MEDIUM,
          suggestedCategories: [InterventionCategory.SLEEP_HYGIENE],
          rationale: 'Late night app usage detected'
        };
      }
    }

    // Routine disruption intervention
    const routineDisruption = analysis.insights.patterns.some(p => p.includes('disruption'));
    if (routineDisruption) {
      return {
        required: true,
        priority: InterventionUrgency.LOW,
        suggestedCategories: [InterventionCategory.ROUTINE_SUPPORT],
        rationale: 'Routine disruption detected'
      };
    }

    return {
      required: false,
      priority: InterventionUrgency.SCHEDULED,
      suggestedCategories: [],
      rationale: 'No immediate intervention needed'
    };
  }

  /**
   * Generate adaptive intervention
   */
  private async generateAdaptiveIntervention(
    context: InterventionContext,
    need: { priority: InterventionUrgency; suggestedCategories: InterventionCategory[]; rationale: string }
  ): Promise<AdaptiveIntervention | null> {
    
    const category = this.selectOptimalCategory(need.suggestedCategories, context);
    if (!category) return null;

    const deliveryMethod = this.selectOptimalDeliveryMethod(need.priority, context);
    const content = this.generateInterventionContent(category, context);
    const personalizedContent = this.personalizeContent(content, context);

    const intervention: AdaptiveIntervention = {
      id: `intervention_${Date.now()}_${context.userId}`,
      userId: context.userId,
      category,
      urgency: need.priority,
      
      title: personalizedContent.title,
      content: personalizedContent.content,
      instructions: personalizedContent.instructions,
      duration: personalizedContent.duration,
      
      deliveryMethod,
      scheduledFor: this.calculateOptimalDeliveryTime(need.priority, context),
      expiresAt: new Date(Date.now() + this.getExpirationTime(category)),
      canBeDelayed: need.priority !== InterventionUrgency.IMMEDIATE,
      allowUserOverride: context.userConfig.userAutonomyLevel === 'high',
      
      triggeredBy: {
        contextAnalysisId: context.currentContext.analysisId,
        riskLevel: context.currentContext.riskAssessment.overallRisk,
        stressLevel: context.currentContext.userState.stressLevel,
        activityState: context.currentContext.userState.activityState,
        triggerFactors: context.currentContext.riskAssessment.riskFactors
      },
      
      personalizedFor: {
        userProfile: context.userProfile,
        preferredStyle: this.determinePreferredStyle(context),
        culturalContext: 'turkish',
        previousEffectiveness: this.getPreviousEffectiveness(category, context.userId)
      },
      
      delivery: {
        delivered: false,
        followUpRequired: this.shouldRequireFollowUp(category, need.priority)
      },
      
      createdAt: new Date(),
      cbtTechnique: this.mapCategoryToCBTTechnique(category),
      relatedInterventions: [],
      adaptationHistory: []
    };

    return intervention;
  }

  // =============================================================================
  // 🚀 INTERVENTION DELIVERY & SCHEDULING
  // =============================================================================

  /**
   * Schedule intervention for delivery
   */
  private async scheduleIntervention(intervention: AdaptiveIntervention): Promise<void> {
    const userQueue = this.interventionQueue.get(intervention.userId) || [];
    userQueue.push(intervention);
    this.interventionQueue.set(intervention.userId, userQueue);

    // Sort by urgency and scheduled time
    userQueue.sort((a, b) => {
      const urgencyOrder = {
        immediate: 5,
        high: 4,
        medium: 3,
        low: 2,
        scheduled: 1
      };
      
      const priorityDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      if (priorityDiff !== 0) return priorityDiff;
      
      return a.scheduledFor.getTime() - b.scheduledFor.getTime();
    });
  }

  /**
   * Deliver immediate intervention
   */
  private async deliverImmediateIntervention(intervention: AdaptiveIntervention): Promise<void> {
    intervention.delivery.delivered = true;
    intervention.delivery.deliveredAt = new Date();
    
    this.activeInterventions.set(intervention.id, intervention);
    
    // Here you would integrate with actual delivery mechanisms
    // For now, we'll just log the intervention
    console.log(`🚨 IMMEDIATE INTERVENTION DELIVERED:`, {
      title: intervention.title,
      content: intervention.content,
      method: intervention.deliveryMethod
    });
  }

  /**
   * Start intervention delivery loop
   */
  private deliveryLoop?: ReturnType<typeof setInterval>;

  private startInterventionDeliveryLoop(): void {
    if (this.deliveryLoop) {
      clearInterval(this.deliveryLoop as any);
    }
    this.deliveryLoop = setInterval(async () => {
      if (!this.isEnabled) return;

      for (const [userId, queue] of this.interventionQueue.entries()) {
        const now = new Date();
        const readyInterventions = queue.filter(i => 
          i.scheduledFor <= now && 
          !i.delivery.delivered &&
          i.expiresAt > now
        );

        for (const intervention of readyInterventions) {
          try {
            await this.deliverIntervention(intervention);
          } catch (error) {
            console.error(`❌ Failed to deliver intervention ${intervention.id}:`, error);
          }
        }

        // Clean up expired interventions
        this.interventionQueue.set(userId, queue.filter(i => i.expiresAt > now));
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Deliver intervention
   */
  private async deliverIntervention(intervention: AdaptiveIntervention): Promise<void> {
    intervention.delivery.delivered = true;
    intervention.delivery.deliveredAt = new Date();
    
    this.activeInterventions.set(intervention.id, intervention);
    
    // Integration point for actual delivery systems
    console.log(`⚡ INTERVENTION DELIVERED:`, {
      id: intervention.id,
      category: intervention.category,
      title: intervention.title,
      method: intervention.deliveryMethod,
      urgency: intervention.urgency
    });

    await trackAIInteraction(AIEventType.INTERVENTION_DELIVERED, {
      interventionId: intervention.id,
      userId: intervention.userId,
      category: intervention.category,
      deliveryMethod: intervention.deliveryMethod,
      urgency: intervention.urgency
    });
  }

  // =============================================================================
  // 🔧 HELPER METHODS
  // =============================================================================

  private checkInterventionRateLimit(context: InterventionContext): boolean {
    const config = this.getUserConfig(context.userId);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * 60 * 60 * 1000;

    const recentInterventions = context.recentInterventions.filter(i => 
      now - i.createdAt.getTime() < oneDay
    );

    const hourlyCount = recentInterventions.filter(i => 
      now - i.createdAt.getTime() < oneHour
    ).length;

    return hourlyCount < config.maxInterventionsPerHour && 
           recentInterventions.length < config.maxInterventionsPerDay;
  }

  private selectOptimalCategory(
    suggestedCategories: InterventionCategory[], 
    context: InterventionContext
  ): InterventionCategory | null {
    if (suggestedCategories.length === 0) return null;

    // Simple selection based on effectiveness history
    let bestCategory = suggestedCategories[0];
    let bestEffectiveness = this.getPreviousEffectiveness(bestCategory, context.userId);

    for (const category of suggestedCategories) {
      const effectiveness = this.getPreviousEffectiveness(category, context.userId);
      if (effectiveness > bestEffectiveness) {
        bestCategory = category;
        bestEffectiveness = effectiveness;
      }
    }

    return bestCategory;
  }

  private selectOptimalDeliveryMethod(
    priority: InterventionUrgency, 
    context: InterventionContext
  ): InterventionDelivery {
    const config = this.getUserConfig(context.userId);

    if (priority === InterventionUrgency.IMMEDIATE) {
      return InterventionDelivery.IN_APP_MODAL;
    }

    if (context.recentUserActivity.currentScreen && context.deviceState.inFocus) {
      return InterventionDelivery.GENTLE_REMINDER;
    }

    if (config.allowNotifications) {
      return InterventionDelivery.PUSH_NOTIFICATION;
    }

    return InterventionDelivery.TEXT_MESSAGE;
  }

  private generateInterventionContent(category: InterventionCategory, context: InterventionContext): {
    title: string;
    content: string;
    instructions: string[];
    duration: number;
  } {
    const templates = this.getInterventionTemplates();
    const template = templates[category] || templates[InterventionCategory.STRESS_REDUCTION];
    
    return {
      title: template.title,
      content: template.content,
      instructions: template.instructions,
      duration: template.duration
    };
  }

  private personalizeContent(
    content: { title: string; content: string; instructions: string[]; duration: number },
    context: InterventionContext
  ): { title: string; content: string; instructions: string[]; duration: number } {
    // Basic personalization
    return {
      ...content,
      title: `💙 ${content.title}`,
      content: `Merhaba! ${content.content}`,
    };
  }

  private calculateOptimalDeliveryTime(priority: InterventionUrgency, context: InterventionContext): Date {
    const now = new Date();
    
    switch (priority) {
      case InterventionUrgency.IMMEDIATE:
        return now;
      case InterventionUrgency.HIGH:
        return new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes
      case InterventionUrgency.MEDIUM:
        return new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
      case InterventionUrgency.LOW:
        return new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
      default:
        return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    }
  }

  private getExpirationTime(category: InterventionCategory): number {
    switch (category) {
      case InterventionCategory.CRISIS_SUPPORT: return 60 * 60 * 1000;
      case InterventionCategory.STRESS_REDUCTION: return 4 * 60 * 60 * 1000;
      case InterventionCategory.MOOD_REGULATION: return 8 * 60 * 60 * 1000;
      case InterventionCategory.ENERGY_BOOST: return 6 * 60 * 60 * 1000;
      case InterventionCategory.SLEEP_HYGIENE: return 12 * 60 * 60 * 1000;
      default: return 4 * 60 * 60 * 1000;
    }
  }

  private determinePreferredStyle(context: InterventionContext): 'gentle' | 'direct' | 'encouraging' {
    // Based on user state and previous preferences
    if (context.currentContext.userState.stressLevel === StressLevel.VERY_HIGH) {
      return 'gentle';
    }
    return 'encouraging';
  }

  private getPreviousEffectiveness(category: InterventionCategory, userId: string): number {
    const history = this.effectivenessHistory.get(userId) || [];
    const categoryHistory = history.filter(h => h.interventionId.includes(category));
    
    if (categoryHistory.length === 0) return 0.7; // Default effectiveness
    
    return categoryHistory.reduce((sum, h) => sum + h.effectiveness, 0) / categoryHistory.length;
  }

  private shouldRequireFollowUp(category: InterventionCategory, priority: InterventionUrgency): boolean {
    return category === InterventionCategory.CRISIS_SUPPORT || 
           priority === InterventionUrgency.IMMEDIATE;
  }

  private mapCategoryToCBTTechnique(category: InterventionCategory): CBTTechnique | undefined {
    switch (category) {
      case InterventionCategory.STRESS_REDUCTION: return CBTTechnique.PSYCHOEDUCATION;
      case InterventionCategory.MOOD_REGULATION: return CBTTechnique.COGNITIVE_RESTRUCTURING;
      case InterventionCategory.CBT_TECHNIQUE: return CBTTechnique.COGNITIVE_RESTRUCTURING;
      case InterventionCategory.BEHAVIORAL_ACTIVATION: return CBTTechnique.BEHAVIORAL_ACTIVATION;
      default: return undefined;
    }
  }

  private getUserConfig(userId: string): InterventionConfig {
    return this.userConfigs.get(userId) || this.getDefaultConfig();
  }

  private getDefaultConfig(): InterventionConfig {
    return {
      enabled: true,
      userAutonomyLevel: 'high',
      maxInterventionsPerHour: 3,
      maxInterventionsPerDay: 10,
      
      respectQuietHours: true,
      quietHours: {
        start: "22:00",
        end: "08:00"
      },
      
      preferredDeliveryMethods: [
        InterventionDelivery.GENTLE_REMINDER,
        InterventionDelivery.PUSH_NOTIFICATION,
        InterventionDelivery.TEXT_MESSAGE
      ],
      allowInAppInterruptions: true,
      allowNotifications: true,
      enableHapticFeedback: true,
      
      adaptToUserFeedback: true,
      learnFromEffectiveness: true,
      culturalAdaptation: true,
      
      crisisOverride: true,
      emergencyContacts: [],
      escalationProtocol: true
    };
  }

  private getInterventionTemplates(): Record<InterventionCategory, {
    title: string;
    content: string;
    instructions: string[];
    duration: number;
  }> {
    return {
      [InterventionCategory.CRISIS_SUPPORT]: {
        title: 'Acil Destek',
        content: 'Zor bir anla geçiyorsunuz. Size yardımcı olmak istiyorum.',
        instructions: [
          'Derin nefes alın',
          'Güvenli olduğunuzu hatırlayın',
          'Bu an geçicidir',
          'Destek için buradayım'
        ],
        duration: 300
      },
      [InterventionCategory.STRESS_REDUCTION]: {
        title: 'Stres Azaltma',
        content: 'Biraz stresli görünüyorsunuz. Rahatlamaya ne dersiniz?',
        instructions: [
          '4-7-8 nefes tekniği yapın',
          'Omuzlarınızı gevşetin',
          'Pozitif bir anıyı düşünün',
          '2 dakika mindfulness yapın'
        ],
        duration: 180
      },
      [InterventionCategory.ENERGY_BOOST]: {
        title: 'Enerji Artırma',
        content: 'Enerjiniz düşük görünüyor. Enerji artıralım!',
        instructions: [
          '10 kez derin nefes alın',
          'Ayağa kalkıp gerinin',
          'Su için',
          'Kısa bir yürüyüş yapın'
        ],
        duration: 120
      },
      [InterventionCategory.SLEEP_HYGIENE]: {
        title: 'Uyku Hijyeni',
        content: 'Geç saatte uyanık olduğunuzu fark ettim. Uyku zamanı yaklaşıyor.',
        instructions: [
          'Ekran parlaklığını azaltın',
          'Rahatlatıcı müzik dinleyin',
          'Yatağınızı hazırlayın',
          'Telefonunuzu sessiz moda alın'
        ],
        duration: 300
      },
      [InterventionCategory.SOCIAL_CONNECTION]: {
        title: 'Sosyal Bağlantı',
        content: 'Sevdiklerinizle iletişim kurmaya ne dersiniz?',
        instructions: [
          'Bir arkadaşınıza mesaj atın',
          'Aile bireyinizi arayın',
          'Sosyal bir aktivite planlayın',
          'Kendinizi ifade edin'
        ],
        duration: 240
      },
      [InterventionCategory.MINDFULNESS]: {
        title: 'Mindfulness',
        content: 'Şu ana odaklanma zamanı.',
        instructions: [
          '5 şey görün',
          '4 şey duyun',
          '3 şey hissedin',
          '2 şey koklayın',
          '1 şey tadın'
        ],
        duration: 180
      },
      [InterventionCategory.CBT_TECHNIQUE]: {
        title: 'CBT Tekniği',
        content: 'Düşüncelerinizi inceleyelim.',
        instructions: [
          'Bu düşünce ne kadar gerçekçi?',
          'Kanıtlar neler?',
          'Alternatif bakış açıları var mı?',
          'Daha dengeli bir düşünce oluşturun'
        ],
        duration: 300
      },
      [InterventionCategory.BEHAVIORAL_ACTIVATION]: {
        title: 'Aktivite Önerisi',
        content: 'Küçük bir aktivite yapmaya ne dersiniz?',
        instructions: [
          'Basit bir görev seçin',
          'Küçük adımlarla başlayın',
          'İlerlemeni kaydedin',
          'Kendinizi kutlayın'
        ],
        duration: 600
      },
      [InterventionCategory.ROUTINE_SUPPORT]: {
        title: 'Rutin Desteği',
        content: 'Rutininizi yeniden kurmaya odaklanalım.',
        instructions: [
          'Bugünkü planınızı gözden geçirin',
          'Önemli öncelikleri belirleyin',
          'Esnek hedefler koyun',
          'Küçük adımlarla ilerleyin'
        ],
        duration: 240
      },
      [InterventionCategory.MOOD_REGULATION]: {
        title: 'Duygu Düzenleme',
        content: 'Duygularınızı dengelemeye odaklanalım.',
        instructions: [
          'Şu anki duygunuzu tanımlayın',
          'Bu duygunun geçici olduğunu hatırlayın',
          'Olumlu aktiviteler düşünün',
          'Kendine şefkatli davranın'
        ],
        duration: 240
      }
    };
  }

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  /**
   * Adaptive Interventions durumunu kontrol et
   */
  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_ADAPTIVE_INTERVENTIONS');
  }

  /**
   * User configuration güncelle
   */
  updateUserConfiguration(userId: string, config: Partial<InterventionConfig>): void {
    const currentConfig = this.getUserConfig(userId);
    const updatedConfig = { ...currentConfig, ...config };
    this.userConfigs.set(userId, updatedConfig);
  }

  /**
   * Intervention effectiveness feedback
   */
  async recordInterventionFeedback(
    interventionId: string,
    userId: string,
    effectiveness: number,
    userResponse: 'completed' | 'dismissed' | 'delayed' | 'ignored'
  ): Promise<void> {
    const intervention = this.activeInterventions.get(interventionId);
    if (intervention) {
      intervention.delivery.effectivenessRating = effectiveness;
      intervention.delivery.userResponse = userResponse;
      
      // Store in effectiveness history
      const history = this.effectivenessHistory.get(userId) || [];
      history.push({
        interventionId,
        effectiveness,
        timestamp: new Date()
      });
      this.effectivenessHistory.set(userId, history);
      
      await trackAIInteraction(AIEventType.INTERVENTION_FEEDBACK, {
        interventionId,
        userId,
        effectiveness,
        userResponse,
        category: intervention.category
      });
    }
  }

  /**
   * Get active interventions for user
   */
  getActiveInterventions(userId: string): AdaptiveIntervention[] {
    const allActive = Array.from(this.activeInterventions.values());
    return allActive.filter(i => i.userId === userId && !i.delivery.completedAt);
  }

  /**
   * Engine'i temizle
   */
  async shutdown(): Promise<void> {
    console.log('⚡ Adaptive Interventions Engine: Shutting down...');
    this.isEnabled = false;
    this.interventionQueue.clear();
    this.activeInterventions.clear();
    this.userConfigs.clear();
    this.effectivenessHistory.clear();
    if (this.deliveryLoop) {
      clearInterval(this.deliveryLoop);
      this.deliveryLoop = undefined;
    }
    
    await trackAIInteraction(AIEventType.ADAPTIVE_INTERVENTIONS_SHUTDOWN, {
      version: '1.0'
    });
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const adaptiveInterventionsEngine = AdaptiveInterventionsEngine.getInstance();
export default adaptiveInterventionsEngine;