/**
 * Insights Generation Engine
 * 
 * Kişiselleştirilmiş terapötik içgörüler üreten motor
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  TherapeuticInsight,
  UserAIProfile,
  AIError,
  AIErrorCode
} from '@/features/ai/types';
import { 
  PatternAnalysis,
  PatternType,
  CompulsionData,
  patternRecognitionService 
} from '@/features/ai/services/patternRecognition';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';
import { logger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// İçgörü kategorileri
export enum InsightCategory {
  PROGRESS = 'progress',
  PATTERN = 'pattern',
  TRIGGER = 'trigger',
  COPING = 'coping',
  MOTIVATION = 'motivation',
  EDUCATION = 'education',
  WARNING = 'warning',
  CELEBRATION = 'celebration'
}

// İçgörü önceliği
export enum InsightPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

// Genişletilmiş içgörü tipi
export interface EnhancedInsight extends TherapeuticInsight {
  id: string;
  category: InsightCategory;
  priority: InsightPriority;
  actionable: boolean;
  actions?: InsightAction[];
  relatedPatterns?: string[];
  expiresAt?: Date;
  readAt?: Date;
  helpful?: boolean; // Kullanıcı geri bildirimi
}

// İçgörü aksiyonu
export interface InsightAction {
  id: string;
  label: string;
  type: 'exercise' | 'reminder' | 'goal' | 'resource' | 'tracking';
  data: any;
}

// İçgörü üretim bağlamı
export interface InsightContext {
  userId: string;
  userProfile: UserAIProfile;
  patterns: PatternAnalysis[];
  recentData: CompulsionData[];
  historicalInsights: EnhancedInsight[];
  preferences: InsightPreferences;
}

// Kullanıcı tercihleri
export interface InsightPreferences {
  frequency: 'daily' | 'weekly' | 'as_needed';
  style: 'supportive' | 'direct' | 'educational';
  focusAreas: InsightCategory[];
  avoidTopics?: string[];
}

// İçgörü şablonu
interface InsightTemplate {
  id: string;
  category: InsightCategory;
  conditions: InsightCondition[];
  generator: (context: InsightContext, data: any) => EnhancedInsight;
  priority: InsightPriority;
}

// İçgörü koşulu
interface InsightCondition {
  type: 'pattern' | 'threshold' | 'time' | 'achievement';
  evaluate: (context: InsightContext) => boolean;
}

class InsightsEngine {
  private static instance: InsightsEngine;
  private templates: InsightTemplate[] = [];
  private generatedInsights: Map<string, EnhancedInsight[]> = new Map();

  private constructor() {
    this.initializeTemplates();
  }

  static getInstance(): InsightsEngine {
    if (!this.instance) {
      this.instance = new InsightsEngine();
    }
    return this.instance;
  }

  /**
   * Kullanıcı için içgörüler üret
   */
  async generateInsights(context: InsightContext): Promise<EnhancedInsight[]> {
    if (!FEATURE_FLAGS.isEnabled('AI_INSIGHTS')) {
      return [];
    }

    logger.ai.info(`Generating insights for user ${context.userId}`);

    const insights: EnhancedInsight[] = [];

    // Her şablon için değerlendirme yap
    for (const template of this.templates) {
      try {
        if (this.shouldGenerateInsight(template, context)) {
          const insight = await this.generateFromTemplate(template, context);
          if (insight && this.isInsightValid(insight, context)) {
            insights.push(insight);
          }
        }
      } catch (error) {
        logger.ai.error(`Failed to generate insight from template ${template.id}`, error);
      }
    }

    // Önceliklendirme ve filtreleme
    const prioritizedInsights = this.prioritizeInsights(insights, context);
    const filteredInsights = this.filterInsights(prioritizedInsights, context);

    // Kaydet
    this.generatedInsights.set(context.userId, filteredInsights);
    await this.saveInsights(context.userId, filteredInsights);

    // Telemetri
    await trackAIInteraction(AIEventType.INSIGHT_GENERATED, {
      count: filteredInsights.length,
      categories: filteredInsights.map(i => i.category),
      priorities: filteredInsights.map(i => i.priority)
    });

    return filteredInsights;
  }

  /**
   * Belirli bir kategori için içgörü üret
   */
  async generateCategoryInsights(
    category: InsightCategory,
    context: InsightContext
  ): Promise<EnhancedInsight[]> {
    const categoryTemplates = this.templates.filter(t => t.category === category);
    const insights: EnhancedInsight[] = [];

    for (const template of categoryTemplates) {
      if (this.shouldGenerateInsight(template, context)) {
        const insight = await this.generateFromTemplate(template, context);
        if (insight) {
          insights.push(insight);
        }
      }
    }

    return insights;
  }

  /**
   * Kullanıcı geri bildirimi işle
   */
  async processInsightFeedback(
    insightId: string,
    userId: string,
    helpful: boolean
  ): Promise<void> {
    const userInsights = this.generatedInsights.get(userId) || [];
    const insight = userInsights.find(i => i.id === insightId);

    if (insight) {
      insight.helpful = helpful;
      await this.saveInsights(userId, userInsights);

      // Geri bildirime göre öğren
      await this.learnFromFeedback(insight, helpful);
    }
  }

  /**
   * İçgörü şablonlarını başlat
   */
  private initializeTemplates() {
    // Progress içgörüleri
    this.templates.push({
      id: 'weekly_progress',
      category: InsightCategory.PROGRESS,
      priority: InsightPriority.MEDIUM,
      conditions: [
        {
          type: 'time',
          evaluate: (ctx) => this.hasWeeklyData(ctx)
        }
      ],
      generator: (ctx, data) => this.generateWeeklyProgress(ctx)
    });

    this.templates.push({
      id: 'improvement_milestone',
      category: InsightCategory.CELEBRATION,
      priority: InsightPriority.HIGH,
      conditions: [
        {
          type: 'achievement',
          evaluate: (ctx) => this.hasSignificantImprovement(ctx)
        }
      ],
      generator: (ctx, data) => this.generateMilestoneInsight(ctx)
    });

    // Pattern içgörüleri
    this.templates.push({
      id: 'new_pattern_detected',
      category: InsightCategory.PATTERN,
      priority: InsightPriority.HIGH,
      conditions: [
        {
          type: 'pattern',
          evaluate: (ctx) => this.hasNewPatterns(ctx)
        }
      ],
      generator: (ctx, data) => this.generateNewPatternInsight(ctx)
    });

    this.templates.push({
      id: 'pattern_correlation',
      category: InsightCategory.PATTERN,
      priority: InsightPriority.MEDIUM,
      conditions: [
        {
          type: 'pattern',
          evaluate: (ctx) => this.hasCorrelatedPatterns(ctx)
        }
      ],
      generator: (ctx, data) => this.generateCorrelationInsight(ctx)
    });

    // Trigger içgörüleri
    this.templates.push({
      id: 'trigger_analysis',
      category: InsightCategory.TRIGGER,
      priority: InsightPriority.HIGH,
      conditions: [
        {
          type: 'pattern',
          evaluate: (ctx) => this.hasIdentifiableTriggers(ctx)
        }
      ],
      generator: (ctx, data) => this.generateTriggerInsight(ctx)
    });

    // Coping içgörüleri
    this.templates.push({
      id: 'coping_strategy',
      category: InsightCategory.COPING,
      priority: InsightPriority.MEDIUM,
      conditions: [
        {
          type: 'pattern',
          evaluate: (ctx) => this.needsCopingStrategies(ctx)
        }
      ],
      generator: (ctx, data) => this.generateCopingInsight(ctx)
    });

    // Motivation içgörüleri
    this.templates.push({
      id: 'daily_motivation',
      category: InsightCategory.MOTIVATION,
      priority: InsightPriority.LOW,
      conditions: [
        {
          type: 'time',
          evaluate: (ctx) => this.shouldShowMotivation(ctx)
        }
      ],
      generator: (ctx, data) => this.generateMotivationInsight(ctx)
    });

    // Education içgörüleri
    this.templates.push({
      id: 'ocd_education',
      category: InsightCategory.EDUCATION,
      priority: InsightPriority.LOW,
      conditions: [
        {
          type: 'time',
          evaluate: (ctx) => this.shouldProvideEducation(ctx)
        }
      ],
      generator: (ctx, data) => this.generateEducationInsight(ctx)
    });

    // Warning içgörüleri
    this.templates.push({
      id: 'escalation_warning',
      category: InsightCategory.WARNING,
      priority: InsightPriority.CRITICAL,
      conditions: [
        {
          type: 'threshold',
          evaluate: (ctx) => this.detectsEscalation(ctx)
        }
      ],
      generator: (ctx, data) => this.generateWarningInsight(ctx)
    });
  }

  // Koşul değerlendirme metodları

  private hasWeeklyData(context: InsightContext): boolean {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return context.recentData.some(d => 
      new Date(d.timestamp) >= oneWeekAgo
    );
  }

  private hasSignificantImprovement(context: InsightContext): boolean {
    const improvingPatterns = context.patterns.filter(p => 
      p.timeline.trend === 'decreasing' && p.severity <= 5
    );
    
    return improvingPatterns.length >= 2;
  }

  private hasNewPatterns(context: InsightContext): boolean {
    const recentPatterns = context.patterns.filter(p => {
      const daysSinceFirst = (Date.now() - new Date(p.timeline.firstOccurrence).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceFirst <= 7;
    });

    return recentPatterns.length > 0;
  }

  private hasCorrelatedPatterns(context: InsightContext): boolean {
    // En az 2 pattern'in ortak tetikleyicileri olmalı
    for (let i = 0; i < context.patterns.length - 1; i++) {
      for (let j = i + 1; j < context.patterns.length; j++) {
        const commonTriggers = context.patterns[i].triggers.filter(t =>
          context.patterns[j].triggers.includes(t)
        );
        if (commonTriggers.length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  private hasIdentifiableTriggers(context: InsightContext): boolean {
    return context.patterns.some(p => 
      p.type === PatternType.TRIGGER && p.confidence > 0.7
    );
  }

  private needsCopingStrategies(context: InsightContext): boolean {
    const highSeverityPatterns = context.patterns.filter(p => p.severity >= 7);
    return highSeverityPatterns.length > 0;
  }

  private shouldShowMotivation(context: InsightContext): boolean {
    // Her gün bir motivasyon mesajı
    const lastMotivation = context.historicalInsights
      .filter(i => i.category === InsightCategory.MOTIVATION)
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())[0];

    if (!lastMotivation) return true;

    const hoursSinceLastMotivation = (Date.now() - new Date(lastMotivation.timestamp!).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMotivation >= 24;
  }

  private shouldProvideEducation(context: InsightContext): boolean {
    // Haftada bir eğitim içeriği
    const lastEducation = context.historicalInsights
      .filter(i => i.category === InsightCategory.EDUCATION)
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())[0];

    if (!lastEducation) return true;

    const daysSinceLastEducation = (Date.now() - new Date(lastEducation.timestamp!).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastEducation >= 7;
  }

  private detectsEscalation(context: InsightContext): boolean {
    const recentData = context.recentData.filter(d => {
      const hoursSince = (Date.now() - new Date(d.timestamp).getTime()) / (1000 * 60 * 60);
      return hoursSince <= 24;
    });

    if (recentData.length < 5) return false;

    const avgIntensity = recentData.reduce((sum, d) => sum + d.intensity, 0) / recentData.length;
    return avgIntensity >= 8;
  }

  // İçgörü üretim metodları

  private generateWeeklyProgress(context: InsightContext): EnhancedInsight {
    const weekData = context.recentData.filter(d => {
      const daysSince = (Date.now() - new Date(d.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    });

    const thisWeekAvg = weekData.reduce((sum, d) => sum + d.intensity, 0) / weekData.length;
    
    const lastWeekData = context.recentData.filter(d => {
      const daysSince = (Date.now() - new Date(d.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 7 && daysSince <= 14;
    });

    const lastWeekAvg = lastWeekData.length > 0 
      ? lastWeekData.reduce((sum, d) => sum + d.intensity, 0) / lastWeekData.length
      : thisWeekAvg;

    const improvement = ((lastWeekAvg - thisWeekAvg) / lastWeekAvg) * 100;

    return {
      id: `insight_progress_${Date.now()}`,
      type: 'progress',
      category: InsightCategory.PROGRESS,
      priority: InsightPriority.MEDIUM,
      content: improvement > 0
        ? `Bu hafta kompulsiyon yoğunluğunuzda %${Math.round(improvement)} azalma var! Harika gidiyorsunuz.`
        : `Bu hafta biraz zorlu geçmiş gibi görünüyor. Her yeni gün yeni bir başlangıç fırsatıdır.`,
      confidence: 0.8,
      clinicalRelevance: 0.7,
      timestamp: new Date(),
      actionable: true,
      actions: [
        {
          id: 'view_details',
          label: 'Detaylı Raporu Gör',
          type: 'resource',
          data: { weekData, improvement }
        }
      ]
    };
  }

  private generateMilestoneInsight(context: InsightContext): EnhancedInsight {
    const improvingPatterns = context.patterns.filter(p => 
      p.timeline.trend === 'decreasing'
    );

    const patternNames = improvingPatterns.map(p => p.name).join(', ');

    return {
      id: `insight_milestone_${Date.now()}`,
      type: 'progress',
      category: InsightCategory.CELEBRATION,
      priority: InsightPriority.HIGH,
      content: `🎉 Tebrikler! ${patternNames} pattern'lerinde belirgin iyileşme var. Bu büyük bir başarı!`,
      confidence: 0.9,
      clinicalRelevance: 0.9,
      timestamp: new Date(),
      actionable: true,
      actions: [
        {
          id: 'share_achievement',
          label: 'Başarını Paylaş',
          type: 'resource',
          data: { achievement: 'pattern_improvement', patterns: improvingPatterns }
        },
        {
          id: 'set_new_goal',
          label: 'Yeni Hedef Belirle',
          type: 'goal',
          data: { suggested: 'maintain_improvement' }
        }
      ]
    };
  }

  private generateNewPatternInsight(context: InsightContext): EnhancedInsight {
    const newPattern = context.patterns
      .filter(p => {
        const daysSinceFirst = (Date.now() - new Date(p.timeline.firstOccurrence).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceFirst <= 7;
      })
      .sort((a, b) => b.severity - a.severity)[0];

    if (!newPattern) {
      return this.createEmptyInsight();
    }

    return {
      id: `insight_pattern_${Date.now()}`,
      type: 'pattern',
      category: InsightCategory.PATTERN,
      priority: InsightPriority.HIGH,
      content: `Yeni bir pattern keşfettik: "${newPattern.name}". ${newPattern.description}`,
      confidence: newPattern.confidence,
      clinicalRelevance: newPattern.severity / 10,
      timestamp: new Date(),
      actionable: true,
      actions: [
        {
          id: 'learn_more',
          label: 'Pattern Hakkında Bilgi Al',
          type: 'resource',
          data: { patternId: newPattern.id }
        },
        {
          id: 'track_pattern',
          label: 'Bu Pattern\'i Takip Et',
          type: 'tracking',
          data: { patternId: newPattern.id }
        }
      ],
      relatedPatterns: [newPattern.id]
    };
  }

  private generateCorrelationInsight(context: InsightContext): EnhancedInsight {
    // İlişkili pattern'leri bul
    let correlatedPair: [PatternAnalysis, PatternAnalysis] | null = null;
    let commonTriggers: string[] = [];

    for (let i = 0; i < context.patterns.length - 1; i++) {
      for (let j = i + 1; j < context.patterns.length; j++) {
        const common = context.patterns[i].triggers.filter(t =>
          context.patterns[j].triggers.includes(t)
        );
        if (common.length > commonTriggers.length) {
          commonTriggers = common;
          correlatedPair = [context.patterns[i], context.patterns[j]];
        }
      }
    }

    if (!correlatedPair) {
      return this.createEmptyInsight();
    }

    return {
      id: `insight_correlation_${Date.now()}`,
      type: 'pattern',
      category: InsightCategory.PATTERN,
      priority: InsightPriority.MEDIUM,
      content: `"${correlatedPair[0].name}" ve "${correlatedPair[1].name}" pattern'leri birbiriyle ilişkili görünüyor. Ortak tetikleyiciler: ${commonTriggers.join(', ')}`,
      confidence: 0.75,
      clinicalRelevance: 0.8,
      timestamp: new Date(),
      actionable: true,
      actions: [
        {
          id: 'combined_strategy',
          label: 'Kombine Strateji Oluştur',
          type: 'exercise',
          data: { patterns: correlatedPair.map(p => p.id) }
        }
      ],
      relatedPatterns: correlatedPair.map(p => p.id)
    };
  }

  private generateTriggerInsight(context: InsightContext): EnhancedInsight {
    const triggerPattern = context.patterns
      .filter(p => p.type === PatternType.TRIGGER)
      .sort((a, b) => b.frequency - a.frequency)[0];

    if (!triggerPattern) {
      return this.createEmptyInsight();
    }

    const topTriggers = triggerPattern.triggers.slice(0, 3);

    return {
      id: `insight_trigger_${Date.now()}`,
      type: 'pattern',
      category: InsightCategory.TRIGGER,
      priority: InsightPriority.HIGH,
      content: `En sık karşılaştığınız tetikleyiciler: ${topTriggers.join(', ')}. Bu tetikleyicilere hazırlıklı olmak, kompulsiyonları önlemenize yardımcı olabilir.`,
      confidence: triggerPattern.confidence,
      clinicalRelevance: 0.85,
      timestamp: new Date(),
      actionable: true,
      actions: [
        {
          id: 'trigger_plan',
          label: 'Tetikleyici Planı Oluştur',
          type: 'exercise',
          data: { triggers: topTriggers }
        },
        {
          id: 'practice_response',
          label: 'Alternatif Tepki Pratiği',
          type: 'exercise',
          data: { type: 'trigger_response' }
        }
      ]
    };
  }

  private generateCopingInsight(context: InsightContext): EnhancedInsight {
    const highSeverityPattern = context.patterns
      .filter(p => p.severity >= 7)
      .sort((a, b) => b.severity - a.severity)[0];

    if (!highSeverityPattern) {
      return this.createEmptyInsight();
    }

    const copingStrategy = this.selectCopingStrategy(highSeverityPattern);

    return {
      id: `insight_coping_${Date.now()}`,
      type: 'suggestion',
      category: InsightCategory.COPING,
      priority: InsightPriority.MEDIUM,
      content: `"${highSeverityPattern.name}" pattern'i için önerilen başa çıkma stratejisi: ${copingStrategy.name}. ${copingStrategy.description}`,
      confidence: 0.8,
      clinicalRelevance: 0.9,
      timestamp: new Date(),
      actionable: true,
      actions: [
        {
          id: 'try_strategy',
          label: 'Stratejiyi Dene',
          type: 'exercise',
          data: { strategy: copingStrategy }
        },
        {
          id: 'learn_technique',
          label: 'Tekniği Öğren',
          type: 'resource',
          data: { technique: copingStrategy.technique }
        }
      ]
    };
  }

  private generateMotivationInsight(context: InsightContext): EnhancedInsight {
    const motivationalMessages = [
      {
        content: "Her küçük adım önemlidir. Bugün attığınız adımlar, yarının başarısını inşa eder.",
        focus: "progress"
      },
      {
        content: "OKB ile mücadele cesaretli bir yolculuktur ve siz bu yolculuğu yapıyorsunuz. Kendinizle gurur duyun.",
        focus: "courage"
      },
      {
        content: "Mükemmel olmak zorunda değilsiniz. İlerleme, mükemmellikten daha değerlidir.",
        focus: "perfectionism"
      },
      {
        content: "Zorluklar geçicidir, ancak kazandığınız güç kalıcıdır.",
        focus: "resilience"
      },
      {
        content: "Kendinize karşı nazik olun. İyileşme doğrusal bir süreç değildir.",
        focus: "self_compassion"
      }
    ];

    const message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    return {
      id: `insight_motivation_${Date.now()}`,
      type: 'suggestion',
      category: InsightCategory.MOTIVATION,
      priority: InsightPriority.LOW,
      content: message.content,
      confidence: 0.9,
      clinicalRelevance: 0.6,
      timestamp: new Date(),
      actionable: false
    };
  }

  private generateEducationInsight(context: InsightContext): EnhancedInsight {
    const educationalTopics = [
      {
        title: "OKB ve Beyin",
        content: "OKB'nin beyindeki serotonin dengesizliğiyle ilişkili olduğu düşünülüyor. Bu, sizin 'suçunuz' değil, tedavi edilebilir bir durum.",
        resource: "neuroscience_of_ocd"
      },
      {
        title: "Belirsizliğe Tahammülsüzlük",
        content: "OKB'nin temelinde belirsizliğe tahammülsüzlük yatar. Belirsizlikle barışmak, iyileşmenin önemli bir parçasıdır.",
        resource: "uncertainty_intolerance"
      },
      {
        title: "Düşünce-Eylem Kaynaşması",
        content: "OKB'de düşünceler ve eylemler birbirine karışır. Kötü bir düşünceye sahip olmak, kötü bir insan olmak anlamına gelmez.",
        resource: "thought_action_fusion"
      },
      {
        title: "Kompulsiyonların Paradoksu",
        content: "Kompulsiyonlar kısa vadede rahatlama sağlar ama uzun vadede OKB'yi güçlendirir. Bu döngüyü kırmak mümkün.",
        resource: "compulsion_cycle"
      }
    ];

    const topic = educationalTopics[Math.floor(Math.random() * educationalTopics.length)];

    return {
      id: `insight_education_${Date.now()}`,
      type: 'suggestion',
      category: InsightCategory.EDUCATION,
      priority: InsightPriority.LOW,
      content: `💡 ${topic.title}: ${topic.content}`,
      confidence: 0.95,
      clinicalRelevance: 0.7,
      timestamp: new Date(),
      actionable: true,
      actions: [
        {
          id: 'learn_more',
          label: 'Daha Fazla Bilgi',
          type: 'resource',
          data: { resource: topic.resource }
        }
      ]
    };
  }

  private generateWarningInsight(context: InsightContext): EnhancedInsight {
    const last24Hours = context.recentData.filter(d => {
      const hoursSince = (Date.now() - new Date(d.timestamp).getTime()) / (1000 * 60 * 60);
      return hoursSince <= 24;
    });

    const avgIntensity = last24Hours.reduce((sum, d) => sum + d.intensity, 0) / last24Hours.length;
    const compulsionCount = last24Hours.length;

    return {
      id: `insight_warning_${Date.now()}`,
      type: 'warning',
      category: InsightCategory.WARNING,
      priority: InsightPriority.CRITICAL,
      content: `Son 24 saatte ${compulsionCount} kompulsiyon kaydı ve ortalama ${avgIntensity.toFixed(1)} yoğunluk tespit edildi. Bu artış dikkat gerektiriyor.`,
      confidence: 0.9,
      clinicalRelevance: 0.95,
      timestamp: new Date(),
      actionable: true,
      actions: [
        {
          id: 'crisis_plan',
          label: 'Kriz Planını Aktive Et',
          type: 'exercise',
          data: { type: 'crisis_intervention' }
        },
        {
          id: 'contact_support',
          label: 'Destek Sistemine Ulaş',
          type: 'resource',
          data: { type: 'support_contacts' }
        },
        {
          id: 'emergency_techniques',
          label: 'Acil Teknikler',
          type: 'exercise',
          data: { techniques: ['grounding', 'breathing', 'distraction'] }
        }
      ]
    };
  }

  // Yardımcı metodlar

  private shouldGenerateInsight(template: InsightTemplate, context: InsightContext): boolean {
    // Tüm koşullar sağlanmalı
    return template.conditions.every(condition => condition.evaluate(context));
  }

  private async generateFromTemplate(
    template: InsightTemplate,
    context: InsightContext
  ): Promise<EnhancedInsight | null> {
    try {
      const insight = template.generator(context, {});
      
      // Son kontroller
      if (!insight.content || insight.content.trim().length === 0) {
        return null;
      }

      // Expiration date ekle
      if (!insight.expiresAt) {
        const expirationHours = this.getExpirationHours(insight.category);
        insight.expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
      }

      return insight;
    } catch (error) {
      logger.ai.error(`Failed to generate from template ${template.id}`, error);
      return null;
    }
  }

  private isInsightValid(insight: EnhancedInsight, context: InsightContext): boolean {
    // Tekrar kontrolü
    const isDuplicate = context.historicalInsights.some(hi => {
      const hoursSince = (Date.now() - new Date(hi.timestamp!).getTime()) / (1000 * 60 * 60);
      return hoursSince < 24 && 
             hi.category === insight.category &&
             this.calculateSimilarity(hi.content, insight.content) > 0.8;
    });

    if (isDuplicate) return false;

    // Kullanıcı tercihlerine uygunluk
    if (context.preferences.avoidTopics) {
      const containsAvoidedTopic = context.preferences.avoidTopics.some(topic =>
        insight.content.toLowerCase().includes(topic.toLowerCase())
      );
      if (containsAvoidedTopic) return false;
    }

    return true;
  }

  private prioritizeInsights(
    insights: EnhancedInsight[],
    context: InsightContext
  ): EnhancedInsight[] {
    return insights.sort((a, b) => {
      // Önce priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Sonra clinical relevance
      if (a.clinicalRelevance !== b.clinicalRelevance) {
        return b.clinicalRelevance - a.clinicalRelevance;
      }

      // En son confidence
      return b.confidence - a.confidence;
    });
  }

  private filterInsights(
    insights: EnhancedInsight[],
    context: InsightContext
  ): EnhancedInsight[] {
    // Kullanıcı tercihlerine göre filtrele
    let filtered = insights;

    // Focus area filtreleme
    if (context.preferences.focusAreas.length > 0) {
      // Her kategoriden en az bir içgörü al
      const byCategory = new Map<InsightCategory, EnhancedInsight[]>();
      
      filtered.forEach(insight => {
        const categoryInsights = byCategory.get(insight.category) || [];
        categoryInsights.push(insight);
        byCategory.set(insight.category, categoryInsights);
      });

      filtered = [];
      context.preferences.focusAreas.forEach(category => {
        const categoryInsights = byCategory.get(category) || [];
        filtered.push(...categoryInsights.slice(0, 2)); // Her kategoriden max 2
      });

      // Diğer kategorilerden de critical olanları ekle
      byCategory.forEach((insights, category) => {
        if (!context.preferences.focusAreas.includes(category)) {
          const criticalInsights = insights.filter(i => i.priority === InsightPriority.CRITICAL);
          filtered.push(...criticalInsights);
        }
      });
    }

    // Maksimum sayı sınırlaması
    const maxInsights = context.preferences.frequency === 'daily' ? 5 : 10;
    return filtered.slice(0, maxInsights);
  }

  private selectCopingStrategy(pattern: PatternAnalysis): any {
    const strategies = {
      [PatternType.TEMPORAL]: {
        name: "Zamanlı Müdahale",
        description: "Pattern'in en yoğun olduğu saatlerde proaktif stratejiler uygulayın.",
        technique: "scheduled_intervention"
      },
      [PatternType.TRIGGER]: {
        name: "Tetikleyici Yönetimi",
        description: "Tetikleyicileri önceden tanıyın ve alternatif tepkiler geliştirin.",
        technique: "trigger_management"
      },
      [PatternType.BEHAVIORAL]: {
        name: "Davranış Zinciri Kırma",
        description: "Ritüel zincirini başlangıç noktasında durdurun.",
        technique: "chain_breaking"
      },
      [PatternType.EMOTIONAL]: {
        name: "Duygu Düzenleme",
        description: "Duygusal yoğunluğu azaltmak için nefes ve grounding teknikleri kullanın.",
        technique: "emotion_regulation"
      },
      [PatternType.COGNITIVE]: {
        name: "Bilişsel Yeniden Yapılandırma",
        description: "Düşünce hatalarını tanıyın ve dengeli düşünceler geliştirin.",
        technique: "cognitive_restructuring"
      },
      [PatternType.SOCIAL]: {
        name: "Sosyal Destek Aktivasyonu",
        description: "Güvendiğiniz kişilerle iletişime geçin ve destek alın.",
        technique: "social_support"
      },
      [PatternType.ENVIRONMENTAL]: {
        name: "Çevre Düzenlemesi",
        description: "Tetikleyici çevresel faktörleri minimize edin.",
        technique: "environmental_modification"
      }
    };

    return strategies[pattern.type] || strategies[PatternType.BEHAVIORAL];
  }

  private createEmptyInsight(): EnhancedInsight {
    return {
      id: '',
      type: 'suggestion',
      category: InsightCategory.PROGRESS,
      priority: InsightPriority.LOW,
      content: '',
      confidence: 0,
      clinicalRelevance: 0,
      timestamp: new Date(),
      actionable: false
    };
  }

  private getExpirationHours(category: InsightCategory): number {
    const expirationMap = {
      [InsightCategory.PROGRESS]: 168, // 1 hafta
      [InsightCategory.PATTERN]: 72, // 3 gün
      [InsightCategory.TRIGGER]: 48, // 2 gün
      [InsightCategory.COPING]: 24, // 1 gün
      [InsightCategory.MOTIVATION]: 24, // 1 gün
      [InsightCategory.EDUCATION]: 168, // 1 hafta
      [InsightCategory.WARNING]: 12, // 12 saat
      [InsightCategory.CELEBRATION]: 72 // 3 gün
    };

    return expirationMap[category] || 24;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Basit similarity hesaplama - gerçek uygulamada daha sofistike olmalı
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(w => words2.includes(w));
    const similarity = (commonWords.length * 2) / (words1.length + words2.length);
    
    return similarity;
  }

  private async saveInsights(userId: string, insights: EnhancedInsight[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `@insights_${userId}`,
        JSON.stringify(insights)
      );
    } catch (error) {
      logger.ai.error('Failed to save insights', error);
    }
  }

  private async learnFromFeedback(insight: EnhancedInsight, helpful: boolean): Promise<void> {
    // Geri bildirim verilerini topla ve gelecekte kullan
    const feedbackData = {
      insightId: insight.id,
      category: insight.category,
      priority: insight.priority,
      helpful,
      timestamp: new Date()
    };

    try {
      const existingFeedback = await AsyncStorage.getItem('@insight_feedback');
      const feedback = existingFeedback ? JSON.parse(existingFeedback) : [];
      feedback.push(feedbackData);
      
      // Son 1000 geri bildirimi tut
      const recentFeedback = feedback.slice(-1000);
      await AsyncStorage.setItem('@insight_feedback', JSON.stringify(recentFeedback));

      // Telemetri
      await trackAIInteraction(AIEventType.INSIGHT_GENERATED, {
        feedback: helpful ? 'helpful' : 'not_helpful',
        category: insight.category
      });
    } catch (error) {
      logger.ai.error('Failed to save feedback', error);
    }
  }
}

// Singleton export
export const insightsEngine = InsightsEngine.getInstance(); 