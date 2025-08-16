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
import Constants from 'expo-constants';
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
      
      // AI Servislerini başlat - YENİ
      await this.initializeAIServices();
      
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
    // Feature flag kontrolü - AI master switch (AI_ENABLED)
    if (!FEATURE_FLAGS.isEnabled('AI_ENABLED')) {
      console.log('🚫 AI master (AI_ENABLED) feature flag disabled');
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
    // Production'da Gemini anahtar kontrolü (Gemini-only)
    if (!__DEV__) {
      const extra: any = Constants.expoConfig?.extra || {};
      const geminiKey = extra.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!geminiKey || /REPLACE_WITH_REAL|REPLACE|your_?api_?key/i.test(String(geminiKey))) {
        console.warn('Gemini API anahtarı bulunamadı veya geçersiz');
        return false;
      }
    }

    // Network bağlantısı (gelecekte geliştirilecek)
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
    // Tek sağlayıcı: Gemini
    return AIProvider.GEMINI;
  }

  /**
   * Provider'a göre model seçimi
   */
  private getModelForProvider(provider: AIProvider): string {
    // Prefer stable Gemini model
    const extra: any = Constants.expoConfig?.extra || {};
    return extra.EXPO_PUBLIC_GEMINI_MODEL || process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash';
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
    // Tek sağlayıcı; health check AI dışı yapılır
    return true;
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
    const messages: Record<any, string> = {
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
      [AIErrorCode.TIMEOUT]: 'İşlem zaman aşımına uğradı.',
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
    console.log('🔌 Closing active AI connections...');
    try {
      // External AI Service
      try {
        const mod = await import('@/features/ai/services/externalAIService');
        await mod.externalAIService?.shutdown?.();
      } catch (e) { if (__DEV__) console.warn('externalAIService shutdown skipped:', e); }

      // Insights Engine V2
      try {
        const mod = await import('@/features/ai/engines/insightsEngineV2');
        await mod.insightsEngineV2?.shutdown?.();
      } catch (e) { if (__DEV__) console.warn('insightsEngineV2 shutdown skipped:', e); }

      // JITAI Engine
      try {
        const mod = await import('@/features/ai/jitai/jitaiEngine');
        await mod.jitaiEngine?.shutdown?.();
      } catch (e) { if (__DEV__) console.warn('jitaiEngine shutdown skipped:', e); }

      // Treatment Planning Engine
      try {
        const mod = await import('@/features/ai/engines/treatmentPlanningEngine');
        await mod.treatmentPlanningEngine?.shutdown?.();
      } catch (e) { if (__DEV__) console.warn('treatmentPlanningEngine shutdown skipped:', e); }

      // Onboarding Engine
      try {
        const mod = await import('@/features/ai/engines/onboardingEngine');
        await mod.onboardingEngine?.shutdown?.();
      } catch (e) { if (__DEV__) console.warn('onboardingEngine shutdown skipped:', e); }

      // Pattern Recognition V2
      try {
        const mod = await import('@/features/ai/services/patternRecognitionV2');
        await mod.patternRecognitionV2?.shutdown?.();
      } catch (e) { if (__DEV__) console.warn('patternRecognitionV2 shutdown skipped:', e); }

      // Context Intelligence
      try {
        const mod = await import('@/features/ai/context/contextIntelligence');
        await mod.contextIntelligence?.shutdown?.();
      } catch (e) { if (__DEV__) console.warn('contextIntelligence shutdown skipped:', e); }

      // Adaptive Interventions
      try {
        const mod = await import('@/features/ai/interventions/adaptiveInterventions');
        await mod.adaptiveInterventions?.shutdown?.();
      } catch (e) { if (__DEV__) console.warn('adaptiveInterventions shutdown skipped:', e); }

    } catch (error) {
      console.warn('⚠️ Some AI connections could not be closed:', error);
    }
  }

  private async clearCaches(): Promise<void> {
    console.log('🧹 Clearing AI caches...');
    try {
      // Clear known AsyncStorage buckets used by AI/telemetry (best-effort)
      try {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.removeItem('ai_telemetry_offline');
      } catch (e) { if (__DEV__) console.warn('AsyncStorage cache clear skipped:', e); }

      // Ask services to clear their internal caches via shutdown or dedicated methods
      try {
        const mod = await import('@/features/ai/services/externalAIService');
        // shutdown already clears internal maps; call again to ensure
        await mod.externalAIService?.shutdown?.();
      } catch {}
    } catch (error) {
      console.warn('⚠️ Cache clearing encountered an issue:', error);
    }
  }

  private async initializeAIServices(): Promise<void> {
    console.log('🚀 Initializing AI services with parallel execution...');
    
    const services = [
      { 
        name: 'externalAI', 
        init: async () => {
          const { externalAIService } = await import('@/features/ai/services/externalAIService');
          if (externalAIService?.initialize) {
            return await externalAIService.initialize();
          }
        },
        critical: true 
      },
      { 
        name: 'cbtEngine', 
        init: async () => {
          const { cbtEngine } = await import('@/features/ai/engines/cbtEngine');
          if (cbtEngine?.initialize) {
            return await cbtEngine.initialize();
          }
        },
        critical: false 
      },
      { 
        name: 'insightsV2', 
        init: async () => {
          const { insightsEngineV2 } = await import('@/features/ai/engines/insightsEngineV2');
          if (insightsEngineV2?.initialize) {
            return await insightsEngineV2.initialize();
          }
        },
        critical: true 
      },
      { 
        name: 'patternV2', 
        init: async () => {
          const { patternRecognitionV2 } = await import('@/features/ai/services/patternRecognitionV2');
          if (patternRecognitionV2?.initialize) {
            return await patternRecognitionV2.initialize();
          }
        },
        critical: false 
      },
      { 
        name: 'smartNotifications', 
        init: async () => {
          const { smartNotificationService } = await import('@/features/ai/services/smartNotifications');
          if (smartNotificationService?.initialize) {
            return await smartNotificationService.initialize();
          }
        },
        critical: false 
      },
      { 
        name: 'therapeuticPrompts', 
        init: async () => {
          const { therapeuticPromptEngine } = await import('@/features/ai/prompts/therapeuticPrompts');
          if (therapeuticPromptEngine?.initialize) {
            return await therapeuticPromptEngine.initialize();
          }
        },
        critical: false 
      }
    ];

    // Paralel başlatma - Promise.allSettled kullan
    const results = await Promise.allSettled(
      services.map(async (service) => {
        try {
          const result = await service.init();
          return { name: service.name, critical: service.critical, success: true, result };
        } catch (error) {
          return { name: service.name, critical: service.critical, success: false, error };
        }
      })
    );

    // Sonuçları değerlendir
    let criticalFailure = false;
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const serviceResult = result.value;
        if (serviceResult.success) {
          console.log(`✅ ${serviceResult.name} initialized successfully`);
          this.healthStatus.set(serviceResult.name, true);
          successCount++;
        } else {
          console.error(`❌ ${serviceResult.name} initialization failed:`, serviceResult.error);
          this.healthStatus.set(serviceResult.name, false);
          failureCount++;
          
          if (serviceResult.critical) {
            criticalFailure = true;
          }
        }
      } else {
        console.error(`❌ Service initialization rejected:`, result.reason);
        failureCount++;
      }
    });

    console.log(`📊 Service initialization complete: ${successCount} success, ${failureCount} failed`);

    if (criticalFailure) {
      throw new Error('Critical AI services failed to initialize');
    }
  }

  private getHealthyServicesCount(): number {
    return Array.from(this.healthStatus.values()).filter(Boolean).length;
  }

  private async initiateEmergencyProtocol(context: ConversationContext): Promise<void> {
    console.log('🚨 Initiating emergency protocol for user:', context.userId);
    try {
      // Minimal protocol: disable risky AI features and log
      FEATURE_FLAGS.disableAll();
      await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        event: 'emergency_protocol_initiated',
        userId: context.userId
      });
    } catch {}
  }

  private async provideSupportResources(context: ConversationContext): Promise<void> {
    console.log('📞 Providing support resources for user:', context.userId);
    try {
      // Surface minimal, non-PII support metadata to telemetry; UI layer can react
      await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        event: 'support_resources_provided',
        resources: ['help_center', 'emergency_lines', 'self_help_library']
      }, context.userId);
    } catch {}
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