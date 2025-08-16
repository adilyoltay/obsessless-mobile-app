/**
 * 📱 Smart Notifications - Context-Aware Therapeutic Delivery System
 * 
 * Bu sistem, Insights Engine v2.0 ve Pattern Recognition v2.0'dan gelen
 * bulgular temelinde kullanıcıya en uygun zamanda, en etkili şekilde
 * bildirimler gönderir. Therapeutic timing ve user context'i önemser.
 * 
 * ⚠️ CRITICAL: Notification fatigue'u önlemek için intelligent throttling
 * ⚠️ Feature flag kontrolü: AI_SMART_NOTIFICATIONS
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
// Crisis types removed from notifications context
import { 
  IntelligentInsight, 
  InsightCategory, 
  InsightPriority, 
  InsightTiming 
} from '@/features/ai/engines/insightsEngineV2';
import { 
  DetectedPattern, 
  PatternType, 
  PatternSeverity 
} from '@/features/ai/services/patternRecognitionV2';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { ErrorSeverity, AIError, AIErrorCode } from '@/features/ai/types';

// =============================================================================
// 🎯 NOTIFICATION DEFINITIONS & TYPES
// =============================================================================

/**
 * Notification kategorileri
 */
export enum NotificationCategory {
  INSIGHT_DELIVERY = 'insight_delivery',         // İçgörü sunma
  PROGRESS_CELEBRATION = 'progress_celebration', // İlerleme kutlaması
  THERAPEUTIC_REMINDER = 'therapeutic_reminder', // Terapötik hatırlatma
  SKILL_PRACTICE = 'skill_practice',            // Beceri pratiği
  CHECK_IN = 'check_in',                        // Durum sorgusu
  EDUCATIONAL = 'educational'                   // Eğitici içerik
}

/**
 * Notification delivery methods
 */
export enum DeliveryMethod {
  PUSH_NOTIFICATION = 'push_notification',   // Push notification
  IN_APP_BANNER = 'in_app_banner',          // Uygulama içi banner
  GENTLE_POPUP = 'gentle_popup',            // Nazik popup
  CHAT_MESSAGE = 'chat_message',            // Sohbet mesajı
  EMAIL_DIGEST = 'email_digest',            // Email özeti
  SILENT_BADGE = 'silent_badge'             // Sessiz badge güncellemesi
}

/**
 * User context için notification preferences
 */
export interface NotificationPreferences {
  userId: string;
  
  // General preferences
  enabled: boolean;
  quietHours: {
    start: string; // "22:00"
    end: string;   // "08:00"
  };
  
  // Category preferences
  categorySettings: {
    [key in NotificationCategory]: {
      enabled: boolean;
      maxPerDay: number;
      preferredMethod: DeliveryMethod;
      allowQuietHours: boolean;
    };
  };
  
  // Timing preferences
  preferredTimes: string[]; // ["09:00", "14:00", "19:00"]
  timezone: string;
  
  // Context awareness
  respectAppUsage: boolean;  // Don't notify during active usage
  adaptToMood: boolean;      // Consider user mood
  crisisOverride: boolean;   // Allow crisis notifications anytime
  
  // Personalization
  tone: 'formal' | 'casual' | 'warm';
  language: 'tr' | 'en';
  culturalContext: 'turkish' | 'international';
}

/**
 * Smart Notification
 */
export interface SmartNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  // Content
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  customData?: any;
  
  // Delivery
  deliveryMethod: DeliveryMethod;
  scheduledFor: Date;
  expiresAt: Date;
  
  // Context
  triggeredBy: {
    type: 'insight' | 'pattern' | 'schedule' | 'user_action';
    sourceId: string;
    confidence: number;
  };
  
  // Targeting
  targetContext: {
    userMood?: string;
    appUsageState: 'active' | 'background' | 'closed';
    lastActivity: Date;
    // crisis level removed
  };
  
  // Metadata
  createdAt: Date;
  sentAt?: Date;
  viewedAt?: Date;
  actionedAt?: Date;
  dismissed: boolean;
  
  // Analytics
  effectiveness?: {
    viewed: boolean;
    engaged: boolean;
    actionTaken: boolean;
    userFeedback?: 'helpful' | 'not_helpful' | 'annoying';
  };
}

/**
 * Notification delivery context
 */
export interface DeliveryContext {
  userId: string;
  userPreferences: NotificationPreferences;
  currentContext: {
    isAppActive: boolean;
    lastActivity: Date;
    currentScreen?: string;
    userMood?: string;
    // crisis level removed
  };
  recentNotifications: SmartNotification[];
  timeOfDay: Date;
}

/**
 * Notification scheduling result
 */
export interface SchedulingResult {
  scheduled: boolean;
  notification?: SmartNotification;
  reason?: string;
  suggestedTime?: Date;
  alternativeMethod?: DeliveryMethod;
}

// =============================================================================
// 📱 SMART NOTIFICATIONS IMPLEMENTATION
// =============================================================================

class SmartNotificationService {
  private static instance: SmartNotificationService;
  private isEnabled: boolean = false;
  private notificationQueue: Map<string, SmartNotification[]> = new Map();
  private userPreferences: Map<string, NotificationPreferences> = new Map();
  private deliveryHistory: Map<string, SmartNotification[]> = new Map();
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  private constructor() {}

  static getInstance(): SmartNotificationService {
    if (!SmartNotificationService.instance) {
      SmartNotificationService.instance = new SmartNotificationService();
    }
    return SmartNotificationService.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION & SETUP
  // =============================================================================

  /**
   * Smart Notifications Service'i başlat
   */
  async initialize(): Promise<void> {
    console.log('📱 Smart Notifications Service: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_SMART_NOTIFICATIONS')) {
        console.log('🚫 Smart Notifications disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      // Load default preferences
      this.initializeDefaultPreferences();

      this.isEnabled = true;
      
      // Telemetry
      await trackAIInteraction(AIEventType.SMART_NOTIFICATIONS_INITIALIZED, {
        version: '2.0'
      });

      console.log('✅ Smart Notifications Service initialized successfully');

    } catch (error) {
      console.error('❌ Smart Notifications Service initialization failed:', error);
      this.isEnabled = false;
      
      await trackAIError({
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: 'Smart Notifications Service başlatılamadı',
        severity: ErrorSeverity.HIGH,
        context: { component: 'SmartNotificationService', method: 'initialize' }
      });
      
      throw error;
    }
  }

  private initializeDefaultPreferences(): void {
    // Default notification preferences will be set per user
    console.log('📱 Default notification preferences initialized');
  }

  // =============================================================================
  // 🎯 MAIN NOTIFICATION METHODS
  // =============================================================================

  /**
   * Insight'ı notification'a dönüştür ve schedule et
   */
  async scheduleInsightNotification(
    insight: IntelligentInsight, 
    deliveryContext: DeliveryContext
  ): Promise<SchedulingResult> {
    if (!this.isEnabled) {
      throw new AIError(AIErrorCode.FEATURE_DISABLED, 'Smart Notifications Service is not enabled');
    }

    try {
      // Rate limiting kontrolü
      if (!this.checkRateLimit(deliveryContext.userId, insight.category)) {
        return {
          scheduled: false,
          reason: 'Rate limit exceeded for this category',
          suggestedTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour later
        };
      }

      // Timing analysis
      const optimalTime = this.calculateOptimalDeliveryTime(insight, deliveryContext);
      
      // Delivery method selection
      const deliveryMethod = this.selectOptimalDeliveryMethod(insight, deliveryContext);

      // Content personalization
      const personalizedContent = this.personalizeNotificationContent(insight, deliveryContext);

      // Create notification
      const notification: SmartNotification = {
        id: `insight_${insight.id}_${Date.now()}`,
        userId: deliveryContext.userId,
        category: this.mapInsightCategoryToNotificationCategory(insight.category),
        priority: this.mapInsightPriorityToNotificationPriority(insight.priority),
        
        title: personalizedContent.title,
        message: personalizedContent.message,
        actionText: personalizedContent.actionText,
        actionUrl: `/insights/${insight.id}`,
        customData: { insightId: insight.id },
        
        deliveryMethod,
        scheduledFor: optimalTime,
        expiresAt: insight.validUntil,
        
        triggeredBy: {
          type: 'insight',
          sourceId: insight.id,
          confidence: insight.confidence
        },
        
        targetContext: {
          userMood: deliveryContext.currentContext.userMood,
          appUsageState: deliveryContext.currentContext.isAppActive ? 'active' : 'background',
          lastActivity: deliveryContext.currentContext.lastActivity
        },
        
        createdAt: new Date(),
        dismissed: false
      };

      // Schedule delivery
      this.addToQueue(notification);
      
      // Update rate limits
      this.updateRateLimit(deliveryContext.userId, insight.category);

      // Telemetry
      await trackAIInteraction(AIEventType.NOTIFICATION_SCHEDULED, {
        notificationId: notification.id,
        userId: deliveryContext.userId,
        category: notification.category,
        priority: notification.priority,
        deliveryMethod,
        scheduledFor: optimalTime.toISOString(),
        triggeredBy: 'insight'
      });

      console.log(`📱 Insight notification scheduled for ${optimalTime.toLocaleString()}`);

      return {
        scheduled: true,
        notification,
        reason: 'Successfully scheduled'
      };

    } catch (error) {
      console.error('❌ Failed to schedule insight notification:', error);
      
      await trackAIError({
        code: AIErrorCode.PROCESSING_FAILED,
        message: 'Insight notification scheduling failed',
        severity: ErrorSeverity.MEDIUM,
        context: { 
          component: 'SmartNotificationService', 
          method: 'scheduleInsightNotification',
          insightId: insight.id,
          userId: deliveryContext.userId
        }
      });

      return {
        scheduled: false,
        reason: 'Scheduling failed due to error'
      };
    }
  }

  /**
   * Pattern alert notification schedule et
   */
  async schedulePatternAlert(
    pattern: DetectedPattern,
    deliveryContext: DeliveryContext
  ): Promise<SchedulingResult> {
    if (!this.isEnabled) {
      throw new AIError(AIErrorCode.FEATURE_DISABLED, 'Smart Notifications Service is not enabled');
    }

    try {
      // Critical patterns için immediate delivery
      const isUrgent = pattern.severity === PatternSeverity.CRITICAL || pattern.severity === PatternSeverity.SEVERE;
      
      const notification: SmartNotification = {
        id: `pattern_${pattern.id}_${Date.now()}`,
        userId: deliveryContext.userId,
        category: NotificationCategory.INSIGHT_DELIVERY,
        priority: isUrgent ? 'critical' : 'medium',
        
        title: this.createPatternAlertTitle(pattern),
        message: this.createPatternAlertMessage(pattern),
        actionText: 'İncele',
        actionUrl: `/patterns/${pattern.id}`,
        customData: { patternId: pattern.id },
        
        deliveryMethod: isUrgent ? DeliveryMethod.PUSH_NOTIFICATION : DeliveryMethod.IN_APP_BANNER,
        scheduledFor: isUrgent ? new Date() : this.calculateOptimalDeliveryTime(null, deliveryContext),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        
        triggeredBy: {
          type: 'pattern',
          sourceId: pattern.id,
          confidence: pattern.confidence
        },
        
        targetContext: {
          userMood: deliveryContext.currentContext.userMood,
          appUsageState: deliveryContext.currentContext.isAppActive ? 'active' : 'background',
          lastActivity: deliveryContext.currentContext.lastActivity
        },
        
        createdAt: new Date(),
        dismissed: false
      };

      this.addToQueue(notification);

      // Telemetry
      await trackAIInteraction(AIEventType.NOTIFICATION_SCHEDULED, {
        notificationId: notification.id,
        userId: deliveryContext.userId,
        category: notification.category,
        priority: notification.priority,
        triggeredBy: 'pattern'
      });

      return {
        scheduled: true,
        notification
      };

    } catch (error) {
      console.error('❌ Failed to schedule pattern alert:', error);
      return {
        scheduled: false,
        reason: 'Pattern alert scheduling failed'
      };
    }
  }

  // =============================================================================
  // 🧠 INTELLIGENT SCHEDULING LOGIC
  // =============================================================================

  /**
   * Optimal delivery time hesapla
   */
  private calculateOptimalDeliveryTime(
    insight: IntelligentInsight | null, 
    context: DeliveryContext
  ): Date {
    const now = new Date();
    const prefs = this.getUserPreferences(context.userId);

    // Check quiet hours
    const currentHour = now.getHours();
    const quietStart = parseInt(prefs.quietHours.start.split(':')[0]);
    const quietEnd = parseInt(prefs.quietHours.end.split(':')[0]);
    
    const isQuietHours = (quietStart > quietEnd) ? 
      (currentHour >= quietStart || currentHour < quietEnd) :
      (currentHour >= quietStart && currentHour < quietEnd);

    // If in quiet hours and not crisis, schedule for next preferred time
    if (isQuietHours && (!insight || insight.timing !== InsightTiming.IMMEDIATE)) {
      const nextPreferredTime = this.getNextPreferredTime(prefs);
      if (nextPreferredTime > now) {
        return nextPreferredTime;
      }
    }

    // App usage consideration
    if (prefs.respectAppUsage && context.currentContext.isAppActive) {
      // User is actively using app, delay notification slightly
      return new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
    }

    // Insight timing preferences
    if (insight) {
      switch (insight.timing) {
        case InsightTiming.IMMEDIATE:
          return now;
        case InsightTiming.NEXT_SESSION:
          return this.getNextSessionTime(context);
        case InsightTiming.DAILY_SUMMARY:
          return this.getDailySummaryTime(prefs);
        case InsightTiming.WEEKLY_REVIEW:
          return this.getWeeklyReviewTime(prefs);
        default:
          return new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes default
      }
    }

    // Default: next preferred time or 30 minutes
    const nextPreferred = this.getNextPreferredTime(prefs);
    return nextPreferred > now ? nextPreferred : new Date(now.getTime() + 30 * 60 * 1000);
  }

  /**
   * Optimal delivery method seç
   */
  private selectOptimalDeliveryMethod(
    insight: IntelligentInsight,
    context: DeliveryContext
  ): DeliveryMethod {
    const prefs = this.getUserPreferences(context.userId);

    // High priority insights
    if (insight.priority === InsightPriority.CRITICAL || insight.priority === InsightPriority.HIGH) {
      return prefs.categorySettings[this.mapInsightCategoryToNotificationCategory(insight.category)]?.preferredMethod || 
             DeliveryMethod.PUSH_NOTIFICATION;
    }

    // App active - use in-app methods
    if (context.currentContext.isAppActive) {
      return DeliveryMethod.IN_APP_BANNER;
    }

    // User preference based
    const category = this.mapInsightCategoryToNotificationCategory(insight.category);
    return prefs.categorySettings[category]?.preferredMethod || DeliveryMethod.PUSH_NOTIFICATION;
  }

  /**
   * Notification content'ini kişiselleştir
   */
  private personalizeNotificationContent(
    insight: IntelligentInsight,
    context: DeliveryContext
  ): { title: string; message: string; actionText?: string } {
    const prefs = this.getUserPreferences(context.userId);
    
    // Language adaptation
    const isTurkish = prefs.language === 'tr';
    
    // Tone adaptation
    let title = insight.title;
    let message = insight.message;
    
    if (prefs.tone === 'warm') {
      title = `💙 ${title}`;
      message = `Merhaba! ${message}`;
    } else if (prefs.tone === 'casual') {
      title = `✨ ${title}`;
    }

    // Mood consideration
    if (prefs.adaptToMood && context.currentContext.userMood) {
      if (context.currentContext.userMood === 'anxious') {
        message = `Sakin kalın. ${message}`;
      } else if (context.currentContext.userMood === 'positive') {
        title = `🌟 ${title}`;
      }
    }

    // Cultural context
    if (prefs.culturalContext === 'turkish') {
      // Add Turkish cultural elements if needed
    }

    const actionText = isTurkish ? 'Görüntüle' : 'View';

    return { title, message, actionText };
  }

  // =============================================================================
  // 🔧 HELPER METHODS
  // =============================================================================

  private checkRateLimit(userId: string, category: InsightCategory): boolean {
    const prefs = this.getUserPreferences(userId);
    const notificationCategory = this.mapInsightCategoryToNotificationCategory(category);
    const maxPerDay = prefs.categorySettings[notificationCategory]?.maxPerDay || 5;

    const rateLimitKey = `${userId}_${notificationCategory}`;
    const limit = this.rateLimits.get(rateLimitKey);
    const now = Date.now();

    if (!limit) {
      this.rateLimits.set(rateLimitKey, { count: 0, resetTime: now + 24 * 60 * 60 * 1000 });
      return true;
    }

    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + 24 * 60 * 60 * 1000;
    }

    return limit.count < maxPerDay;
  }

  private updateRateLimit(userId: string, category: InsightCategory): void {
    const notificationCategory = this.mapInsightCategoryToNotificationCategory(category);
    const rateLimitKey = `${userId}_${notificationCategory}`;
    const limit = this.rateLimits.get(rateLimitKey);
    
    if (limit) {
      limit.count++;
    }
  }

  private addToQueue(notification: SmartNotification): void {
    const queue = this.notificationQueue.get(notification.userId) || [];
    queue.push(notification);
    this.notificationQueue.set(notification.userId, queue);
  }

  private getUserPreferences(userId: string): NotificationPreferences {
    return this.userPreferences.get(userId) || this.getDefaultPreferences(userId);
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      enabled: true,
      quietHours: {
        start: "22:00",
        end: "08:00"
      },
      categorySettings: {
        [NotificationCategory.INSIGHT_DELIVERY]: {
          enabled: true,
          maxPerDay: 3,
          preferredMethod: DeliveryMethod.PUSH_NOTIFICATION,
          allowQuietHours: false
        },
        [NotificationCategory.PROGRESS_CELEBRATION]: {
          enabled: true,
          maxPerDay: 5,
          preferredMethod: DeliveryMethod.PUSH_NOTIFICATION,
          allowQuietHours: true
        },
        [NotificationCategory.THERAPEUTIC_REMINDER]: {
          enabled: true,
          maxPerDay: 2,
          preferredMethod: DeliveryMethod.GENTLE_POPUP,
          allowQuietHours: false
        },
        [NotificationCategory.SKILL_PRACTICE]: {
          enabled: true,
          maxPerDay: 3,
          preferredMethod: DeliveryMethod.IN_APP_BANNER,
          allowQuietHours: false
        },
        [NotificationCategory.CHECK_IN]: {
          enabled: true,
          maxPerDay: 2,
          preferredMethod: DeliveryMethod.PUSH_NOTIFICATION,
          allowQuietHours: false
        },
        [NotificationCategory.EDUCATIONAL]: {
          enabled: true,
          maxPerDay: 1,
          preferredMethod: DeliveryMethod.EMAIL_DIGEST,
          allowQuietHours: true
        }
      },
      preferredTimes: ["09:00", "14:00", "19:00"],
      timezone: "Europe/Istanbul",
      respectAppUsage: true,
      adaptToMood: true,
      crisisOverride: true,
      tone: 'warm',
      language: 'tr',
      culturalContext: 'turkish'
    };
  }

  private getNextPreferredTime(prefs: NotificationPreferences): Date {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (const timeStr of prefs.preferredTimes) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const preferredTime = new Date(today.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000);
      
      if (preferredTime > now) {
        return preferredTime;
      }
    }
    
    // If no preferred time today, use first preferred time tomorrow
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const [hours, minutes] = prefs.preferredTimes[0].split(':').map(Number);
    return new Date(tomorrow.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000);
  }

  private getNextSessionTime(context: DeliveryContext): Date {
    // Estimate next session based on user behavior
    const lastActivity = context.currentContext.lastActivity;
    const averageSessionGap = 6 * 60 * 60 * 1000; // 6 hours default
    return new Date(lastActivity.getTime() + averageSessionGap);
  }

  private getDailySummaryTime(prefs: NotificationPreferences): Date {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const summaryTime = new Date(today.getTime() + 19 * 60 * 60 * 1000); // 19:00
    
    return summaryTime > now ? summaryTime : new Date(summaryTime.getTime() + 24 * 60 * 60 * 1000);
  }

  private getWeeklyReviewTime(prefs: NotificationPreferences): Date {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const daysUntilSunday = (7 - dayOfWeek) % 7;
    const nextSunday = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000);
    return new Date(nextSunday.setHours(10, 0, 0, 0)); // Sunday 10:00
  }

  // Mapping functions
  private mapInsightCategoryToNotificationCategory(category: InsightCategory): NotificationCategory {
    const mapping = {
      [InsightCategory.PATTERN_RECOGNITION]: NotificationCategory.INSIGHT_DELIVERY,
      [InsightCategory.PROGRESS_TRACKING]: NotificationCategory.PROGRESS_CELEBRATION,
      [InsightCategory.THERAPEUTIC_GUIDANCE]: NotificationCategory.THERAPEUTIC_REMINDER,
      [InsightCategory.BEHAVIORAL_ANALYSIS]: NotificationCategory.INSIGHT_DELIVERY,
      [InsightCategory.EMOTIONAL_STATE]: NotificationCategory.CHECK_IN,
      [InsightCategory.CRISIS_PREVENTION]: NotificationCategory.THERAPEUTIC_REMINDER,
      [InsightCategory.SKILL_DEVELOPMENT]: NotificationCategory.SKILL_PRACTICE,
      [InsightCategory.RELAPSE_PREVENTION]: NotificationCategory.THERAPEUTIC_REMINDER
    } as const;
    return (mapping as any)[category] || NotificationCategory.INSIGHT_DELIVERY;
  }

  private mapInsightPriorityToNotificationPriority(priority: InsightPriority): SmartNotification['priority'] {
    const mapping = {
      [InsightPriority.CRITICAL]: 'critical' as const,
      [InsightPriority.HIGH]: 'high' as const,
      [InsightPriority.MEDIUM]: 'medium' as const,
      [InsightPriority.LOW]: 'low' as const,
      [InsightPriority.INFO]: 'low' as const
    };
    return mapping[priority] || 'medium';
  }

  private createPatternAlertTitle(pattern: DetectedPattern): string {
    const severityEmojis = {
      [PatternSeverity.CRITICAL]: '🚨',
      [PatternSeverity.SEVERE]: '⚠️',
      [PatternSeverity.MODERATE]: '📊',
      [PatternSeverity.MILD]: '💡',
      [PatternSeverity.MINIMAL]: 'ℹ️'
    };
    
    return `${severityEmojis[pattern.severity]} ${pattern.name}`;
  }

  private createPatternAlertMessage(pattern: DetectedPattern): string {
    return `${pattern.description} Bu konuda size yardımcı olabilirim.`;
  }

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  /**
   * Service durumunu kontrol et
   */
  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_SMART_NOTIFICATIONS');
  }

  /**
   * User preferences güncelle
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    const current = this.getUserPreferences(userId);
    const updated = { ...current, ...preferences };
    this.userPreferences.set(userId, updated);
    
    await trackAIInteraction(AIEventType.NOTIFICATION_PREFERENCES_UPDATED, {
      userId,
      changedSettings: Object.keys(preferences)
    });
  }

  /**
   * Notification'ı delivered olarak işaretle
   */
  async markNotificationDelivered(notificationId: string, userId: string): Promise<void> {
    const queue = this.notificationQueue.get(userId) || [];
    const notification = queue.find(n => n.id === notificationId);
    
    if (notification) {
      notification.sentAt = new Date();
      
      // Move to history
      const history = this.deliveryHistory.get(userId) || [];
      history.push(notification);
      this.deliveryHistory.set(userId, history);
      
      // Remove from queue
      const updatedQueue = queue.filter(n => n.id !== notificationId);
      this.notificationQueue.set(userId, updatedQueue);
    }
  }

  /**
   * Notification feedback kaydet
   */
  async recordNotificationFeedback(
    notificationId: string,
    userId: string,
    feedback: 'helpful' | 'not_helpful' | 'annoying'
  ): Promise<void> {
    const history = this.deliveryHistory.get(userId) || [];
    const notification = history.find(n => n.id === notificationId);
    
    if (notification && notification.effectiveness) {
      notification.effectiveness.userFeedback = feedback;
      
      await trackAIInteraction(AIEventType.NOTIFICATION_FEEDBACK, {
        notificationId,
        userId,
        feedback,
        category: notification.category
      });
    }
  }

  /**
   * Service'i temizle
   */
  async shutdown(): Promise<void> {
    console.log('📱 Smart Notifications Service: Shutting down...');
    this.isEnabled = false;
    this.notificationQueue.clear();
    this.userPreferences.clear();
    this.deliveryHistory.clear();
    this.rateLimits.clear();
    
    await trackAIInteraction(AIEventType.SMART_NOTIFICATIONS_SHUTDOWN, {
      version: '2.0'
    });
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const smartNotificationService = SmartNotificationService.getInstance();
export default smartNotificationService;
// Types ve enum tekrar export edilmiyor; merkezi `features/ai/types/index.ts` üzerinden kullanılmalı.