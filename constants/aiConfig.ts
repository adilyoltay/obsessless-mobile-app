/**
 * AI Configuration for ObsessLess App
 * Centralized AI provider settings and prompt management
 */

import { FEATURE_FLAGS, AI_CONFIG } from './featureFlags';

// AI Provider Types
export type AIProvider = 'openai' | 'gemini' | 'claude';

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
}

// Environment-based AI Configuration
export const getAIConfig = (): {
  provider: AIProvider;
  config: AIProviderConfig;
} => {
  const provider = (process.env.EXPO_PUBLIC_AI_PROVIDER || process.env.AI_PROVIDER || AI_CONFIG.DEFAULT_PROVIDER) as AIProvider;
  
  const configs: Record<AIProvider, AIProviderConfig> = {
    openai: {
      apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || 'demo-key-disabled',
      model: process.env.EXPO_PUBLIC_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseURL: 'https://api.openai.com/v1',
      timeout: parseInt(process.env.AI_CHAT_TIMEOUT || '30000'),
      maxTokens: parseInt(process.env.AI_CHAT_MAX_TOKENS || '1000'),
      temperature: parseFloat(process.env.AI_CHAT_TEMPERATURE || '0.7'),
    },
    gemini: {
      apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'demo-key-disabled',
      model: process.env.EXPO_PUBLIC_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      timeout: parseInt(process.env.AI_CHAT_TIMEOUT || '30000'),
      maxTokens: parseInt(process.env.AI_CHAT_MAX_TOKENS || '1000'),
      temperature: parseFloat(process.env.AI_CHAT_TEMPERATURE || '0.7'),
    },
    claude: {
      apiKey: process.env.EXPO_PUBLIC_CLAUDE_API_KEY || 'demo-key-disabled',
      model: process.env.EXPO_PUBLIC_CLAUDE_MODEL || process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      baseURL: 'https://api.anthropic.com',
      timeout: parseInt(process.env.AI_CHAT_TIMEOUT || '30000'),
      maxTokens: parseInt(process.env.AI_CHAT_MAX_TOKENS || '1000'),
      temperature: parseFloat(process.env.AI_CHAT_TEMPERATURE || '0.7'),
    },
  };

  return {
    provider,
    config: configs[provider],
  };
};

// OKB Uzmanı Sistem Prompt'u - Özelleştirilebilir
export const OKB_SPECIALIST_SYSTEM_PROMPT = `Sen ObsessLess uygulamasının AI asistanısın ve Obsesif Kompulsif Bozukluk (OKB) konusunda uzman bir terapistsin.

ROL VE KİMLİK:
- OKB konusunda deneyimli, empatik ve sabırlı bir uzman terapist
- Kullanıcıların duygusal ihtiyaçlarını anlayan, yargılamayan bir destek sağlayıcı
- Bilimsel kanıta dayalı, CBT ve ERP yöntemlerini uygulayan bir rehber
- Türkçe konuşan, kültürel duyarlılığa sahip bir AI asistan

UZMANLUK ALANLARI:
1. Obsesif Kompulsif Bozukluk (OKB) tanı ve tedavi bilgisi
2. Bilişsel Davranışçı Terapi (CBT) teknikleri
3. Maruz Kalma ve Tepki Önleme (ERP) egzersizleri
4. Anksiyete ve stres yönetimi
5. Mindfulness ve nefes teknikleri
6. Motivasyonel görüşme teknikleri

İLETİŞİM STİLİ:
- Empatik, anlayışlı ve sabırlı bir ton
- Yargılamayan, destekleyici bir yaklaşım
- Umutsuzluğa karşı umut veren, cesaretlendirici mesajlar
- Kullanıcının kendi gücünü hatırlatan ifadeler
- Bilimsel bilgiyi anlaşılır şekilde aktaran açıklamalar

SINIRLAR VE GÜVENLİK:
- Kendine zarar verme riski tespit ettiğinde derhal profesyonel yardım öner
- Tıbbi tanı koymayacağını, sadece destek verdiğini belirt
- Acil durumlarda crisis hotline'larını öner
- Profesyonel terapi desteğinin önemini vurgula

YANIT YAPISI:
1. Duygusal doğrulama ve empati
2. Durumun normalleştirilmesi (varsa)
3. Pratik öneriler veya teknikler
4. Cesaretlendirici kapanış mesajı
5. Gerekirse sonraki adım önerileri

ÖRNEİ BAŞLANGIC CÜMLELERI:
- "Bu duygularınızı paylaştığınız için cesursunuz..."
- "OKB ile yaşamak kolay değil, ama siz yalnız değilsiniz..."
- "Bu düşünceler sizin gerçek kendinizi yansıtmaz..."
- "Bugün küçük bir adım atmak bile büyük bir başarıdır..."

ÖNEMLİ: Her zaman kullanıcının kendi gücünü ve iyileşme kapasitesini vurgula. Umutsuzluk yerine umut, çaresizlik yerine güçlenme mesajları ver.`;

// Chat Context Types
export interface ChatContext {
  userProfile?: {
    ocdSymptoms: string[];
    severityLevel: number;
    triggerAreas: string[];
    copingStrategies: string[];
  };
  sessionHistory: {
    sessionType: 'chat' | 'erp' | 'assessment';
    timestamp: Date;
    summary: string;
  }[];
  currentMood?: 'anxious' | 'calm' | 'frustrated' | 'hopeful' | 'neutral';
  recentCompulsions?: {
    type: string;
    intensity: number;
    timestamp: Date;
  }[];
}

// Prompt Templates - Özelleştirilebilir
export const PROMPT_TEMPLATES = {
  // Genel chat prompt
  GENERAL_CHAT: (userMessage: string, context?: ChatContext) => `
${OKB_SPECIALIST_SYSTEM_PROMPT}

KULLANICI PROFİLİ:
${context?.userProfile ? `
- OKB Belirtileri: ${context.userProfile.ocdSymptoms.join(', ')}
- Şiddet Düzeyi: ${context.userProfile.severityLevel}/10
- Tetikleyici Alanlar: ${context.userProfile.triggerAreas.join(', ')}
- Başa Çıkma Stratejileri: ${context.userProfile.copingStrategies.join(', ')}
` : 'Profil bilgisi henüz mevcut değil.'}

GÜNCEL DURUM:
${context?.currentMood ? `- Ruh Hali: ${context.currentMood}` : ''}
${context?.recentCompulsions?.length ? `- Son Kompulsiyonlar: ${context.recentCompulsions.length} adet` : ''}

KULLANICI MESAJI:
"${userMessage}"

Lütfen yukarıdaki sistem prompt'una göre empatik, bilimsel ve destekleyici bir yanıt ver.`,

  // Kriz durumu prompt'u
  CRISIS_SUPPORT: (userMessage: string, context?: ChatContext) => `
${OKB_SPECIALIST_SYSTEM_PROMPT}

⚠️ KRİZ DURUMU TESPİT EDİLDİ ⚠️

KULLANICI MESAJI: "${userMessage}"

ACIL DURUM PROTOKOLÜ:
1. Önce kullanıcının güvenliğini sağla
2. Derhal profesyonel yardım öner
3. Crisis hotline numaralarını paylaş
4. Kullanıcıyı sakinleştirici teknikler öner
5. Yalnız olmadığını vurgula

Lütfen KRİZ MÜDAHALE protokolüne göre HEMEN yanıt ver.`,

  // ERP seansı sonrası
  POST_ERP_SESSION: (sessionData: any, context?: ChatContext) => `
${OKB_SPECIALIST_SYSTEM_PROMPT}

ERP SEANS SONRASI DEĞERLENDİRME:
- Süre: ${sessionData.duration} dakika
- Başlangıç Anksiyete: ${sessionData.startAnxiety}/10
- Bitiş Anksiyete: ${sessionData.endAnxiety}/10
- Tamamlanma Durumu: ${sessionData.completed ? 'Tamamlandı' : 'Yarıda Bırakıldı'}

Lütfen bu ERP seansını değerlendir ve kullanıcıyı cesaretlendir. Habituation sürecini açıkla ve gelecek adımları öner.`,
} as const;

// API Response Interface
export interface AIResponse {
  success: boolean;
  message: string;
  provider: AIProvider;
  model: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  timestamp: Date;
  error?: string;
} 