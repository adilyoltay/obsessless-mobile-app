/**
 * 🌐 External AI Service - OpenAI/Claude Integration
 * 
 * Bu servis external AI provider'ları (OpenAI, Claude, Gemini) ile
 * güvenli ve etkili entegrasyon sağlar. Therapeutic context için
 * optimize edilmiş, fallback mekanizmaları ile robust bir yapı sunar.
 * 
 * ⚠️ CRITICAL: Tüm API çağrıları safety filter'dan geçer
 * ⚠️ Feature flag kontrolü: AI_EXTERNAL_API
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage, 
  ConversationContext, 
  UserTherapeuticProfile,
  AIError,
  AIErrorCode,
  ErrorSeverity 
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { contentFilterService } from '@/features/ai/safety/contentFilter';
import { aiManager } from '@/features/ai/config/aiManager';

// =============================================================================
// 🎯 AI PROVIDER DEFINITIONS
// =============================================================================

/**
 * Supported AI Providers
 */
export enum AIProvider {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  GEMINI = 'gemini',
  LOCAL = 'local'
}

/**
 * Provider Configuration
 */
export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  isAvailable: boolean;
  lastHealthCheck: Date;
  errorCount: number;
  successRate: number;
}

/**
 * AI Request Configuration
 */
export interface AIRequestConfig {
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  useStream?: boolean;
  includeSafetyInstructions?: boolean;
  therapeuticMode?: boolean;
}

/**
 * AI Response with metadata
 */
export interface EnhancedAIResponse {
  success: boolean;
  content: string;
  provider: AIProvider;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency: number;
  confidence?: number;
  safetyScore?: number;
  filtered?: boolean;
  fallbackUsed?: boolean;
  timestamp: Date;
  requestId: string;
}

// =============================================================================
// 🌐 EXTERNAL AI SERVICE IMPLEMENTATION
// =============================================================================

class ExternalAIService {
  private static instance: ExternalAIService;
  private isEnabled: boolean = false;
  private providers: Map<AIProvider, ProviderConfig> = new Map();
  private activeProvider: AIProvider | null = null;
  private requestQueue: Map<string, Promise<EnhancedAIResponse>> = new Map();
  private rateLimiter: Map<AIProvider, { count: number; resetTime: number }> = new Map();

  private constructor() {
    this.initializeProviders();
  }

  static getInstance(): ExternalAIService {
    if (!ExternalAIService.instance) {
      ExternalAIService.instance = new ExternalAIService();
    }
    return ExternalAIService.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION & SETUP
  // =============================================================================

  /**
   * External AI Service'i başlat
   */
  async initialize(): Promise<void> {
    console.log('🌐 External AI Service: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_EXTERNAL_API')) {
        console.log('🚫 External AI Service disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      // Provider'ları yükle ve test et
      await this.loadProviderConfigurations();
      await this.performHealthChecks();
      
      // En iyi provider'ı seç
      this.activeProvider = this.selectBestProvider();
      
      if (!this.activeProvider) {
        throw new AIError(AIErrorCode.NO_PROVIDER_AVAILABLE, 'No AI provider available');
      }

      this.isEnabled = true;
      
      // Telemetry
      await trackAIInteraction(AIEventType.EXTERNAL_AI_INITIALIZED, {
        activeProvider: this.activeProvider,
        availableProviders: Array.from(this.providers.keys()),
        totalProviders: this.providers.size
      });

      console.log('✅ External AI Service initialized with provider:', this.activeProvider);

    } catch (error) {
      console.error('❌ External AI Service initialization failed:', error);
      this.isEnabled = false;
      
      await trackAIError({
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: 'External AI Service başlatılamadı',
        severity: ErrorSeverity.HIGH,
        context: { component: 'ExternalAIService', method: 'initialize' }
      });
      
      throw error;
    }
  }

  /**
   * Provider konfigürasyonlarını yükle
   */
  private async loadProviderConfigurations(): Promise<void> {
    // OpenAI Configuration
    if (process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
      this.providers.set(AIProvider.OPENAI, {
        provider: AIProvider.OPENAI,
        apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        model: process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: 4000,
        temperature: 0.7,
        timeout: 30000,
        isAvailable: false,
        lastHealthCheck: new Date(),
        errorCount: 0,
        successRate: 1.0
      });
    }

    // Claude Configuration
    if (process.env.EXPO_PUBLIC_CLAUDE_API_KEY) {
      this.providers.set(AIProvider.CLAUDE, {
        provider: AIProvider.CLAUDE,
        apiKey: process.env.EXPO_PUBLIC_CLAUDE_API_KEY,
        baseURL: 'https://api.anthropic.com',
        model: process.env.EXPO_PUBLIC_CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        maxTokens: 4000,
        temperature: 0.7,
        timeout: 30000,
        isAvailable: false,
        lastHealthCheck: new Date(),
        errorCount: 0,
        successRate: 1.0
      });
    }

    // Gemini Configuration
    if (process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
      this.providers.set(AIProvider.GEMINI, {
        provider: AIProvider.GEMINI,
        apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        model: process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash-exp',
        maxTokens: 4000,
        temperature: 0.7,
        timeout: 30000,
        isAvailable: false,
        lastHealthCheck: new Date(),
        errorCount: 0,
        successRate: 1.0
      });
    }

    console.log(`🔧 Loaded ${this.providers.size} AI provider configurations`);
  }

  /**
   * Provider health check'leri yap
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.providers.entries()).map(
      async ([provider, config]) => {
        try {
          const isHealthy = await this.checkProviderHealth(provider);
          config.isAvailable = isHealthy;
          config.lastHealthCheck = new Date();
          
          if (isHealthy) {
            console.log(`✅ ${provider} is available`);
          } else {
            console.warn(`⚠️ ${provider} is not available`);
          }
        } catch (error) {
          console.error(`❌ Health check failed for ${provider}:`, error);
          config.isAvailable = false;
        }
      }
    );

    await Promise.all(healthCheckPromises);
  }

  /**
   * Provider health durumunu kontrol et
   */
  private async checkProviderHealth(provider: AIProvider): Promise<boolean> {
    const config = this.providers.get(provider);
    if (!config) return false;

    try {
      // Simple health check request
      const response = await this.makeProviderRequest(provider, {
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 10,
        temperature: 0
      });

      return response.success;
    } catch (error) {
      return false;
    }
  }

  // =============================================================================
  // 🎯 CORE AI METHODS
  // =============================================================================

  /**
   * AI'dan yanıt al - Ana metod
   */
  async getAIResponse(
    messages: AIMessage[],
    context: ConversationContext,
    config?: AIRequestConfig
  ): Promise<EnhancedAIResponse> {
    if (!this.isEnabled) {
      throw new AIError(AIErrorCode.FEATURE_DISABLED, 'External AI Service is not enabled');
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Rate limiting kontrolü
      await this.checkRateLimit(config?.provider || this.activeProvider!);

      // Provider seç
      const provider = config?.provider || this.selectBestProvider();
      if (!provider) {
        throw new AIError(AIErrorCode.NO_PROVIDER_AVAILABLE, 'No AI provider available');
      }

      // Request hazırla
      const preparedRequest = await this.prepareRequest(messages, context, config);
      
      // API çağrısı yap
      let response = await this.makeProviderRequest(provider, preparedRequest);
      
      // Fallback mekanizması
      if (!response.success && provider !== this.getBackupProvider(provider)) {
        console.warn(`⚠️ Primary provider ${provider} failed, trying backup...`);
        const backupProvider = this.getBackupProvider(provider);
        if (backupProvider) {
          response = await this.makeProviderRequest(backupProvider, preparedRequest);
          response.fallbackUsed = true;
        }
      }

      // Content filtering
      if (response.success && config?.therapeuticMode !== false) {
        const filterResult = await contentFilterService.filterContent(
          { content: response.content } as AIMessage,
          { isTherapeutic: true }
        );
        
        if (!filterResult.allowed) {
          response.filtered = true;
          response.content = this.getFilteredResponse(filterResult.reason);
          response.safetyScore = 0.1;
        } else {
          response.safetyScore = filterResult.confidence || 0.9;
        }
      }

      // Metadata tamamla
      response.latency = Date.now() - startTime;
      response.requestId = requestId;
      response.timestamp = new Date();

      // Provider statistics güncelle
      this.updateProviderStats(provider, response.success);

      // Telemetry
      await trackAIInteraction(AIEventType.AI_RESPONSE_GENERATED, {
        provider,
        model: response.model,
        success: response.success,
        latency: response.latency,
        tokens: response.tokens.total,
        filtered: response.filtered,
        fallbackUsed: response.fallbackUsed
      });

      return response;

    } catch (error) {
      console.error('❌ AI response generation failed:', error);
      
      const latency = Date.now() - startTime;
      
      await trackAIError({
        code: error instanceof AIError ? error.code : AIErrorCode.UNKNOWN,
        message: 'AI yanıtı alınamadı',
        severity: ErrorSeverity.HIGH,
        context: { 
          component: 'ExternalAIService', 
          method: 'getAIResponse',
          provider: config?.provider || this.activeProvider,
          latency,
          requestId
        }
      });

      // Fallback response döndür
      return this.getFallbackResponse(requestId, latency);
    }
  }

  /**
   * Streaming AI response (gelecek için)
   */
  async getStreamingResponse(
    messages: AIMessage[],
    context: ConversationContext,
    onChunk: (chunk: string) => void,
    config?: AIRequestConfig
  ): Promise<EnhancedAIResponse> {
    // Future implementation for streaming
    throw new AIError(AIErrorCode.NOT_IMPLEMENTED, 'Streaming not yet implemented');
  }

  // =============================================================================
  // 🔧 PROVIDER-SPECIFIC IMPLEMENTATIONS
  // =============================================================================

  /**
   * OpenAI API çağrısı
   */
  private async callOpenAI(request: any): Promise<EnhancedAIResponse> {
    const config = this.providers.get(AIProvider.OPENAI)!;
    const startTime = Date.now();

    try {
      const response = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: request.model || config.model,
          messages: request.messages,
          max_tokens: request.maxTokens || config.maxTokens,
          temperature: request.temperature || config.temperature
        }),
        signal: AbortSignal.timeout(config.timeout)
      });

      if (!response.ok) {
        throw new AIError(AIErrorCode.API_ERROR, `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.choices[0]?.message?.content || '',
        provider: AIProvider.OPENAI,
        model: data.model,
        tokens: {
          prompt: data.usage?.prompt_tokens || 0,
          completion: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0
        },
        latency: Date.now() - startTime,
        timestamp: new Date(),
        requestId: ''
      };

    } catch (error) {
      console.error('❌ OpenAI API call failed:', error);
      throw error;
    }
  }

  /**
   * Claude API çağrısı
   */
  private async callClaude(request: any): Promise<EnhancedAIResponse> {
    const config = this.providers.get(AIProvider.CLAUDE)!;
    const startTime = Date.now();

    try {
      const response = await fetch(`${config.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: request.model || config.model,
          max_tokens: request.maxTokens || config.maxTokens,
          temperature: request.temperature || config.temperature,
          messages: request.messages.filter((m: any) => m.role !== 'system'),
          system: request.messages.find((m: any) => m.role === 'system')?.content || ''
        }),
        signal: AbortSignal.timeout(config.timeout)
      });

      if (!response.ok) {
        throw new AIError(AIErrorCode.API_ERROR, `Claude API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.content[0]?.text || '',
        provider: AIProvider.CLAUDE,
        model: data.model,
        tokens: {
          prompt: data.usage?.input_tokens || 0,
          completion: data.usage?.output_tokens || 0,
          total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        },
        latency: Date.now() - startTime,
        timestamp: new Date(),
        requestId: ''
      };

    } catch (error) {
      console.error('❌ Claude API call failed:', error);
      throw error;
    }
  }

  /**
   * Gemini API çağrısı
   */
  private async callGemini(request: any): Promise<EnhancedAIResponse> {
    const config = this.providers.get(AIProvider.GEMINI)!;
    const startTime = Date.now();

    try {
      const response = await fetch(
        `${config.baseURL}/models/${config.model}:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: request.messages.map((m: any) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            })),
            generationConfig: {
              temperature: request.temperature || config.temperature,
              maxOutputTokens: request.maxTokens || config.maxTokens
            }
          }),
          signal: AbortSignal.timeout(config.timeout)
        }
      );

      if (!response.ok) {
        throw new AIError(AIErrorCode.API_ERROR, `Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.candidates[0]?.content?.parts[0]?.text || '',
        provider: AIProvider.GEMINI,
        model: config.model,
        tokens: {
          prompt: data.usageMetadata?.promptTokenCount || 0,
          completion: data.usageMetadata?.candidatesTokenCount || 0,
          total: data.usageMetadata?.totalTokenCount || 0
        },
        latency: Date.now() - startTime,
        timestamp: new Date(),
        requestId: ''
      };

    } catch (error) {
      console.error('❌ Gemini API call failed:', error);
      throw error;
    }
  }

  // =============================================================================
  // 🔧 HELPER METHODS
  // =============================================================================

  private initializeProviders(): void {
    // Provider'lar loadProviderConfigurations'da dinamik yüklenecek
    console.log('🔧 External AI Service providers initialized');
  }

  private selectBestProvider(): AIProvider | null {
    let bestProvider: AIProvider | null = null;
    let bestScore = -1;

    for (const [provider, config] of this.providers.entries()) {
      if (!config.isAvailable) continue;
      
      // Score hesapla: success rate - error count + availability
      const score = config.successRate * 100 - config.errorCount + (config.isAvailable ? 10 : 0);
      
      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  private getBackupProvider(primaryProvider: AIProvider): AIProvider | null {
    const backupOrder = {
      [AIProvider.OPENAI]: AIProvider.CLAUDE,
      [AIProvider.CLAUDE]: AIProvider.OPENAI,
      [AIProvider.GEMINI]: AIProvider.OPENAI
    };

    const backup = backupOrder[primaryProvider];
    const config = this.providers.get(backup);
    
    return config?.isAvailable ? backup : null;
  }

  private async makeProviderRequest(provider: AIProvider, request: any): Promise<EnhancedAIResponse> {
    switch (provider) {
      case AIProvider.OPENAI:
        return await this.callOpenAI(request);
      case AIProvider.CLAUDE:
        return await this.callClaude(request);
      case AIProvider.GEMINI:
        return await this.callGemini(request);
      default:
        throw new AIError(AIErrorCode.INVALID_PROVIDER, `Unsupported provider: ${provider}`);
    }
  }

  private async prepareRequest(
    messages: AIMessage[],
    context: ConversationContext,
    config?: AIRequestConfig
  ): Promise<any> {
    return {
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      maxTokens: config?.maxTokens,
      temperature: config?.temperature,
      model: config?.model
    };
  }

  private async checkRateLimit(provider: AIProvider): Promise<void> {
    const limit = this.rateLimiter.get(provider);
    const now = Date.now();
    
    if (!limit) {
      this.rateLimiter.set(provider, { count: 1, resetTime: now + 60000 });
      return;
    }

    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + 60000;
      return;
    }

    if (limit.count >= 60) { // 60 requests per minute
      throw new AIError(AIErrorCode.RATE_LIMIT, 'Rate limit exceeded');
    }

    limit.count++;
  }

  private updateProviderStats(provider: AIProvider, success: boolean): void {
    const config = this.providers.get(provider);
    if (!config) return;

    if (success) {
      config.errorCount = Math.max(0, config.errorCount - 1);
      config.successRate = Math.min(1.0, config.successRate + 0.01);
    } else {
      config.errorCount++;
      config.successRate = Math.max(0.0, config.successRate - 0.05);
    }
  }

  private getFilteredResponse(reason: string): string {
    return `Üzgünüm, güvenlik protokolleri nedeniyle bu yanıtı veremiyorum. ${reason} Farklı bir konuda size nasıl yardımcı olabilirim?`;
  }

  private getFallbackResponse(requestId: string, latency: number): EnhancedAIResponse {
    return {
      success: false,
      content: 'Üzgünüm, şu anda AI sistemi kullanılamıyor. Lütfen daha sonra tekrar deneyin. Bu arada nefes alma egzersizi yapmayı deneyebilirsiniz: 4 saniye nefes alın, 4 saniye tutun, 6 saniye bırakın.',
      provider: AIProvider.LOCAL,
      model: 'fallback',
      tokens: { prompt: 0, completion: 0, total: 0 },
      latency,
      timestamp: new Date(),
      requestId,
      fallbackUsed: true
    };
  }

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  /**
   * Service durumunu kontrol et
   */
  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_EXTERNAL_API');
  }

  /**
   * Aktif provider'ı al
   */
  get currentProvider(): AIProvider | null {
    return this.activeProvider;
  }

  /**
   * Mevcut provider'ları al
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.entries())
      .filter(([_, config]) => config.isAvailable)
      .map(([provider, _]) => provider);
  }

  /**
   * Provider statistiklerini al
   */
  getProviderStats(provider: AIProvider): ProviderConfig | undefined {
    return this.providers.get(provider);
  }

  /**
   * Service'i temizle
   */
  async shutdown(): Promise<void> {
    console.log('🌐 External AI Service: Shutting down...');
    this.isEnabled = false;
    this.requestQueue.clear();
    this.rateLimiter.clear();
    
    await trackAIInteraction(AIEventType.EXTERNAL_AI_SHUTDOWN, {
      providersShutdown: this.providers.size
    });
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const externalAIService = ExternalAIService.getInstance();
export default externalAIService;
export { 
  AIProvider, 
  type ProviderConfig, 
  type AIRequestConfig, 
  type EnhancedAIResponse 
};