/**
 * 🔗 Insights Coordinator - Sprint 5 Integration Hub
 * 
 * Bu coordinator, sistemdeki AI bileşenlerini orchestrate eder:
 * - Insights Engine v2.0
 * - Pattern Recognition v2.0
 * - Smart Notifications
 * - CBT Engine
 * - External AI Service
 * 
 * ⚠️ CRITICAL: End-to-end insight delivery workflow'u yönetir
 * ⚠️ Feature flag kontrolü: AI_INSIGHTS_ENGINE_V2
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import {
  AIMessage,
  ConversationContext,
  UserTherapeuticProfile,
  AIError,
  AIErrorCode,
  ErrorSeverity,
  isAIError
} from '@/features/ai/types';

// Sprint 4 imports
import { cbtEngine } from '@/features/ai/engines/cbtEngine';
import { externalAIService } from '@/features/ai/services/externalAIService';
import { therapeuticPromptEngine } from '@/features/ai/prompts/therapeuticPrompts';

// Sprint 5 imports
import { 
  insightsEngineV2, 
  type IntelligentInsight,
  type InsightGenerationContext,
  InsightCategory,
  InsightPriority,
  InsightTiming
} from '@/features/ai/engines/insightsEngineV2';

import { 
  patternRecognitionV2,
  type PatternAnalysisContext,
  type PatternRecognitionResult,
  type DetectedPattern
} from '@/features/ai/services/patternRecognitionV2';

import { 
  smartNotificationService,
  type DeliveryContext,
  type SmartNotification
} from '@/features/ai/services/smartNotifications';

// Progress Analytics removed

import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 COORDINATOR DEFINITIONS & TYPES
// =============================================================================

/**
 * Comprehensive insight workflow context
 */
export interface ComprehensiveInsightContext {
  userId: string;
  userProfile: UserTherapeuticProfile;
  
  // Data sources
  recentMessages: AIMessage[];
  conversationHistory: ConversationContext[];
  behavioralData: {
    compulsions: {
      id: string;
      category: string;
      resistance_level?: number;
      timestamp?: string | Date;
    }[];
    moods: {
      score: number;
      timestamp: string | Date;
    }[];
    exercises: {
      id: string;
      name?: string;
      duration_minutes?: number;
      completed?: boolean;
      timestamp?: string | Date;
    }[];
    achievements: {
      id: string;
      type: string;
      timestamp: string | Date;
    }[];
    assessments: {
      id?: string;
      type: string;
      score?: number;
      timestamp?: string | Date;
    }[];
  };
  
  // Analysis parameters
  timeframe: {
    start: Date;
    end: Date;
    analysisDepth: 'quick' | 'standard' | 'comprehensive';
  };
  
  // Delivery preferences
  deliveryPreferences: {
    immediate: boolean;
    allowNotifications: boolean;
    respectQuietHours: boolean;
    preferredMethod?: string;
  };
  
  appUsageContext: {
    isActive: boolean;
    currentScreen?: string;
    lastActivity: Date;
  };
}

/**
 * Orchestrated insight result
 */
export interface OrchestratedInsightResult {
  executionId: string;
  userId: string;
  timestamp: Date;
  
  // Analysis results
  patterns: DetectedPattern[];
  insights: IntelligentInsight[];
  
  // Delivery results
  scheduledNotifications: SmartNotification[];
  immediateInsights: IntelligentInsight[];
  
  // Quality metrics
  executionMetrics: {
    totalLatency: number;
    componentsExecuted: string[];
    successRate: number;
    dataQuality: number;
  };
  
  // Next steps
  recommendations: {
    nextAnalysisIn: number; // milliseconds
    suggestedInterventions: string[];
    priorityActions: string[];
  };
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  enablePatternAnalysis: boolean;
  enableInsightGeneration: boolean;
  enableNotificationScheduling: boolean;
  enableAIEnhancement: boolean;
  parallelExecution: boolean;
  timeoutMs: number;
}

// =============================================================================
// 🔗 INSIGHTS COORDINATOR IMPLEMENTATION
// =============================================================================

class InsightsCoordinator {
  private static instance: InsightsCoordinator;
  private isEnabled: boolean = false;
  private activeExecutions: Map<string, Promise<OrchestratedInsightResult>> = new Map();
  private lastExecutionTime: Map<string, Date> = new Map();
  private defaultConfig: WorkflowConfig;

  private constructor() {
    this.defaultConfig = {
      enablePatternAnalysis: true,
      enableInsightGeneration: true,
      enableNotificationScheduling: true,
      enableAIEnhancement: true,
      parallelExecution: true,
      timeoutMs: 30000 // 30 seconds
    };
  }

  static getInstance(): InsightsCoordinator {
    if (!InsightsCoordinator.instance) {
      InsightsCoordinator.instance = new InsightsCoordinator();
    }
    return InsightsCoordinator.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION & SETUP
  // =============================================================================

  /**
   * Insights Coordinator'ı başlat
   */
  async initialize(): Promise<void> {
    console.log('🔗 Insights Coordinator: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_INSIGHTS_ENGINE_V2')) {
        console.log('🚫 Insights Coordinator disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      // Component initialization check
      const componentStatus = {
        cbtEngine: cbtEngine.enabled,
        externalAI: externalAIService.enabled,
        insightsEngine: insightsEngineV2.enabled,
        patternRecognition: patternRecognitionV2.enabled,
        smartNotifications: smartNotificationService.enabled
      };

      const enabledComponents = Object.values(componentStatus).filter(Boolean).length;
      const totalComponents = Object.keys(componentStatus).length;

      // Uyarıyı oran yerine çekirdek bileşenlerin (insightsEngine, patternRecognition, smartNotifications)
      // kullanılabilirliğine göre yap.
      const coreAvailable = Number(componentStatus.insightsEngine) + Number(componentStatus.patternRecognition) + Number(componentStatus.smartNotifications);
      if (coreAvailable < 2) {
        console.warn('⚠️ Core insight pipeline partially available, functionality may be limited');
      }

      this.isEnabled = true;
      
      // Telemetry: kısa gecikme sonra componentStatus gönder
      await new Promise(resolve => setTimeout(resolve, 150));
      const delayedStatus = {
        cbtEngine: cbtEngine.enabled,
        externalAI: externalAIService.enabled,
        insightsEngine: insightsEngineV2.enabled,
        patternRecognition: patternRecognitionV2.enabled,
        smartNotifications: smartNotificationService.enabled
      };
      const delayedEnabled = Object.values(delayedStatus).filter(Boolean).length;
      await trackAIInteraction(AIEventType.SYSTEM_STARTED, {
        version: '2.0',
        componentStatus: delayedStatus,
        enabledComponents: delayedEnabled,
        totalComponents
      });

      console.log(`✅ Insights Coordinator initialized (${enabledComponents}/${totalComponents} components active)`);

    } catch (error) {
      console.error('❌ Insights Coordinator initialization failed:', error);
      this.isEnabled = false;
      
      await trackAIError({
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: 'Insights Coordinator başlatılamadı',
        severity: ErrorSeverity.HIGH,
        context: { component: 'InsightsCoordinator', method: 'initialize' }
      });
      
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN ORCHESTRATION METHODS
  // =============================================================================

  /**
   * Comprehensive insight workflow - Ana orchestration metodu
   */
  async orchestrateInsightWorkflow(
    context: ComprehensiveInsightContext,
    config?: Partial<WorkflowConfig>
  ): Promise<OrchestratedInsightResult> {
    if (!this.isEnabled) {
      const error = new Error('Insights Coordinator is not enabled');
      (error as any).code = AIErrorCode.FEATURE_DISABLED;
      (error as any).severity = ErrorSeverity.MEDIUM;
      (error as any).recoverable = true;
      throw error;
    }

    const executionId = `execution_${Date.now()}_${context.userId}`;
    const startTime = Date.now();
    const workflowConfig = { ...this.defaultConfig, ...config };

    try {
      // Validate required fields early and fail with meaningful error
      if (!context.recentMessages || !context.behavioralData || !context.timeframe) {
        const missingFields: string[] = [];
        if (!context.recentMessages) missingFields.push('recentMessages');
        if (!context.behavioralData) missingFields.push('behavioralData');
        if (!context.timeframe) missingFields.push('timeframe');
        try {
          await trackAIInteraction(AIEventType.INSIGHTS_MISSING_REQUIRED_FIELDS, { missingFields }, context.userId);
        } catch {}
        const err = new Error(`Gerekli alanlar eksik: ${missingFields.join(', ')}`);
        (err as any).code = AIErrorCode.DATA_VALIDATION_FAILED;
        (err as any).severity = ErrorSeverity.MEDIUM;
        throw err;
      }
      console.log(`🔗 Starting comprehensive insight workflow for user ${context.userId}`);

      // ✅ PRODUCTION: Rate limiting - daha akıllı ve esnek
      const lastExecution = this.lastExecutionTime.get(context.userId);
      const timeSinceLastExecution = lastExecution ? Date.now() - lastExecution.getTime() : Number.MAX_SAFE_INTEGER;
      const minInterval = context.timeframe.analysisDepth === 'quick' ? 30000 : 60000; // 30s for quick, 1min for others
      
      if (timeSinceLastExecution < minInterval) {
        console.log(`⏱️ Workflow rate limited for user (${Math.round(timeSinceLastExecution/1000)}s ago, min ${minInterval/1000}s):`, context.userId);
        try {
          await trackAIInteraction(AIEventType.INSIGHTS_RATE_LIMITED, {
            userId: context.userId,
            sinceLastMs: timeSinceLastExecution,
            minIntervalMs: minInterval
          }, context.userId);
        } catch {}

        // Return empty result instead of throwing error
        return {
          executionId: `cached_${Date.now()}_${context.userId}`,
          userId: context.userId,
          timestamp: new Date(),
          patterns: [],
          insights: [],
          scheduledNotifications: [],
          immediateInsights: [],
          executionMetrics: {
            totalLatency: 0,
            componentsExecuted: ['cache'],
            successRate: 1.0,
            dataQuality: 0.5
          },
          recommendations: {
            nextAnalysisIn: minInterval - timeSinceLastExecution,
            suggestedInterventions: [],
            priorityActions: []
          }
        };
      }

      // Check for existing execution - queue new requests for the same user
      if (this.activeExecutions.has(context.userId)) {
        console.log('⏳ Workflow already in progress for user, queuing request:', context.userId);
        const previous = this.activeExecutions.get(context.userId)!;
        const chained = previous.finally(() => this.executeWorkflow(context, workflowConfig, executionId, startTime));
        this.activeExecutions.set(context.userId, chained);
        return await chained;
      }

      // Start workflow execution
      const workflowPromise = this.executeWorkflow(context, workflowConfig, executionId, startTime);
      this.activeExecutions.set(context.userId, workflowPromise);

      try {
        const result = await workflowPromise;
        this.lastExecutionTime.set(context.userId, new Date());
        return result;
      } finally {
        this.activeExecutions.delete(context.userId);
      }

    } catch (error) {
      // Rate limit durumunda error değil info log
      if (error && typeof error === 'object' && 'code' in error && error.code === AIErrorCode.RATE_LIMIT) {
        console.log('ℹ️ Insight workflow rate limited (expected behavior)');
      } else {
        console.error('❌ Insight workflow orchestration failed:', error);
      }
      
      // Only track non-rate-limit errors as HIGH severity
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error && typeof error === 'object' && 'code' in (error as any)) 
                        ? (error as any).code as AIErrorCode : AIErrorCode.UNKNOWN;
      const isRateLimit = errorCode === AIErrorCode.RATE_LIMIT;
      
      await trackAIError({
        code: errorCode,
        message: isRateLimit ? 'Rate limit aktif - normal davranış' : 'Insight workflow orchestration başarısız',
        severity: isRateLimit ? ErrorSeverity.LOW : ErrorSeverity.HIGH,
        context: { 
          component: 'InsightsCoordinator', 
          method: 'orchestrateInsightWorkflow',
          executionId,
          userId: context.userId,
          latency: Date.now() - startTime,
          errorType: (error as any)?.constructor?.name || 'Unknown',
          isExpectedBehavior: isRateLimit,
          originalMessage: errorMessage
        }
      });

      throw error;
    }
  }

  /**
   * Actual workflow execution
   */
  private async executeWorkflow(
    context: ComprehensiveInsightContext,
    config: WorkflowConfig,
    executionId: string,
    startTime: number
  ): Promise<OrchestratedInsightResult> {
    const components: string[] = [];
    let patterns: DetectedPattern[] = [];
    let insights: IntelligentInsight[] = [];
    let scheduledNotifications: SmartNotification[] = [];

    // Timeout protection
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error('Workflow timeout');
        (error as any).code = AIErrorCode.TIMEOUT;
        (error as any).severity = ErrorSeverity.MEDIUM;
        reject(error);
      }, config.timeoutMs);
    });

    try {
      if (config.parallelExecution) {
        // Parallel execution for better performance
        const promises = [];

        // Pattern Analysis
        if (config.enablePatternAnalysis && patternRecognitionV2.enabled) {
          promises.push(this.executePatternAnalysis(context).then(result => {
            patterns = result;
            components.push('patternRecognition');
          }));
        }

        // Progress Analytics removed

        // Wait for initial analysis
        await Promise.race([Promise.all(promises), timeoutPromise]);

        // Sequential insight generation (depends on patterns)
        if (config.enableInsightGeneration && insightsEngineV2.enabled) {
          insights = await this.executeInsightGeneration(context, patterns);
          components.push('insightsEngine');
        }

        // Notification scheduling (depends on insights)
        if (config.enableNotificationScheduling && smartNotificationService.enabled && insights.length > 0) {
          scheduledNotifications = await this.executeNotificationScheduling(context, insights);
          components.push('smartNotifications');
        }

      } else {
        // Sequential execution
        if (config.enablePatternAnalysis && patternRecognitionV2.enabled) {
          patterns = await this.executePatternAnalysis(context);
          components.push('patternRecognition');
        }

        if (config.enableInsightGeneration && insightsEngineV2.enabled) {
          insights = await this.executeInsightGeneration(context, patterns);
          components.push('insightsEngine');
        }

        // Progress Analytics removed

        if (config.enableNotificationScheduling && smartNotificationService.enabled && insights.length > 0) {
          scheduledNotifications = await this.executeNotificationScheduling(context, insights);
          components.push('smartNotifications');
        }
      }

      // Separate immediate insights from scheduled ones
      const immediateInsights = insights.filter(insight => 
        insight.timing === InsightTiming.IMMEDIATE || 
        insight.priority === InsightPriority.CRITICAL
      );

      // Calculate execution metrics
      const executionMetrics = {
        totalLatency: Date.now() - startTime,
        componentsExecuted: components,
        successRate: components.length / this.getMaxComponents(config),
        dataQuality: this.calculateDataQuality(context)
      };

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        patterns, 
        insights, 
        context
      );

      const result: OrchestratedInsightResult = {
        executionId,
        userId: context.userId,
        timestamp: new Date(),
        patterns,
        insights,
        scheduledNotifications,
        immediateInsights,
        executionMetrics,
        recommendations
      };

      // Telemetry
      await trackAIInteraction(AIEventType.INTERVENTION_RECOMMENDED, {
        executionId,
        userId: context.userId,
        componentsExecuted: components,
        patternsDetected: patterns.length,
        insightsGenerated: insights.length,
        notificationsScheduled: scheduledNotifications.length,
        immediateInsights: immediateInsights.length,
        totalLatency: executionMetrics.totalLatency,
        successRate: executionMetrics.successRate
      });

      console.log(`✅ Insight workflow completed: ${insights.length} insights, ${patterns.length} patterns`);
      return result;

    } catch (error) {
      console.error('❌ Workflow execution failed:', error);
      throw error;
    }
  }

  // =============================================================================
  // 🔧 COMPONENT EXECUTION METHODS
  // =============================================================================

  /**
   * Pattern analysis yürüt
   */
  private async executePatternAnalysis(context: ComprehensiveInsightContext): Promise<DetectedPattern[]> {
    try {
      const analysisContext: PatternAnalysisContext = {
        userId: context.userId,
        userProfile: context.userProfile,
        timeframe: {
          start: context.timeframe.start,
          end: context.timeframe.end,
          analysisDepth: context.timeframe.analysisDepth === 'quick' ? 'shallow' : 
                        context.timeframe.analysisDepth === 'comprehensive' ? 'comprehensive' : 'deep'
        },
        dataSource: {
          messages: context.recentMessages,
          compulsions: context.behavioralData.compulsions.map(c => ({
            id: c.id,
            timestamp: new Date(c.timestamp || new Date()),
            category: c.category
          })),
          moods: context.behavioralData.moods.map(m => ({
            timestamp: new Date(m.timestamp),
            score: m.score
          })),
          exercises: context.behavioralData.exercises.map(e => ({
            id: e.id,
            type: e.name,
            duration: e.duration_minutes,
            timestamp: new Date(e.timestamp || new Date())
          })),
          achievements: context.behavioralData.achievements.map(a => ({
            name: a.type,
            timestamp: new Date(a.timestamp)
          })),
          userEvents: []
        },
        minimumConfidence: 0.6,
        includeCorrelations: true
      };

      const result = await patternRecognitionV2.analyzePatterns(analysisContext);
      return result.patterns;

    } catch (error) {
      console.warn('⚠️ Pattern analysis failed:', error);
      return [];
    }
  }

  /**
   * Insight generation yürüt
   */
  private async executeInsightGeneration(
    context: ComprehensiveInsightContext, 
    patterns: DetectedPattern[]
  ): Promise<IntelligentInsight[]> {
    try {
      const insightContext: InsightGenerationContext = {
        userId: context.userId,
        userProfile: context.userProfile,
        recentMessages: context.recentMessages,
        conversationHistory: context.conversationHistory,
        behavioralData: context.behavioralData,
        timeframe: {
          start: context.timeframe.start,
          end: context.timeframe.end,
          period: 'week'
        },
        lastInsightGenerated: null
      };

      return await insightsEngineV2.generateInsights(insightContext);

    } catch (error) {
      console.warn('⚠️ Insight generation failed:', error);
      return [];
    }
  }

  /**
   * Progress analysis yürüt
   */
  // Progress Analytics removed

  /**
   * Notification scheduling yürüt
   */
  private async executeNotificationScheduling(
    context: ComprehensiveInsightContext,
    insights: IntelligentInsight[]
  ): Promise<SmartNotification[]> {
    try {
      if (!context.deliveryPreferences.allowNotifications) {
        return [];
      }

      const deliveryContext: DeliveryContext = {
        userId: context.userId,
        userPreferences: await this.getUserNotificationPreferences(context.userId),
        currentContext: {
          isAppActive: context.appUsageContext.isActive,
          lastActivity: context.appUsageContext.lastActivity,
          currentScreen: context.appUsageContext.currentScreen,
        },
        recentNotifications: [],
        timeOfDay: new Date()
      };

      const scheduledNotifications: SmartNotification[] = [];

      for (const insight of insights) {
        // Skip immediate insights from notification scheduling
        if (insight.timing === InsightTiming.IMMEDIATE || insight.priority === InsightPriority.CRITICAL) {
          continue;
        }

        const result = await smartNotificationService.scheduleInsightNotification(insight, deliveryContext);
        if (result.scheduled && result.notification) {
          scheduledNotifications.push(result.notification);
        }
      }

      return scheduledNotifications;

    } catch (error) {
      console.warn('⚠️ Notification scheduling failed:', error);
      return [];
    }
  }

  // =============================================================================
  // 🔧 HELPER METHODS
  // =============================================================================

  private async getUserNotificationPreferences(userId: string) {
    // This would typically fetch from user settings
    return smartNotificationService['getUserPreferences'](userId);
  }

  private getMaxComponents(config: WorkflowConfig): number {
    let maxComponents = 0;
    if (config.enablePatternAnalysis) maxComponents++;
    if (config.enableInsightGeneration) maxComponents++;
    // Progress Analytics removed
    if (config.enableNotificationScheduling) maxComponents++;
    return maxComponents;
  }

  private calculateDataQuality(context: ComprehensiveInsightContext): number {
    const sources = [
      context.recentMessages.length > 0,
      context.behavioralData.compulsions.length > 0,
      context.behavioralData.moods.length > 0,
      context.behavioralData.exercises.length > 0,
      context.behavioralData.achievements.length > 0,
      context.behavioralData.assessments.length > 0
    ];

    return sources.filter(Boolean).length / sources.length;
  }

  private generateRecommendations(
    patterns: DetectedPattern[],
    insights: IntelligentInsight[],
    context: ComprehensiveInsightContext
  ) {
    // Determine next analysis timing
    const nextAnalysisIn = 24 * 60 * 60 * 1000; // 24 hours default

    // Suggested interventions
    const suggestedInterventions: string[] = [];
    if (patterns.some(p => p.severity === 'severe' || p.severity === 'critical')) {
      suggestedInterventions.push('Immediate CBT intervention');
    }
    if (insights.some(i => i.priority === InsightPriority.HIGH)) {
      suggestedInterventions.push('Focus on high-priority insights');
    }

    // Priority actions
    const priorityActions: string[] = [];
    // Crisis actions removed
    if (insights.filter(i => !i.shown).length > 3) {
      priorityActions.push('Review pending insights');
    }

    return {
      nextAnalysisIn,
      suggestedInterventions,
      priorityActions
    };
  }

  // Progress analytics removed

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  /**
   * Quick insight generation (lightweight)
   */
  async quickInsightGeneration(
    userId: string,
    recentMessages: AIMessage[],
    userProfile: UserTherapeuticProfile
  ): Promise<IntelligentInsight[]> {
    const context: ComprehensiveInsightContext = {
      userId,
      userProfile,
      recentMessages,
      conversationHistory: [],
      behavioralData: {
        compulsions: [],
        moods: [],
        exercises: [],
        achievements: [],
        assessments: []
      },
      timeframe: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
        analysisDepth: 'quick'
      },
      deliveryPreferences: {
        immediate: true,
        allowNotifications: false,
        respectQuietHours: false
      },
      appUsageContext: {
        isActive: true,
        lastActivity: new Date()
      }
    };

    const result = await this.orchestrateInsightWorkflow(context, {
      enablePatternAnalysis: false,
      
      enableNotificationScheduling: false,
      enableAIEnhancement: true,
      parallelExecution: false,
      timeoutMs: 10000 // 10 seconds for quick
    });

    return result.immediateInsights;
  }

  /**
   * Coordinator durumunu kontrol et
   */
  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_INSIGHTS_ENGINE_V2');
  }

  /**
   * Active executions sayısını al
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * 📊 Generate daily insights for user
   */
  async generateDailyInsights(userId: string, userProfile?: UserTherapeuticProfile): Promise<IntelligentInsight[]> {
    if (!this.isEnabled) {
      console.warn('⚠️ Insights Coordinator is not enabled');
      return [];
    }

    try {
      // Create context for daily insights
      const context: ComprehensiveInsightContext = {
        userId,
        userProfile: userProfile || {} as UserTherapeuticProfile,
        recentMessages: [],
        conversationHistory: [],
        behavioralData: {
          compulsions: [],
          moods: [],
          exercises: [],
          achievements: [],
          assessments: []
        },
        timeframe: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          end: new Date(),
          analysisDepth: 'standard'
        },
        deliveryPreferences: {
          immediate: false,
          allowNotifications: true,
          respectQuietHours: true
        },
        appUsageContext: {
          isActive: true,
          currentScreen: 'home',
          lastActivity: new Date()
        }
      };

      // Generate insights
      const result = await this.orchestrateInsightWorkflow(context);
      
      console.log(`📊 Generated ${result.insights.length} daily insights for user ${userId}`);
      return result.insights;
      
    } catch (error) {
      console.error('❌ Failed to generate daily insights:', error);
      await trackAIError({
        code: AIErrorCode.PROCESSING_FAILED,
        message: 'Daily insights generation failed',
        severity: ErrorSeverity.MEDIUM,
        context: { userId, method: 'generateDailyInsights' }
      });
      return [];
    }
  }

  /**
   * 📊 Generate daily insights with provided behavioral data
   * Lightweight API for UI surfaces (e.g., Today screen) to enrich context
   */
  async generateDailyInsightsWithData(
    userId: string,
    userProfile: UserTherapeuticProfile | undefined,
    behavioralData: {
      compulsions: any[];
      moods: any[];
      exercises: any[];
      achievements: any[];
      assessments: any[];
    },
    analysisDepth: 'quick' | 'standard' | 'comprehensive' = 'standard'
  ): Promise<IntelligentInsight[]> {
    if (!this.isEnabled) {
      console.warn('⚠️ Insights Coordinator is not enabled');
      return [];
    }
    try {
      const context: ComprehensiveInsightContext = {
        userId,
        userProfile: userProfile || ({} as UserTherapeuticProfile),
        recentMessages: [],
        conversationHistory: [],
        behavioralData: behavioralData || {
          compulsions: [],
          moods: [],
          exercises: [],
          achievements: [],
          assessments: []
        },
        timeframe: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
          analysisDepth
        },
        deliveryPreferences: {
          immediate: false,
          allowNotifications: true,
          respectQuietHours: true
        },
        appUsageContext: {
          isActive: true,
          currentScreen: 'home',
          lastActivity: new Date()
        }
      };

      const result = await this.orchestrateInsightWorkflow(context);
      return result.insights;
    } catch (error) {
      console.error('❌ Failed to generate daily insights (with data):', error);
      return [];
    }
  }

  /**
   * Coordinator'ı temizle
   */
  async shutdown(): Promise<void> {
    console.log('🔗 Insights Coordinator: Shutting down...');
    
    // Wait for active executions to complete (with timeout)
    const activePromises = Array.from(this.activeExecutions.values());
    if (activePromises.length > 0) {
      console.log(`⏳ Waiting for ${activePromises.length} active executions to complete...`);
      try {
        await Promise.race([
          Promise.all(activePromises),
          new Promise(resolve => setTimeout(resolve, 10000)) // 10 second timeout
        ]);
      } catch (error) {
        console.warn('⚠️ Some executions did not complete during shutdown');
      }
    }

    this.isEnabled = false;
    this.activeExecutions.clear();
    this.lastExecutionTime.clear();
    
          await trackAIInteraction(AIEventType.SYSTEM_STOPPED, {
      version: '2.0'
    });
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const insightsCoordinator = InsightsCoordinator.getInstance();
export default insightsCoordinator;