/**
 * 🏷️ OCD Categorization Service - AI-Powered Compulsion Classification
 * 
 * Bu service kompulsiyon açıklamalarını analiz ederek otomatik kategorizasyon,
 * alt-kategori tespiti ve güven skorlaması yapar. Kültürel duyarlılık ile
 * Türkçe dil desteği ve çoklu etiket sınıflandırması sağlar.
 * 
 * ⚠️ CRITICAL: UnifiedAIPipeline entegrasyonu zorunlu  
 * ⚠️ Feature flag kontrolü: AI_OCD_CATEGORIZATION
 * ⚠️ Heuristic fallback sistemi dahil
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { CompulsionEntry } from '@/types/compulsion';
import { 
  AIError,
  AIErrorCode,
  ErrorSeverity
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { externalAIService } from '@/features/ai/services/externalAIService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

export enum OCDCategory {
  CHECKING = 'checking',                    // Kontrol kompulsiyonları
  CONTAMINATION = 'contamination',          // Bulaşma/temizlik  
  COUNTING = 'counting',                    // Sayma ritüelleri
  SYMMETRY = 'symmetry',                    // Düzen/simetri
  INTRUSIVE_THOUGHTS = 'intrusive',         // İstenmeyen düşünceler
  HOARDING = 'hoarding',                    // Biriktirme
  RELIGIOUS = 'religious',                  // Dini skrupüller
  HARM_OBSESSIONS = 'harm',                 // Zarar verme obsesyonları
  SEXUAL_OBSESSIONS = 'sexual',             // Cinsel obsesyonlar
  OTHER = 'other'                           // Diğer/karma
}

export interface CategoryClassificationResult {
  primaryCategory: OCDCategory;
  confidence: number;                       // 0-1
  secondaryCategories: {
    category: OCDCategory;
    confidence: number;
  }[];
  subcategories: string[];                  // Detailed sub-classifications
  culturalFactors: {
    religiousComponent: boolean;
    familialInfluence: boolean;
    culturalNorms: boolean;
  };
  reasoning: string;                        // AI explanation
  suggestions: string[];                    // Treatment suggestions
  riskLevel: 'low' | 'medium' | 'high';    // Clinical risk assessment
}

interface HeuristicPatterns {
  [key: string]: {
    keywords: string[];
    phrases: RegExp[];
    severity_indicators: string[];
    cultural_markers?: string[];
    confidence_weight: number;
  };
}

interface CategorizationCache {
  [key: string]: {
    result: CategoryClassificationResult;
    timestamp: number;
  };
}

// =============================================================================
// 🏗️ MAIN SERVICE CLASS
// =============================================================================

class OCDCategorizationService {
  private static instance: OCDCategorizationService;
  private isInitialized = false;
  private cache: CategorizationCache = {};
  private heuristicPatterns: HeuristicPatterns;

  static getInstance(): OCDCategorizationService {
    if (!OCDCategorizationService.instance) {
      OCDCategorizationService.instance = new OCDCategorizationService();
    }
    return OCDCategorizationService.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // Load cache from storage
      const cachedData = await AsyncStorage.getItem('ocd_categorization_cache');
      if (cachedData) {
        this.cache = JSON.parse(cachedData);
      }

      // Initialize heuristic patterns
      this.initializeHeuristicPatterns();

      this.isInitialized = true;
      console.log('🏷️ OCD Categorization Service initialized');

      await trackAIInteraction(AIEventType.FEATURE_INITIALIZED, {
        feature: 'OCD_CATEGORIZATION',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Failed to initialize OCD Categorization Service:', error);
      await trackAIError(AIEventType.INITIALIZATION_ERROR, {
        feature: 'OCD_CATEGORIZATION',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN CLASSIFICATION METHOD
  // =============================================================================

  /**
   * Classify compulsion description using AI or heuristics
   */
  async classifyCompulsion(
    description: string,
    metadata?: {
      trigger?: string;
      severity?: number;
      previousCategories?: string[];
      userId?: string;
    }
  ): Promise<CategoryClassificationResult> {
    if (!this.isInitialized) {
      throw new Error('OCD Categorization Service not initialized');
    }

    const startTime = Date.now();
    console.log(`🏷️ Classifying compulsion: "${description.substring(0, 50)}..."`);

    try {
      // Input validation
      if (!description || description.trim().length < 3) {
        throw new Error('Description too short for classification');
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(description, metadata);
      const cached = this.cache[cacheKey];
      if (cached && (Date.now() - cached.timestamp < 3600000)) { // 1 hour cache
        console.log('🏷️ Using cached categorization result');
        return cached.result;
      }

      // Preprocess text
      const normalizedText = this.preprocessTurkishText(description);
      
      let result: CategoryClassificationResult;

      // Try AI classification first
      if (FEATURE_FLAGS.isEnabled('AI_OCD_CATEGORIZATION')) {
        try {
          result = await this.classifyWithAI(normalizedText, metadata);
          console.log('🌐 AI classification successful');
        } catch (aiError) {
          console.warn('⚠️ AI classification failed, falling back to heuristics:', aiError);
          result = this.classifyWithHeuristics(normalizedText, metadata);
        }
      } else {
        result = this.classifyWithHeuristics(normalizedText, metadata);
      }

      // Apply cultural context adjustments
      result = this.applyCulturalAdjustments(result, normalizedText);

      // Cache the result
      this.cache[cacheKey] = {
        result,
        timestamp: Date.now()
      };
      await this.persistCache();

      // Track success
      await trackAIInteraction(AIEventType.CATEGORIZATION_COMPLETED, {
        userId: metadata?.userId,
        primaryCategory: result.primaryCategory,
        confidence: result.confidence,
        method: FEATURE_FLAGS.isEnabled('AI_OCD_CATEGORIZATION') ? 'ai' : 'heuristic',
        duration: Date.now() - startTime
      });

      console.log(`✅ Categorization completed: ${result.primaryCategory} (${(result.confidence * 100).toFixed(1)}%)`);
      return result;

    } catch (error) {
      console.error('❌ Compulsion classification failed:', error);
      await trackAIError(AIEventType.CATEGORIZATION_ERROR, {
        userId: metadata?.userId,
        error: error instanceof Error ? error.message : String(error),
        description: description.substring(0, 100)
      });
      
      // Return fallback result
      return this.getFallbackResult(description);
    }
  }

  // =============================================================================
  // 🌐 AI-POWERED CLASSIFICATION
  // =============================================================================

  private async classifyWithAI(
    normalizedText: string,
    metadata?: any
  ): Promise<CategoryClassificationResult> {
    const prompt = this.buildAIClassificationPrompt(normalizedText, metadata);

    try {
      const aiResponse = await externalAIService.generateContent(prompt);
      return this.parseAIResponse(aiResponse.text, normalizedText);
    } catch (error) {
      console.error('AI classification request failed:', error);
      throw error;
    }
  }

  private buildAIClassificationPrompt(text: string, metadata?: any): string {
    return `
Sen bir OKB (Obsesif Kompulsif Bozukluk) uzmanısın. Aşağıdaki kompülsiyon açıklamasını analiz ederek en uygun kategoriye yerleştir.

KOMPÜLSIYON AÇIKLAMASI: "${text}"
${metadata?.trigger ? `TETİKLEYİCİ: "${metadata.trigger}"` : ''}
${metadata?.severity ? `ŞİDDET: ${metadata.severity}/10` : ''}

KATEGORİLER:
1. CHECKING (Kontrol) - Kapı, elektrik, güvenlik kontrolleri
2. CONTAMINATION (Bulaşma/Temizlik) - El yıkama, hijyen, kirlilik korkusu
3. COUNTING (Sayma) - Sayma ritüelleri, çift/tek sayılar
4. SYMMETRY (Düzen/Simetri) - Eşyaları yerleştirme, simetri ihtiyacı
5. INTRUSIVE (İstenmeyen Düşünceler) - Kafadan çıkmayan düşünceler
6. HOARDING (Biriktirme) - Atamama, toplama davranışı
7. RELIGIOUS (Dini) - Dini skrupüller, günah korkusu, ibadet endişeleri
8. HARM (Zarar Verme) - Kendine/başkalarına zarar verme korkusu
9. SEXUAL (Cinsel) - İstenmeyen cinsel düşünceler
10. OTHER (Diğer) - Yukarıdakilerle eşleşmeyen

TÜRK KÜLTÜRÜ FAKTÖRLERI:
- Dini pratikler (namaz, abdest, temizlik)
- Aile değerleri ve sorumluluklar
- Sosyal beklentiler ve mahrem kaygıları

Lütfen JSON formatında şu bilgileri ver:
{
  "primaryCategory": "kategori_adı",
  "confidence": 0.85,
  "secondaryCategories": [{"category": "diğer_kategori", "confidence": 0.3}],
  "subcategories": ["alt_kategori1", "alt_kategori2"],
  "culturalFactors": {
    "religiousComponent": true/false,
    "familialInfluence": true/false,
    "culturalNorms": true/false
  },
  "reasoning": "Sınıflandırma gerekçesi",
  "suggestions": ["Öneri1", "Öneri2"],
  "riskLevel": "low/medium/high"
}

ÖZEL DİKKAT:
- Türkçe dil nüanslarını dikkate al
- Dini içerik varsa RELIGIOUS kategorisini önceliklendir
- Kültürel bağlamı reasoning'de açıkla
- Güven skoru gerçekçi olsun
`;
  }

  private parseAIResponse(aiText: string, originalText: string): CategoryClassificationResult {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response
      return {
        primaryCategory: this.validateCategory(parsed.primaryCategory),
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        secondaryCategories: (parsed.secondaryCategories || [])
          .map((sc: any) => ({
            category: this.validateCategory(sc.category),
            confidence: Math.min(Math.max(sc.confidence || 0, 0), 1)
          }))
          .filter((sc: any) => sc.confidence > 0.1)
          .slice(0, 3), // Max 3 secondary categories
        subcategories: (parsed.subcategories || []).slice(0, 5),
        culturalFactors: {
          religiousComponent: Boolean(parsed.culturalFactors?.religiousComponent),
          familialInfluence: Boolean(parsed.culturalFactors?.familialInfluence),
          culturalNorms: Boolean(parsed.culturalFactors?.culturalNorms)
        },
        reasoning: parsed.reasoning || 'AI sınıflandırması yapıldı',
        suggestions: (parsed.suggestions || []).slice(0, 3),
        riskLevel: this.validateRiskLevel(parsed.riskLevel)
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error(`AI response parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // =============================================================================
  // ⚡ HEURISTIC CLASSIFICATION
  // =============================================================================

  private classifyWithHeuristics(
    normalizedText: string,
    metadata?: any
  ): CategoryClassificationResult {
    const scores = new Map<OCDCategory, number>();
    const matchedPatterns = new Map<OCDCategory, string[]>();

    // Score each category based on pattern matching
    Object.entries(this.heuristicPatterns).forEach(([categoryKey, pattern]) => {
      const category = categoryKey as OCDCategory;
      let score = 0;
      const matches: string[] = [];

      // Keyword matching
      pattern.keywords.forEach(keyword => {
        if (normalizedText.includes(keyword)) {
          score += pattern.confidence_weight * 0.3;
          matches.push(keyword);
        }
      });

      // Phrase pattern matching
      pattern.phrases.forEach(phrase => {
        if (phrase.test(normalizedText)) {
          score += pattern.confidence_weight * 0.5;
          matches.push(phrase.toString());
        }
      });

      // Severity indicators
      pattern.severity_indicators.forEach(indicator => {
        if (normalizedText.includes(indicator)) {
          score += pattern.confidence_weight * 0.2;
          matches.push(indicator);
        }
      });

      // Cultural markers (bonus points)
      if (pattern.cultural_markers) {
        pattern.cultural_markers.forEach(marker => {
          if (normalizedText.includes(marker)) {
            score += pattern.confidence_weight * 0.4;
            matches.push(marker);
          }
        });
      }

      scores.set(category, score);
      if (matches.length > 0) {
        matchedPatterns.set(category, matches);
      }
    });

    // Find primary and secondary categories
    const sortedCategories = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([, score]) => score > 0);

    if (sortedCategories.length === 0) {
      return this.getFallbackResult(normalizedText);
    }

    const [primaryCategory, primaryScore] = sortedCategories[0];
    const confidence = Math.min(0.95, primaryScore);

    const secondaryCategories = sortedCategories
      .slice(1)
      .filter(([, score]) => score > primaryScore * 0.3)
      .slice(0, 2)
      .map(([category, score]) => ({
        category,
        confidence: Math.min(0.8, score * 0.8)
      }));

    // Generate subcategories based on matched patterns
    const subcategories = this.generateSubcategories(primaryCategory, matchedPatterns.get(primaryCategory) || []);

    return {
      primaryCategory,
      confidence,
      secondaryCategories,
      subcategories,
      culturalFactors: this.detectCulturalFactors(normalizedText),
      reasoning: `Heuristik analiz: ${matchedPatterns.get(primaryCategory)?.slice(0, 3).join(', ') || 'pattern matches'}`,
      suggestions: this.generateSuggestions(primaryCategory, confidence),
      riskLevel: this.assessRiskLevel(primaryCategory, confidence, metadata?.severity)
    };
  }

  // =============================================================================
  // 🛠️ HELPER METHODS
  // =============================================================================

  private initializeHeuristicPatterns(): void {
    this.heuristicPatterns = {
      [OCDCategory.CHECKING]: {
        keywords: ['kontrol', 'baktım', 'kapatmış', 'kilitlemiş', 'doğru', 'emin', 'tekrar'],
        phrases: [
          /kontrol etti?m/i,
          /tekrar bakt?ım/i,
          /emin olmak için/i,
          /kapı.*?kilitli/i,
          /elektrik.*?kapalı/i,
          /ocak.*?kapalı/i,
          /alarm.*?kurulu/i
        ],
        severity_indicators: ['sürekli', 'defalarca', 'durmadan', 'obsesif'],
        cultural_markers: ['ev güvenliği', 'aile sorumluluğu'],
        confidence_weight: 1.0
      },

      [OCDCategory.CONTAMINATION]: {
        keywords: ['kirli', 'temiz', 'yıka', 'bulaş', 'mikrop', 'bakteri', 'hastalık', 'dezenfektan', 'sabun'],
        phrases: [
          /el.*?yıka/i,
          /temizlik yap/i,
          /kirlenmiş gibi/i,
          /bulaşıcı.*?hastalık/i,
          /hijyen.*?kaygı/i,
          /steril.*?ol/i
        ],
        severity_indicators: ['dayanamam', 'iğrenç', 'çok kirli', 'tiksiniyorum'],
        cultural_markers: ['namaz öncesi', 'dini temizlik', 'abdest'],
        confidence_weight: 1.0
      },

      [OCDCategory.COUNTING]: {
        keywords: ['saydım', 'rakam', 'tekrarladım', 'kaç', 'tane', 'kez', 'kere'],
        phrases: [
          /üç.*?kez/i,
          /beş.*?kere/i,
          /çift.*?sayı/i,
          /tek.*?sayı/i,
          /say.*?mak zorunda/i,
          /belirli.*?sayı/i
        ],
        severity_indicators: ['tam olmalı', 'mükemmel', 'doğru sayı'],
        confidence_weight: 0.9
      },

      [OCDCategory.SYMMETRY]: {
        keywords: ['düzenli', 'simetrik', 'tam', 'orta', 'eşit', 'düz', 'yerli yerine', 'toparla', 'düzelt'],
        phrases: [
          /düzenli.*?olmalı/i,
          /tam.*?orta/i,
          /düz.*?durmalı/i,
          /karışık.*?duramam/i,
          /simetri.*?bozul/i
        ],
        severity_indicators: ['mükemmel olmalı', 'rahatsız ediyor'],
        cultural_markers: ['ev düzeni', 'misafir'],
        confidence_weight: 0.9
      },

      [OCDCategory.INTRUSIVE_THOUGHTS]: {
        keywords: ['düşünce', 'kafamdan çık', 'takıntı', 'obsesyon', 'zihinimden', 'rahat bırak'],
        phrases: [
          /düşünce.*?dur/i,
          /kafamdan çık/i,
          /sürekli.*?geliyor/i,
          /dayanamıyorum/i,
          /rahat.*?bırak/i,
          /zihnimden.*?sil/i
        ],
        severity_indicators: ['çıldıracağım', 'beni rahatsız ediyor', 'dur dur'],
        confidence_weight: 1.0
      },

      [OCDCategory.RELIGIOUS]: {
        keywords: ['günah', 'allah', 'namaz', 'abdest', 'dua', 'ibadet', 'haram', 'helal', 'temiz'],
        phrases: [
          /namaz.*?doğru/i,
          /abdest.*?bozul/i,
          /günah.*?işle/i,
          /allah.*?rahatsız/i,
          /dini.*?kural/i
        ],
        severity_indicators: ['cehennem', 'lanetli', 'günahkar'],
        cultural_markers: ['namaz', 'abdest', 'dini vazife', 'ibadet'],
        confidence_weight: 1.1
      },

      [OCDCategory.HOARDING]: {
        keywords: ['at', 'atmam', 'biriktir', 'topla', 'sakla', 'kaybet', 'lazım olur'],
        phrases: [
          /atmaya.*?dayanamam/i,
          /lazım.*?olur/i,
          /biriktir.*?mek/i,
          /çöpe.*?atamam/i
        ],
        severity_indicators: ['hiçbir şey atmam', 'her şey lazım'],
        confidence_weight: 0.8
      },

      [OCDCategory.HARM]: {
        keywords: ['zarar', 'incit', 'öldür', 'vurmak', 'zarar ver', 'korkuyorum'],
        phrases: [
          /zarar.*?vereceğim/i,
          /incit.*?eceğim/i,
          /kontrol.*?kaybet/i,
          /kötülük.*?yap/i
        ],
        severity_indicators: ['çok korkuyorum', 'yapmamaya çalışıyorum'],
        confidence_weight: 1.0
      },

      [OCDCategory.SEXUAL]: {
        keywords: ['cinsel', 'uygunsuz', 'şehvet', 'arzu'],
        phrases: [
          /uygunsuz.*?düşünce/i,
          /cinsel.*?hayal/i,
          /şehvet.*?düşünce/i
        ],
        severity_indicators: ['çok utanıyorum', 'istemiyorum'],
        cultural_markers: ['mahrem', 'ayıp'],
        confidence_weight: 0.9
      },

      [OCDCategory.OTHER]: {
        keywords: ['garip', 'tuhaf', 'anlamıyorum', 'karışık'],
        phrases: [/.*?/], // Catch-all
        severity_indicators: [],
        confidence_weight: 0.3
      }
    };
  }

  private preprocessTurkishText(text: string): string {
    return text
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .trim();
  }

  private validateCategory(category: string): OCDCategory {
    const validCategories = Object.values(OCDCategory);
    return validCategories.includes(category as OCDCategory) 
      ? category as OCDCategory 
      : OCDCategory.OTHER;
  }

  private validateRiskLevel(riskLevel: string): 'low' | 'medium' | 'high' {
    return ['low', 'medium', 'high'].includes(riskLevel) 
      ? riskLevel as 'low' | 'medium' | 'high'
      : 'medium';
  }

  private generateSubcategories(category: OCDCategory, matches: string[]): string[] {
    const subcategoryMap: Record<OCDCategory, string[]> = {
      [OCDCategory.CHECKING]: ['Güvenlik kontrolü', 'Elektrik kontrolü', 'Kapı kontrolü'],
      [OCDCategory.CONTAMINATION]: ['El yıkama', 'Temizlik', 'Hijyen endişesi'],
      [OCDCategory.COUNTING]: ['Sayma ritüeli', 'Çift sayılar', 'Tekrar etme'],
      [OCDCategory.SYMMETRY]: ['Düzen obsesyonu', 'Simetri ihtiyacı', 'Yerleştirme'],
      [OCDCategory.INTRUSIVE_THOUGHTS]: ['İstenmeyen düşünceler', 'Takıntılı fikirler'],
      [OCDCategory.RELIGIOUS]: ['Dini skrupüller', 'İbadet endişeleri', 'Günah korkusu'],
      [OCDCategory.HOARDING]: ['Biriktirme', 'Atamama', 'Toplama'],
      [OCDCategory.HARM]: ['Zarar verme korkusu', 'Kontrol kaybı endişesi'],
      [OCDCategory.SEXUAL]: ['Cinsel obsesyonlar', 'İstenmeyen arzular'],
      [OCDCategory.OTHER]: ['Karma obsesyon', 'Diğer']
    };

    return subcategoryMap[category] || ['Genel'];
  }

  private detectCulturalFactors(text: string): {
    religiousComponent: boolean;
    familialInfluence: boolean;
    culturalNorms: boolean;
  } {
    const religiousKeywords = ['namaz', 'abdest', 'günah', 'allah', 'dua', 'ibadet'];
    const familialKeywords = ['aile', 'anne', 'baba', 'ev', 'misafir', 'akraba'];
    const culturalKeywords = ['komşu', 'mahalle', 'toplum', 'gelenek'];

    return {
      religiousComponent: religiousKeywords.some(keyword => text.includes(keyword)),
      familialInfluence: familialKeywords.some(keyword => text.includes(keyword)),
      culturalNorms: culturalKeywords.some(keyword => text.includes(keyword))
    };
  }

  private generateSuggestions(category: OCDCategory, confidence: number): string[] {
    const baseSuggestions: Record<OCDCategory, string[]> = {
      [OCDCategory.CHECKING]: [
        'Kontrol davranışını sınırlandırmaya çalışın',
        'Terapi egzersizleri deneyin',
        'Maruz kalma terapisi faydalı olabilir'
      ],
      [OCDCategory.CONTAMINATION]: [
        'Temizlik davranışını kademeli olarak azaltın',
        'Bulaşma korkularına maruz kalma egzersizleri',
        'Hijyen standartlarını gerçekçi tutun'
      ],
      [OCDCategory.COUNTING]: [
        'Sayma ritüellerini durdurmaya çalışın',
        'Dikkat dağıtıcı aktiviteler yapın',
        'Mindfulness teknikleri uygulayın'
      ],
      [OCDCategory.SYMMETRY]: [
        'Düzensizliğe tolerans geliştirin',
        'Kademeli maruz kalma egzersizleri',
        'Mükemmeliyetçilikle çalışın'
      ],
      [OCDCategory.INTRUSIVE_THOUGHTS]: [
        'Düşünceleri kabul etme teknikleri',
        'Mindfulness meditasyonu',
        'Bilişsel defüzyon teknikleri'
      ],
      [OCDCategory.RELIGIOUS]: [
        'Dini değerler ile OKB semptomlarını ayırt edin',
        'Din görevlisi ile görüşün',
        'Kültürel duyarlı terapi alın'
      ],
      [OCDCategory.HOARDING]: [
        'Kademeli atma egzersizleri',
        'Değer yargılarını sorgulayın',
        'Organize etme teknikleri öğrenin'
      ],
      [OCDCategory.HARM]: [
        'Profesyonel destek alın',
        'Güvenlik davranışlarını azaltın',
        'ERP terapisi çok önemli'
      ],
      [OCDCategory.SEXUAL]: [
        'Düşünce kayıtları tutun',
        'Cinsel obsesyonlara özel terapi',
        'Kabul ve kararlılık terapisi'
      ],
      [OCDCategory.OTHER]: [
        'Genel OKB stratejileri uygulayın',
        'Profesyonel değerlendirme alın',
        'Kişiselleştirilmiş tedavi planı'
      ]
    };

    let suggestions = baseSuggestions[category] || [];
    
    // High confidence = more specific suggestions
    if (confidence > 0.8) {
      suggestions = suggestions.slice(0, 2); // Most relevant
    }

    return suggestions;
  }

  private assessRiskLevel(category: OCDCategory, confidence: number, severity?: number): 'low' | 'medium' | 'high' {
    // High-risk categories
    if ([OCDCategory.HARM, OCDCategory.SEXUAL].includes(category)) {
      return confidence > 0.7 ? 'high' : 'medium';
    }

    // Severity-based assessment
    if (severity) {
      if (severity >= 8) return 'high';
      if (severity >= 6) return 'medium';
      return 'low';
    }

    // Confidence-based assessment
    if (confidence > 0.8) return 'medium';
    return 'low';
  }

  private applyCulturalAdjustments(
    result: CategoryClassificationResult,
    text: string
  ): CategoryClassificationResult {
    // If religious content detected, boost religious category or adjust primary
    if (result.culturalFactors.religiousComponent) {
      const religiousKeywords = ['namaz', 'abdest', 'günah', 'allah'];
      const hasStrongReligious = religiousKeywords.some(k => text.includes(k));
      
      if (hasStrongReligious && result.primaryCategory !== OCDCategory.RELIGIOUS) {
        // Move current primary to secondary
        result.secondaryCategories.unshift({
          category: result.primaryCategory,
          confidence: result.confidence * 0.8
        });
        
        // Make religious primary
        result.primaryCategory = OCDCategory.RELIGIOUS;
        result.confidence = Math.min(0.9, result.confidence + 0.2);
        result.reasoning += ' (Dini içerik nedeniyle ayarlandı)';
      }
    }

    return result;
  }

  private getFallbackResult(text: string): CategoryClassificationResult {
    return {
      primaryCategory: OCDCategory.OTHER,
      confidence: 0.3,
      secondaryCategories: [],
      subcategories: ['Genel kompulsiyon'],
      culturalFactors: {
        religiousComponent: false,
        familialInfluence: false,
        culturalNorms: false
      },
      reasoning: 'Fallback kategorisi - daha detaylı açıklama gerekebilir',
      suggestions: ['Daha detaylı açıklama ekleyin', 'Profesyonel değerlendirme alın'],
      riskLevel: 'medium'
    };
  }

  private generateCacheKey(description: string, metadata?: any): string {
    const textHash = description.substring(0, 50);
    const metadataHash = metadata ? JSON.stringify(metadata).substring(0, 20) : '';
    return `categorization_${textHash}_${metadataHash}`.replace(/[^a-zA-Z0-9_]/g, '');
  }

  private async persistCache(): Promise<void> {
    try {
      // Keep only recent cache entries (last 24 hours)
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      const filteredCache: CategorizationCache = {};
      
      Object.entries(this.cache).forEach(([key, value]) => {
        if (value.timestamp > cutoff) {
          filteredCache[key] = value;
        }
      });
      
      this.cache = filteredCache;
      await AsyncStorage.setItem('ocd_categorization_cache', JSON.stringify(this.cache));
    } catch (error) {
      console.error('Failed to persist categorization cache:', error);
    }
  }

  /**
   * Batch categorize multiple descriptions
   */
  async batchClassify(
    descriptions: Array<{
      description: string;
      metadata?: any;
    }>
  ): Promise<CategoryClassificationResult[]> {
    const results: CategoryClassificationResult[] = [];
    
    for (const item of descriptions) {
      try {
        const result = await this.classifyCompulsion(item.description, item.metadata);
        results.push(result);
      } catch (error) {
        console.error(`Failed to classify: "${item.description.substring(0, 30)}..."`, error);
        results.push(this.getFallbackResult(item.description));
      }
    }
    
    return results;
  }

  /**
   * Get category statistics for a user
   */
  async getCategoryStatistics(compulsions: CompulsionEntry[]): Promise<{
    distribution: Record<OCDCategory, number>;
    trends: Record<OCDCategory, 'increasing' | 'decreasing' | 'stable'>;
    recommendations: string[];
  }> {
    const distribution: Record<OCDCategory, number> = {} as Record<OCDCategory, number>;
    
    // Initialize all categories
    Object.values(OCDCategory).forEach(category => {
      distribution[category] = 0;
    });
    
    // Count categorized compulsions
    for (const compulsion of compulsions) {
      try {
        const result = await this.classifyCompulsion(compulsion.notes || compulsion.type, {
          severity: compulsion.intensity,
          userId: compulsion.userId
        });
        distribution[result.primaryCategory]++;
      } catch (error) {
        distribution[OCDCategory.OTHER]++;
      }
    }

    // Calculate trends (simplified)
    const trends: Record<OCDCategory, 'increasing' | 'decreasing' | 'stable'> = {} as Record<OCDCategory, 'increasing' | 'decreasing' | 'stable'>;
    Object.values(OCDCategory).forEach(category => {
      trends[category] = 'stable'; // Simplified - could be enhanced with temporal analysis
    });

    // Generate recommendations
    const topCategories = Object.entries(distribution)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const recommendations = topCategories.map(([category, count]) =>
      `${category} kategorisinde ${count} kayıt: Bu alanda özel odaklı çalışma gerekebilir`
    );

    return {
      distribution,
      trends,
      recommendations
    };
  }
}

// =============================================================================
// 🎯 SINGLETON EXPORT
// =============================================================================

export const ocdCategorizationService = OCDCategorizationService.getInstance();
export type { CategoryClassificationResult, OCDCategory };
