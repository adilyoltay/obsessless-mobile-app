/**
 * 🌐 External AI Service - Gemini Integration (Gemini-only)
 * 
 * Bu servis, Google Gemini ile güvenli ve etkili entegrasyon sağlar.
 * Therapeutic context için optimize edilmiştir. Sadece Gemini desteklenir;
 * yedek sağlayıcı ve OpenAI/Claude entegrasyonları kaldırılmıştır.
 * 
 * ⚠️ CRITICAL: Tüm API çağrıları safety filter'dan geçer
 * ⚠️ Feature flag kontrolü: AI_EXTERNAL_API
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage, 
  ConversationContext, 
  UserTherapeuticProfile,
  AIError,
  AIErrorCode,
  ErrorSeverity,
  isAIError
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { contentFilterService } from '@/features/ai/safety/contentFilter';
import { aiManager } from '@/features/ai/config/aiManager';
import Constants from 'expo-constants';
import { AI_CONFIG } from '@/constants/featureFlags';

// =============================================================================
// 🎯 AI PROVIDER DEFINITIONS
// =============================================================================

/**
 * Supported AI Providers
 */
export enum AIProvider {
  GEMINI = 'gemini'
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
  cached?: boolean; // Cache'den gelip gelmediği
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttlMs: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache entries
  useStorage: boolean; // Use AsyncStorage for persistence
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  perUser: boolean; // Rate limit per user vs global
}

/**
 * Cache entry interface
 */
interface CacheEntry {
  response: EnhancedAIResponse;
  timestamp: number;
  ttl: number;
  promptHash: string;
  userId?: string;
}

/**
 * Rate limit tracker interface
 */
interface RateLimitTracker {
  requests: number;
  windowStart: number;
  windowSizeMs: number;
  userId?: string;
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

  // Cache & Rate Limiting
  private cacheConfig: CacheConfig = {
    enabled: true,
    ttlMs: 10 * 60 * 1000, // 10 minutes
    maxSize: 100,
    useStorage: true
  };
  private rateLimitConfig: RateLimitConfig = {
    enabled: true,
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    perUser: true
  };
  private responseCache: Map<string, CacheEntry> = new Map();
  private userRateLimits: Map<string, RateLimitTracker[]> = new Map();

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
    if (__DEV__) console.log('🌐 External AI Service: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_EXTERNAL_API')) {
        if (__DEV__) console.log('🚫 External AI Service disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      // Provider'ları yükle ve test et
      await this.loadProviderConfigurations();
      await this.performHealthChecks();
      
      // En iyi provider'ı seç
      this.activeProvider = this.selectBestProvider();
      
      if (!this.activeProvider) {
        // NO_PROVIDER_AVAILABLE telemetry
        await trackAIError({
          code: AIErrorCode.NO_PROVIDER_AVAILABLE,
          message: 'No AI provider available after health checks',
          severity: ErrorSeverity.HIGH,
          context: { 
            component: 'ExternalAIService',
            method: 'initialize',
            providersChecked: this.providers.size,
            healthCheckResults: Array.from(this.providers.entries()).map(([provider, config]) => ({
              provider,
              isAvailable: config.isAvailable,
              lastHealthCheck: config.lastHealthCheck,
              errorCount: config.errorCount
            }))
          }
        });
        
        throw new AIError(AIErrorCode.NO_PROVIDER_AVAILABLE, 'No AI provider available');
      }

      this.isEnabled = true;
      
      // Telemetry
      await trackAIInteraction(AIEventType.EXTERNAL_AI_INITIALIZED, {
        activeProvider: this.activeProvider,
        availableProviders: Array.from(this.providers.keys()),
        totalProviders: this.providers.size
      });

      if (__DEV__) console.log('✅ External AI Service initialized with provider:', this.activeProvider);

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
    const extra: any = Constants.expoConfig?.extra || {};
    
    const isLikelyPlaceholder = (value?: string) => {
      if (!value) return true;
      const v = String(value);
      return /REPLACE_WITH_REAL|REPLACE|your_?api_?key/i.test(v);
    };

    // Determine selected provider from Expo env (fallback gemini). Only gemini is supported.
    const selectedProvider = String(
      (extra.EXPO_PUBLIC_AI_PROVIDER || process.env.EXPO_PUBLIC_AI_PROVIDER || 'gemini')
    ).toLowerCase();

    // Remove OpenAI/Claude entirely – warn if non-gemini configured
    if (selectedProvider !== 'gemini') {
      if (__DEV__) console.warn(`⚠️ Only Gemini is supported. Configured provider '${selectedProvider}' will be ignored.`);
    }

    // Gemini Configuration (only if selected)
    const geminiKey = extra.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const geminiModel = extra.EXPO_PUBLIC_GEMINI_MODEL || process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash-exp';
    if (selectedProvider === 'gemini' && geminiKey && !isLikelyPlaceholder(geminiKey)) {
      this.providers.set(AIProvider.GEMINI, {
        provider: AIProvider.GEMINI,
        apiKey: geminiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        model: geminiModel,
        maxTokens: 4000,
        temperature: 0.7,
        timeout: 30000,
        isAvailable: false,
        lastHealthCheck: new Date(),
        errorCount: 0,
        successRate: 1.0
      });
    }

    // Telemetry: configuration load summary (dinamik)
    const configuredProviders = Array.from(this.providers.keys());
    await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
      component: 'ExternalAIService',
      event: 'config_loaded',
      selectedProvider,
      providersConfigured: configuredProviders,
    });
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
          
          // Telemetry for health result
          await trackAIInteraction(AIEventType.AI_PROVIDER_HEALTH_CHECK, {
            provider,
            isHealthy
          });

          if (__DEV__) {
            if (isHealthy) {
              if (__DEV__) console.log(`✅ ${provider} is available`);
            } else {
              if (__DEV__) console.warn(`⚠️ ${provider} is not available`);
            }
          }
        } catch (error) {
          console.error(`❌ Health check failed for ${provider}:`, error);
          config.isAvailable = false;

          await trackAIInteraction(AIEventType.AI_PROVIDER_FAILED, {
            provider,
            reason: 'health_check_failed'
          });
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
  // 🔒 PII SANITIZATION METHODS
  // =============================================================================

  /**
   * PII'yi sanitize et - CRITICAL SECURITY FUNCTION
   */
  private sanitizeSensitiveData(messages: AIMessage[], context: ConversationContext): {
    sanitizedMessages: AIMessage[];
    sanitizedContext: ConversationContext;
    piiDetected: boolean;
  } {
    const piiPatterns = {
      // Email patterns
      email: /\b[\w\.-]+@[\w\.-]+\.\w+\b/gi,
      // Phone patterns (Turkish and international)
      phone: /(\+90|0)?[\s\-\.]?5\d{2}[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2}|\b\d{11,}\b/gi,
      // Turkish ID numbers (11 digits)
      turkishId: /\b\d{11}\b/gi,
      // Names (basic pattern - capital letters followed by lowercase)
      names: /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\b/gi,
      // Credit card patterns
      creditCard: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/gi,
      // Address patterns (street names with numbers)
      address: /\b\d+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+(Cd|Sk|St|Street|Caddesi|Sokağı)\b/gi,
      // Date of birth patterns
      dateOfBirth: /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/gi
    };

    let piiDetected = false;

    // Sanitize messages
    const sanitizedMessages = messages.map(message => {
      let sanitizedContent = message.content;
      
      // Apply PII patterns
      for (const [type, pattern] of Object.entries(piiPatterns)) {
        const matches = sanitizedContent.match(pattern);
        // Require at least 2 name matches to reduce over-masking; phones require >=1 but >=11 digits
        const shouldMask = !!matches && (type !== 'names' || matches.length >= 2);
        if (shouldMask) {
          piiDetected = true;
          if (__DEV__) console.warn(`🔒 PII detected and sanitized: ${type} (${matches.length} instances)`);
          
          switch (type) {
            case 'email':
              sanitizedContent = sanitizedContent.replace(pattern, '[EMAIL]');
              break;
            case 'phone':
              sanitizedContent = sanitizedContent.replace(pattern, '[PHONE]');
              break;
            case 'turkishId':
              sanitizedContent = sanitizedContent.replace(pattern, '[ID_NUMBER]');
              break;
            case 'names':
              sanitizedContent = sanitizedContent.replace(pattern, '[NAME]');
              break;
            case 'creditCard':
              sanitizedContent = sanitizedContent.replace(pattern, '[CREDIT_CARD]');
              break;
            case 'address':
              sanitizedContent = sanitizedContent.replace(pattern, '[ADDRESS]');
              break;
            case 'dateOfBirth':
              sanitizedContent = sanitizedContent.replace(pattern, '[DATE]');
              break;
          }
        }
      }

      return {
        ...message,
        content: sanitizedContent
      };
    });

    // Sanitize context (remove sensitive metadata)
    const sanitizedContext = {
      ...context,
      // Remove potentially sensitive fields
      userMetadata: context.userMetadata ? {
        ...context.userMetadata,
        email: undefined,
        phone: undefined,
        fullName: undefined,
        realName: undefined
      } : undefined,
      
      // Keep therapeutic context but sanitize personal details
      therapeuticProfile: context.therapeuticProfile ? {
        ...context.therapeuticProfile,
        personalDetails: undefined, // Remove personal details
        contactInfo: undefined, // Remove contact info
        emergencyContacts: undefined // Remove emergency contacts
      } : undefined
    };

    return {
      sanitizedMessages,
      sanitizedContext,
      piiDetected
    };
  }

  // =============================================================================
  // 🗂️ CACHE & RATE LIMITING METHODS
  // =============================================================================

  /**
   * Normalize edilmiş prompt hash oluştur
   */
  private generatePromptHash(messages: AIMessage[], context: ConversationContext, config?: AIRequestConfig): string {
    const normalizedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content.trim().toLowerCase()
    }));
    
    const hashInput = JSON.stringify({
      messages: normalizedMessages,
      provider: config?.provider || this.activeProvider,
      model: config?.model,
      temperature: config?.temperature || 0.7,
      therapeuticMode: config?.therapeuticMode !== false
    });
    
    // Simple hash function - production'da crypto hash kullanılmalı
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Cache'den response al
   */
  private async getCachedResponse(promptHash: string, userId?: string): Promise<EnhancedAIResponse | null> {
    if (!this.cacheConfig.enabled) return null;

    // Memory cache kontrolü
    const memoryCached = this.responseCache.get(promptHash);
    if (memoryCached && this.isCacheEntryValid(memoryCached)) {
    if (__DEV__) console.log('📦 Cache hit (memory):', promptHash.substring(0, 8));
      return { ...memoryCached.response, cached: true };
    }

    // AsyncStorage cache kontrolü
    if (this.cacheConfig.useStorage) {
      try {
        const storedCache = await AsyncStorage.getItem(`ai_cache_${promptHash}`);
        if (storedCache) {
          const cacheEntry: CacheEntry = JSON.parse(storedCache);
          if (this.isCacheEntryValid(cacheEntry)) {
            // Memory cache'e de ekle
            this.responseCache.set(promptHash, cacheEntry);
            if (__DEV__) console.log('📦 Cache hit (storage):', promptHash.substring(0, 8));
            return { ...cacheEntry.response, cached: true };
          } else {
            // Expired cache'i temizle
            await AsyncStorage.removeItem(`ai_cache_${promptHash}`);
          }
        }
      } catch (error) {
        console.error('❌ Cache read error:', error);
      }
    }

    return null;
  }

  /**
   * Response'u cache'le
   */
  private async cacheResponse(promptHash: string, response: EnhancedAIResponse, userId?: string): Promise<void> {
    if (!this.cacheConfig.enabled || !response.success) return;

    const cacheEntry: CacheEntry = {
      response: { ...response, cached: false }, // Cache flag'i kaldır
      timestamp: Date.now(),
      ttl: this.cacheConfig.ttlMs,
      promptHash,
      userId
    };

    // Memory cache
    this.responseCache.set(promptHash, cacheEntry);
    this.cleanupMemoryCache();

    // AsyncStorage cache
    if (this.cacheConfig.useStorage) {
      try {
        await AsyncStorage.setItem(`ai_cache_${promptHash}`, JSON.stringify(cacheEntry));
      } catch (error) {
        console.error('❌ Cache write error:', error);
      }
    }

    if (__DEV__) console.log('📦 Response cached:', promptHash.substring(0, 8));
  }

  /**
   * Cache entry'sinin geçerli olup olmadığını kontrol et
   */
  private isCacheEntryValid(entry: CacheEntry): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < entry.ttl;
  }

  /**
   * Memory cache'i temizle
   */
  private cleanupMemoryCache(): void {
    if (this.responseCache.size <= this.cacheConfig.maxSize) return;

    // En eski entry'leri sil
    const entries = Array.from(this.responseCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toDelete = entries.slice(0, entries.length - this.cacheConfig.maxSize);
    toDelete.forEach(([key]) => this.responseCache.delete(key));
  }

  /**
   * User-specific rate limit kontrolü
   */
  private async checkUserRateLimit(userId?: string): Promise<void> {
    if (!this.rateLimitConfig.enabled || !userId) return;

    const now = Date.now();
    const userLimits = this.userRateLimits.get(userId) || [];

    // Expired trackers'ları temizle
    const validLimits = userLimits.filter(limit => 
      (now - limit.windowStart) < limit.windowSizeMs
    );

    // Current windows için tracker'ları oluştur
    const windows = [
      { sizeMs: 60 * 1000, maxRequests: this.rateLimitConfig.requestsPerMinute }, // 1 minute
      { sizeMs: 60 * 60 * 1000, maxRequests: this.rateLimitConfig.requestsPerHour }, // 1 hour  
      { sizeMs: 24 * 60 * 60 * 1000, maxRequests: this.rateLimitConfig.requestsPerDay } // 1 day
    ];

    for (const window of windows) {
      const windowTracker = validLimits.find(limit => limit.windowSizeMs === window.sizeMs);
      
      if (windowTracker) {
        if (windowTracker.requests >= window.maxRequests) {
          const resetTime = new Date(windowTracker.windowStart + window.sizeMs);
          const error = new Error(`Rate limit exceeded. Resets at: ${resetTime.toISOString()}`);
          (error as any).code = AIErrorCode.RATE_LIMIT;
          (error as any).severity = ErrorSeverity.MEDIUM;
          (error as any).recoverable = true;
          throw error;
        }
        windowTracker.requests++;
      } else {
        validLimits.push({
          requests: 1,
          windowStart: now,
          windowSizeMs: window.sizeMs,
          userId
        });
      }
    }

    this.userRateLimits.set(userId, validLimits);
  }

  // =============================================================================
  // 🎯 CORE AI METHODS
  // =============================================================================

  /**
   * AI'dan yanıt al - Ana metod (Cache & Rate Limiting ile)
   */
  async getAIResponse(
    messages: AIMessage[],
    context: ConversationContext,
    config?: AIRequestConfig,
    userId?: string
  ): Promise<EnhancedAIResponse> {
    if (!this.isEnabled) {
      const error = new Error('External AI Service is not enabled');
      (error as any).code = AIErrorCode.FEATURE_DISABLED;
      (error as any).severity = ErrorSeverity.MEDIUM;
      (error as any).recoverable = true;
      throw error;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // 🔒 CRITICAL: PII Sanitization FIRST
      const { sanitizedMessages, sanitizedContext, piiDetected } = this.sanitizeSensitiveData(messages, context);
      
      if (piiDetected) {
        if (__DEV__) console.warn('🔒 PII detected and sanitized before AI request');
        // Track PII detection for security monitoring
        await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          piiDetected: true,
          userId: userId,
          messageCount: messages.length
        });
      }

      // User-specific rate limiting kontrolü
      await this.checkUserRateLimit(userId);

      // Cache kontrolü (sanitized data ile)
      const promptHash = this.generatePromptHash(sanitizedMessages, sanitizedContext, config);
      const cachedResponse = await this.getCachedResponse(promptHash, userId);
      if (cachedResponse) {
        cachedResponse.requestId = requestId;
        
        // Cache hit telemetry
        await trackAIInteraction(AIEventType.AI_RESPONSE_GENERATED, {
          provider: cachedResponse.provider,
          model: cachedResponse.model,
          success: true,
          latency: Date.now() - startTime,
          tokens: cachedResponse.tokens.total,
          cached: true,
          userId: userId
        });
        
        return cachedResponse;
      }

      // Provider-level rate limiting kontrolü (backward compatibility)
      await this.checkRateLimit(config?.provider || this.activeProvider!);

      // Provider seç
      const provider = config?.provider || this.selectBestProvider();
      if (!provider) {
        const error = new Error('No AI provider available');
        (error as any).code = AIErrorCode.NO_PROVIDER_AVAILABLE;
        (error as any).severity = ErrorSeverity.HIGH;
        (error as any).recoverable = false;
        throw error;
      }

      // Request hazırla (sanitized data ile)
      const preparedRequest = await this.prepareRequest(sanitizedMessages, sanitizedContext, config);
      
      // API çağrısı yap
      let response = await this.makeProviderRequest(provider, preparedRequest);
      
      // Fallback mekanizması
      if (!response.success && provider !== this.getBackupProvider(provider)) {
        if (__DEV__) console.warn(`⚠️ Primary provider ${provider} failed, trying backup...`);
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
          const reasonText = Array.isArray(filterResult.reasons) && filterResult.reasons.length > 0
            ? filterResult.reasons[0]
            : 'content_filtered';
          response.content = this.getFilteredResponse(reasonText);
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

      // Cache successful responses
      if (response.success && !response.filtered) {
        await this.cacheResponse(promptHash, response, userId);
      }

      // Telemetry
      await trackAIInteraction(AIEventType.AI_RESPONSE_GENERATED, {
        provider,
        model: response.model,
        success: response.success,
        latency: response.latency,
        tokens: response.tokens.total,
        filtered: response.filtered,
        fallbackUsed: response.fallbackUsed,
        cached: false,
        userId: userId
      });

      return response;

    } catch (error) {
      console.error('❌ AI response generation failed:', error);
      
      const latency = Date.now() - startTime;
      
      await trackAIError({
        code: (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') 
              ? error.code : AIErrorCode.UNKNOWN,
        message: 'AI yanıtı alınamadı',
        severity: ErrorSeverity.HIGH,
        context: { 
          component: 'ExternalAIService', 
          method: 'getAIResponse',
          provider: config?.provider || this.activeProvider,
          latency,
          requestId,
          errorType: error?.constructor?.name || 'Unknown'
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
    throw new AIError(AIErrorCode.UNKNOWN, 'Streaming not yet implemented');
  }

  // =============================================================================
  // 🔧 PROVIDER-SPECIFIC IMPLEMENTATIONS
  // =============================================================================

  // OpenAI ve Claude çağrıları kaldırıldı; yalnızca Gemini desteklenir

  /**
   * Gemini API çağrısı
   */
  private async callGemini(request: any): Promise<EnhancedAIResponse> {
    const config = this.providers.get(AIProvider.GEMINI)!;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);
      // Normalize messages to Gemini format defensively
      const safeMessages = Array.isArray(request.messages) ? request.messages : [];
      const normalizedContents = safeMessages.map((m: any) => ({
        role: m?.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m?.content ?? '') }]
      }));

      const response = await fetch(
        `${config.baseURL}/models/${config.model}:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: normalizedContents,
            generationConfig: {
              temperature: request.temperature || config.temperature,
              maxOutputTokens: request.maxTokens || config.maxTokens
            }
          }),
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

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
    if (__DEV__) console.log('🔧 External AI Service providers initialized');
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
    // Yalnızca Gemini desteklenir; yedek sağlayıcı yok
    return null;
  }

  private async makeProviderRequest(provider: AIProvider, request: any): Promise<EnhancedAIResponse> {
    // Only Gemini is supported
    return await this.callGemini(request);
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
      provider: AIProvider.GEMINI,
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
    if (__DEV__) console.log('🌐 External AI Service: Shutting down...');
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