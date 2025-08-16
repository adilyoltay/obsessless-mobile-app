/**
 * 🔄 Insights Engine v2.0 - Intelligent Pattern Analysis & Therapeutic Insights
 * 
 * Bu engine, kullanıcı verilerini AI destekli analiz ederek kişiselleştirilmiş
 * terapötik içgörüler üretir. CBT Engine, External AI Service ve Advanced Pattern
 * Recognition ile entegre çalışarak modern ML algoritmaları kullanır.
 * 
 * ⚠️ CRITICAL: Sprint 4'teki AI altyapısını kullanarak build edilmiş
 * ⚠️ Feature flag kontrolü: AI_INSIGHTS_ENGINE_V2
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  AIMessage, 
  ConversationContext, 
  UserTherapeuticProfile,
  AIError,
  AIErrorCode,
  ErrorSeverity,
  RiskLevel
} from '@/features/ai/types';
import { CBTTechnique, CognitiveDistortion, cbtEngine } from '@/features/ai/engines/cbtEngine';
import { externalAIService } from '@/features/ai/services/externalAIService';
import { therapeuticPromptEngine } from '@/features/ai/prompts/therapeuticPrompts';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 INSIGHT TYPES & DEFINITIONS
// =============================================================================

/**
 * Insight kategorileri
 */
export enum InsightCategory {
  PATTERN_RECOGNITION = 'pattern_recognition',
  PROGRESS_TRACKING = 'progress_tracking',
  THERAPEUTIC_GUIDANCE = 'therapeutic_guidance',
  BEHAVIORAL_ANALYSIS = 'behavioral_analysis',
  EMOTIONAL_STATE = 'emotional_state',
  SKILL_DEVELOPMENT = 'skill_development',
  RELAPSE_PREVENTION = 'relapse_prevention'
}

/**
 * Insight öncelik seviyeleri
 */
export enum InsightPriority {
  CRITICAL = 'critical',    // Kriz durumu, acil müdahale
  HIGH = 'high',           // Önemli pattern, terapötik fırsat
  MEDIUM = 'medium',       // Faydalı gözlem, iyileştirme alanı
  LOW = 'low',            // Genel bilgi, motivasyon
  INFO = 'info'           // Eğitici içerik, destekleyici bilgi
}

/**
 * Insight timing - Ne zaman gösterilecek
 */
export enum InsightTiming {
  IMMEDIATE = 'immediate',     // Hemen göster
  NEXT_SESSION = 'next_session', // Sonraki seansta
  DAILY_SUMMARY = 'daily_summary', // Günlük özette
  WEEKLY_REVIEW = 'weekly_review', // Haftalık incelemede
  MILESTONE = 'milestone'     // Önemli başarılarda
}

/**
 * Intelligent Insight - AI destekli içgörü
 */
export interface IntelligentInsight {
  id: string;
  userId: string;
  category: InsightCategory;
  priority: InsightPriority;
  timing: InsightTiming;
  
  // Content
  title: string;
  message: string;
  actionableAdvice: string[];
  therapeuticTechnique?: CBTTechnique;
  
  // AI Analysis
  confidence: number; // 0-1 arası güven skoru
  aiProvider?: string;
  detectedPatterns: string[];
  cognitiveDistortions?: CognitiveDistortion[];
  emotionalState?: string;
  
  // Context
  basedOnData: {
    messageCount: number;
    timeframe: string;
    keyEvents: string[];
    compulsionFrequency?: number;
    moodTrend?: 'improving' | 'stable' | 'declining';
  };
  
  // Metadata
  generatedAt: Date;
  validUntil: Date;
  shown: boolean;
  shownAt?: Date;
  userFeedback?: 'helpful' | 'not_helpful' | 'irrelevant';
  
  // Tracking
  therapeuticGoals: string[];
  expectedOutcome: string;
  followUpRequired: boolean;
  relatedInsightIds: string[];
}

/**
 * Insight generation context
 */
export interface InsightGenerationContext {
  userId: string;
  userProfile: UserTherapeuticProfile;
  recentMessages: AIMessage[];
  conversationHistory: ConversationContext[];
  behavioralData: {
    compulsions: any[];
    moods: any[];
    exercises: any[];
    achievements: any[];
  };
  timeframe: {
    start: Date;
    end: Date;
    period: 'day' | 'week' | 'month';
  };
  lastInsightGenerated: Date | null;
}

/**
 * Pattern Analysis Result
 */
export interface PatternAnalysisResult {
  patterns: {
    type: string;
    description: string;
    frequency: number;
    confidence: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    timeframe: string;
  }[];
  recommendations: {
    technique: CBTTechnique;
    rationale: string;
    urgency: InsightPriority;
  }[];
  riskAssessment: {
    level: RiskLevel;
    indicators: string[];
    preventiveActions: string[];
  };
}

// =============================================================================
// 🔄 INSIGHTS ENGINE V2.0 IMPLEMENTATION
// =============================================================================

class InsightsEngineV2 {
  private static instance: InsightsEngineV2;
  private isEnabled: boolean = false;
  private insightCache: Map<string, IntelligentInsight[]> = new Map();
  private generationQueue: Map<string, Promise<IntelligentInsight[]>> = new Map();
  private lastGenerationTime: Map<string, Date> = new Map();

  private constructor() {}

  static getInstance(): InsightsEngineV2 {
    if (!InsightsEngineV2.instance) {
      InsightsEngineV2.instance = new InsightsEngineV2();
    }
    return InsightsEngineV2.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION & SETUP
  // =============================================================================

  /**
   * Insights Engine v2.0'ı başlat
   */
  async initialize(): Promise<void> {
    console.log('🔄 Insights Engine v2.0: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_INSIGHTS_ENGINE_V2')) {
        console.log('🚫 Insights Engine v2.0 disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      // Dependency check - Sprint 4 components
      if (!cbtEngine.enabled) {
        console.warn('⚠️ CBT Engine not available, insights will be limited');
      }

      if (!externalAIService.enabled) {
        console.warn('⚠️ External AI Service not available, using pattern-based insights only');
      }

      this.isEnabled = true;

      // Load persisted caches (offline-first)
      try {
        const indexRaw = await AsyncStorage.getItem('insights_cache_users');
        const userIds: string[] = indexRaw ? JSON.parse(indexRaw) : [];
        if (Array.isArray(userIds) && userIds.length > 0) {
          for (const uid of userIds) {
            if (typeof uid !== 'string' || uid.length === 0) continue;
            try {
              const cacheKey = `insights_cache_${uid}`;
              const lastKey = `insights_last_gen_${uid}`;
              const cachedRaw = await AsyncStorage.getItem(cacheKey);
              const lastRaw = await AsyncStorage.getItem(lastKey);
              if (cachedRaw) {
                const parsed: IntelligentInsight[] = JSON.parse(cachedRaw);
                this.insightCache.set(uid, parsed);
              }
              if (lastRaw) {
                const ts = Number(lastRaw);
                if (!Number.isNaN(ts)) this.lastGenerationTime.set(uid, new Date(ts));
              }
            } catch {}
          }
        }
      } catch {}
      
      // Telemetry
      await trackAIInteraction(AIEventType.INSIGHTS_ENGINE_INITIALIZED, {
        version: '2.0',
        dependencies: {
          cbtEngine: cbtEngine.enabled,
          externalAI: externalAIService.enabled,
          therapeuticPrompts: therapeuticPromptEngine.enabled
        }
      });

      console.log('✅ Insights Engine v2.0 initialized successfully');

    } catch (error) {
      console.error('❌ Insights Engine v2.0 initialization failed:', error);
      this.isEnabled = false;
      
      await trackAIError({
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: 'Insights Engine v2.0 başlatılamadı',
        severity: ErrorSeverity.HIGH,
        context: { component: 'InsightsEngineV2', method: 'initialize' }
      });
      
      throw error;
    }
  }

  // =============================================================================
  // 🎯 CORE INSIGHT GENERATION METHODS
  // =============================================================================

  /**
   * Intelligent insights oluştur - Ana metod
   */
  async generateInsights(context: InsightGenerationContext): Promise<IntelligentInsight[]> {
    if (!this.isEnabled) {
      const error = new Error('Insights Engine v2.0 is not enabled');
      (error as any).code = AIErrorCode.FEATURE_DISABLED;
      (error as any).severity = ErrorSeverity.MEDIUM;
      (error as any).recoverable = true;
      throw error;
    }

    const userId = context.userId;
    const startTime = Date.now();

    try {
      // Guard: Validate minimal context
      const hasRecentMessages = Array.isArray((context as any)?.recentMessages);
      const hasBehavioral = (context as any)?.behavioralData && typeof (context as any).behavioralData === 'object';
      const hasTimeframe = !!((context as any)?.timeframe && (context as any).timeframe.start && (context as any).timeframe.end && (context as any).timeframe.period);
      if (!hasRecentMessages || !hasBehavioral || !hasTimeframe) {
        try {
          await trackAIInteraction(AIEventType.INSIGHTS_MISSING_REQUIRED_FIELDS, {
            userId,
            reason: 'missing_required_fields',
            hasRecentMessages,
            hasBehavioral,
            hasTimeframe
          });
        } catch {}
        const cached = this.getCachedInsights(userId);
        return cached;
      }
      // Rate limiting - Aynı kullanıcı için çok sık generation engelle
      const lastGeneration = this.lastGenerationTime.get(userId);
      if (lastGeneration && Date.now() - lastGeneration.getTime() < 60000) { // 60 saniye
        console.log('🚫 Insight generation rate limited for user:', userId);
        const cached = this.getCachedInsights(userId);
        if (cached.length === 0) {
          await trackAIInteraction(AIEventType.INSIGHTS_RATE_LIMITED, {
            userId,
            reason: 'rate_limited_no_cache',
            messageCount: context.recentMessages.length,
            compulsionCount: context.behavioralData.compulsions?.length || 0,
            timeframe: context.timeframe.period
          });
        }
        return cached;
      }

      // Existing generation check (dedupe concurrent calls)
      if (this.generationQueue.has(userId)) {
        console.log('⏳ Insight generation already in progress for user:', userId);
        return await this.generationQueue.get(userId)!;
      }

      // Start generation
      const generationPromise = this.performInsightGeneration(context);
      this.generationQueue.set(userId, generationPromise);

      try {
        const insights = await generationPromise;
        
        // Cache results (memory)
        this.insightCache.set(userId, insights);
        const now = new Date();
        this.lastGenerationTime.set(userId, now);

        // Persist results (AsyncStorage)
        try {
          const cacheKey = `insights_cache_${userId}`;
          const lastKey = `insights_last_gen_${userId}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(insights));
          await AsyncStorage.setItem(lastKey, String(now.getTime()));
          // Maintain user index
          const indexRaw = await AsyncStorage.getItem('insights_cache_users');
          const indexList: string[] = indexRaw ? JSON.parse(indexRaw) : [];
          if (!indexList.includes(userId)) {
            indexList.push(userId);
            await AsyncStorage.setItem('insights_cache_users', JSON.stringify(indexList));
          }
        } catch {}
        
        // Telemetry
        await trackAIInteraction(AIEventType.INSIGHTS_GENERATED, {
          userId,
          insightCount: insights.length,
          categories: [...new Set(insights.map(i => i.category))],
          priorities: [...new Set(insights.map(i => i.priority))],
          latency: Date.now() - startTime,
          aiUsed: insights.some(i => i.aiProvider)
        });

        if (insights.length === 0) {
          await trackAIInteraction(AIEventType.NO_INSIGHTS_GENERATED, {
            userId,
            reason: 'no_insights_generated',
            messageCount: context.recentMessages.length,
            compulsionCount: context.behavioralData.compulsions?.length || 0,
            timeframe: context.timeframe.period
          });
        }

        console.log(`✅ Generated ${insights.length} insights for user ${userId}`);
        return insights;

      } finally {
        this.generationQueue.delete(userId);
      }

    } catch (error) {
      console.error('❌ Insight generation failed:', error);
      
      await trackAIError({
        code: AIErrorCode.PROCESSING_FAILED,
        message: 'Insight generation başarısız',
        severity: ErrorSeverity.MEDIUM,
        context: { 
          component: 'InsightsEngineV2', 
          method: 'generateInsights',
          userId,
          latency: Date.now() - startTime
        }
      });

      // Fallback to cached insights
      return this.getCachedInsights(userId);
    }
  }

  /**
   * Actual insight generation implementation
   */
  private async performInsightGeneration(context: InsightGenerationContext): Promise<IntelligentInsight[]> {
    const insights: IntelligentInsight[] = [];

    // Pattern Analysis removed - keeping AI-powered insights only

    // 1. CBT Analysis - Cognitive distortions and techniques
    if (cbtEngine.enabled && context.recentMessages.length > 0) {
      const cbtInsights = await this.generateCBTInsights(context);
      insights.push(...cbtInsights);
    }

    // 2. AI-Powered Deep Analysis
    if (externalAIService.enabled && FEATURE_FLAGS.isEnabled('AI_EXTERNAL_API')) {
      const aiInsights = await this.generateAIInsights(context);
      insights.push(...aiInsights);
    }

    // 3. Progress Tracking Insights
    const progressInsights = await this.generateProgressInsights(context);
    insights.push(...progressInsights);

    // Crisis Prevention Insights removed

    // Sort by priority and timing
    return this.prioritizeAndFilterInsights(insights, context);
  }

  // =============================================================================
  // 🔍 PATTERN ANALYSIS METHODS
  // =============================================================================

  /**
   * Advanced pattern analysis
   */
  private async analyzePatterns(context: InsightGenerationContext): Promise<PatternAnalysisResult> {
    const patterns: PatternAnalysisResult['patterns'] = [];
    const recommendations: PatternAnalysisResult['recommendations'] = [];

    // Message pattern analysis
    if (context.recentMessages.length > 0) {
      const messagePatterns = this.analyzeMessagePatterns(context.recentMessages);
      patterns.push(...messagePatterns);
    }

    // Behavioral pattern analysis
    const behavioralPatterns = this.analyzeBehavioralPatterns(context.behavioralData);
    patterns.push(...behavioralPatterns);

    // Generate recommendations based on patterns
    patterns.forEach(pattern => {
      const technique = this.recommendTechniqueForPattern(pattern.type);
      if (technique) {
        recommendations.push({
          technique,
          rationale: `${pattern.description} pattern detected with ${(pattern.confidence * 100).toFixed(0)}% confidence`,
          urgency: this.determineUrgencyFromPattern(pattern)
        });
      }
    });

    return {
      patterns,
      recommendations
    } as PatternAnalysisResult;
  }

  private analyzeMessagePatterns(messages: AIMessage[]): PatternAnalysisResult['patterns'] {
    const patterns: PatternAnalysisResult['patterns'] = [];

    // Frequency analysis
    const messageFrequency = messages.length / 7; // per day
    if (messageFrequency > 10) {
      patterns.push({
        type: 'high_frequency_messages',
        description: 'Yüksek mesaj frekansı - yoğun destek ihtiyacı',
        frequency: messageFrequency,
        confidence: 0.8,
        trend: 'increasing',
        timeframe: 'last_week'
      });
    }

    // Sentiment analysis (basic keyword-based)
    const negativeKeywords = ['korku', 'endişe', 'panik', 'kötü', 'dayanamıyorum', 'çaresiz'];
    const positiveKeywords = ['iyi', 'başardım', 'mutlu', 'rahatım', 'güzel', 'iyileşiyor'];
    
    let negativeCount = 0;
    let positiveCount = 0;

    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      negativeKeywords.forEach(keyword => {
        if (content.includes(keyword)) negativeCount++;
      });
      positiveKeywords.forEach(keyword => {
        if (content.includes(keyword)) positiveCount++;
      });
    });

    if (negativeCount > positiveCount * 2) {
      patterns.push({
        type: 'negative_sentiment_trend',
        description: 'Negatif duygu durumu eğilimi tespit edildi',
        frequency: negativeCount / messages.length,
        confidence: 0.7,
        trend: 'increasing',
        timeframe: 'recent_messages'
      });
    }

    return patterns;
  }

  private analyzeBehavioralPatterns(data: InsightGenerationContext['behavioralData']): PatternAnalysisResult['patterns'] {
    const patterns: PatternAnalysisResult['patterns'] = [];

    // Compulsion frequency analysis
    if (data.compulsions && data.compulsions.length > 0) {
      const dailyAverage = data.compulsions.length / 7;
      if (dailyAverage > 5) {
        patterns.push({
          type: 'high_compulsion_frequency',
          description: 'Yüksek kompulsiyon frekansı',
          frequency: dailyAverage,
          confidence: 0.9,
          trend: 'stable',
          timeframe: 'last_week'
        });
      }
    }

    // Exercise engagement
    if (data.exercises && data.exercises.length < 2) {
      patterns.push({
        type: 'low_exercise_engagement',
        description: 'Düşük egzersiz katılımı',
        frequency: data.exercises.length,
        confidence: 0.8,
        trend: 'stable',
        timeframe: 'last_week'
      });
    }

    return patterns;
  }

  // =============================================================================
  // 🧠 CBT INSIGHTS GENERATION
  // =============================================================================

  /**
   * CBT Engine kullanarak insights oluştur
   */
  private async generateCBTInsights(context: InsightGenerationContext): Promise<IntelligentInsight[]> {
    const insights: IntelligentInsight[] = [];

    try {
      // Recent messages'tan cognitive distortions tespit et
      const lastMessage = context.recentMessages[context.recentMessages.length - 1];
      if (lastMessage) {
        const mockConversationContext: ConversationContext = {
          sessionId: `insight_${Date.now()}`,
          userId: context.userId,
          currentState: 'therapeutic' as any,
          conversationHistory: context.recentMessages,
          userProfile: context.userProfile,
          startTime: new Date(),
          lastActivity: new Date(),
          messageCount: context.recentMessages.length,
          topicHistory: [],
          appContext: { screen: 'insights', route: 'engine_v2' }
        } as any;

        const cbtAnalysis = await cbtEngine.detectCognitiveDistortions(lastMessage, mockConversationContext);
        
        if (cbtAnalysis.detectedDistortions.length > 0) {
          const distortion = cbtAnalysis.detectedDistortions[0];
          const technique = cbtAnalysis.suggestedTechniques[0];

          insights.push({
            id: `cbt_${Date.now()}_${distortion}`,
            userId: context.userId,
            category: InsightCategory.THERAPEUTIC_GUIDANCE,
            priority: cbtAnalysis.severity === 'high' ? InsightPriority.HIGH : InsightPriority.MEDIUM,
            timing: InsightTiming.NEXT_SESSION,
            
            title: this.getCBTInsightTitle(distortion),
            message: this.getCBTInsightMessage(distortion, technique),
            actionableAdvice: this.getCBTActionableAdvice(technique),
            therapeuticTechnique: technique,
            
            confidence: cbtAnalysis.confidence,
            detectedPatterns: [distortion],
            cognitiveDistortions: [distortion],
            
            basedOnData: {
              messageCount: context.recentMessages.length,
              timeframe: 'recent_conversation',
              keyEvents: [`Detected ${distortion} pattern`]
            },
            
            generatedAt: new Date(),
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
            shown: false,
            therapeuticGoals: [`Reduce ${distortion} thinking pattern`],
            expectedOutcome: `Improved cognitive flexibility with ${technique}`,
            followUpRequired: cbtAnalysis.severity === 'high',
            relatedInsightIds: []
          });
        }
      }

    } catch (error) {
      console.warn('⚠️ CBT insights generation failed:', error);
    }

    return insights;
  }

  private getCBTInsightTitle(distortion: CognitiveDistortion): string {
    const titles: Record<string, string> = {
      'all_or_nothing': '🌈 Esneklik Fırsatı',
      'catastrophizing': '🧘 Sakinlik Zamanı',
      'overgeneralization': '🔍 Detayları Keşfet',
      'should_statements': '💙 Kendine Şefkat',
      'emotional_reasoning': '🧠 Akıl ve Duygu Dengesi'
    };
    return titles[distortion] || '🎯 Gelişim Fırsatı';
  }

  private getCBTInsightMessage(distortion: CognitiveDistortion, technique: CBTTechnique): string {
    const messages: Record<string, string> = {
      'all_or_nothing': `Son mesajlarınızda 'ya hep ya hiç' düşünce kalıbı fark ettim. Bu normal ve değiştirilebilir! ${technique} tekniği ile birlikte daha esnek düşünmeyi keşfedelim.`,
      'catastrophizing': `Endişelerinizin büyüdüğünü gözlemliyorum. ${technique} ile bu durumu daha dengeli bir perspektiften değerlendirmeyi deneyebiliriz.`,
      'overgeneralization': `Genelleme kalıpları tespit ettim. ${technique} kullanarak bu durumun özel yanlarını keşfetmeye ne dersiniz?`
    };
    return messages[distortion] || `${technique} tekniği ile bu durumu ele almayı deneyebiliriz.`;
  }

  private getCBTActionableAdvice(technique: CBTTechnique): string[] {
    const advice: Record<string, string[]> = {
      'socratic_questioning': [
        'Bu düşüncenin doğru olduğuna dair kanıtları listeleyin',
        'Karşı kanıtları da araştırın',
        'En iyi arkadaşınıza ne tavsiye verirdiniz?'
      ],
      'cognitive_restructuring': [
        'Bu düşünceyi daha dengeli şekilde yeniden yazın',
        'Gerçekçi alternatifler düşünün',
        'Yeni perspektifi günlük hayatınızda test edin'
      ],
      'mindfulness_integration': [
        '5 dakika nefes farkındalığı yapın',
        'Düşünceyi yargılamadan gözlemleyin',
        'Şimdiki an farkındalığı pratiği yapın'
      ]
    };
    return advice[technique] || ['Bu teknikle ilgili daha fazla bilgi alın'];
  }

  // =============================================================================
  // 🤖 AI-POWERED INSIGHTS
  // =============================================================================

  /**
   * External AI kullanarak deep insights oluştur
   */
  private async generateAIInsights(context: InsightGenerationContext): Promise<IntelligentInsight[]> {
    const insights: IntelligentInsight[] = [];

    try {
      if (!externalAIService.enabled) return insights;

      // AI prompt for insight generation
      const insightPrompt = await this.createInsightGenerationPrompt(context);
      
      const aiResponse = await externalAIService.getAIResponse(
        [{ id: `m_${Date.now()}`, role: 'user', content: insightPrompt, timestamp: new Date() } as any],
        (this.createMockConversationContext(context) || ({} as any)),
        {
          therapeuticMode: true,
          temperature: 0.6,
          maxTokens: 800
        }
      );

      if (aiResponse.success) {
        const parsedInsight = this.parseAIInsightResponse(aiResponse.content, context);
        if (parsedInsight) {
          insights.push(parsedInsight);
        }
      }

    } catch (error) {
      console.warn('⚠️ AI insights generation failed:', error);
      try {
        await trackAIError({
          code: AIErrorCode.PROCESSING_FAILED,
          message: (error as any)?.message || 'AI insights generation failed',
          severity: ErrorSeverity.LOW,
          context: {
            component: 'InsightsEngineV2',
            method: 'generateAIInsights',
            provider: externalAIService.currentProvider || 'unknown'
          }
        });
      } catch {}

      // Friendly fallback to avoid empty insights stream
      try {
        const fallback: IntelligentInsight = {
          id: `ai_fallback_${Date.now()}`,
          userId: context.userId,
          category: InsightCategory.THERAPEUTIC_GUIDANCE,
          priority: InsightPriority.LOW,
          timing: InsightTiming.DAILY_SUMMARY,
          title: 'Nazik Bir Hatırlatma',
          message: 'Bugün küçük bir adım atmak bile çok değerli. Nefes al, kendine şefkat göster ve ilerlemene güven.',
          actionableAdvice: [
            '2 dakika nefes farkındalığı yap',
            'Kendine destekleyici bir cümle yaz',
            'Bugün tek bir küçük hedef belirle'
          ],
          confidence: 0.5,
          aiProvider: externalAIService.currentProvider || undefined,
          detectedPatterns: ['fallback'],
          basedOnData: {
            messageCount: context.recentMessages?.length || 0,
            timeframe: context.timeframe?.period || 'week',
            keyEvents: ['fallback_used']
          },
          generatedAt: new Date(),
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
          shown: false,
          therapeuticGoals: ['Self-compassion'],
          expectedOutcome: 'Short-term relief and gentle motivation',
          followUpRequired: false,
          relatedInsightIds: []
        };
        insights.push(fallback);
      } catch {}
    }

    return insights;
  }

  private async createInsightGenerationPrompt(context: InsightGenerationContext): Promise<string> {
    const recentActivity = context.recentMessages.slice(-3).map(msg => 
      `"${msg.content}"`
    ).join(', ');

    return `OKB uzmanı bir terapist olarak, aşağıdaki verilerle kullanıcının durumunu analiz et ve kısa, uygulanabilir bir içgörü oluştur:

KULLANICI PROFİLİ:
- Son mesajlar: ${recentActivity}
- Kompulsiyon sayısı: ${context.behavioralData.compulsions?.length || 0}
- Zaman dilimi: ${context.timeframe.period}

 ÇIKTI GEREKSİNİMLERİ:
 1) Ana pattern (1 cümle)
 2) OKB ile ilişkisi (1 cümle, tıbbi tanı koymadan)
 3) 3 adet net ve güvenli eylem adımı (madde işaretleri, her biri 1 cümle)
 4) 1 cümlelik umut verici kapanış mesajı

 FORMAT:
 BAŞLIK: [kısa motivasyonel başlık]
 MESAJ: [ana içgörü]
 TAVSİYELER:
 - [adım 1]
 - [adım 2]
 - [adım 3]

 SINIRLAR: Tanı koyma/yasal/ilaç önerme yok. Kısa, anlaşılır, Türkçe ve empatik ol.`;
  }

  private parseAIInsightResponse(response: string, context: InsightGenerationContext): IntelligentInsight | null {
    try {
      // Basit parsing - gerçek implementation'da daha sofistike olabilir
      const lines = response.split('\n');
      const titleLine = lines.find(line => line.startsWith('BAŞLIK:'));
      const messageLine = lines.find(line => line.startsWith('MESAJ:'));
      const adviceLine = lines.find(line => line.startsWith('TAVSİYELER:'));

      if (!titleLine || !messageLine) return null;

      return {
        id: `ai_${Date.now()}`,
        userId: context.userId,
        category: InsightCategory.BEHAVIORAL_ANALYSIS,
        priority: InsightPriority.MEDIUM,
        timing: InsightTiming.DAILY_SUMMARY,
        
        title: titleLine.replace('BAŞLIK:', '').trim(),
        message: messageLine.replace('MESAJ:', '').trim(),
        actionableAdvice: adviceLine ? [adviceLine.replace('TAVSİYELER:', '').trim()] : [],
        
        confidence: 0.8,
        aiProvider: externalAIService.currentProvider!,
        detectedPatterns: ['ai_generated'],
        
        basedOnData: {
          messageCount: context.recentMessages.length,
          timeframe: context.timeframe.period,
          keyEvents: ['AI analysis completed']
        },
        
        generatedAt: new Date(),
        validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        shown: false,
        therapeuticGoals: ['AI-guided therapeutic improvement'],
        expectedOutcome: 'Enhanced self-awareness and coping strategies',
        followUpRequired: false,
        relatedInsightIds: []
      };

    } catch (error) {
      console.warn('⚠️ Failed to parse AI insight response:', error);
      return null;
    }
  }

  // =============================================================================
  // 📊 PROGRESS INSIGHTS
  // =============================================================================

  /**
   * Progress tracking insights
   */
  private async generateProgressInsights(context: InsightGenerationContext): Promise<IntelligentInsight[]> {
    const insights: IntelligentInsight[] = [];

    // Achievement-based insights
    if (context.behavioralData.achievements && context.behavioralData.achievements.length > 0) {
      insights.push({
        id: `progress_${Date.now()}`,
        userId: context.userId,
        category: InsightCategory.PROGRESS_TRACKING,
        priority: InsightPriority.MEDIUM,
        timing: InsightTiming.MILESTONE,
        
        title: '🎉 Harika İlerleme!',
        message: `Son ${context.timeframe.period} içinde ${context.behavioralData.achievements.length} başarı elde ettiniz. Bu, OKB ile mücadelenizde önemli bir ilerleme gösteriyor!`,
        actionableAdvice: [
          'Bu başarıları günlüğünüze kaydedin',
          'Hangi stratejilerin işe yaradığını analiz edin',
          'Bir sonraki hedefi belirleyin'
        ],
        
        confidence: 0.9,
        detectedPatterns: ['achievement_pattern'],
        
        basedOnData: {
          messageCount: context.recentMessages.length,
          timeframe: context.timeframe.period,
          keyEvents: context.behavioralData.achievements.map((a: any) => a.name || 'Achievement'),
        },
        
        generatedAt: new Date(),
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        shown: false,
        therapeuticGoals: ['Progress recognition', 'Motivation enhancement'],
        expectedOutcome: 'Increased motivation and self-efficacy',
        followUpRequired: false,
        relatedInsightIds: []
      });
    }

    return insights;
  }

  // =============================================================================
  // 🚨 CRISIS PREVENTION INSIGHTS
  // =============================================================================

  // Crisis prevention removed

  // =============================================================================
  // 🔧 HELPER METHODS
  // =============================================================================

  private prioritizeAndFilterInsights(insights: IntelligentInsight[], context: InsightGenerationContext): IntelligentInsight[] {
    // Priority sıralaması
    const priorityOrder = {
      [InsightPriority.CRITICAL]: 5,
      [InsightPriority.HIGH]: 4,
      [InsightPriority.MEDIUM]: 3,
      [InsightPriority.LOW]: 2,
      [InsightPriority.INFO]: 1
    };

    // Sort by priority
    insights.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    // Filter duplicates and limit count
    const uniqueInsights = insights.filter((insight, index, array) => 
      array.findIndex(i => i.category === insight.category) === index
    );

    // Max 5 insights to avoid overwhelming user
    return uniqueInsights.slice(0, 5);
  }

  private getCachedInsights(userId: string): IntelligentInsight[] {
    return this.insightCache.get(userId) || [];
  }

  private recommendTechniqueForPattern(patternType: string): CBTTechnique | null {
    const recommendations: Record<string, CBTTechnique> = {
      'high_frequency_messages': CBTTechnique.MINDFULNESS_INTEGRATION,
      'negative_sentiment_trend': CBTTechnique.COGNITIVE_RESTRUCTURING,
      'high_compulsion_frequency': CBTTechnique.BEHAVIORAL_EXPERIMENT,
      'low_exercise_engagement': CBTTechnique.BEHAVIORAL_EXPERIMENT
    };
    
    return recommendations[patternType] || null;
  }

  private determineUrgencyFromPattern(pattern: PatternAnalysisResult['patterns'][0]): InsightPriority {
    if (pattern.confidence > 0.9 && pattern.trend === 'increasing') {
      return InsightPriority.HIGH;
    }
    if (pattern.confidence > 0.7) {
      return InsightPriority.MEDIUM;
    }
    return InsightPriority.LOW;
  }

  private assessRiskFromPatterns(patterns: PatternAnalysisResult['patterns']): PatternAnalysisResult['riskAssessment'] {
    const highRiskPatterns = patterns.filter(p => 
      p.type.includes('high_frequency') || 
      p.type.includes('negative_sentiment') ||
      p.confidence > 0.8
    );

    let riskLevel: RiskLevel = RiskLevel.LOW;
    if (highRiskPatterns.length >= 3) riskLevel = RiskLevel.VERY_HIGH;
    else if (highRiskPatterns.length >= 2) riskLevel = RiskLevel.HIGH;
    else if (highRiskPatterns.length >= 1) riskLevel = RiskLevel.MODERATE;

    return {
      level: riskLevel,
      indicators: highRiskPatterns.map(p => p.description),
      preventiveActions: [
        'Daha sık check-in yapın',
        'Coping stratejilerini hatırlayın', 
        'Destek sisteminizi aktive edin'
      ]
    };
  }

  private createMockConversationContext(context: InsightGenerationContext): ConversationContext {
    return {
      sessionId: `insight_${Date.now()}`,
      userId: context.userId,
      currentState: 'therapeutic' as any,
      conversationHistory: context.recentMessages,
      userProfile: context.userProfile,
      startTime: new Date(),
      lastActivity: new Date(),
      messageCount: context.recentMessages.length,
      topicHistory: [],
      appContext: { screen: 'insights', route: 'engine_v2' }
    } as any;
  }

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  /**
   * Insights Engine durumunu kontrol et
   */
  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_INSIGHTS_ENGINE_V2');
  }

  /**
   * Kullanıcı için insights al
   */
  async getInsightsForUser(userId: string): Promise<IntelligentInsight[]> {
    return this.getCachedInsights(userId);
  }

  /**
   * Insight'ı gösterildi olarak işaretle
   */
  async markInsightShown(insightId: string, userId: string): Promise<void> {
    const insights = this.getCachedInsights(userId);
    const insight = insights.find(i => i.id === insightId);
    if (insight) {
      insight.shown = true;
      insight.shownAt = new Date();
    }
  }

  /**
   * Insight feedback al
   */
  async recordInsightFeedback(insightId: string, userId: string, feedback: 'helpful' | 'not_helpful' | 'irrelevant'): Promise<void> {
    const insights = this.getCachedInsights(userId);
    const insight = insights.find(i => i.id === insightId);
    if (insight) {
      insight.userFeedback = feedback;
      
      // Telemetry
      await trackAIInteraction(AIEventType.INSIGHTS_FEEDBACK, {
        insightId,
        userId,
        feedback,
        category: insight.category,
        priority: insight.priority
      });
    }
  }

  /**
   * Engine'i temizle
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Insights Engine v2.0: Shutting down...');
    this.isEnabled = false;
    this.insightCache.clear();
    this.generationQueue.clear();
    this.lastGenerationTime.clear();
    
    await trackAIInteraction(AIEventType.INSIGHTS_ENGINE_SHUTDOWN, {
      version: '2.0'
    });
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const insightsEngineV2 = InsightsEngineV2.getInstance();
export default insightsEngineV2;
// Re-exports removed to avoid conflicts (types are declared in-file)