/**
 * Adaptive ERP Session Management
 * 
 * Kullanıcının durumuna göre kendini uyarlayan ERP sistemi
 * Real-time difficulty adjustment ve biometric feedback integration
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  AIError,
  AIErrorCode,
  ErrorSeverity
} from '@/features/ai/types';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// ERP Zorluk Seviyeleri
export enum ERPDifficultyLevel {
  BEGINNER = 1,
  EASY = 2,
  MODERATE = 3,
  CHALLENGING = 4,
  ADVANCED = 5,
  EXPERT = 6
}

// ERP Session Durumları
export enum ERPSessionState {
  PREPARATION = 'preparation',
  BASELINE = 'baseline',
  EXPOSURE = 'exposure',
  PEAK_ANXIETY = 'peak_anxiety',
  HABITUATION = 'habituation',
  COMPLETION = 'completion',
  CRISIS_EXIT = 'crisis_exit'
}

// Biometric Data Types
export interface BiometricData {
  heartRate?: number;
  heartRateVariability?: number;
  respirationRate?: number;
  skinConductance?: number;
  bodyTemperature?: number;
  accelerometer?: {
    x: number;
    y: number;
    z: number;
  };
  timestamp: Date;
}

// ERP Adaptation Parameters
export interface ERPAdaptationParams {
  anxietyThreshold: {
    min: number; // Minimum anxiety for effective exposure
    max: number; // Maximum safe anxiety level
    optimal: number; // Optimal anxiety for learning
  };
  timingConstraints: {
    minExposureDuration: number; // dakika
    maxExposureDuration: number; // dakika
    habitationThreshold: number; // % anxiety reduction
  };
  safetyLimits: {
    maxAnxietySpike: number;
    emergencyExitConditions: string[];
  };
  personalization: {
    learningRate: number; // How quickly to adapt (0-1)
    preferredPacing: 'slow' | 'moderate' | 'fast';
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  };
}

// Adaptive ERP Session
export interface AdaptiveERPSession {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  category: string;
  
  // Current State
  currentState: ERPSessionState;
  currentDifficulty: ERPDifficultyLevel;
  currentAnxiety: number; // 0-10 scale
  
  // Session Configuration
  targetDuration: number; // dakika
  adaptationParams: ERPAdaptationParams;
  
  // Real-time Data
  anxietyTimeline: { timestamp: Date; level: number; source: 'self_report' | 'biometric' | 'predicted' }[];
  biometricData: BiometricData[];
  adaptationHistory: {
    timestamp: Date;
    action: 'difficulty_increased' | 'difficulty_decreased' | 'pacing_adjusted' | 'safety_intervention';
    reason: string;
    beforeValue: any;
    afterValue: any;
  }[];
  
  // Session Progress
  startTime: Date;
  expectedEndTime: Date;
  actualEndTime?: Date;
  peakAnxietyTime?: Date;
  habitationStartTime?: Date;
  
  // Outcomes
  successMetrics: {
    anxietyReduction: number; // %
    exposureTolerance: number; // dakika
    habitationAchieved: boolean;
    userSatisfaction?: number; // 1-10
    therapeuticGain?: number; // Clinical assessment
  };
  
  // Safety & Crisis Management
  safetyEvents: {
    timestamp: Date;
    type: 'high_anxiety' | 'panic_symptoms' | 'user_request_exit' | 'biometric_alert';
    action: 'monitoring' | 'intervention' | 'session_pause' | 'emergency_exit';
    resolved: boolean;
  }[];
  
  // AI Coaching
  aiGuidance: {
    timestamp: Date;
    message: string;
    type: 'encouragement' | 'technique' | 'breathing' | 'grounding' | 'safety';
    effectiveness?: 'helpful' | 'neutral' | 'unhelpful';
  }[];
}

class AdaptiveERPService {
  private static instance: AdaptiveERPService;
  private activeSessions: Map<string, AdaptiveERPSession> = new Map();
  private userERPProfiles: Map<string, any> = new Map();
  
  static getInstance(): AdaptiveERPService {
    if (!this.instance) {
      this.instance = new AdaptiveERPService();
    }
    return this.instance;
  }

  /**
   * Adaptif ERP session başlat
   */
  async startAdaptiveSession(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    category: string,
    userPreferences?: Partial<ERPAdaptationParams>
  ): Promise<AdaptiveERPSession> {
    
    // Kullanıcı profili yükle
    const userProfile = await this.loadUserERPProfile(userId);
    
    // Adaptation parametrelerini kişiselleştir
    const adaptationParams = this.createPersonalizedParams(userProfile, userPreferences);
    
    // Başlangıç zorluk seviyesini belirle
    const initialDifficulty = this.calculateInitialDifficulty(userProfile, exerciseId);
    
    const session: AdaptiveERPSession = {
      id: `erp_${Date.now()}_${userId}`,
      userId,
      exerciseId,
      exerciseName,
      category,
      currentState: ERPSessionState.PREPARATION,
      currentDifficulty: initialDifficulty,
      currentAnxiety: 0,
      targetDuration: this.calculateTargetDuration(initialDifficulty, userProfile),
      adaptationParams,
      anxietyTimeline: [],
      biometricData: [],
      adaptationHistory: [],
      startTime: new Date(),
      expectedEndTime: new Date(Date.now() + this.calculateTargetDuration(initialDifficulty, userProfile) * 60 * 1000),
      successMetrics: {
        anxietyReduction: 0,
        exposureTolerance: 0,
        habitationAchieved: false
      },
      safetyEvents: [],
      aiGuidance: []
    };

    this.activeSessions.set(session.id, session);
    
    // Initial AI guidance
    await this.provideAIGuidance(session, 'Hoş geldiniz! Bu ERP seansında size özel olarak rehberlik edeceğim. Hazır olduğunuzda başlayalım.', 'encouragement');
    
    // Track ERP session start (using generic session event type)
    await trackAIInteraction(AIEventType.CHAT_SESSION_STARTED, {
      sessionId: session.id,
      exerciseId,
      initialDifficulty,
      targetDuration: session.targetDuration
    });

    return session;
  }

  /**
   * Anxiety seviyesini güncelle ve adaptasyon yap
   */
  async updateAnxietyLevel(
    sessionId: string,
    anxietyLevel: number,
    source: 'self_report' | 'biometric' | 'predicted' = 'self_report',
    biometricData?: BiometricData
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      const error: AIError = {
        code: AIErrorCode.SESSION_NOT_FOUND,
        message: 'ERP session bulunamadı',
        timestamp: new Date(),
        severity: 'medium' as any,
        recoverable: true
      };
      throw error;
    }

    // Anxiety timeline'ına ekle
    session.anxietyTimeline.push({
      timestamp: new Date(),
      level: anxietyLevel,
      source
    });

    // Biometric data varsa ekle
    if (biometricData) {
      session.biometricData.push(biometricData);
    }

    // Mevcut anxiety'yi güncelle
    const previousAnxiety = session.currentAnxiety;
    session.currentAnxiety = anxietyLevel;

    // Real-time adaptation logic
    await this.performRealTimeAdaptation(session, previousAnxiety, anxietyLevel);

    // Safety check
    await this.performSafetyCheck(session, anxietyLevel);

    // Session state güncellemesi
    await this.updateSessionState(session);

    // Session'ı kaydet
    await this.saveSession(session);
  }

  /**
   * Real-time adaptation gerçekleştir
   */
  private async performRealTimeAdaptation(
    session: AdaptiveERPSession,
    previousAnxiety: number,
    currentAnxiety: number
  ): Promise<void> {
    const params = session.adaptationParams;
    const anxietyChange = currentAnxiety - previousAnxiety;
    const timeSinceStart = (Date.now() - session.startTime.getTime()) / (1000 * 60); // dakika

    // Anxiety çok düşükse zorluk artır
    if (currentAnxiety < params.anxietyThreshold.min && session.currentState === ERPSessionState.EXPOSURE) {
      if (session.currentDifficulty < ERPDifficultyLevel.EXPERT) {
        await this.increaseDifficulty(session, 'Anxiety seviyesi optimal eğitim için çok düşük');
      }
    }

    // Anxiety çok yüksekse zorluk azalt
    if (currentAnxiety > params.anxietyThreshold.max) {
      if (session.currentDifficulty > ERPDifficultyLevel.BEGINNER) {
        await this.decreaseDifficulty(session, 'Anxiety seviyesi güvenlik sınırını aştı');
      }
      
      // Safety intervention logic (legacy crisis removal)
      if (currentAnxiety >= params.anxietyThreshold.max + 1) {
        await this.triggerSafetyIntervention(session);
      }
    }

    // Habituation detection
    if (session.currentState === ERPSessionState.PEAK_ANXIETY) {
      const recentAnxiety = session.anxietyTimeline.slice(-5); // Son 5 ölçüm
      if (recentAnxiety.length >= 3) {
        const trend = this.calculateAnxietyTrend(recentAnxiety);
        if (trend < -0.3) { // %30 düşüş trendi
          session.currentState = ERPSessionState.HABITUATION;
          session.habitationStartTime = new Date();
          await this.provideAIGuidance(session, 'Harika! Anksiyetenizin azaldığını görüyorum. Bu habituation süreci - vücudunuz duruma alışıyor.', 'encouragement');
        }
      }
    }

    // Pacing adjustment
    if (params.personalization.preferredPacing === 'slow' && anxietyChange > 2) {
      await this.adjustPacing(session, 'slower');
    } else if (params.personalization.preferredPacing === 'fast' && anxietyChange < 0.5 && timeSinceStart > 5) {
      await this.adjustPacing(session, 'faster');
    }
  }

  /**
   * Safety kontrolü gerçekleştir
   */
  private async performSafetyCheck(
    session: AdaptiveERPSession,
    currentAnxiety: number
  ): Promise<void> {
    const safetyLimits = session.adaptationParams.safetyLimits;

    // High anxiety alert
    if (currentAnxiety >= 8.5) {
      session.safetyEvents.push({
        timestamp: new Date(),
        type: 'high_anxiety',
        action: 'monitoring',
        resolved: false
      });

      await this.provideAIGuidance(
        session,
        'Anksiyete seviyen yüksek. Derin nefes alalım. 4 saniye nefes al, 4 saniye tut, 4 saniye ver.',
        'breathing'
      );
    }

    // Safety threshold intervention
    if (currentAnxiety >= session.adaptationParams.anxietyThreshold.max + 1) {
      await this.triggerSafetyIntervention(session);
    }

    // Biometric alerts
    const latestBiometric = session.biometricData.slice(-1)[0];
    if (latestBiometric) {
      if (latestBiometric.heartRate && latestBiometric.heartRate > 130) {
        session.safetyEvents.push({
          timestamp: new Date(),
          type: 'biometric_alert',
          action: 'intervention',
          resolved: false
        });

        await this.provideAIGuidance(
          session,
          'Nabzınız hızlandı. Biraz yavaşlayalım ve rahatlatıcı teknikler yapalım.',
          'technique'
        );
      }
    }
  }

  /**
   * Kriz müdahalesi tetikle
   */
  private async triggerSafetyIntervention(session: AdaptiveERPSession): Promise<void> {
    session.safetyEvents.push({
      timestamp: new Date(),
      type: 'panic_symptoms',
      action: 'emergency_exit',
      resolved: false
    });

    session.currentState = ERPSessionState.COMPLETION;

    await this.provideAIGuidance(
      session,
      'Şu anda güvendesiniz. Bu session\'ı güvenli bir şekilde sonlandırıyoruz. 5-4-3-2-1 grounding tekniği yapalım.',
      'safety'
    );

    // Crisis trigger oluştur (fallback if service not available)
    // Note: conversationTriggerService will be integrated when triggers module is available
    console.log('Crisis trigger logged locally:', { 
      sessionId: session.id, 
      userId: session.userId, 
      trigger: 'erp_crisis_exit' 
    });

    // Session'ı güvenli şekilde sonlandır
    await this.safelyEndSession(session);
  }

  /**
   * Zorluk seviyesini artır
   */
  private async increaseDifficulty(session: AdaptiveERPSession, reason: string): Promise<void> {
    const oldDifficulty = session.currentDifficulty;
    session.currentDifficulty = Math.min(session.currentDifficulty + 1, ERPDifficultyLevel.EXPERT);

    session.adaptationHistory.push({
      timestamp: new Date(),
      action: 'difficulty_increased',
      reason,
      beforeValue: oldDifficulty,
      afterValue: session.currentDifficulty
    });

    await this.provideAIGuidance(
      session,
      'Harika ilerliyorsunuz! Egzersizi biraz daha zorlayacağız. Bununla başa çıkabileceğinize inanıyorum.',
      'encouragement'
    );
  }

  /**
   * Zorluk seviyesini azalt
   */
  private async decreaseDifficulty(session: AdaptiveERPSession, reason: string): Promise<void> {
    const oldDifficulty = session.currentDifficulty;
    session.currentDifficulty = Math.max(session.currentDifficulty - 1, ERPDifficultyLevel.BEGINNER);

    session.adaptationHistory.push({
      timestamp: new Date(),
      action: 'difficulty_decreased',
      reason,
      beforeValue: oldDifficulty,
      afterValue: session.currentDifficulty
    });

    await this.provideAIGuidance(
      session,
      'Biraz yavaşlayalım. Bu normal ve uygun. Kendi hızınızda ilerlemek önemli.',
      'encouragement'
    );
  }

  /**
   * Pacing ayarla
   */
  private async adjustPacing(session: AdaptiveERPSession, direction: 'slower' | 'faster'): Promise<void> {
    const adjustment = direction === 'slower' ? 1.2 : 0.8;
    const newDuration = session.targetDuration * adjustment;
    
    session.adaptationHistory.push({
      timestamp: new Date(),
      action: 'pacing_adjusted',
      reason: `Pacing ${direction} için ayarlandı`,
      beforeValue: session.targetDuration,
      afterValue: newDuration
    });

    session.targetDuration = newDuration;
    session.expectedEndTime = new Date(session.startTime.getTime() + newDuration * 60 * 1000);
  }

  /**
   * AI rehberlik sağla
   */
  private async provideAIGuidance(
    session: AdaptiveERPSession,
    message: string,
    type: 'encouragement' | 'technique' | 'breathing' | 'grounding' | 'safety'
  ): Promise<void> {
    session.aiGuidance.push({
      timestamp: new Date(),
      message,
      type
    });

    // Burada gerçek UI'ya mesaj gönderilecek
    // App state management ile entegre edilecek
  }

  /**
   * Session durumunu güncelle
   */
  private async updateSessionState(session: AdaptiveERPSession): Promise<void> {
    const timeSinceStart = (Date.now() - session.startTime.getTime()) / (1000 * 60);
    const currentAnxiety = session.currentAnxiety;

    switch (session.currentState) {
      case ERPSessionState.PREPARATION:
        if (timeSinceStart > 2) { // 2 dakika hazırlık
          session.currentState = ERPSessionState.BASELINE;
          await this.provideAIGuidance(session, 'Baseline ölçümünü alalım. Şu andaki anksiyete seviyen nedir?', 'technique');
        }
        break;

      case ERPSessionState.BASELINE:
        if (currentAnxiety > 0 && timeSinceStart > 3) {
          session.currentState = ERPSessionState.EXPOSURE;
          await this.provideAIGuidance(session, 'Exposure başlıyor. Hazır olduğunuzda devam edelim.', 'encouragement');
        }
        break;

      case ERPSessionState.EXPOSURE:
        if (currentAnxiety >= session.adaptationParams.anxietyThreshold.optimal) {
          session.currentState = ERPSessionState.PEAK_ANXIETY;
          session.peakAnxietyTime = new Date();
        }
        break;

      case ERPSessionState.HABITUATION:
        const habitationDuration = session.habitationStartTime ? 
          (Date.now() - session.habitationStartTime.getTime()) / (1000 * 60) : 0;
        
        if (habitationDuration > 5 && currentAnxiety < session.adaptationParams.anxietyThreshold.min) {
          session.currentState = ERPSessionState.COMPLETION;
          session.successMetrics.habitationAchieved = true;
        }
        break;
    }
  }

  // Yardımcı metodlar
  private createPersonalizedParams(
    userProfile: any,
    userPreferences?: Partial<ERPAdaptationParams>
  ): ERPAdaptationParams {
    const defaultParams: ERPAdaptationParams = {
      anxietyThreshold: {
        min: 4,
        max: 8,
        optimal: 6
      },
      timingConstraints: {
        minExposureDuration: 10,
        maxExposureDuration: 45,
        habitationThreshold: 30
      },
      safetyLimits: {
        maxAnxietySpike: 3,
        crisisDetectionLevel: 9,
        emergencyExitConditions: ['user_request', 'biometric_alert', 'time_limit']
      },
      personalization: {
        learningRate: 0.1,
        preferredPacing: 'moderate',
        riskTolerance: 'moderate'
      }
    };

    // User preferences ile merge et
    return { ...defaultParams, ...userPreferences };
  }

  private calculateInitialDifficulty(userProfile: any, exerciseId: string): ERPDifficultyLevel {
    // Kullanıcının geçmiş performansına göre başlangıç zorluğu belirle
    const baseLevel = userProfile?.averageDifficulty || ERPDifficultyLevel.EASY;
    const exerciseHistory = userProfile?.exerciseHistory?.[exerciseId];
    
    if (exerciseHistory?.successRate > 0.8) {
      return Math.min(baseLevel + 1, ERPDifficultyLevel.EXPERT);
    } else if (exerciseHistory?.successRate < 0.5) {
      return Math.max(baseLevel - 1, ERPDifficultyLevel.BEGINNER);
    }
    
    return baseLevel;
  }

  private calculateTargetDuration(difficulty: ERPDifficultyLevel, userProfile: any): number {
    const baseDurations = {
      [ERPDifficultyLevel.BEGINNER]: 15,
      [ERPDifficultyLevel.EASY]: 20,
      [ERPDifficultyLevel.MODERATE]: 25,
      [ERPDifficultyLevel.CHALLENGING]: 30,
      [ERPDifficultyLevel.ADVANCED]: 35,
      [ERPDifficultyLevel.EXPERT]: 40
    };

    return baseDurations[difficulty];
  }

  private calculateAnxietyTrend(recentData: any[]): number {
    if (recentData.length < 2) return 0;
    
    const first = recentData[0].level;
    const last = recentData[recentData.length - 1].level;
    
    return (last - first) / first; // Yüzdesel değişim
  }

  private async loadUserERPProfile(userId: string): Promise<any> {
    try {
      const stored = await AsyncStorage.getItem(`erp_profile_${userId}`);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  private async saveSession(session: AdaptiveERPSession): Promise<void> {
    try {
      await AsyncStorage.setItem(`erp_session_${session.id}`, JSON.stringify(session));
    } catch (error) {
      console.error('ERP session kaydedilemedi:', error);
    }
  }

  private async safelyEndSession(session: AdaptiveERPSession): Promise<void> {
    session.actualEndTime = new Date();
    
    // Final metrics hesapla
    if (session.anxietyTimeline.length > 1) {
      const initialAnxiety = session.anxietyTimeline[0].level;
      const finalAnxiety = session.anxietyTimeline[session.anxietyTimeline.length - 1].level;
      session.successMetrics.anxietyReduction = ((initialAnxiety - finalAnxiety) / initialAnxiety) * 100;
    }

    session.successMetrics.exposureTolerance = (Date.now() - session.startTime.getTime()) / (1000 * 60);

    // Session'ı aktif listeden kaldır
    this.activeSessions.delete(session.id);

    // Final save
    await this.saveSession(session);

    // Track ERP session completion (using generic session event type)
    await trackAIInteraction(AIEventType.CHAT_SESSION_ENDED, {
      sessionId: session.id,
      duration: session.successMetrics.exposureTolerance,
      anxietyReduction: session.successMetrics.anxietyReduction,
      habitationAchieved: session.successMetrics.habitationAchieved,
      safetyEvents: session.safetyEvents.length
    });
  }
}

export const adaptiveERPService = AdaptiveERPService.getInstance(); 