/**
 * 🇹🇷 Turkish CBT Service - Cultural & Language Adaptation
 * 
 * CBT tekniklerini Türk kültürüne ve diline uyarlar.
 * Türkçe dilbilim özelliklerini CBT analizi için optimize eder.
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🇹🇷 CULTURAL ADAPTATIONS
// =============================================================================

export interface TurkishCulturalContext {
  familyCentric: boolean;
  collectiveCulture: boolean;
  religionNeutral: boolean;
  respectHierarchy: boolean;
}

export interface TurkishCBTAdaptation {
  culturalReframes: string[];
  familyIntegratedSuggestions: string[];
  collectiveValueReferences: string[];
  culturalMetaphors: string[];
}

const TURKISH_CULTURAL_ADAPTATIONS = {
  familyCentric: {
    reframes: [
      'Ailenin desteğini hissettiğinde bu durum nasıl değişir?',
      'Sevdiklerin seni olduğun gibi kabul ediyor',
      'Bu durumda büyüklerin tecrübesi sana nasıl yol gösterebilir?',
      'Ailenle birlikte bu zorluğun üstesinden gelinebilir',
      'Yakınlarının sana olan sevgisi bu düşünceyi nasıl etkiler?'
    ],
    considerations: [
      'Aile görüşlerini dahil etme',
      'Kollektif kültür değerlerini koruma',
      'Saygi ve hürmet kavramlarını entegre etme',
      'Aile desteğini vurgulama',
      'Büyüklerin tecrübesine referans'
    ]
  },
  
  religiousConsiderations: {
    neutral: true, // Din-agnostik yaklaşım
    inclusive: [
      'İnanç sisteminle uyumlu olarak...',
      'Değer sistemine saygı duyarak...',
      'Kendi hakikatin doğrultusunda...',
      'Manevi değerlerin ışığında...',
      'İçsel inancınla barışık olarak...'
    ]
  },
  
  collectiveValues: {
    reframes: [
      'Toplumsal sorumluluklarınla bu durum nasıl dengelenir?',
      'Çevrendeki insanlara nasıl katkı sağlayabilirsin?',
      'Bu durumda toplumsal desteği nasıl kullanabilirsin?',
      'Başkalarıyla paylaştığında bu yük nasıl hafifler?'
    ],
    metaphors: [
      'Su damlası bile taşı deler - küçük adımlar büyük değişim',
      'Ağaç dallarına büküldüğü için kırılmaz',
      'Karınca kararınca, bal arısı kararınca',
      'Yavaş yavaş dağları da geçeriz'
    ]
  }
};

// =============================================================================
// 🔤 TURKISH NLP OPTIMIZATIONS
// =============================================================================

export interface TurkishNLPFeatures {
  morphologicalAnalysis: {
    stemming: Record<string, string>;
    suffixPatterns: string[];
    negationDetection: string[];
  };
  sentimentMapping: {
    positive: string[];
    negative: string[];
    intensifiers: string[];
  };
  distortionIndicators: {
    [key: string]: string[];
  };
}

export const TURKISH_NLP_FEATURES: TurkishNLPFeatures = {
  morphologicalAnalysis: {
    // Türkçe'nin agglutinative (eklemeli) yapısı
    stemming: {
      'sevemedim': 'sev-',
      'yapamıyorum': 'yap-',
      'başaramıyorum': 'başar-',
      'dayanamıyorum': 'dayan-',
      'anlayamıyorum': 'anla-',
      'bulamıyorum': 'bul-',
      'gelemiyorum': 'gel-'
    },
    suffixPatterns: ['-emedim', '-amıyorum', '-mayacağım', '-emiyorum', '-miyorum'],
    negationDetection: ['değil', 'yok', '-me/-ma', '-sız/-suz', 'olmaz', 'olmayan']
  },
  
  sentimentMapping: {
    positive: [
      'güzel', 'iyi', 'harika', 'mükemmel', 'başarılı', 'muhteşem',
      'şahane', 'kusursuz', 'olağanüstü', 'fevkalade', 'nefis',
      'umutlu', 'iyimser', 'neşeli', 'mutlu', 'keyifli', 'coşkulu',
      'rahat', 'huzurlu', 'sakin', 'dingin', 'sükûnet'
    ],
    negative: [
      'kötü', 'berbat', 'korkunç', 'başarısız', 'rezalet',
      'felâket', 'müthiş', 'dağ başı', 'kâbus', 'cehennem',
      'üzgün', 'mutsuz', 'kahır', 'gamgin', 'melul', 'kederli',
      'gergin', 'stresli', 'bunalmış', 'sıkılmış', 'boğulmuş'
    ],
    intensifiers: [
      'çok', 'son derece', 'aşırı', 'fazlasıyla', 'oldukça',
      'hayli', 'bir hayli', 'epey', 'ziyadesiyle', 'pek',
      'gayet', 'bayağı', 'iyice', 'iyiden iyiye'
    ]
  },
  
  distortionIndicators: {
    catastrophizing: [
      'felaket', 'dünyanın sonu', 'berbat', 'mahvoldum',
      'bitti', 'yıkıldım', 'kahroldum', 'battım', 'cehennem',
      'korkunç', 'müthiş', 'rezalet', 'kabus'
    ],
    allOrNothing: [
      'hep', 'hiç', 'asla', 'daima', 'her zaman', 'hiçbir zaman',
      'kesinlikle', 'mutlaka', 'tamamen', 'büsbütün', 'bütünüyle'
    ],
    shouldStatements: [
      'malıyım', 'lazım', 'gerek', 'mecburum', 'zorundayım',
      'şart', 'vacip', 'zorunlu', 'lüzumlu'
    ],
    mindReading: [
      'beni yargılıyor', 'ne düşündüğünü biliyorum',
      'emindir ki', 'kesin düşünüyor', 'sanıyor ki',
      'zannediyor', 'herhalde düşünüyor'
    ],
    personalization: [
      'benim yüzümden', 'benim suçum', 'ben sebep oldum',
      'hep ben', 'yine ben', 'sadece ben'
    ],
    labeling: [
      'ben bir başarısızım', 'ben aptalım', 'ben değersizim',
      'ben beceriksizim', 'ben ahmakım', 'ben zavallıyım'
    ]
  }
};

// =============================================================================
// 🎯 TURKISH CBT SERVICE
// =============================================================================

class TurkishCBTService {
  private static instance: TurkishCBTService;

  static getInstance(): TurkishCBTService {
    if (!TurkishCBTService.instance) {
      TurkishCBTService.instance = new TurkishCBTService();
    }
    return TurkishCBTService.instance;
  }

  /**
   * Türkçe metni CBT analizi için preprocess eder
   */
  preprocessTurkishText(text: string): {
    processedText: string;
    detectedPatterns: string[];
    morphologicalInfo: any;
    sentiment: 'positive' | 'negative' | 'neutral';
    intensity: number;
  } {
    const lowerText = text.toLowerCase();
    const detectedPatterns: string[] = [];
    
    // Morphological analysis
    const morphologicalInfo = this.analyzeTurkishMorphology(lowerText);
    
    // Sentiment analysis
    const sentiment = this.analyzeTurkishSentiment(lowerText);
    
    // Pattern detection
    Object.entries(TURKISH_NLP_FEATURES.distortionIndicators).forEach(([distortion, indicators]) => {
      const found = indicators.some(indicator => lowerText.includes(indicator));
      if (found) {
        detectedPatterns.push(distortion);
      }
    });

    return {
      processedText: lowerText,
      detectedPatterns,
      morphologicalInfo,
      sentiment: sentiment.type,
      intensity: sentiment.intensity
    };
  }

  /**
   * Türkçe morfolog
   */
  private analyzeTurkishMorphology(text: string) {
    const { stemming, suffixPatterns, negationDetection } = TURKISH_NLP_FEATURES.morphologicalAnalysis;
    
    const stems: string[] = [];
    const suffixes: string[] = [];
    const negations: string[] = [];

    // Stem detection
    Object.entries(stemming).forEach(([word, stem]) => {
      if (text.includes(word)) {
        stems.push(stem);
      }
    });

    // Suffix pattern detection
    suffixPatterns.forEach(pattern => {
      if (text.includes(pattern)) {
        suffixes.push(pattern);
      }
    });

    // Negation detection
    negationDetection.forEach(negation => {
      if (text.includes(negation)) {
        negations.push(negation);
      }
    });

    return { stems, suffixes, negations };
  }

  /**
   * Türkçe sentiment analysis
   */
  private analyzeTurkishSentiment(text: string): {
    type: 'positive' | 'negative' | 'neutral';
    intensity: number;
  } {
    const { positive, negative, intensifiers } = TURKISH_NLP_FEATURES.sentimentMapping;
    
    let positiveScore = 0;
    let negativeScore = 0;
    let intensityMultiplier = 1;

    // Count positive words
    positive.forEach(word => {
      if (text.includes(word)) positiveScore++;
    });

    // Count negative words
    negative.forEach(word => {
      if (text.includes(word)) negativeScore++;
    });

    // Check intensifiers
    intensifiers.forEach(intensifier => {
      if (text.includes(intensifier)) {
        intensityMultiplier *= 1.5;
      }
    });

    const finalPositive = positiveScore * intensityMultiplier;
    const finalNegative = negativeScore * intensityMultiplier;

    if (finalPositive > finalNegative) {
      return {
        type: 'positive',
        intensity: Math.min(finalPositive / (finalPositive + finalNegative), 1)
      };
    } else if (finalNegative > finalPositive) {
      return {
        type: 'negative',
        intensity: Math.min(finalNegative / (finalPositive + finalNegative), 1)
      };
    } else {
      return {
        type: 'neutral',
        intensity: 0.5
      };
    }
  }

  /**
   * Kulturel olarak uyarlanmış reframe önerileri
   */
  generateCulturallyAdaptedReframes(
    originalThought: string,
    detectedDistortions: string[],
    culturalContext?: TurkishCulturalContext
  ): string[] {
    const reframes: string[] = [];
    
    // Family-centric reframes
    if (culturalContext?.familyCentric !== false) {
      reframes.push(...TURKISH_CULTURAL_ADAPTATIONS.familyCentric.reframes);
    }

    // Collective culture reframes
    if (culturalContext?.collectiveCulture !== false) {
      reframes.push(...TURKISH_CULTURAL_ADAPTATIONS.collectiveValues.reframes);
    }

    // Religious-neutral reframes
    if (culturalContext?.religionNeutral !== false) {
      reframes.push(...TURKISH_CULTURAL_ADAPTATIONS.religiousConsiderations.inclusive);
    }

    // Distortion-specific cultural reframes
    detectedDistortions.forEach(distortion => {
      switch (distortion) {
        case 'catastrophizing':
          reframes.push('Su damlası bile taşı deler - bu durum da geçecek');
          reframes.push('Sabır acıdır ama meyvesi tatlıdır');
          break;
        case 'allOrNothing':
          reframes.push('Orta yolu bulma sanatı - ne çok sıcak ne çok soğuk');
          reframes.push('Ağaç dallarına büküldüğü için kırılmaz');
          break;
        case 'personalization':
          reframes.push('Herkesin sorumluluğu ayrıdır - sen sadece kendi payına odaklan');
          break;
      }
    });

    // Filter and select best reframes
    return this.selectBestReframes(reframes, originalThought, 3);
  }

  /**
   * En uygun reframe'leri seçer
   */
  private selectBestReframes(reframes: string[], originalThought: string, count: number): string[] {
    // Simple selection based on diversity and relevance
    const selected: string[] = [];
    const used: Set<string> = new Set();

    reframes.forEach(reframe => {
      if (selected.length < count && !used.has(reframe)) {
        // Simple relevance check - avoid duplicate themes
        const isDuplicate = selected.some(existing => 
          this.calculateSimilarity(existing, reframe) > 0.7
        );
        
        if (!isDuplicate) {
          selected.push(reframe);
          used.add(reframe);
        }
      }
    });

    return selected;
  }

  /**
   * İki string arasında benzerlik hesaplar
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(' '));
    const words2 = new Set(str2.toLowerCase().split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Turkish cultural metaphors
   */
  getCulturalMetaphors(context: string): string[] {
    return TURKISH_CULTURAL_ADAPTATIONS.collectiveValues.metaphors.filter(metaphor =>
      this.isMetaphorRelevant(metaphor, context)
    );
  }

  private isMetaphorRelevant(metaphor: string, context: string): boolean {
    // Simple relevance check - can be improved with ML
    const contextKeywords = context.toLowerCase().split(' ');
    
    if (contextKeywords.some(word => ['zor', 'zorlu', 'güç'].includes(word))) {
      return metaphor.includes('dağ') || metaphor.includes('taş') || metaphor.includes('yavaş');
    }
    
    if (contextKeywords.some(word => ['küçük', 'adım', 'ilerleme'].includes(word))) {
      return metaphor.includes('damla') || metaphor.includes('karınca');
    }
    
    return true; // Default: show all metaphors
  }

  /**
   * Turkish language honorifics integration
   */
  adaptHonorifics(text: string, userProfile?: { age?: number; gender?: string }): string {
    // Simple honorific adaptation based on age and context
    if (userProfile?.age && userProfile.age < 25) {
      return text.replace(/\bsiz\b/g, 'sen');
    } else {
      return text.replace(/\bsen\b/g, 'siz');
    }
  }
}

export const turkishCBTService = TurkishCBTService.getInstance();

// =============================================================================
// 🎯 HELPER FUNCTIONS
// =============================================================================

/**
 * CBT terminolojisini Türkçeye çevirir
 */
export const CBT_TERMINOLOGY_TURKISH = {
  // Cognitive Distortions
  'all_or_nothing': 'Hep-hiç düşünce',
  'overgeneralization': 'Aşırı genelleme',
  'mental_filter': 'Zihinsel filtreleme',
  'catastrophizing': 'Felaketleştirme',
  'mind_reading': 'Zihin okuma',
  'fortune_telling': 'Falcılık',
  'emotional_reasoning': 'Duygusal çıkarım',
  'should_statements': 'Olmalı ifadeleri',
  'labeling': 'Etiketleme',
  'personalization': 'Kişiselleştirme',
  
  // CBT Techniques
  'socratic_questioning': 'Sokratik sorgulama',
  'cognitive_restructuring': 'Bilişsel yeniden yapılandırma',
  'thought_challenging': 'Düşünce sınama',
  'behavioral_experiment': 'Davranışsal deney',
  'mindfulness_integration': 'Farkındalık entegrasyonu',
  
  // Common CBT Terms
  'automatic_thoughts': 'Otomatik düşünceler',
  'core_beliefs': 'Temel inançlar',
  'intermediate_beliefs': 'Ara inançlar',
  'thought_record': 'Düşünce kaydı',
  'evidence': 'Kanıt',
  'balanced_thought': 'Dengeli düşünce'
};

/**
 * Turkish cultural considerations checker
 */
export function checkCulturalSensitivity(content: string): {
  isSensitive: boolean;
  suggestions: string[];
  issues: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check for family references
  if (content.includes('aile') || content.includes('anne') || content.includes('baba')) {
    suggestions.push('Aile değerlerini koruyucu yaklaşım benimse');
  }
  
  // Check for religious references
  const religiousWords = ['allah', 'tanrı', 'din', 'namaz', 'oruç'];
  if (religiousWords.some(word => content.toLowerCase().includes(word))) {
    suggestions.push('Dini inançlara saygılı ve nötr yaklaşım kullan');
    suggestions.push('Kişisel inanç sistemini destekleyici ol');
  }
  
  // Check for gender-specific content
  if (content.includes('erkek') || content.includes('kadın')) {
    suggestions.push('Toplumsal cinsiyet rollerine karşı duyarlı yaklaş');
  }
  
  return {
    isSensitive: issues.length > 0,
    suggestions,
    issues
  };
}

/**
 * Format Turkish CBT response with cultural adaptations
 */
export function formatTurkishCBTResponse(
  response: string,
  culturalContext: TurkishCulturalContext
): string {
  let formattedResponse = response;
  
  // Add family-centric language if appropriate
  if (culturalContext.familyCentric) {
    formattedResponse = formattedResponse.replace(
      /\byou\b/g, 
      'siz ve aileniz'
    );
  }
  
  // Add respectful language
  if (culturalContext.respectHierarchy) {
    formattedResponse = turkishCBTService.adaptHonorifics(formattedResponse);
  }
  
  return formattedResponse;
}
