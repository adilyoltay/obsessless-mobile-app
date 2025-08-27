/**
 * 🔄 STATIC FALLBACK SERVICE
 * 
 * Provides meaningful static insights and suggestions when AI services fail
 * or are disabled, ensuring users always receive value.
 * 
 * This service prevents empty states and provides research-backed 
 * mental health guidance without requiring AI processing.
 */

export interface StaticInsight {
  id: string;
  title: string;
  content: string;
  category: 'therapeutic' | 'progress' | 'behavioral' | 'motivational';
  icon: string;
  confidence: number;
  actionable: boolean;
  source: 'static_fallback';
}

export interface StaticFallbackContext {
  hasRecentMoodEntries?: boolean;
  averageMood?: number;
  entriesCount?: number;
  daysSinceLastEntry?: number;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  userPreferences?: {
    preferredLanguage?: string;
    therapeuticApproach?: string;
  };
}

/**
 * 🎯 STATIC FALLBACK SERVICE
 * Provides AI-independent insights based on established mental health principles
 */
export class StaticFallbackService {
  private static instance: StaticFallbackService;

  static getInstance(): StaticFallbackService {
    if (!StaticFallbackService.instance) {
      StaticFallbackService.instance = new StaticFallbackService();
    }
    return StaticFallbackService.instance;
  }

  /**
   * 🧠 CORE METHOD: Generate static insights based on context
   */
  generateStaticInsights(context: StaticFallbackContext = {}): StaticInsight[] {
    const insights: StaticInsight[] = [];
    
    // Always include general therapeutic insights
    insights.push(...this.getGeneralTherapeuticInsights());
    
    // Add context-specific insights
    if (context.hasRecentMoodEntries) {
      insights.push(...this.getMoodTrackingInsights(context));
    } else {
      insights.push(...this.getMotivationalInsights());
    }
    
    // Add time-of-day specific insights
    if (context.timeOfDay) {
      insights.push(...this.getTimeBasedInsights(context.timeOfDay));
    }
    
    // Add progress insights if user has been active
    if (context.entriesCount && context.entriesCount > 0) {
      insights.push(...this.getProgressInsights(context));
    }
    
    // Return top 5 most relevant insights
    return insights
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * 💡 THERAPEUTIC INSIGHTS: Evidence-based mental health guidance
   */
  private getGeneralTherapeuticInsights(): StaticInsight[] {
    const therapeuticInsights = [
      {
        id: 'breathing_technique',
        title: '🫁 Nefes Egzersizi',
        content: 'Derin nefes almak anksiyeteyi azaltmanın en hızlı yollarından biri. 4 saniye nefes al, 7 saniye tut, 8 saniye ver.',
        category: 'therapeutic' as const,
        icon: 'air-ballons',
        confidence: 0.9,
        actionable: true,
        source: 'static_fallback' as const
      },
      {
        id: 'grounding_technique',
        title: '🌍 Topraklanma Tekniği',
        content: '5-4-3-2-1 tekniği: 5 şey gör, 4 şey dokun, 3 şey duy, 2 şey kokla, 1 şey tat. Anksiyete anında çok etkili.',
        category: 'therapeutic' as const,
        icon: 'nature-people',
        confidence: 0.85,
        actionable: true,
        source: 'static_fallback' as const
      },
      {
        id: 'mindfulness_moment',
        title: '🧘 Farkındalık Anı',
        content: 'Şu anda neler hissettiğini yargılamadan gözlemle. Her duygu geçicidir ve bu da geçecek.',
        category: 'therapeutic' as const,
        icon: 'meditation',
        confidence: 0.8,
        actionable: true,
        source: 'static_fallback' as const
      },
      {
        id: 'thought_challenge',
        title: '🤔 Düşünce Sorgulama',
        content: 'Bu düşünce gerçek mi? Kanıtı var mı? En iyi arkadaşına ne söylerdin? Düşüncelerini sorgulamak güçlendirici.',
        category: 'therapeutic' as const,
        icon: 'head-lightbulb',
        confidence: 0.82,
        actionable: true,
        source: 'static_fallback' as const
      }
    ];

    // Return 2-3 random therapeutic insights
    return this.shuffleArray(therapeuticInsights).slice(0, 3);
  }

  /**
   * 📈 MOOD TRACKING INSIGHTS: For users with recent mood data
   */
  private getMoodTrackingInsights(context: StaticFallbackContext): StaticInsight[] {
    const insights: StaticInsight[] = [];

    if (context.averageMood !== undefined) {
      if (context.averageMood >= 70) {
        insights.push({
          id: 'positive_momentum',
          title: '✨ Pozitif Momentum',
          content: 'Ruh halin son zamanlarda iyi görünüyor! Bu pozitif enerjiyi korumak için düzenli uyku ve egzersiz önemli.',
          category: 'progress',
          icon: 'trending-up',
          confidence: 0.75,
          actionable: true,
          source: 'static_fallback'
        });
      } else if (context.averageMood <= 40) {
        insights.push({
          id: 'support_reminder',
          title: '🤗 Destek Hatırlatması',
          content: 'Zor günlerden geçiyorsun. Unutma ki yardım almak güçlülük işareti. Sevdiğin biriyle konuş veya profesyonel destek al.',
          category: 'therapeutic',
          icon: 'account-heart',
          confidence: 0.8,
          actionable: true,
          source: 'static_fallback'
        });
      } else {
        insights.push({
          id: 'balance_focus',
          title: '⚖️ Denge Odağı',
          content: 'Ruh halin orta seviyede. Küçük pozitif değişiklikler büyük fark yaratabilir: kısa yürüyüş, müzik dinlemek, arkadaşla sohbet.',
          category: 'behavioral',
          icon: 'scale-balance',
          confidence: 0.7,
          actionable: true,
          source: 'static_fallback'
        });
      }
    }

    return insights;
  }

  /**
   * 🚀 MOTIVATIONAL INSIGHTS: For new or inactive users
   */
  private getMotivationalInsights(): StaticInsight[] {
    const motivationalInsights = [
      {
        id: 'journey_start',
        title: '🌱 Yolculuk Başlangıcı',
        content: 'Mental sağlık yolculuğuna başladığın için tebrikler! Her küçük adım sayıyor ve sen zaten doğru yoldasın.',
        category: 'motivational',
        icon: 'sprout',
        confidence: 0.85,
        actionable: false,
        source: 'static_fallback' as const
      },
      {
        id: 'tracking_benefits',
        title: '📊 Takibin Faydaları',
        content: 'Mood takibi kendi duygusal kalıplarını anlamanın en etkili yollarından biri. Bilim destekli bir yöntem kullanıyorsun.',
        category: 'motivational',
        icon: 'chart-line-variant',
        confidence: 0.8,
        actionable: false,
        source: 'static_fallback' as const
      },
      {
        id: 'consistency_matters',
        title: '🎯 Tutarlılık Önemli',
        content: 'Düzenli kayıt tutmak daha anlamlı içgörüler sağlıyor. Günde sadece 30 saniye bile büyük fark yaratıyor.',
        category: 'behavioral',
        icon: 'target',
        confidence: 0.78,
        actionable: true,
        source: 'static_fallback' as const
      }
    ];

    return motivationalInsights;
  }

  /**
   * ⏰ TIME-BASED INSIGHTS: Context-aware suggestions
   */
  private getTimeBasedInsights(timeOfDay: string): StaticInsight[] {
    const timeBasedInsights: Record<string, StaticInsight[]> = {
      morning: [
        {
          id: 'morning_intention',
          title: '🌅 Sabah Niyeti',
          content: 'Güne pozitif bir niyet koyarak başla. Bugün kendine karşı şefkatli ol ve küçük başarıları kutla.',
          category: 'motivational',
          icon: 'weather-sunrise',
          confidence: 0.75,
          actionable: true,
          source: 'static_fallback'
        }
      ],
      afternoon: [
        {
          id: 'midday_break',
          title: '☀️ Öğle Molası',
          content: 'Gün ortasında 5 dakika derin nefes al veya kısa bir yürüyüşe çık. Enerji seviyeni dengele.',
          category: 'behavioral',
          icon: 'weather-sunny',
          confidence: 0.72,
          actionable: true,
          source: 'static_fallback'
        }
      ],
      evening: [
        {
          id: 'reflection_time',
          title: '🌆 Yansıma Zamanı',
          content: 'Akşam günün pozitif anlarını hatırlama zamanı. 3 şey için minnet duyduğunu düşün.',
          category: 'therapeutic',
          icon: 'weather-sunset',
          confidence: 0.78,
          actionable: true,
          source: 'static_fallback'
        }
      ],
      night: [
        {
          id: 'wind_down',
          title: '🌙 Rahatlatma',
          content: 'Uyumadan önce günün stresini bırak. Gevşeme egzersizi veya sakin müzik dinle.',
          category: 'therapeutic',
          icon: 'weather-night',
          confidence: 0.8,
          actionable: true,
          source: 'static_fallback'
        }
      ]
    };

    return timeBasedInsights[timeOfDay] || [];
  }

  /**
   * 📈 PROGRESS INSIGHTS: For active users
   */
  private getProgressInsights(context: StaticFallbackContext): StaticInsight[] {
    const insights: StaticInsight[] = [];
    
    if (context.entriesCount && context.entriesCount >= 7) {
      insights.push({
        id: 'week_milestone',
        title: '🏆 Haftalık Başarı',
        content: `${context.entriesCount} kayıt tamamladın! Tutarlı takip mental sağlık yolculuğunda önemli bir adım.`,
        category: 'progress',
        icon: 'trophy',
        confidence: 0.85,
        actionable: false,
        source: 'static_fallback'
      });
    } else if (context.entriesCount && context.entriesCount >= 7) {
      insights.push({
        id: 'good_start',
        title: '🌟 İyi Başlangıç',
        content: `${context.entriesCount} kayıt ile başladın! Her kayıt kendini daha iyi anlamanı sağlıyor.`,
        category: 'progress',
        icon: 'star-outline',
        confidence: 0.75,
        actionable: false,
        source: 'static_fallback'
      });
    }

    return insights;
  }

  /**
   * 🎲 UTILITY: Shuffle array for variety
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 🎯 CONTEXT-AWARE: Generate insights for specific UI states
   */
  generateEmptyStateInsights(): StaticInsight[] {
    return [
      {
        id: 'start_journey',
        title: '🚀 Yolculuğa Başla',
        content: 'İlk mood kaydını yapmak için "+" butonuna tıkla. Her yolculuk tek bir adımla başlar.',
        category: 'motivational',
        icon: 'rocket-launch',
        confidence: 0.9,
        actionable: true,
        source: 'static_fallback'
      },
      {
        id: 'daily_habit',
        title: '📅 Günlük Alışkanlık',
        content: 'Mood takibi en iyi günlük alışkanlık olarak çalışır. Sabit bir zamanda (sabah kahvesi gibi) kayıt tut.',
        category: 'behavioral',
        icon: 'calendar-check',
        confidence: 0.8,
        actionable: true,
        source: 'static_fallback'
      }
    ];
  }

  /**
   * 🔄 ERROR FALLBACK: When AI services fail
   */
  generateErrorFallbackInsights(errorType?: string): StaticInsight[] {
    const baseInsights = this.getGeneralTherapeuticInsights();
    
    // Add error-specific guidance
    baseInsights.unshift({
      id: 'service_continuity',
      title: '✅ Hizmet Sürekliliği',
      content: 'AI özelliği geçici olarak kullanılamıyor, ancak temel özellikler çalışmaya devam ediyor. Mood kaydetmeye devam edebilirsin.',
      category: 'therapeutic',
      icon: 'shield-check',
      confidence: 0.95,
      actionable: false,
      source: 'static_fallback'
    });

    return baseInsights.slice(0, 4);
  }

  /**
   * 🌐 OFFLINE FALLBACK: When device is offline
   */
  generateOfflineFallbacks(): StaticInsight[] {
    return [
      {
        id: 'offline_continuity',
        title: '📱 Çevrimdışı Kullanım',
        content: 'İnternet bağlantın olmasa da mood takibine devam edebilirsin. Veriler bağlantı kurulduğunda senkronize olacak.',
        category: 'behavioral',
        icon: 'wifi-off',
        confidence: 0.9,
        actionable: true,
        source: 'static_fallback'
      },
      ...this.getGeneralTherapeuticInsights().slice(0, 3)
    ];
  }
}

export const staticFallbackService = StaticFallbackService.getInstance();
