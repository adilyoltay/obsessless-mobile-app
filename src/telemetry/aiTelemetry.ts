/**
 * ObsessLess AI Telemetri Sistemi
 * 
 * Gizlilik odaklı, GDPR/KVKK uyumlu telemetri sistemi.
 * Kullanıcı verilerini anonimleştirir ve minimum veri toplar.
 * "Privacy-First" ilkesine tam uyum sağlar.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { AITelemetryEvent, PrivacyLevel } from '@/ai/types';
import supabaseService from '@/services/supabase';

// Telemetri konfigürasyonu
const TELEMETRY_CONFIG = {
  batchSize: 10,              // Toplu gönderim için olay sayısı
  flushInterval: 60000,       // 60 saniyede bir gönder
  maxRetries: 3,              // Başarısız gönderimler için deneme sayısı
  storageKey: 'ai_telemetry_queue',
  anonymizationSalt: 'obsessless_privacy_salt_2024', // Prod'da env'den alınacak
};

// Telemetri kuyruğu
let telemetryQueue: AITelemetryEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Kullanıcı ID'sini anonimleştirir
 * @param userId Gerçek kullanıcı ID'si
 * @returns Anonimleştirilmiş hash
 */
async function anonymizeUserId(userId: string): Promise<string> {
  const data = userId + TELEMETRY_CONFIG.anonymizationSalt;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data
  );
  return hash.substring(0, 16); // İlk 16 karakter yeterli
}

/**
 * Hassas verileri temizler
 * @param data Temizlenecek veri objesi
 * @returns Temizlenmiş veri
 */
function sanitizeData(data: any): any {
  const sensitivePatterns = [
    /\b\d{10,}\b/g,           // Telefon numaraları
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{11}\b/g,            // TC Kimlik No
    /https?:\/\/[^\s]+/g,     // URL'ler
  ];

  let sanitized = JSON.stringify(data);
  
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return JSON.parse(sanitized);
}

/**
 * AI etkileşimini kaydeder
 * @param event Telemetri olayı
 */
export async function trackAIInteraction(
  action: string,
  data: Record<string, any> = {},
  privacyLevel: PrivacyLevel = 'private'
): Promise<void> {
  try {
    // Ephemeral veriler kaydedilmez
    if (privacyLevel === 'ephemeral') {
      console.log('📊 Ephemeral event, not tracking:', action);
      return;
    }

    // Kullanıcı ID'sini al ve anonimleştir
    const userIdRaw = data.userId || 'anonymous';
    const userId = await anonymizeUserId(userIdRaw);
    
    // Session ID oluştur veya al
    const sessionId = data.sessionId || await getOrCreateSessionId();
    
    // Telemetri olayını oluştur
    const event: AITelemetryEvent = {
      eventId: await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${Date.now()}-${Math.random()}`
      ).then(hash => hash.substring(0, 8)),
      timestamp: new Date(),
      userId,
      sessionId,
      eventType: determineEventType(action),
      data: {
        action,
        duration: data.duration,
        success: data.success !== false,
        errorMessage: data.error,
        metadata: sanitizeData(data.metadata || {}),
      },
      anonymizedData: {
        dayOfWeek: new Date().getDay(),
        hourOfDay: new Date().getHours(),
        messageLength: data.messageLength,
        responseTime: data.responseTime,
        modelUsed: data.model,
      },
    };

    // Kuyruğa ekle
    telemetryQueue.push(event);
    
    // Kuyruk doluysa gönder
    if (telemetryQueue.length >= TELEMETRY_CONFIG.batchSize) {
      await flushTelemetry();
    }
    
    // Timer'ı başlat veya sıfırla
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushTelemetry, TELEMETRY_CONFIG.flushInterval);
    
    // Yerel depolamaya yedekle
    await saveToLocalStorage();
    
  } catch (error) {
    console.error('❌ Telemetry tracking error:', error);
    // Telemetri hataları kullanıcıyı etkilememeli
  }
}

/**
 * Performans metriğini kaydeder
 * @param metric Metrik adı
 * @param value Değer
 * @param metadata Ek bilgiler
 */
export async function trackPerformanceMetric(
  metric: string,
  value: number,
  metadata: Record<string, any> = {}
): Promise<void> {
  await trackAIInteraction(`performance.${metric}`, {
    value,
    ...metadata,
    timestamp: Date.now(),
  });
}

/**
 * Kullanıcı memnuniyetini kaydeder
 * @param rating Memnuniyet puanı (1-5)
 * @param feedback İsteğe bağlı geri bildirim
 */
export async function trackUserSatisfaction(
  rating: number,
  feedback?: string,
  context?: Record<string, any>
): Promise<void> {
  await trackAIInteraction('user.satisfaction', {
    rating,
    feedback: feedback ? '[feedback_provided]' : null, // İçeriği kaydetme
    hasFeedback: !!feedback,
    ...context,
  });
}

/**
 * Güvenlik olayını kaydeder
 * @param eventType Olay türü
 * @param details Detaylar
 */
export async function trackSafetyEvent(
  eventType: 'crisis_detected' | 'intervention_suggested' | 'emergency_contact',
  details: Record<string, any> = {}
): Promise<void> {
  await trackAIInteraction(`safety.${eventType}`, {
    ...details,
    timestamp: Date.now(),
    severity: details.severity || 'medium',
  }, 'sensitive');
}

/**
 * Model kullanımını kaydeder
 * @param model Model adı
 * @param tokens Token sayısı
 * @param latency Gecikme süresi
 */
export async function trackModelUsage(
  model: string,
  tokens: number,
  latency: number,
  success: boolean
): Promise<void> {
  await trackAIInteraction('model.usage', {
    model,
    tokens,
    latency,
    success,
    timestamp: Date.now(),
  });
}

/**
 * Olay türünü belirler
 */
function determineEventType(action: string): AITelemetryEvent['eventType'] {
  if (action.startsWith('safety.')) return 'safety';
  if (action.startsWith('error.')) return 'error';
  if (action.startsWith('performance.')) return 'performance';
  return 'interaction';
}

/**
 * Session ID oluştur veya mevcut olanı al
 */
async function getOrCreateSessionId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem('ai_session_id');
    if (stored) {
      const { id, timestamp } = JSON.parse(stored);
      // 24 saat geçerliliği kontrol et
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        return id;
      }
    }
    
    // Yeni session ID oluştur
    const newId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Date.now()}-${Math.random()}`
    ).then(hash => hash.substring(0, 16));
    
    await AsyncStorage.setItem('ai_session_id', JSON.stringify({
      id: newId,
      timestamp: Date.now(),
    }));
    
    return newId;
  } catch (error) {
    console.error('Session ID error:', error);
    return 'error-session';
  }
}

/**
 * Telemetri kuyruğunu Supabase'e gönder
 */
async function flushTelemetry(): Promise<void> {
  if (telemetryQueue.length === 0) return;
  
  const eventsToSend = [...telemetryQueue];
  telemetryQueue = []; // Kuyruğu temizle
  
  try {
    // Supabase'e toplu gönderim
    await supabaseService.saveTelemetryBatch(eventsToSend);
    console.log(`📊 Flushed ${eventsToSend.length} telemetry events`);
    
    // Başarılı gönderimden sonra yerel depolamayı temizle
    await AsyncStorage.removeItem(TELEMETRY_CONFIG.storageKey);
    
  } catch (error) {
    console.error('❌ Telemetry flush error:', error);
    
    // Başarısız olursa kuyruğa geri ekle
    telemetryQueue = [...eventsToSend, ...telemetryQueue];
    
    // Yerel depolamaya kaydet
    await saveToLocalStorage();
  }
}

/**
 * Telemetri kuyruğunu yerel depolamaya kaydet
 */
async function saveToLocalStorage(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      TELEMETRY_CONFIG.storageKey,
      JSON.stringify(telemetryQueue)
    );
  } catch (error) {
    console.error('Local storage error:', error);
  }
}

/**
 * Uygulama başladığında bekleyen telemetrileri yükle
 */
export async function initializeTelemetry(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(TELEMETRY_CONFIG.storageKey);
    if (stored) {
      telemetryQueue = JSON.parse(stored);
      console.log(`📊 Loaded ${telemetryQueue.length} pending telemetry events`);
      
      // Bekleyen olayları gönder
      if (telemetryQueue.length > 0) {
        setTimeout(flushTelemetry, 5000); // 5 saniye sonra gönder
      }
    }
  } catch (error) {
    console.error('Telemetry initialization error:', error);
  }
}

/**
 * Telemetri sistemini temizle (logout vb. için)
 */
export async function clearTelemetry(): Promise<void> {
  telemetryQueue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await AsyncStorage.removeItem(TELEMETRY_CONFIG.storageKey);
  await AsyncStorage.removeItem('ai_session_id');
}

// Supabase servisine eklenmesi gereken fonksiyon (mock)
declare module '@/services/supabase' {
  interface SupabaseService {
    saveTelemetryBatch(events: AITelemetryEvent[]): Promise<void>;
  }
}

// Export telemetri özeti fonksiyonu
export async function getTelemetrySummary(): Promise<{
  queuedEvents: number;
  sessionId: string;
  lastFlush: Date | null;
}> {
  const sessionId = await getOrCreateSessionId();
  return {
    queuedEvents: telemetryQueue.length,
    sessionId,
    lastFlush: null, // TODO: Implement last flush tracking
  };
} 