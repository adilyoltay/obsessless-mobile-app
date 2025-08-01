/**
 * ObsessLess AI Tipleri ve Arayüzleri
 * 
 * Bu dosya, AI sisteminin temel veri yapılarını tanımlar.
 * "Dijital Sığınak" vizyonu ve "Privacy-First" ilkesine uygun olarak,
 * tüm veri yapıları gizlilik ve güvenlik odaklı tasarlanmıştır.
 */

// Mesaj rolleri - Terapötik yaklaşıma uygun roller
export type AIRole = 'user' | 'assistant' | 'system' | 'therapist_note';

// Mesaj türleri - Çeşitli etkileşim biçimleri
export type MessageType = 
  | 'text' 
  | 'suggestion' 
  | 'insight' 
  | 'crisis_support' 
  | 'exercise_prompt'
  | 'reflection'
  | 'encouragement';

// Gizlilik seviyeleri - Veri hassasiyeti sınıflandırması
export type PrivacyLevel = 
  | 'public'        // Anonim istatistikler için
  | 'private'       // Kullanıcıya özel, şifreli
  | 'sensitive'     // Ekstra koruma gerektiren
  | 'ephemeral';    // Geçici, saklanmayan

// AI mesaj arayüzü
export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  type: MessageType;
  timestamp: Date;
  
  // Metadata - İzleme ve analiz için
  metadata?: {
    model?: string;           // Kullanılan AI modeli
    processingTime?: number;  // İşlem süresi (ms)
    confidence?: number;      // Güven skoru (0-1)
    intent?: string;          // Algılanan niyet
    emotion?: string;         // Algılanan duygu durumu
    privacyLevel: PrivacyLevel;
  };
  
  // Güvenlik işaretçileri
  safety?: {
    isCrisisDetected: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
    flaggedKeywords?: string[];
    suggestedActions?: string[];
  };
  
  // Kullanıcı etkileşimi
  userFeedback?: {
    helpful: boolean;
    rating?: number;
    comment?: string;
  };
}

// AI konfigürasyon arayüzü
export interface AIConfig {
  // Model ayarları
  model: {
    provider: 'openai' | 'anthropic' | 'local';
    name: string;
    temperature: number;      // 0-1 arası, yaratıcılık seviyesi
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  
  // Güvenlik ayarları
  safety: {
    enableCrisisDetection: boolean;
    enableContentFiltering: boolean;
    maxConversationLength: number;
    sessionTimeout: number;   // Dakika cinsinden
    emergencyContacts: {
      name: string;
      number: string;
      type: 'hotline' | 'personal' | 'professional';
    }[];
  };
  
  // Gizlilik ayarları
  privacy: {
    storeConversations: boolean;
    anonymizeData: boolean;
    dataRetentionDays: number;
    allowAnalytics: boolean;
    encryptionEnabled: boolean;
  };
  
  // Kişiselleştirme
  personalization: {
    therapyStyle: 'cbt' | 'act' | 'mindfulness' | 'mixed';
    communicationTone: 'formal' | 'friendly' | 'empathetic';
    preferredLanguage: string;
    culturalContext?: string;
  };
}

// Konuşma bağlamı - Sohbetin durumunu takip eder
export interface ConversationContext {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActiveTime: Date;
  
  // Konuşma durumu
  state: {
    mood: 'positive' | 'neutral' | 'anxious' | 'distressed' | 'crisis';
    topics: string[];         // Konuşulan konular
    exercises: string[];      // Önerilen egzersizler
    insights: string[];       // Verilen içgörüler
  };
  
  // OKB bağlamı
  ocdContext: {
    currentObsessions: string[];
    recentCompulsions: string[];
    triggerPatterns: string[];
    copingStrategies: string[];
    progressIndicators: {
      anxietyLevel: number;   // 1-10
      resistanceSuccess: number; // Yüzde
      insightLevel: number;   // 1-5
    };
  };
  
  // Güvenlik takibi
  safetyTracking: {
    crisisFlags: number;      // Kriz uyarı sayısı
    lastCrisisCheck: Date;
    interventionsSuggested: string[];
    professionalReferralMade: boolean;
  };
  
  // Performans metrikleri
  metrics: {
    messageCount: number;
    averageResponseTime: number;
    userEngagementScore: number;
    therapeuticProgress: number;
  };
}

// Prompt şablonu arayüzü
export interface PromptTemplate {
  id: string;
  name: string;
  category: 'greeting' | 'exercise' | 'insight' | 'crisis' | 'closing';
  template: string;
  variables: string[];        // Şablonda kullanılan değişkenler
  tone: 'supportive' | 'encouraging' | 'calming' | 'directive';
  
  // Kullanım koşulları
  conditions?: {
    minAnxietyLevel?: number;
    maxAnxietyLevel?: number;
    requiredTopics?: string[];
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  };
}

// AI yanıt arayüzü
export interface AIResponse {
  message: AIMessage;
  suggestions?: string[];     // Takip soruları veya öneriler
  exercises?: {
    id: string;
    title: string;
    duration: number;
    type: 'erp' | 'mindfulness' | 'breathing' | 'journaling';
  }[];
  resources?: {
    title: string;
    url: string;
    type: 'article' | 'video' | 'audio' | 'app';
  }[];
}

// Telemetri olayı arayüzü
export interface AITelemetryEvent {
  eventId: string;
  timestamp: Date;
  userId: string;             // Anonimleştirilmiş
  sessionId: string;
  eventType: 'interaction' | 'error' | 'performance' | 'safety';
  
  data: {
    action: string;
    duration?: number;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  };
  
  // Gizlilik uyumlu veri
  anonymizedData: {
    dayOfWeek: number;
    hourOfDay: number;
    messageLength?: number;
    responseTime?: number;
    modelUsed?: string;
  };
}

// Hata yönetimi
export interface AIError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  context?: Record<string, any>;
  userMessage: string;        // Kullanıcıya gösterilecek mesaj
  technicalDetails?: string;  // Geliştirici için detaylar
}

// Model fallback zinciri
export interface ModelFallback {
  primary: string;
  fallbacks: {
    model: string;
    condition: 'error' | 'timeout' | 'rate_limit' | 'cost';
    priority: number;
  }[];
}

// A/B test konfigürasyonu
export interface ABTestConfig {
  testId: string;
  name: string;
  variants: {
    id: string;
    weight: number;           // 0-100 arası ağırlık
    config: Partial<AIConfig>;
  }[];
  metrics: string[];          // İzlenecek metrikler
  startDate: Date;
  endDate?: Date;
} 