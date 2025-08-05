/**
 * AI Configuration Manager
 * 
 * KRITIK: Tüm AI özellikleri feature flag arkasında olmalı
 * Her özellik için rollback mekanizması mevcut
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  AIConfig, 
  AIError, 
  AIErrorCode,
  AISafetyCheck,
  SafetyViolation 
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';

// Varsayılan konfigürasyon
const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 1000,
  systemPrompt: 'Sen empatik ve destekleyici bir terapötik asistansın.',
  fallbackBehavior: 'generic',
  featureFlag: 'AI_CHAT',
  safetyThreshold: 0.8,
  privacyMode: 'strict'
};

// Konfigürasyon limitleri
const CONFIG_LIMITS = {
  temperature: { min: 0, max: 2 },
  maxTokens: { min: 50, max: 4000 },
  safetyThreshold: { min: 0.5, max: 1 }
};

export class AIManager {
  private static instance: AIManager;
  private enabled: boolean = false;
  private config: AIConfig = DEFAULT_CONFIG;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): AIManager {
    if (!this.instance) {
      this.instance = new AIManager();
    }
    return this.instance;
  }

  /**
   * AI sistemini başlat
   */
  async initialize(): Promise<void> {
    // Çoklu initialization'ı önle
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    console.log('[AIManager] Initializing...');

    // Tüm ön koşulları kontrol et
    if (!this.checkPrerequisites()) {
      console.log('[AIManager] Prerequisites not met, AI features disabled');
      await trackAIInteraction(AIEventType.FEATURE_DISABLED, {
        reason: 'prerequisites_not_met'
      });
      return;
    }

    try {
      // Kaydedilmiş konfigürasyonu yükle
      await this.loadConfiguration();

      // Güvenlik kontrolü
      const safetyCheck = await this.performSafetyCheck();
      if (!safetyCheck.passed) {
        throw new Error('Safety check failed');
      }

      // Başarılı initialization
      this.enabled = true;
      await trackAIInteraction(AIEventType.FEATURE_ENABLED, {
        config: this.getSanitizedConfig()
      });
      
      console.log('[AIManager] Initialization successful');
    } catch (error) {
      console.error('[AIManager] Initialization failed:', error);
      await this.handleInitializationError(error as Error);
    }
  }

  /**
   * Ön koşulları kontrol et
   */
  private checkPrerequisites(): boolean {
    // Feature flag kontrolü
    if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
      console.log('[AIManager] AI_CHAT feature flag is disabled');
      return false;
    }

    // Environment kontrolü
    if (!this.checkEnvironment()) {
      console.log('[AIManager] Environment check failed');
      return false;
    }

    // Bağımlılık kontrolü
    if (!this.checkDependencies()) {
      console.log('[AIManager] Dependencies check failed');
      return false;
    }

    // Import hataları kontrolü
    if (!this.checkImportIntegrity()) {
      console.log('[AIManager] Import integrity check failed');
      return false;
    }

    return true;
  }

  private checkEnvironment(): boolean {
    // API key kontrolü (environment variable)
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    return !!apiKey && apiKey.length > 0;
  }

  private checkDependencies(): boolean {
    // Gerekli modüllerin yüklü olduğunu kontrol et
    try {
      require('@react-native-async-storage/async-storage');
      return true;
    } catch {
      return false;
    }
  }

  private checkImportIntegrity(): boolean {
    // src/ dizini import kontrolü (basit kontrol)
    // Gerçek kontrolü import-guard script yapıyor
    return true;
  }

  /**
   * Güvenlik kontrolü
   */
  private async performSafetyCheck(): Promise<AISafetyCheck> {
    const violations: SafetyViolation[] = [];

    // API key güvenliği
    if (this.config.provider === 'openai' && !process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
      violations.push({
        type: 'privacy_leak',
        severity: 'high',
        description: 'API key not found',
        suggestedAction: 'Add EXPO_PUBLIC_OPENAI_API_KEY to environment'
      });
    }

    // Model güvenliği
    if (this.config.temperature > 1.5) {
      violations.push({
        type: 'therapeutic_boundary',
        severity: 'medium',
        description: 'Temperature too high for therapeutic context',
        suggestedAction: 'Reduce temperature to <= 1.5'
      });
    }

    const passed = violations.length === 0;
    const score = passed ? 1 : 1 - (violations.length * 0.2);

    return {
      passed,
      score: Math.max(0, score),
      violations,
      recommendations: violations.map(v => v.suggestedAction)
    };
  }

  /**
   * Konfigürasyon yönetimi
   */
  async updateConfig(updates: Partial<AIConfig>): Promise<void> {
    if (!this.enabled) {
      throw this.createError(
        AIErrorCode.FEATURE_DISABLED,
        'AI features are disabled'
      );
    }

    // Validasyon
    this.validateConfigUpdates(updates);

    // Güncelle
    this.config = { ...this.config, ...updates };

    // Kaydet
    await this.saveConfiguration();

    // Telemetri
    await trackAIInteraction(AIEventType.MESSAGE_SENT, {
      action: 'config_updated',
      updates: Object.keys(updates)
    });
  }

  private validateConfigUpdates(updates: Partial<AIConfig>): void {
    if (updates.temperature !== undefined) {
      const { min, max } = CONFIG_LIMITS.temperature;
      if (updates.temperature < min || updates.temperature > max) {
        throw this.createError(
          AIErrorCode.INVALID_RESPONSE,
          `Temperature must be between ${min} and ${max}`
        );
      }
    }

    if (updates.maxTokens !== undefined) {
      const { min, max } = CONFIG_LIMITS.maxTokens;
      if (updates.maxTokens < min || updates.maxTokens > max) {
        throw this.createError(
          AIErrorCode.INVALID_RESPONSE,
          `Max tokens must be between ${min} and ${max}`
        );
      }
    }
  }

  /**
   * Konfigürasyon persistence
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('@ai_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.error('[AIManager] Failed to load config:', error);
      // Varsayılan konfigürasyonu kullan
    }
  }

  private async saveConfiguration(): Promise<void> {
    try {
      await AsyncStorage.setItem('@ai_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('[AIManager] Failed to save config:', error);
    }
  }

  /**
   * Acil durum kapatma
   */
  async shutdown(): Promise<void> {
    console.warn('[AIManager] Emergency shutdown initiated');

    // AI özelliklerini kapat
    this.enabled = false;
    
    // Feature flag'leri kapat
    FEATURE_FLAGS.disableAll();

    // Telemetri
    await trackAIInteraction(AIEventType.FEATURE_DISABLED, {
      reason: 'emergency_shutdown'
    });

    // Kaynakları temizle
    this.config = DEFAULT_CONFIG;
    this.initializationPromise = null;

    console.log('[AIManager] Shutdown complete');
  }

  /**
   * Yardımcı metodlar
   */
  isEnabled(): boolean {
    return this.enabled && FEATURE_FLAGS.isEnabled('AI_CHAT');
  }

  getConfig(): Readonly<AIConfig> {
    return { ...this.config };
  }

  private getSanitizedConfig(): Record<string, any> {
    // Hassas bilgileri çıkar
    const { systemPrompt, ...sanitized } = this.config;
    return sanitized;
  }

  private createError(
    code: AIErrorCode,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): AIError {
    const error = new Error(message) as AIError;
    error.code = code;
    error.severity = severity;
    error.userMessage = this.getUserFriendlyMessage(code);
    return error;
  }

  private getUserFriendlyMessage(code: AIErrorCode): string {
    const messages: Record<AIErrorCode, string> = {
      [AIErrorCode.FEATURE_DISABLED]: 'AI özellikleri şu anda kullanılamıyor.',
      [AIErrorCode.NETWORK_ERROR]: 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.',
      [AIErrorCode.RATE_LIMIT]: 'Çok fazla istek. Lütfen biraz bekleyin.',
      [AIErrorCode.INVALID_RESPONSE]: 'Geçersiz yanıt. Lütfen tekrar deneyin.',
      [AIErrorCode.SAFETY_VIOLATION]: 'Güvenlik kontrolü başarısız.',
      [AIErrorCode.PRIVACY_VIOLATION]: 'Gizlilik ayarlarınız bu işleme izin vermiyor.',
      [AIErrorCode.MODEL_ERROR]: 'AI modeli hatası.',
      [AIErrorCode.UNKNOWN]: 'Beklenmeyen bir hata oluştu.'
    };
    return messages[code] || messages[AIErrorCode.UNKNOWN];
  }

  private async handleInitializationError(error: Error): Promise<void> {
    const aiError = this.createError(
      AIErrorCode.UNKNOWN,
      error.message,
      'critical'
    );

    await trackAIError(aiError);
    
    // Otomatik rollback
    await this.shutdown();
  }

  /**
   * A/B Test desteği
   */
  async getExperimentConfig(experimentName: string): Promise<any> {
    // Basit A/B test implementasyonu
    // Gerçek uygulamada remote config servisi kullanılmalı
    const experiments = {
      'chat_ui_variant': {
        control: 'simple',
        variants: ['simple', 'advanced'],
        allocation: 0.1
      }
    };

    return experiments[experimentName] || null;
  }

  /**
   * Performans monitoring
   */
  async reportPerformance(metric: string, value: number): Promise<void> {
    if (!this.enabled) return;

    // Basit performans raporu
    console.log(`[AIManager] Performance: ${metric} = ${value}ms`);
    
    // Telemetri ile entegre
    if (value > 3000) {
      console.warn(`[AIManager] Slow performance detected: ${metric}`);
    }
  }
}

// Singleton export
export const aiManager = AIManager.getInstance(); 