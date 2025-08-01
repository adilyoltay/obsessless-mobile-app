/**
 * AI Telemetri Sistemi
 * 
 * KRITIK: Feature flag kontrolü her telemetri işleminden önce
 * src/ import'ları yok, sadece mevcut dizinlerden import
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  AITelemetryEvent, 
  AIEventType,
  AIError,
  AIErrorCode 
} from '@/features/ai/types';
import { logger } from '@/utils/logger'; // Use the new logger utility

// Telemetri konfigürasyonu
const TELEMETRY_CONFIG = {
  BATCH_SIZE: 10,
  FLUSH_INTERVAL: 30000, // 30 saniye
  MAX_QUEUE_SIZE: 100,
  STORAGE_KEY: '@ai_telemetry_queue',
  PRIVACY_MODE: 'strict' as const,
  ENABLE_CONSOLE_LOG: __DEV__
};

class AITelemetryService {
  private static instance: AITelemetryService;
  private eventQueue: AITelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isEnabled: boolean = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): AITelemetryService {
    if (!this.instance) {
      this.instance = new AITelemetryService();
    }
    return this.instance;
  }

  private async initialize() {
    // Feature flag kontrolü
    if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
      console.log('[AITelemetry] Disabled - feature flag is off');
      return;
    }

    this.isEnabled = true;
    
    // Kaydedilmiş olayları yükle
    await this.loadQueueFromStorage();
    
    // Periyodik flush başlat
    this.startFlushTimer();
  }

  /**
   * AI etkileşimini takip et
   */
  async trackAIInteraction(
    type: AIEventType,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    // Feature flag kontrolü
    if (!this.isEnabled || !FEATURE_FLAGS.isEnabled('AI_CHAT')) {
      return;
    }

    // Privacy-first: hassas verileri temizle
    const sanitizedMetadata = this.sanitizeMetadata(metadata);

    const event: AITelemetryEvent = {
      eventType: type,
      timestamp: new Date(),
      sessionId: await this.getOrCreateSessionId(),
      metadata: sanitizedMetadata,
      privacy_compliant: true
    };

    // Kuyruğa ekle
    this.addToQueue(event);

    // Kritik olayları hemen gönder
    if (this.isCriticalEvent(type)) {
      await this.flush();
    }
  }

  /**
   * Performans metriği kaydet
   */
  async trackPerformance(
    operation: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    await this.trackAIInteraction(AIEventType.MESSAGE_RECEIVED, {
      operation,
      duration,
      success,
      performance_category: this.categorizePerformance(duration)
    });
  }

  /**
   * Hata takibi
   */
  async trackError(error: AIError): Promise<void> {
    await this.trackAIInteraction(AIEventType.ERROR_OCCURRED, {
      error_code: error.code,
      severity: error.severity,
      fallback_used: !!error.fallbackAction
    });
  }

  /**
   * Kullanıcı memnuniyeti
   */
  async trackSatisfaction(
    rating: number,
    sessionId: string,
    feedback?: string
  ): Promise<void> {
    await this.trackAIInteraction(AIEventType.CONVERSATION_END, {
      satisfaction_rating: rating,
      has_feedback: !!feedback,
      session_duration: await this.getSessionDuration(sessionId)
    });
  }

  /**
   * Terapötik sonuç korelasyonu
   */
  async trackTherapeuticOutcome(
    outcomeType: string,
    improvement: number,
    confidence: number
  ): Promise<void> {
    await this.trackAIInteraction(AIEventType.MESSAGE_RECEIVED, {
      outcome_type: outcomeType,
      improvement_score: improvement,
      confidence_level: confidence,
      clinical_relevance: improvement > 0.5
    });
  }

  // Yardımcı metodlar

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    // İzin verilen alanlar
    const allowedFields = [
      'duration', 'success', 'error_code', 'severity',
      'satisfaction_rating', 'has_feedback', 'session_duration',
      'outcome_type', 'improvement_score', 'confidence_level'
    ];

    for (const [key, value] of Object.entries(metadata)) {
      if (allowedFields.includes(key)) {
        // Sayısal değerleri yuvarla (privacy için)
        if (typeof value === 'number') {
          sanitized[key] = Math.round(value * 10) / 10;
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  private async getOrCreateSessionId(): Promise<string> {
    try {
      let sessionId = await AsyncStorage.getItem('@ai_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('@ai_session_id', sessionId);
      }
      return sessionId;
    } catch {
      return 'anonymous_session';
    }
  }

  private addToQueue(event: AITelemetryEvent): void {
    this.eventQueue.push(event);

    // Maksimum kuyruk boyutu kontrolü
    if (this.eventQueue.length > TELEMETRY_CONFIG.MAX_QUEUE_SIZE) {
      this.eventQueue.shift(); // En eski olayı sil
    }

    // Batch boyutuna ulaştıysa flush et
    if (this.eventQueue.length >= TELEMETRY_CONFIG.BATCH_SIZE) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Burada normalde backend'e gönderim yapılır
      // Şimdilik sadece logluyoruz
      if (TELEMETRY_CONFIG.ENABLE_CONSOLE_LOG) {
        console.log('[AITelemetry] Flushing events:', eventsToSend.length);
      }

      // Storage'ı temizle
      await AsyncStorage.removeItem(TELEMETRY_CONFIG.STORAGE_KEY);
    } catch (error) {
      // Hata durumunda olayları geri ekle
      this.eventQueue = [...eventsToSend, ...this.eventQueue];
      await this.saveQueueToStorage();
    }
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(TELEMETRY_CONFIG.STORAGE_KEY);
      if (stored) {
        this.eventQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[AITelemetry] Failed to load queue:', error);
    }
  }

  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        TELEMETRY_CONFIG.STORAGE_KEY,
        JSON.stringify(this.eventQueue)
      );
    } catch (error) {
      console.error('[AITelemetry] Failed to save queue:', error);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, TELEMETRY_CONFIG.FLUSH_INTERVAL);
  }

  private isCriticalEvent(type: AIEventType): boolean {
    return [
      AIEventType.ERROR_OCCURRED,
      AIEventType.SAFETY_TRIGGERED
    ].includes(type);
  }

  private categorizePerformance(duration: number): string {
    if (duration < 1000) return 'excellent';
    if (duration < 2000) return 'good';
    if (duration < 3000) return 'acceptable';
    return 'poor';
  }

  private async getSessionDuration(sessionId: string): Promise<number> {
    // Basit implementasyon - gerçek uygulamada session başlangıç zamanı saklanmalı
    return Math.floor(Math.random() * 3600); // Saniye cinsinden
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
    this.isEnabled = false;
  }
}

// Singleton instance
const telemetryService = AITelemetryService.getInstance();

// Export edilecek fonksiyonlar
export const trackAIInteraction = (
  type: AIEventType,
  metadata?: Record<string, any>
) => telemetryService.trackAIInteraction(type, metadata);

export const trackAIPerformance = (
  operation: string,
  duration: number,
  success: boolean
) => telemetryService.trackPerformance(operation, duration, success);

export const trackAIError = (error: AIError) => 
  telemetryService.trackError(error);

export const trackAISatisfaction = (
  rating: number,
  sessionId: string,
  feedback?: string
) => telemetryService.trackSatisfaction(rating, sessionId, feedback);

export const trackTherapeuticOutcome = (
  outcomeType: string,
  improvement: number,
  confidence: number
) => telemetryService.trackTherapeuticOutcome(outcomeType, improvement, confidence);

// Cleanup function
export const cleanupAITelemetry = () => telemetryService.destroy(); 