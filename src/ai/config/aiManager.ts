/**
 * ObsessLess AI Konfigürasyon Yöneticisi
 * 
 * Merkezi AI yapılandırma sistemi. Ortam değişkenlerine göre
 * model ayarları, fallback zincirleri ve A/B testlerini yönetir.
 * "Güç Kullanıcıdadır" ilkesine uygun olarak kullanıcı tercihlerini önceliklendirir.
 */

import { AIConfig, ModelFallback, ABTestConfig } from '@/ai/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ortam değişkenleri (production'da .env'den gelecek)
const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  AI_PRIMARY_PROVIDER: process.env.AI_PRIMARY_PROVIDER || 'openai',
  AI_PRIMARY_MODEL: process.env.AI_PRIMARY_MODEL || 'gpt-4-turbo-preview',
  AI_FALLBACK_ENABLED: process.env.AI_FALLBACK_ENABLED !== 'false',
  AI_TELEMETRY_ENABLED: process.env.AI_TELEMETRY_ENABLED !== 'false',
  EMERGENCY_HOTLINE: process.env.EMERGENCY_HOTLINE || '988', // US Suicide Prevention Lifeline
};

// Varsayılan AI konfigürasyonu
const DEFAULT_CONFIG: AIConfig = {
  model: {
    provider: 'openai',
    name: 'gpt-4-turbo-preview',
    temperature: 0.7,         // Dengeli yaratıcılık
    maxTokens: 1000,
    topP: 0.9,
    frequencyPenalty: 0.3,    // Tekrarları azalt
    presencePenalty: 0.3,     // Çeşitliliği artır
  },
  
  safety: {
    enableCrisisDetection: true,
    enableContentFiltering: true,
    maxConversationLength: 100,  // Mesaj sayısı
    sessionTimeout: 30,          // 30 dakika
    emergencyContacts: [
      {
        name: 'Ulusal İntihar Önleme Hattı',
        number: '988',
        type: 'hotline',
      },
      {
        name: 'Kriz Destek Hattı',
        number: '741741',
        type: 'hotline',
      },
    ],
  },
  
  privacy: {
    storeConversations: true,    // Kullanıcı onayı ile
    anonymizeData: true,
    dataRetentionDays: 30,       // 30 gün
    allowAnalytics: false,       // Varsayılan olarak kapalı
    encryptionEnabled: true,
  },
  
  personalization: {
    therapyStyle: 'cbt',         // Cognitive Behavioral Therapy
    communicationTone: 'empathetic',
    preferredLanguage: 'tr',
    culturalContext: 'turkish',
  },
};

// Model fallback zincirleri
const MODEL_FALLBACKS: Record<string, ModelFallback> = {
  'gpt-4-turbo-preview': {
    primary: 'gpt-4-turbo-preview',
    fallbacks: [
      {
        model: 'gpt-3.5-turbo',
        condition: 'rate_limit',
        priority: 1,
      },
      {
        model: 'claude-3-opus',
        condition: 'error',
        priority: 2,
      },
      {
        model: 'gpt-3.5-turbo',
        condition: 'cost',
        priority: 3,
      },
    ],
  },
  'claude-3-opus': {
    primary: 'claude-3-opus',
    fallbacks: [
      {
        model: 'claude-3-sonnet',
        condition: 'rate_limit',
        priority: 1,
      },
      {
        model: 'gpt-4-turbo-preview',
        condition: 'error',
        priority: 2,
      },
    ],
  },
};

// A/B test konfigürasyonları
const AB_TESTS: ABTestConfig[] = [
  {
    testId: 'tone-experiment-2024',
    name: 'İletişim Tonu Deneyi',
    variants: [
      {
        id: 'control',
        weight: 50,
        config: {
          personalization: {
            communicationTone: 'empathetic',
          },
        },
      },
      {
        id: 'friendly',
        weight: 50,
        config: {
          personalization: {
            communicationTone: 'friendly',
          },
        },
      },
    ],
    metrics: ['user_satisfaction', 'session_duration', 'return_rate'],
    startDate: new Date('2024-01-01'),
  },
];

// Singleton instance
let configInstance: AIConfigManager | null = null;

/**
 * AI Konfigürasyon Yöneticisi Sınıfı
 */
export class AIConfigManager {
  private config: AIConfig;
  private userPreferences: Partial<AIConfig> = {};
  private activeABTests: Map<string, string> = new Map();
  
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadUserPreferences();
    this.initializeABTests();
  }
  
  /**
   * Singleton instance döndürür
   */
  static getInstance(): AIConfigManager {
    if (!configInstance) {
      configInstance = new AIConfigManager();
    }
    return configInstance;
  }
  
  /**
   * Mevcut konfigürasyonu döndürür
   */
  getConfig(): AIConfig {
    // Kullanıcı tercihlerini üzerine uygula
    return this.mergeConfigs(this.config, this.userPreferences);
  }
  
  /**
   * Belirli bir ayarı günceller
   */
  async updateConfig(updates: Partial<AIConfig>): Promise<void> {
    this.userPreferences = this.mergeConfigs(this.userPreferences, updates);
    await this.saveUserPreferences();
  }
  
  /**
   * Model için fallback zincirini döndürür
   */
  getFallbackChain(model: string): ModelFallback {
    return MODEL_FALLBACKS[model] || {
      primary: model,
      fallbacks: [],
    };
  }
  
  /**
   * Ortama göre model seçer
   */
  getModelForEnvironment(): string {
    if (ENV.NODE_ENV === 'development') {
      // Development'ta daha ucuz model kullan
      return 'gpt-3.5-turbo';
    }
    
    // A/B test varsa onun modelini kullan
    const testVariant = this.getActiveABTestVariant('model-experiment');
    if (testVariant) {
      return testVariant.config.model?.name || ENV.AI_PRIMARY_MODEL;
    }
    
    return ENV.AI_PRIMARY_MODEL;
  }
  
  /**
   * Güvenlik ayarlarını döndürür
   */
  getSafetySettings(): AIConfig['safety'] {
    const config = this.getConfig();
    
    // Kullanıcının kriz geçmişi varsa daha hassas ayarlar
    const userRiskLevel = this.getUserRiskLevel();
    if (userRiskLevel === 'high') {
      return {
        ...config.safety,
        sessionTimeout: 15, // Daha kısa timeout
        enableCrisisDetection: true, // Zorla aç
      };
    }
    
    return config.safety;
  }
  
  /**
   * Gizlilik ayarlarını döndürür
   */
  getPrivacySettings(): AIConfig['privacy'] {
    const config = this.getConfig();
    
    // GDPR/KVKK uyumluluğu için Avrupa'da farklı ayarlar
    if (this.isEuropeanUser()) {
      return {
        ...config.privacy,
        dataRetentionDays: 14, // Daha kısa saklama
        anonymizeData: true,   // Zorla anonimleştir
      };
    }
    
    return config.privacy;
  }
  
  /**
   * Terapi stilini kullanıcı profiline göre önerir
   */
  async recommendTherapyStyle(userProfile: any): Promise<AIConfig['personalization']['therapyStyle']> {
    // TODO: Kullanıcı profiline göre ML modeli ile öneri
    // Şimdilik basit kural tabanlı
    
    if (userProfile.age < 25) {
      return 'act'; // Genç kullanıcılar için ACT
    }
    
    if (userProfile.preferredApproach) {
      return userProfile.preferredApproach;
    }
    
    return 'cbt'; // Varsayılan CBT
  }
  
  /**
   * A/B test varyantını döndürür
   */
  getActiveABTestVariant(testId: string): ABTestConfig['variants'][0] | null {
    const test = AB_TESTS.find(t => t.testId === testId);
    if (!test) return null;
    
    // Kullanıcı için seçilmiş varyantı al
    let variantId = this.activeABTests.get(testId);
    
    if (!variantId) {
      // Rastgele varyant seç
      variantId = this.selectABTestVariant(test);
      this.activeABTests.set(testId, variantId);
    }
    
    return test.variants.find(v => v.id === variantId) || null;
  }
  
  /**
   * Telemetri ayarlarını kontrol eder
   */
  isTelemetryEnabled(): boolean {
    const config = this.getConfig();
    return ENV.AI_TELEMETRY_ENABLED && config.privacy.allowAnalytics;
  }
  
  /**
   * Acil durum iletişim bilgilerini döndürür
   */
  getEmergencyContacts(): AIConfig['safety']['emergencyContacts'] {
    const config = this.getConfig();
    const contacts = [...config.safety.emergencyContacts];
    
    // Kullanıcının kendi acil durum kişilerini ekle
    const userContacts = this.getUserEmergencyContacts();
    if (userContacts.length > 0) {
      contacts.push(...userContacts);
    }
    
    return contacts;
  }
  
  // Yardımcı metodlar
  
  private async loadUserPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('ai_user_preferences');
      if (stored) {
        this.userPreferences = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  }
  
  private async saveUserPreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'ai_user_preferences',
        JSON.stringify(this.userPreferences)
      );
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  }
  
  private mergeConfigs(base: any, updates: any): any {
    const merged = { ...base };
    
    for (const key in updates) {
      if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
        merged[key] = this.mergeConfigs(merged[key] || {}, updates[key]);
      } else {
        merged[key] = updates[key];
      }
    }
    
    return merged;
  }
  
  private selectABTestVariant(test: ABTestConfig): string {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant.id;
      }
    }
    
    return test.variants[0].id; // Fallback
  }
  
  private getUserRiskLevel(): 'low' | 'medium' | 'high' {
    // TODO: Implement based on user history
    return 'low';
  }
  
  private isEuropeanUser(): boolean {
    // TODO: Implement based on user location
    return false;
  }
  
  private getUserEmergencyContacts(): AIConfig['safety']['emergencyContacts'] {
    // TODO: Load from user profile
    return [];
  }
  
  private initializeABTests(): void {
    // Load active A/B tests for user
    // TODO: Implement persistence
  }
}

// Export singleton instance
export const aiConfig = AIConfigManager.getInstance();

// Export utility functions
export const getAIConfig = () => aiConfig.getConfig();
export const updateAIConfig = (updates: Partial<AIConfig>) => aiConfig.updateConfig(updates);
export const getModelFallback = (model: string) => aiConfig.getFallbackChain(model);
export const getSafetySettings = () => aiConfig.getSafetySettings();
export const getPrivacySettings = () => aiConfig.getPrivacySettings();
export const isTelemetryEnabled = () => aiConfig.isTelemetryEnabled(); 