/**
 * 🔒 Content Filtering System - AI Response Safety Validation
 * 
 * Bu sistem AI yanıtlarını güvenlik açısından filtreler ve
 * uygunsuz içeriği engeller.
 * 
 * ⚠️ CRITICAL: Tüm AI yanıtları bu filtreden geçmeden kullanıcıya gösterilmemeli
 * ⚠️ Filtering sonuçları telemetry'ye loglanmalı
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { AIMessage, AIError, AIErrorCode, ErrorSeverity } from '@/features/ai/types';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 CONTENT FILTERING CONFIGURATION
// =============================================================================

/**
 * Content filtering konfigürasyonu
 */
interface ContentFilterConfig {
  enabled: boolean;
  strictMode: boolean; // Daha sıkı filtering
  therapeuticMode: boolean; // Terapötik context için özel kurallar
  blockedTopics: string[];
  allowedTopics: string[];
  profanityFilter: boolean;
  medicalAdviceFilter: boolean;
  selfHarmFilter: boolean;
}

/**
 * Default content filter konfigürasyonu
 */
const DEFAULT_CONFIG: ContentFilterConfig = {
  enabled: true,
  strictMode: false,
  therapeuticMode: true,
  blockedTopics: [
    'explicit_sexual_content',
    'violence_detailed',
    'illegal_activities',
    'harmful_substances_detailed',
    'self_harm_instructions'
  ],
  allowedTopics: [
    'mental_health',
    'therapy_techniques',
    'coping_strategies',
    'mindfulness',
    'ocd_support',
    'emotional_support'
  ],
  profanityFilter: true,
  medicalAdviceFilter: true,
  selfHarmFilter: true
};

/**
 * Content filtering sonucu
 */
interface ContentFilterResult {
  allowed: boolean;
  confidence: number; // 0-1
  reasons: string[];
  filteredContent?: string; // Eğer partial filtering yapıldıysa
  severity: 'low' | 'medium' | 'high' | 'critical';
  requiresHumanReview: boolean;
  suggestedAction: 'allow' | 'block' | 'modify' | 'escalate';
}

// =============================================================================
// 🚫 BLOCKED CONTENT PATTERNS
// =============================================================================

/**
 * Yasaklı kelime/pattern'lar - Türkçe
 */
const TURKISH_BLOCKED_PATTERNS = {
  explicit_sexual: [
    // Explicit sexual content patterns (mild examples for code)
    'cinsel içerik', 'uygunsuz davranış'
  ],
  violence: [
    'şiddet uygula', 'zarar ver', 'incit', 'öldür',
    'saldırı planı', 'bomba yap', 'silah temin'
  ],
  self_harm_instructions: [
    'nasıl zarar veririm', 'kendimi nasıl keserim',
    'intihar yöntemleri', 'ölme yolları'
  ],
  illegal_activities: [
    'uyuşturucu sat', 'kaçakçılık', 'hırsızlık yap',
    'dolandırıcılık', 'sahte belge'
  ],
  medical_advice: [
    'ilaç doz', 'tedavi öner', 'tanı koy',
    'ameliyat gerek', 'doktor yerine'
  ],
  harmful_substances: [
    'zehir karıştır', 'kimyasal madde', 'asit kullan'
  ]
};

/**
 * Yasaklı kelime/pattern'lar - İngilizce
 */
const ENGLISH_BLOCKED_PATTERNS = {
  explicit_sexual: [
    'explicit content', 'inappropriate behavior'
  ],
  violence: [
    'how to hurt', 'cause harm', 'attack plan',
    'make bomb', 'weapon instructions'
  ],
  self_harm_instructions: [
    'how to cut', 'suicide methods', 'ways to die',
    'self-harm tutorial'
  ],
  illegal_activities: [
    'sell drugs', 'smuggling', 'how to steal',
    'fraud scheme', 'fake documents'
  ],
  medical_advice: [
    'drug dosage', 'medical diagnosis', 'treatment recommendation',
    'surgery needed', 'instead of doctor'
  ],
  harmful_substances: [
    'poison recipe', 'chemical weapon', 'acid attack'
  ]
};

/**
 * Terapötik context'te izin verilen hassas konular
 */
const THERAPEUTIC_ALLOWED_PATTERNS = {
  mental_health_discussion: [
    'kendime zarar verme dürtüsü', 'intihar düşünceleri',
    'depresyon hissi', 'anxiety nöbeti',
    'suicidal thoughts', 'self-harm urges',
    'depression feelings', 'anxiety attack'
  ],
  therapy_techniques: [
    'CBT teknikleri', 'mindfulness egzersizi',
    'nefes teknikleri', 'düşünce challenge',
    'CBT techniques', 'mindfulness exercise',
    'breathing techniques', 'thought challenging'
  ]
};

// =============================================================================
// 🔒 CONTENT FILTER SERVICE
// =============================================================================

export class ContentFilterService {
  private config: ContentFilterConfig;
  private isInitialized: boolean = false;

  constructor(config: ContentFilterConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.initialize();
  }

  /**
   * Servisi başlat
   */
  private async initialize(): Promise<void> {
    try {
      // Feature flag kontrolü – içerik filtresi AI_CHAT'ten bağımsız çalışmalı
      if (!FEATURE_FLAGS.isEnabled('CONTENT_FILTERING') || !FEATURE_FLAGS.isEnabled('SAFETY_CHECKS')) {
        this.config.enabled = false;
        return;
      }

      this.isInitialized = true;
      console.log('🔒 Content Filter Service initialized');

      // Telemetry
      await trackAIInteraction(AIEventType.SYSTEM_INITIALIZED, {
        service: 'content_filter',
        config: {
          enabled: this.config.enabled,
          strictMode: this.config.strictMode,
          therapeuticMode: this.config.therapeuticMode
        }
      });

    } catch (error) {
      console.error('❌ Content Filter initialization failed:', error);
      this.config.enabled = false;
    }
  }

  /**
   * AI mesajını filtrele
   */
  async filterContent(message: AIMessage, context?: { isTherapeutic?: boolean }): Promise<ContentFilterResult> {
    // Servis aktif değilse her şeyi geçir
    if (!this.isInitialized || !this.config.enabled) {
      return this.createAllowedResult('service_disabled');
    }

    try {
      const content = message.content.toLowerCase();
      
      // Multiple filtering layers
      const results = await Promise.all([
        this.basicProfanityFilter(content),
        this.blockedContentFilter(content),
        this.medicalAdviceFilter(content),
        this.selfHarmInstructionFilter(content),
        this.therapeuticContextFilter(content, context?.isTherapeutic || false)
      ]);

      // Combine results
      const combinedResult = this.combineFilterResults(results, message);

      // Log result
      await this.logFilterResult(combinedResult, message);

      return combinedResult;

    } catch (error) {
      console.error('❌ Content filtering error:', error);
      
      // Error durumunda güvenli tarafta kal - block et
      return this.createBlockedResult(['filtering_error'], 'critical');
    }
  }

  /**
   * Temel küfür filtresi
   */
  private async basicProfanityFilter(content: string): Promise<Partial<ContentFilterResult>> {
    if (!this.config.profanityFilter) {
      return { allowed: true, confidence: 1.0, reasons: [] };
    }

    // Basit profanity detection
    const profanityPatterns = [
      // Türkçe küfürler (hafif örnekler)
      'aptal', 'salak', 'geri zekalı',
      // İngilizce küfürler (hafif örnekler)  
      'stupid', 'idiot', 'moron'
    ];

    let foundProfanity = false;
    const detectedTerms: string[] = [];

    for (const term of profanityPatterns) {
      if (content.includes(term)) {
        foundProfanity = true;
        detectedTerms.push(term);
      }
    }

    if (foundProfanity) {
      return {
        allowed: false,
        confidence: 0.8,
        reasons: [`profanity_detected:${detectedTerms.length}_terms`],
        severity: 'low'
      };
    }

    return { allowed: true, confidence: 1.0, reasons: [] };
  }

  /**
   * Yasaklı içerik filtresi
   */
  private async blockedContentFilter(content: string): Promise<Partial<ContentFilterResult>> {
    const blockedPatterns = { ...TURKISH_BLOCKED_PATTERNS, ...ENGLISH_BLOCKED_PATTERNS };
    
    let highestSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const detectedPatterns: string[] = [];

    for (const [category, patterns] of Object.entries(blockedPatterns)) {
      for (const pattern of patterns) {
        if (content.includes(pattern)) {
          detectedPatterns.push(`${category}:${pattern}`);
          
          // Severity belirleme
          const severity = this.getCategorySeverity(category);
          if (this.severityLevel(severity) > this.severityLevel(highestSeverity)) {
            highestSeverity = severity;
          }
        }
      }
    }

    if (detectedPatterns.length > 0) {
      return {
        allowed: false,
        confidence: 0.9,
        reasons: detectedPatterns.slice(0, 3), // Limit logged patterns
        severity: highestSeverity
      };
    }

    return { allowed: true, confidence: 1.0, reasons: [] };
  }

  /**
   * Medikal tavsiye filtresi
   */
  private async medicalAdviceFilter(content: string): Promise<Partial<ContentFilterResult>> {
    if (!this.config.medicalAdviceFilter) {
      return { allowed: true, confidence: 1.0, reasons: [] };
    }

    const medicalPatterns = [
      ...TURKISH_BLOCKED_PATTERNS.medical_advice,
      ...ENGLISH_BLOCKED_PATTERNS.medical_advice
    ];

    for (const pattern of medicalPatterns) {
      if (content.includes(pattern)) {
        return {
          allowed: false,
          confidence: 0.85,
          reasons: [`medical_advice_detected:${pattern}`],
          severity: 'medium'
        };
      }
    }

    return { allowed: true, confidence: 1.0, reasons: [] };
  }

  /**
   * Self-harm instruction filtresi
   */
  private async selfHarmInstructionFilter(content: string): Promise<Partial<ContentFilterResult>> {
    if (!this.config.selfHarmFilter) {
      return { allowed: true, confidence: 1.0, reasons: [] };
    }

    const selfHarmPatterns = [
      ...TURKISH_BLOCKED_PATTERNS.self_harm_instructions,
      ...ENGLISH_BLOCKED_PATTERNS.self_harm_instructions
    ];

    for (const pattern of selfHarmPatterns) {
      if (content.includes(pattern)) {
        return {
          allowed: false,
          confidence: 0.95,
          reasons: [`self_harm_instruction:${pattern}`],
          severity: 'critical'
        };
      }
    }

    return { allowed: true, confidence: 1.0, reasons: [] };
  }

  /**
   * Terapötik context filtresi
   */
  private async therapeuticContextFilter(
    content: string, 
    isTherapeutic: boolean
  ): Promise<Partial<ContentFilterResult>> {
    if (!this.config.therapeuticMode || !isTherapeutic) {
      return { allowed: true, confidence: 1.0, reasons: [] };
    }

    // Terapötik context'te hassas konular tartışılabilir
    const allowedPatterns = [
      ...THERAPEUTIC_ALLOWED_PATTERNS.mental_health_discussion,
      ...THERAPEUTIC_ALLOWED_PATTERNS.therapy_techniques
    ];

    let hasTherapeuticContent = false;
    for (const pattern of allowedPatterns) {
      if (content.includes(pattern)) {
        hasTherapeuticContent = true;
        break;
      }
    }

    if (hasTherapeuticContent) {
      return {
        allowed: true,
        confidence: 0.9,
        reasons: ['therapeutic_context_approved'],
        severity: 'low'
      };
    }

    return { allowed: true, confidence: 1.0, reasons: [] };
  }

  /**
   * Filter sonuçlarını birleştir
   */
  private combineFilterResults(
    results: Partial<ContentFilterResult>[],
    message: AIMessage
  ): ContentFilterResult {
    let overallAllowed = true;
    let lowestConfidence = 1.0;
    let allReasons: string[] = [];
    let highestSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    for (const result of results) {
      // Eğer herhangi bir filter red ederse, genel sonuç red
      if (result.allowed === false) {
        overallAllowed = false;
      }

      // En düşük confidence'ı al
      if (result.confidence !== undefined && result.confidence < lowestConfidence) {
        lowestConfidence = result.confidence;
      }

      // Tüm reason'ları topla
      if (result.reasons) {
        allReasons.push(...result.reasons);
      }

      // En yüksek severity'yi al
      if (result.severity && this.severityLevel(result.severity) > this.severityLevel(highestSeverity)) {
        highestSeverity = result.severity;
      }
    }

    // Suggested action belirleme
    const suggestedAction = this.determineSuggestedAction(overallAllowed, highestSeverity, lowestConfidence);

    return {
      allowed: overallAllowed,
      confidence: lowestConfidence,
      reasons: [...new Set(allReasons)], // Remove duplicates
      severity: highestSeverity,
      requiresHumanReview: highestSeverity === 'critical' || 
                          (highestSeverity === 'high' && lowestConfidence > 0.8),
      suggestedAction
    };
  }

  /**
   * Önerilen aksiyon belirleme
   */
  private determineSuggestedAction(
    allowed: boolean, 
    severity: 'low' | 'medium' | 'high' | 'critical',
    confidence: number
  ): 'allow' | 'block' | 'modify' | 'escalate' {
    if (!allowed) {
      if (severity === 'critical') return 'escalate';
      if (severity === 'high') return 'block';
      if (severity === 'medium' && confidence > 0.8) return 'block';
      return 'modify'; // Low severity veya düşük confidence - modify edilebilir
    }
    
    return 'allow';
  }

  /**
   * Category'ye göre severity belirleme
   */
  private getCategorySeverity(category: string): 'low' | 'medium' | 'high' | 'critical' {
    if (category.includes('self_harm') || category.includes('violence')) return 'critical';
    if (category.includes('illegal') || category.includes('harmful_substances')) return 'high';
    if (category.includes('medical') || category.includes('explicit')) return 'medium';
    return 'low';
  }

  /**
   * Severity level mapping
   */
  private severityLevel(severity: 'low' | 'medium' | 'high' | 'critical'): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[severity];
  }

  /**
   * Filter sonucunu logla
   */
  private async logFilterResult(result: ContentFilterResult, message: AIMessage): Promise<void> {
    // Telemetry'ye log
    await trackAIInteraction(AIEventType.AI_CONTENT_FILTERED, {
      contentFilter: {
        allowed: result.allowed,
        severity: result.severity,
        reasonCount: result.reasons.length,
        confidence: result.confidence,
        requiresHumanReview: result.requiresHumanReview
      },
      messageId: message.id
    });

    // Development logging
    if (__DEV__ && !result.allowed) {
      console.warn('🔒 Content filtered:', {
        allowed: result.allowed,
        severity: result.severity,
        reasons: result.reasons.slice(0, 2), // Limit logged reasons
        confidence: result.confidence
      });
    }
  }

  /**
   * Helper methods
   */
  private createAllowedResult(reason: string): ContentFilterResult {
    return {
      allowed: true,
      confidence: 1.0,
      reasons: [reason],
      severity: 'low',
      requiresHumanReview: false,
      suggestedAction: 'allow'
    };
  }

  private createBlockedResult(reasons: string[], severity: 'low' | 'medium' | 'high' | 'critical'): ContentFilterResult {
    return {
      allowed: false,
      confidence: 0.9,
      reasons,
      severity,
      requiresHumanReview: severity === 'critical' || severity === 'high',
      suggestedAction: severity === 'critical' ? 'escalate' : 'block'
    };
  }

  /**
   * Public API
   */
  async updateConfig(newConfig: Partial<ContentFilterConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
  }

  get isEnabled(): boolean {
    return this.config.enabled && this.isInitialized;
  }
}

// =============================================================================
// 📤 EXPORTS
// =============================================================================

// Singleton instance
export const contentFilterService = new ContentFilterService();

// Export types
export { ContentFilterConfig, ContentFilterResult, DEFAULT_CONFIG as DEFAULT_CONTENT_FILTER_CONFIG };