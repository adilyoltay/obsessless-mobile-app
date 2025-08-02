/**
 * Smart Conversation Trigger System
 * 
 * Optimal müdahale anlarını tespit eder ve akıllı tetikleyiciler oluşturur
 * Machine learning ile kişiselleştirilmiş timing prediction
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  AIMessage,
  ConversationContext,
  AIError,
  AIErrorCode
} from '@/features/ai/types';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';
import { cbtEngine } from '@/features/ai/engines/cbtEngine';

// Tetikleyici Tipleri
export enum TriggerType {
  POST_COMPULSION = 'post_compulsion',          // Kompulsiyon sonrası
  TIME_BASED_CHECKIN = 'time_based_checkin',    // Zaman tabanlı kontrol
  PATTERN_RECOGNITION = 'pattern_recognition',   // Pattern tanıma
  EMOTIONAL_STATE = 'emotional_state',           // Duygusal durum
  ENVIRONMENTAL = 'environmental',               // Çevresel tetikleyici
  SOCIAL_SUPPORT = 'social_support',             // Sosyal destek
  THERAPEUTIC_HOMEWORK = 'therapeutic_homework', // Terapi ödevi
  CRISIS_PREVENTION = 'crisis_prevention'        // Kriz önleme
}

// Tetikleyici Öncelik Seviyesi
export enum TriggerPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

// Tetikleyici Durumu
export enum TriggerStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  EXPIRED = 'expired'
}

// Tetikleyici Verisi
export interface ConversationTrigger {
  id: string;
  type: TriggerType;
  priority: TriggerPriority;
  status: TriggerStatus;
  userId: string;
  scheduledTime: Date;
  actualTime?: Date;
  context: {
    reason: string;
    relatedData?: any;
    emotionalState?: 'calm' | 'elevated' | 'distressed' | 'crisis';
    environmentalFactors?: string[];
  };
  content: {
    message: string;
    suggestionType: 'question' | 'affirmation' | 'technique' | 'check_in';
    expectedDuration: number; // dakika
  };
  conditions: {
    minTimeSinceLastInteraction: number; // dakika
    maxTriggersPerDay: number;
    requiredUserState?: 'active' | 'idle';
    locationBased?: boolean;
  };
  effectiveness?: {
    userEngaged: boolean;
    conversationLength: number;
    userSatisfactionScore?: number;
    therapeuticOutcome?: 'helpful' | 'neutral' | 'unhelpful';
  };
  createdAt: Date;
  expiresAt: Date;
}

// Machine Learning Pattern'leri
interface UserPattern {
  userId: string;
  optimalTimes: Date[];
  responsiveStates: string[];
  preferredTriggerTypes: TriggerType[];
  avoidancePatterns: {
    timeRanges: { start: string; end: string }[];
    contexts: string[];
  };
  effectivenessHistory: {
    triggerType: TriggerType;
    successRate: number;
    averageEngagement: number;
  }[];
}

class ConversationTriggerService {
  private static instance: ConversationTriggerService;
  private initialized: boolean = false;
  private activeTriggers: Map<string, ConversationTrigger> = new Map();
  private userPatterns: Map<string, UserPattern> = new Map();

  static getInstance(): ConversationTriggerService {
    if (!this.instance) {
      this.instance = new ConversationTriggerService();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Feature flag kontrolü
    if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
      throw new AIError(
        AIErrorCode.FEATURE_DISABLED,
        'Conversation Triggers require AI_CHAT feature flag'
      );
    }

    // Kullanıcı pattern'lerini yükle
    await this.loadUserPatterns();
    
    // Aktif tetikleyicileri yükle
    await this.loadActiveTriggers();

    this.initialized = true;

    await trackAIInteraction(AIEventType.TRIGGER_SYSTEM_INITIALIZED, {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Kompulsiyon sonrası tetikleyici oluştur
   */
  async createPostCompulsionTrigger(
    userId: string,
    compulsionData: any
  ): Promise<ConversationTrigger> {
    const trigger: ConversationTrigger = {
      id: `post_comp_${Date.now()}`,
      type: TriggerType.POST_COMPULSION,
      priority: TriggerPriority.HIGH,
      status: TriggerStatus.PENDING,
      userId,
      scheduledTime: new Date(Date.now() + 30 * 60 * 1000), // 30 dakika sonra
      context: {
        reason: 'Kompulsiyon sonrası işleme ve destek',
        relatedData: compulsionData,
        emotionalState: this.assessEmotionalStateFromCompulsion(compulsionData)
      },
      content: {
        message: this.generatePostCompulsionMessage(compulsionData),
        suggestionType: 'question',
        expectedDuration: 5
      },
      conditions: {
        minTimeSinceLastInteraction: 15,
        maxTriggersPerDay: 3,
        requiredUserState: 'active'
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 saat
    };

    await this.scheduleTrigger(trigger);
    
    await trackAIInteraction(AIEventType.POST_COMPULSION_TRIGGER_CREATED, {
      triggerId: trigger.id,
      compulsionType: compulsionData.type,
      priority: trigger.priority
    });

    return trigger;
  }

  /**
   * Zaman tabanlı kontrol tetikleyicisi oluştur
   */
  async createTimeBasedCheckIn(
    userId: string,
    timeOfDay: 'morning' | 'afternoon' | 'evening'
  ): Promise<ConversationTrigger> {
    const userPattern = this.userPatterns.get(userId);
    const optimalTime = this.calculateOptimalCheckInTime(timeOfDay, userPattern);

    const trigger: ConversationTrigger = {
      id: `checkin_${timeOfDay}_${Date.now()}`,
      type: TriggerType.TIME_BASED_CHECKIN,
      priority: TriggerPriority.MEDIUM,
      status: TriggerStatus.PENDING,
      userId,
      scheduledTime: optimalTime,
      context: {
        reason: `${timeOfDay} kontrol`,
        emotionalState: 'calm'
      },
      content: {
        message: this.generateCheckInMessage(timeOfDay),
        suggestionType: 'check_in',
        expectedDuration: 3
      },
      conditions: {
        minTimeSinceLastInteraction: 120, // 2 saat
        maxTriggersPerDay: 2,
        requiredUserState: 'active'
      },
      createdAt: new Date(),
      expiresAt: new Date(optimalTime.getTime() + 3 * 60 * 60 * 1000)
    };

    await this.scheduleTrigger(trigger);
    return trigger;
  }

  /**
   * Pattern tanıma tetikleyicisi oluştur
   */
  async createPatternRecognitionTrigger(
    userId: string,
    detectedPattern: string,
    confidence: number
  ): Promise<ConversationTrigger> {
    const priority = confidence > 0.8 ? TriggerPriority.HIGH : TriggerPriority.MEDIUM;

    const trigger: ConversationTrigger = {
      id: `pattern_${Date.now()}`,
      type: TriggerType.PATTERN_RECOGNITION,
      priority,
      status: TriggerStatus.PENDING,
      userId,
      scheduledTime: new Date(Date.now() + 10 * 60 * 1000), // 10 dakika sonra
      context: {
        reason: 'Davranış pattern\'i tespit edildi',
        relatedData: { pattern: detectedPattern, confidence },
        emotionalState: 'elevated'
      },
      content: {
        message: this.generatePatternMessage(detectedPattern),
        suggestionType: 'technique',
        expectedDuration: 8
      },
      conditions: {
        minTimeSinceLastInteraction: 30,
        maxTriggersPerDay: 4
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    };

    await this.scheduleTrigger(trigger);
    return trigger;
  }

  /**
   * Duygusal durum tetikleyicisi oluştur
   */
  async createEmotionalStateTrigger(
    userId: string,
    emotionalState: 'elevated' | 'distressed' | 'crisis',
    context?: any
  ): Promise<ConversationTrigger> {
    const priority = emotionalState === 'crisis' ? TriggerPriority.CRITICAL : TriggerPriority.HIGH;
    const immediateDelay = emotionalState === 'crisis' ? 0 : 5 * 60 * 1000; // Kriz durumunda hemen

    const trigger: ConversationTrigger = {
      id: `emotional_${emotionalState}_${Date.now()}`,
      type: TriggerType.EMOTIONAL_STATE,
      priority,
      status: TriggerStatus.PENDING,
      userId,
      scheduledTime: new Date(Date.now() + immediateDelay),
      context: {
        reason: `Duygusal durum: ${emotionalState}`,
        relatedData: context,
        emotionalState
      },
      content: {
        message: this.generateEmotionalSupportMessage(emotionalState),
        suggestionType: emotionalState === 'crisis' ? 'technique' : 'affirmation',
        expectedDuration: emotionalState === 'crisis' ? 15 : 7
      },
      conditions: {
        minTimeSinceLastInteraction: emotionalState === 'crisis' ? 0 : 10,
        maxTriggersPerDay: emotionalState === 'crisis' ? 10 : 3
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (emotionalState === 'crisis' ? 6 : 2) * 60 * 60 * 1000)
    };

    await this.scheduleTrigger(trigger);
    return trigger;
  }

  /**
   * Tetikleyiciyi programla
   */
  private async scheduleTrigger(trigger: ConversationTrigger): Promise<void> {
    // Kullanıcının günlük limitini kontrol et
    const todayTriggers = await this.getTodayTriggerCount(trigger.userId, trigger.type);
    if (todayTriggers >= trigger.conditions.maxTriggersPerDay) {
      trigger.status = TriggerStatus.SKIPPED;
      return;
    }

    // Son etkileşim zamanını kontrol et
    const lastInteraction = await this.getLastInteractionTime(trigger.userId);
    const timeSinceLastInteraction = Date.now() - lastInteraction.getTime();
    
    if (timeSinceLastInteraction < trigger.conditions.minTimeSinceLastInteraction * 60 * 1000) {
      // Yeterli zaman geçmemiş, tetikleyiciyi ertele
      trigger.scheduledTime = new Date(
        lastInteraction.getTime() + trigger.conditions.minTimeSinceLastInteraction * 60 * 1000
      );
    }

    this.activeTriggers.set(trigger.id, trigger);
    await this.saveActiveTriggers();

    // Zamanlandığında tetikle
    setTimeout(() => {
      this.executeTrigger(trigger.id);
    }, trigger.scheduledTime.getTime() - Date.now());
  }

  /**
   * Tetikleyiciyi çalıştır
   */
  private async executeTrigger(triggerId: string): Promise<void> {
    const trigger = this.activeTriggers.get(triggerId);
    if (!trigger || trigger.status !== TriggerStatus.PENDING) {
      return;
    }

    // Koşulları tekrar kontrol et
    if (!(await this.checkTriggerConditions(trigger))) {
      trigger.status = TriggerStatus.SKIPPED;
      return;
    }

    trigger.status = TriggerStatus.ACTIVE;
    trigger.actualTime = new Date();

    // AI sohbet başlat
    await this.initiateTriggerConversation(trigger);

    await trackAIInteraction(AIEventType.TRIGGER_EXECUTED, {
      triggerId: trigger.id,
      type: trigger.type,
      priority: trigger.priority,
      scheduledTime: trigger.scheduledTime,
      actualTime: trigger.actualTime
    });
  }

  /**
   * Tetikleyici sohbeti başlat
   */
  private async initiateTriggerConversation(trigger: ConversationTrigger): Promise<void> {
    // Burada AI chat interface ile sohbet başlatılacak
    // App state'ine trigger bilgisi gönderilecek
    
    const conversationContext: ConversationContext = {
      userId: trigger.userId,
      sessionId: `trigger_${trigger.id}`,
      conversationHistory: [],
      userProfile: {
        symptomSeverity: 5, // Dinamik olarak alınacak
        preferredLanguage: 'tr',
        triggerWords: [],
        therapeuticGoals: []
      },
      currentState: trigger.context.emotionalState === 'crisis' ? 'crisis' : 'stable'
    };

    // CBT Engine ile yanıt oluştur
    try {
      const response = await cbtEngine.generateCBTResponse(
        trigger.content.message,
        conversationContext
      );

      // Tetikleyici mesajını kullanıcıya gönder
      // Bu kısım app state management ile entegre edilecek
      
    } catch (error) {
      console.error('Trigger conversation başlatılamadı:', error);
      trigger.status = TriggerStatus.EXPIRED;
    }
  }

  // Yardımcı metodlar
  private assessEmotionalStateFromCompulsion(compulsionData: any): 'calm' | 'elevated' | 'distressed' {
    const intensity = compulsionData.intensity || 5;
    if (intensity > 7) return 'distressed';
    if (intensity > 5) return 'elevated';
    return 'calm';
  }

  private generatePostCompulsionMessage(compulsionData: any): string {
    const messages = [
      "Kompulsiyonunuzu fark etmeniz önemli bir adım. Bu deneyimle ilgili nasıl hissediyorsunuz?",
      "Bu kompulsiyonu yaşadığınızı görüyorum. Şu anda kendinize karşı nazik olmayı deneyelim.",
      "Kompulsiyondan sonra kendinizi nasıl hissediyorsunuz? Bu duyguları birlikte keşfedelim."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private generateCheckInMessage(timeOfDay: string): string {
    const messages = {
      morning: [
        "Günaydın! Bugün kendinizi nasıl hissediyorsunuz?",
        "Yeni bir gün başlıyor. Bugün için nasıl bir niyet belirlemek istiyorsunuz?"
      ],
      afternoon: [
        "Öğleden sonra küçük bir mola. Bugün nasıl geçiyor?",
        "Günün ilk yarısı nasıldı? Kendinizle gurur duyduğunuz bir şey var mı?"
      ],
      evening: [
        "Gün sona eriyor. Bugünkü deneyimlerinizi değerlendirmek ister misiniz?",
        "Akşam saatleri... Bugün öğrendiğiniz bir şey var mı?"
      ]
    };
    
    const timeMessages = messages[timeOfDay];
    return timeMessages[Math.floor(Math.random() * timeMessages.length)];
  }

  private generatePatternMessage(pattern: string): string {
    return `Son zamanlarda "${pattern}" pattern'ini fark ediyorum. ` +
           `Bu konuda birlikte düşünmek ve alternatif yaklaşımlar keşfetmek ister misiniz?`;
  }

  private generateEmotionalSupportMessage(state: string): string {
    const messages = {
      elevated: "Biraz gergin görünüyorsunuz. Nefes alma egzersizi yapmak ister misiniz?",
      distressed: "Zor bir dönemden geçiyorsunuz gibi görünüyor. Size nasıl destek olabilirim?",
      crisis: "Şu anda çok zor duygular yaşıyorsunuz. Güvende olduğunuzu hatırlayın. Beraber bu anı geçirelim."
    };
    return messages[state];
  }

  private calculateOptimalCheckInTime(
    timeOfDay: string,
    userPattern?: UserPattern
  ): Date {
    const now = new Date();
    const timeRanges = {
      morning: { start: 8, end: 11 },
      afternoon: { start: 14, end: 17 },
      evening: { start: 19, end: 21 }
    };

    const range = timeRanges[timeOfDay];
    const optimalHour = userPattern?.optimalTimes?.[0]?.getHours() || 
                       (range.start + range.end) / 2;

    const scheduledTime = new Date(now);
    scheduledTime.setHours(Math.floor(optimalHour), 0, 0, 0);
    
    // Eğer zaman geçmişse yarın için programla
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    return scheduledTime;
  }

  private async checkTriggerConditions(trigger: ConversationTrigger): Promise<boolean> {
    // Kullanıcı aktif mi kontrol et
    if (trigger.conditions.requiredUserState === 'active') {
      const isUserActive = await this.checkUserActivity(trigger.userId);
      if (!isUserActive) return false;
    }

    // Günlük limit kontrol et
    const todayCount = await this.getTodayTriggerCount(trigger.userId, trigger.type);
    if (todayCount >= trigger.conditions.maxTriggersPerDay) return false;

    return true;
  }

  private async checkUserActivity(userId: string): Promise<boolean> {
    // App state'den kullanıcı aktivitesini kontrol et
    // Şimdilik true döndür
    return true;
  }

  private async getTodayTriggerCount(userId: string, type: TriggerType): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let count = 0;
    this.activeTriggers.forEach(trigger => {
      if (trigger.userId === userId && 
          trigger.type === type && 
          trigger.createdAt >= today) {
        count++;
      }
    });
    
    return count;
  }

  private async getLastInteractionTime(userId: string): Promise<Date> {
    // Son AI etkileşim zamanını getir
    // Şimdilik 1 saat öncesini döndür
    return new Date(Date.now() - 60 * 60 * 1000);
  }

  private async loadUserPatterns(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('user_patterns');
      if (stored) {
        const patterns = JSON.parse(stored);
        this.userPatterns = new Map(patterns);
      }
    } catch (error) {
      console.error('User patterns yüklenemedi:', error);
    }
  }

  private async loadActiveTriggers(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('active_triggers');
      if (stored) {
        const triggers = JSON.parse(stored);
        this.activeTriggers = new Map(
          triggers.map((t: ConversationTrigger) => [t.id, {
            ...t,
            scheduledTime: new Date(t.scheduledTime),
            actualTime: t.actualTime ? new Date(t.actualTime) : undefined,
            createdAt: new Date(t.createdAt),
            expiresAt: new Date(t.expiresAt)
          }])
        );
      }
    } catch (error) {
      console.error('Active triggers yüklenemedi:', error);
    }
  }

  private async saveActiveTriggers(): Promise<void> {
    try {
      const triggers = Array.from(this.activeTriggers.values());
      await AsyncStorage.setItem('active_triggers', JSON.stringify(triggers));
    } catch (error) {
      console.error('Active triggers kaydedilemedi:', error);
    }
  }
}

export const conversationTriggerService = ConversationTriggerService.getInstance(); 