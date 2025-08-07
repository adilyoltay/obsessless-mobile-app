/**
 * 🤖 AI Manager - Centralized AI Configuration & Management
 * 
 * Bu sınıf tüm AI özelliklerinin merkezi yönetimini sağlar.
 * FAZ 0 güvenlik prensiplerine uygun olarak tasarlanmıştır.
 * 
 * ⚠️ CRITICAL: Tüm AI özellikleri feature flag'ler arkasında olmalı
 * ⚠️ Rollback mekanizmaları her özellik için mevcut olmalı
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIConfig, 
  AIProvider, 
  FallbackBehavior, 
  AIError, 
  AIErrorCode, 
  ErrorSeverity,
  ConversationContext,
  CrisisRiskLevel 
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

/**
 * Singleton AI Manager - Tüm AI özelliklerinin merkezi kontrolü
 */
export class AIManager {
  private static instance: AIManager;
  private enabled: boolean = false;
  private initialized: boolean = false;
  private configs: Map<string, AIConfig> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  
  // Emergency state
  private emergencyShutdown: boolean = false;
  private lastHealthCheck: Date = new Date();
  
  private constructor() {
    // Private constructor for singleton
    this.setupEmergencyListeners();
  }

  /**
   * Singleton instance getter
   */
  static getInstance(): AIManager {
    if (!this.instance) {
      this.instance = new AIManager();
    }
    return this.instance;
  }

  /**
   * AI Manager başlatma
   */
  async initialize(): Promise<void> {
    console.log('🤖 AIManager: Initialization starting...');
    
    try {
      // Prerequisites kontrolü
      if (!this.checkPrerequisites()) {
        console.log('🚫 AI features disabled: prerequisites not met');
        return;
      }
      
      // Configuration yükleme
      await this.loadConfigurations();
      
      // Health check
      await this.performHealthCheck();
      
      // Gradual initialization
      this.enabled = true;
      this.initialized = true;
      
      console.log('✅ AIManager: Successfully initialized');
      
      // Telemetry
      await trackAIInteraction(AIEventType.SYSTEM_INITIALIZED, {
        timestamp: new Date().toISOString(),
        configs_loaded: this.configs.size
      });
      
    } catch (error) {
      console.error('❌ AIManager: Initialization failed:', error);
      await this.handleInitializationError(error as Error);
    }
  }

  /**
   * Prerequisites kontrolü - AI özelliklerinin çalışması için gerekli koşullar
   */
  private checkPrerequisites(): boolean {
    // Feature flag kontrolü
    if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
      console.log('🚫 AI_CHAT feature flag disabled');
      return false;
    }

    // Environment kontrolü
    if (!this.checkEnvironment()) {
      console.log('🚫 Environment not suitable for AI features');
      return false;
    }

    // Dependencies kontrolü
    if (!this.checkDependencies()) {
      console.log('🚫 Required dependencies not available');
      return false;
    }

    // Global kill switch kontrolü
    if (typeof (global as any).__OBSESSLESS_KILL_SWITCH !== 'undefined') {
      console.log('🚨 Global kill switch activated');
      return false;
    }

    return true;
  }

  /**
   * Environment uygunluk kontrolü
   */
  private checkEnvironment(): boolean {
    // Production'da extra kontroller
    if (!__DEV__) {
      // API keys varlığı
      if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY && 
          !process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY) {
        return false;
      }
    }

    // Network bağlantısı (basit check)
    // TODO: Implement proper network connectivity check
    
    return true;
  }

  /**
   * Dependencies kontrolü
   */
  private checkDependencies(): boolean {
    // Gerekli modüllerin varlığını kontrol et
    try {
      // AsyncStorage availability
      require('@react-native-async-storage/async-storage');
      
      // Feature flags availability
      if (!FEATURE_FLAGS) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Dependencies check failed:', error);
      return false;
    }
  }

  /**
   * AI konfigürasyonlarını yükle
   */
  private async loadConfigurations(): Promise<void> {
    // Default AI Chat configuration
    const chatConfig: AIConfig = {
      provider: this.getPreferredProvider(),
      model: this.getModelForProvider(this.getPreferredProvider()),
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: this.getTherapeuticSystemPrompt(),
      fallbackBehavior: FallbackBehavior.GENERIC_RESPONSE,
      featureFlag: 'AI_CHAT' as keyof typeof FEATURE_FLAGS,
      
      // Safety settings
      safetyThreshold: 0.8,
      crisisDetectionEnabled: true,
      contentFilteringEnabled: true,
      
      // Performance settings
      timeoutMs: 30000,
      retryAttempts: 3,
      cachingEnabled: true
    };

    this.configs.set('chat', chatConfig);

    // AI Insights configuration
    if (FEATURE_FLAGS.isEnabled('AI_INSIGHTS')) {
      const insightsConfig: AIConfig = {
        ...chatConfig,
        featureFlag: 'AI_INSIGHTS' as keyof typeof FEATURE_FLAGS,
        temperature: 0.5, // More deterministic for insights
        systemPrompt: this.getInsightsSystemPrompt()
      };
      
      this.configs.set('insights', insightsConfig);
    }

    console.log(`📋 Loaded ${this.configs.size} AI configurations`);
  }

  /**
   * Preferred AI provider belirleme
   */
  private getPreferredProvider(): AIProvider {
    // Environment variable'dan okuma
    const envProvider = process.env.EXPO_PUBLIC_AI_PROVIDER;
    
    if (envProvider && Object.values(AIProvider).includes(envProvider as AIProvider)) {
      return envProvider as AIProvider;
    }

    // Development'ta mock kullan
    if (__DEV__) {
      return AIProvider.MOCK;
    }

    // Production'da OpenAI default
    return AIProvider.OPENAI;
  }

  /**
   * Provider'a göre model seçimi
   */
  private getModelForProvider(provider: AIProvider): string {
    switch (provider) {
      case AIProvider.OPENAI:
        return 'gpt-4-turbo-preview';
      case AIProvider.ANTHROPIC:
        return 'claude-3-sonnet-20240229';
      case AIProvider.MOCK:
        return 'mock-model-v1';
      default:
        return 'gpt-3.5-turbo';
    }
  }

  /**
   * Terapötik system prompt
   */
  private getTherapeuticSystemPrompt(): string {
    return `Sen ObsessLess uygulamasının empatik AI asistanısın. 

TEMEL İLKELERİN:
1. 🌸 SAKİNLİK: Her zaman sakin, yumuşak ve rahatlatıcı bir ton kullan
2. 💪 GÜÇLENDİRME: Kullanıcının kendi gücünü ve kontrolünü destekle
3. 🌿 ZAHMETSIZLIK: Basit, anlaşılır ve uygulanabilir öneriler sun

CBT TEKNİKLERİN:
- Sokratik sorular sor
- Düşünce-his-davranış bağlantılarını keşfet
- Kademeli maruz bırakma öner
- Güçlü yönleri vurgula

GÜVENLİK KURALLARIN:
- Kriz belirtileri için sürekli dikkatli ol
- Profesyonel yardım gerektiğinde yönlendir
- Asla tanı koyma veya ilaç önerme
- Kullanıcının güvenliği her şeyden önemli

TÜRKÇE İLETİŞİM:
- Sıcak, samimi ama profesyonel
- Kültürel hassasiyetleri göz önünde bulundur
- Anlaşılır ve açık dil kullan

Her yanıtında umut, destek ve pratik yardım sunmalısın.`;
  }

  /**
   * Insights system prompt
   */
  private getInsightsSystemPrompt(): string {
    return `Sen ObsessLess uygulamasının pattern analizi ve içgörü uzmanısın.

GÖREVİN:
- Kullanıcı verilerindeki kalıpları tespit et
- Anlamlı ve uygulanabilir içgörüler çıkar
- İlerlemeyi vurgula ve motive et
- Kişisel öneriler sun

ANALİZ PRENSİPLERİN:
- Objektif veri analizi yap
- Pozitif değişimleri öncelikle vurgula
- Pratik öneriler sun
- Gizlilik ve güvenliği koru

İÇGÖRÜ TÜRLERİN:
- Kalıp tanıma (tetikleyiciler, zamanlar)
- İlerleme analizi
- Güçlü yön tespiti
- Gelişim alanları
- Kişiselleştirilmiş öneriler

Her içgörün constructive, motivational ve actionable olmalı.`;
  }

  /**
   * Health check - Sistem sağlığını kontrol et
   */
  private async performHealthCheck(): Promise<void> {
    console.log('🔍 AIManager: Performing health check...');
    
    for (const [name, config] of this.configs) {
      try {
        // Feature flag hala aktif mi?
        if (!FEATURE_FLAGS.isEnabled(config.featureFlag)) {
          this.healthStatus.set(name, false);
          continue;
        }
        
        // Provider erişilebilir mi? (basit test)
        const healthy = await this.testProviderHealth(config.provider);
        this.healthStatus.set(name, healthy);
        
      } catch (error) {
        console.error(`Health check failed for ${name}:`, error);
        this.healthStatus.set(name, false);
      }
    }
    
    this.lastHealthCheck = new Date();
    console.log(`✅ Health check completed. Healthy services: ${this.getHealthyServicesCount()}`);
  }

  /**
   * Provider sağlık testi
   */
  private async testProviderHealth(provider: AIProvider): Promise<boolean> {
    switch (provider) {
      case AIProvider.MOCK:
        return true; // Mock provider her zaman healthy
      
      case AIProvider.OPENAI:
        // TODO: Implement OpenAI health check
        return true;
        
      case AIProvider.ANTHROPIC:
        // TODO: Implement Anthropic health check
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Emergency shutdown - Tüm AI özelliklerini güvenli şekilde kapat
   */
  async shutdown(): Promise<void> {
    console.warn('🚨 AIManager: Emergency shutdown initiated');
    
    this.emergencyShutdown = true;
    this.enabled = false;
    
    // Feature flag'leri kapat
    FEATURE_FLAGS.disableAll();
    
    // Aktif bağlantıları kapat
    await this.closeActiveConnections();
    
    // Cache'leri temizle
    await this.clearCaches();
    
    // State'i sıfırla
    this.configs.clear();
    this.healthStatus.clear();
    
    // Telemetry
    await trackAIInteraction(AIEventType.EMERGENCY_SHUTDOWN, {
      timestamp: new Date().toISOString(),
      reason: 'manual_shutdown'
    });
    
    console.warn('🚨 AIManager: Emergency shutdown completed');
  }

  /**
   * AI özelliği kullanım kontrolü
   */
  canUseFeature(featureName: string): boolean {
    // Emergency shutdown kontrolü
    if (this.emergencyShutdown) {
      return false;
    }
    
    // Initialization kontrolü
    if (!this.initialized || !this.enabled) {
      return false;
    }
    
    // Configuration varlığı
    const config = this.configs.get(featureName);
    if (!config) {
      return false;
    }
    
    // Feature flag kontrolü
    if (!FEATURE_FLAGS.isEnabled(config.featureFlag)) {
      return false;
    }
    
    // Health status kontrolü
    const healthy = this.healthStatus.get(featureName);
    if (!healthy) {
      return false;
    }
    
    return true;
  }

  /**
   * Configuration getter
   */
  getConfig(featureName: string): AIConfig | null {
    if (!this.canUseFeature(featureName)) {
      return null;
    }
    
    return this.configs.get(featureName) || null;
  }

  /**
   * Crisis durumda otomatik müdahale
   */
  async handleCrisisDetection(
    context: ConversationContext, 
    riskLevel: CrisisRiskLevel
  ): Promise<void> {
    console.warn(`🚨 Crisis detected: ${riskLevel} for user ${context.userId}`);
    
    // Telemetry
    await trackAIInteraction(AIEventType.CRISIS_DETECTED, {
      userId: context.userId,
      riskLevel,
      timestamp: new Date().toISOString()
    });
    
    // Risk seviyesine göre aksiyon al
    switch (riskLevel) {
      case CrisisRiskLevel.HIGH:
      case CrisisRiskLevel.CRITICAL:
        // Acil müdahale protokolü
        await this.initiateEmergencyProtocol(context);
        break;
        
      case CrisisRiskLevel.MEDIUM:
        // Destekleyici kaynaklar sun
        await this.provideSupportResources(context);
        break;
        
      default:
        // Normal akışa devam et ama izlemeyi artır
        break;
    }
  }

  /**
   * Error handling ve user-friendly mesajlar
   */
  createError(
    code: AIErrorCode, 
    message: string, 
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, any>
  ): AIError {
    return {
      code,
      message,
      context,
      timestamp: new Date(),
      severity,
      recoverable: this.isRecoverableError(code),
      userMessage: this.getUserFriendlyMessage(code)
    };
  }

  /**
   * Error'un kurtarılabilir olup olmadığını kontrol et
   */
  private isRecoverableError(code: AIErrorCode): boolean {
    const recoverableErrors = [
      AIErrorCode.NETWORK_ERROR,
      AIErrorCode.RATE_LIMIT,
      AIErrorCode.MODEL_ERROR
    ];
    
    return recoverableErrors.includes(code);
  }

  /**
   * Kullanıcı dostu error mesajları
   */
  private getUserFriendlyMessage(code: AIErrorCode): string {
    const messages: Record<AIErrorCode, string> = {
      [AIErrorCode.FEATURE_DISABLED]: 'AI özellikleri şu anda kullanılamıyor.',
      [AIErrorCode.NETWORK_ERROR]: 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.',
      [AIErrorCode.RATE_LIMIT]: 'Çok fazla istek. Lütfen biraz bekleyin.',
      [AIErrorCode.INVALID_RESPONSE]: 'Geçersiz yanıt. Lütfen tekrar deneyin.',
      [AIErrorCode.SAFETY_VIOLATION]: 'Güvenlik kontrolü başarısız.',
      [AIErrorCode.PRIVACY_VIOLATION]: 'Gizlilik ayarlarınız bu işleme izin vermiyor.',
      [AIErrorCode.MODEL_ERROR]: 'AI modeli hatası.',
      [AIErrorCode.INITIALIZATION_FAILED]: 'AI sistemi başlatılamadı.',
      [AIErrorCode.PROCESSING_FAILED]: 'İşlem başarısız oldu.',
      [AIErrorCode.RESOURCE_NOT_FOUND]: 'Kaynak bulunamadı.',
      [AIErrorCode.SESSION_NOT_FOUND]: 'Oturum bulunamadı.',
      [AIErrorCode.UNKNOWN]: 'Beklenmeyen bir hata oluştu.'
    };
    return messages[code] || messages[AIErrorCode.UNKNOWN];
  }

  private async handleInitializationError(error: Error): Promise<void> {
    const aiError = this.createError(
      AIErrorCode.UNKNOWN,
      error.message,
      ErrorSeverity.CRITICAL
    );

    await trackAIError(aiError);
    
    // Otomatik rollback
    await this.shutdown();
  }

  /**
   * A/B Test desteği
   */
  getExperimentConfig(experimentName: string): any {
    // Future: A/B testing configurations
    const experiments: Record<string, any> = {
      chat_ui_variant: {
        control: 'default',
        variants: ['minimal', 'enhanced'],
        allocation: 0.5
      }
    };

    return experiments[experimentName] || null;
  }

  /**
   * Private helper methods
   */
  private setupEmergencyListeners(): void {
    // Global kill switch listener
    if (typeof window !== 'undefined') {
      (window as any).obslesslessEmergencyShutdown = () => {
        this.shutdown();
      };
    }
  }

  private async closeActiveConnections(): Promise<void> {
    // TODO: Implement active connection closing
    console.log('🔌 Closing active AI connections...');
  }

  private async clearCaches(): Promise<void> {
    // TODO: Implement cache clearing
    console.log('🧹 Clearing AI caches...');
  }

  private getHealthyServicesCount(): number {
    return Array.from(this.healthStatus.values()).filter(Boolean).length;
  }

  private async initiateEmergencyProtocol(context: ConversationContext): Promise<void> {
    // TODO: Implement emergency protocol
    console.log('🚨 Initiating emergency protocol for user:', context.userId);
  }

  private async provideSupportResources(context: ConversationContext): Promise<void> {
    // TODO: Implement support resources
    console.log('📞 Providing support resources for user:', context.userId);
  }

  /**
   * Getter methods for monitoring
   */
  get isEnabled(): boolean {
    return this.enabled && !this.emergencyShutdown;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get configCount(): number {
    return this.configs.size;
  }

  get lastHealthCheckTime(): Date {
    return this.lastHealthCheck;
  }
}

// Export singleton instance
export const aiManager = AIManager.getInstance();