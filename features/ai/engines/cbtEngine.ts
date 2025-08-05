/**
 * CBT (Cognitive Behavioral Therapy) Engine
 * 
 * Kanıta dayalı CBT teknikleri kullanarak kullanıcıya rehberlik eden motor
 * Socratic questioning, cognitive distortion detection, thought challenging
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage,
  ConversationContext,
  AIResponse,
  AIError,
  AIErrorCode,
  TherapeuticTechnique
} from '@/features/ai/types';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// CBT Teknikleri
export enum CBTTechnique {
  SOCRATIC_QUESTIONING = 'socratic_questioning',
  COGNITIVE_RESTRUCTURING = 'cognitive_restructuring',
  THOUGHT_CHALLENGING = 'thought_challenging',
  BEHAVIORAL_EXPERIMENT = 'behavioral_experiment',
  MINDFULNESS_INTEGRATION = 'mindfulness_integration',
  EXPOSURE_HIERARCHY = 'exposure_hierarchy',
  RELAPSE_PREVENTION = 'relapse_prevention',
  PROGRESS_CELEBRATION = 'progress_celebration'
}

// Bilişsel Çarpıtmalar (Cognitive Distortions)
export enum CognitiveDistortion {
  ALL_OR_NOTHING = 'all_or_nothing',           // Siyah-beyaz düşünce
  OVERGENERALIZATION = 'overgeneralization',   // Aşırı genelleme
  MENTAL_FILTER = 'mental_filter',             // Zihinsel filtre
  DISCOUNTING_POSITIVE = 'discounting_positive', // Olumluyu görmezden gelme
  JUMPING_TO_CONCLUSIONS = 'jumping_to_conclusions', // Acele sonuç çıkarma
  CATASTROPHIZING = 'catastrophizing',         // Felaketleştirme
  EMOTIONAL_REASONING = 'emotional_reasoning', // Duygusal akıl yürütme
  SHOULD_STATEMENTS = 'should_statements',     // "Yapmalıyım" ifadeleri
  LABELING = 'labeling',                       // Etiketleme
  PERSONALIZATION = 'personalization'         // Kişiselleştirme
}

// CBT Oturum Tipi
export enum CBTSessionType {
  INITIAL_ASSESSMENT = 'initial_assessment',
  THOUGHT_EXPLORATION = 'thought_exploration',
  DISTORTION_IDENTIFICATION = 'distortion_identification',
  CHALLENGE_NEGATIVE_THOUGHTS = 'challenge_negative_thoughts',
  BEHAVIORAL_PLANNING = 'behavioral_planning',
  PROGRESS_REVIEW = 'progress_review',
  RELAPSE_PREVENTION = 'relapse_prevention'
}

// CBT Yanıt Tipi
export interface CBTResponse extends AIResponse {
  technique: CBTTechnique;
  sessionType: CBTSessionType;
  identifiedDistortions: CognitiveDistortion[];
  therapeuticGoals: string[];
  homework?: {
    type: 'thought_record' | 'behavioral_experiment' | 'mindfulness_practice';
    description: string;
    duration: number; // dakika
  };
  progressNotes: string;
}

// Socratic Soru Kategorileri
const SOCRATIC_QUESTIONS = {
  clarification: [
    "Bu düşünceyi daha detaylı açıklayabilir misiniz?",
    "Bu durumda ne hissettiğinizi anlatabilir misiniz?",
    "Size en çok hangi kısmı zor geliyor?"
  ],
  evidence: [
    "Bu düşüncenizi destekleyen kanıtlar neler?",
    "Bu düşüncenin aksini gösteren durumlar yaşadınız mı?",
    "Objektif bir gözlemci bu durumu nasıl değerlendirirdi?"
  ],
  perspective: [
    "Bu duruma farklı açılardan nasıl bakılabilir?",
    "En iyi arkadaşınıza aynı durum yaşansa ona ne tavsiye ederdiniz?",
    "5 yıl sonra bu duruma nasıl bakacağınızı düşünüyorsunuz?"
  ],
  consequences: [
    "Bu düşünce size nasıl hissettiriyor?",
    "Bu düşünce davranışlarınızı nasıl etkiliyor?",
    "Bu şekilde düşünmenin avantaj ve dezavantajları neler?"
  ]
};

// Bilişsel çarpıtma tespit pattern'leri
const DISTORTION_PATTERNS = {
  [CognitiveDistortion.ALL_OR_NOTHING]: [
    /her zaman|asla|hiçbir zaman|tamamen|hiç/gi,
    /mükemmel|berbat|tam olarak|kesinlikle/gi
  ],
  [CognitiveDistortion.OVERGENERALIZATION]: [
    /hep böyle|sürekli|hiçbir zaman değişmez/gi,
    /herkesle başıma geliyor/gi
  ],
  [CognitiveDistortion.CATASTROPHIZING]: [
    /felaket|korkunç|dayanamam|mahvoldum/gi,
    /en kötüsü|berbat bir şey olacak/gi
  ],
  [CognitiveDistortion.SHOULD_STATEMENTS]: [
    /yapmalıyım|olmalıyım|gerekiyor|zorundayım/gi,
    /yapmamalıyım|olmamalıyım/gi
  ],
  [CognitiveDistortion.EMOTIONAL_REASONING]: [
    /hissediyorum o yüzden doğru|böyle hissediyorum çünkü/gi
  ]
};

class CBTEngine {
  private static instance: CBTEngine;
  private initialized: boolean = false;

  static getInstance(): CBTEngine {
    if (!this.instance) {
      this.instance = new CBTEngine();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Feature flag kontrolü
    if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
      throw new AIError(
        AIErrorCode.FEATURE_DISABLED,
        'CBT Engine requires AI_CHAT feature flag'
      );
    }

    this.initialized = true;
    
    await trackAIInteraction(AIEventType.CBT_ENGINE_INITIALIZED, {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * CBT Sohbet yanıtı oluştur
   */
  async generateCBTResponse(
    userMessage: string,
    context: ConversationContext,
    sessionType: CBTSessionType = CBTSessionType.THOUGHT_EXPLORATION
  ): Promise<CBTResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Kullanıcı mesajını analiz et
      const messageAnalysis = await this.analyzeUserMessage(userMessage);
      
      // CBT tekniğini belirle
      const technique = this.selectBestTechnique(messageAnalysis, sessionType);
      
      // Bilişsel çarpıtmaları tespit et
      const distortions = this.identifyDistortions(userMessage);
      
      // CBT yanıtı oluştur
      const response = await this.constructCBTResponse(
        userMessage,
        technique,
        distortions,
        sessionType,
        context
      );

      // Telemetri
      await trackAIInteraction(AIEventType.CBT_RESPONSE_GENERATED, {
        technique,
        sessionType,
        distortionsFound: distortions.length,
        messageLength: userMessage.length
      });

      return response;

    } catch (error) {
      throw new AIError(
        AIErrorCode.CBT_PROCESSING_FAILED,
        `CBT yanıt oluşturma hatası: ${error.message}`
      );
    }
  }

  /**
   * Kullanıcı mesajını analiz et
   */
  private async analyzeUserMessage(message: string) {
    return {
      emotionalIntensity: this.assessEmotionalIntensity(message),
      themes: this.extractThemes(message),
      cognitivePatterns: this.identifyThoughtPatterns(message),
      needsLevel: this.assessSupportNeed(message)
    };
  }

  /**
   * En uygun CBT tekniğini seç
   */
  private selectBestTechnique(
    analysis: any,
    sessionType: CBTSessionType
  ): CBTTechnique {
    // Yüksek duygusal yoğunluk → Mindfulness
    if (analysis.emotionalIntensity > 8) {
      return CBTTechnique.MINDFULNESS_INTEGRATION;
    }

    // Bilişsel çarpıtma tespit edildi → Thought challenging
    if (analysis.cognitivePatterns.length > 0) {
      return CBTTechnique.THOUGHT_CHALLENGING;
    }

    // Session type'a göre varsayılan teknik
    const techniqueMap = {
      [CBTSessionType.INITIAL_ASSESSMENT]: CBTTechnique.SOCRATIC_QUESTIONING,
      [CBTSessionType.THOUGHT_EXPLORATION]: CBTTechnique.SOCRATIC_QUESTIONING,
      [CBTSessionType.DISTORTION_IDENTIFICATION]: CBTTechnique.COGNITIVE_RESTRUCTURING,
      [CBTSessionType.CHALLENGE_NEGATIVE_THOUGHTS]: CBTTechnique.THOUGHT_CHALLENGING,
      [CBTSessionType.BEHAVIORAL_PLANNING]: CBTTechnique.BEHAVIORAL_EXPERIMENT,
      [CBTSessionType.PROGRESS_REVIEW]: CBTTechnique.PROGRESS_CELEBRATION,
      [CBTSessionType.RELAPSE_PREVENTION]: CBTTechnique.RELAPSE_PREVENTION
    };

    return techniqueMap[sessionType] || CBTTechnique.SOCRATIC_QUESTIONING;
  }

  /**
   * Bilişsel çarpıtmaları tespit et
   */
  private identifyDistortions(message: string): CognitiveDistortion[] {
    const foundDistortions: CognitiveDistortion[] = [];

    Object.entries(DISTORTION_PATTERNS).forEach(([distortion, patterns]) => {
      const hasPattern = patterns.some(pattern => pattern.test(message));
      if (hasPattern) {
        foundDistortions.push(distortion as CognitiveDistortion);
      }
    });

    return foundDistortions;
  }

  /**
   * CBT yanıtını oluştur
   */
  private async constructCBTResponse(
    userMessage: string,
    technique: CBTTechnique,
    distortions: CognitiveDistortion[],
    sessionType: CBTSessionType,
    context: ConversationContext
  ): Promise<CBTResponse> {
    let responseText = '';
    let therapeuticGoals: string[] = [];
    let homework;

    switch (technique) {
      case CBTTechnique.SOCRATIC_QUESTIONING:
        responseText = this.generateSocraticResponse(userMessage);
        therapeuticGoals = ['Düşünce farkındalığını artırma'];
        break;

      case CBTTechnique.THOUGHT_CHALLENGING:
        responseText = this.generateThoughtChallenge(userMessage, distortions);
        therapeuticGoals = ['Negatif düşünceleri sorgulamaya teşvik etme'];
        homework = {
          type: 'thought_record' as const,
          description: 'Düşünce kaydı tutun: Durum, Düşünce, Duygu, Alternatif düşünce',
          duration: 10
        };
        break;

      case CBTTechnique.MINDFULNESS_INTEGRATION:
        responseText = this.generateMindfulnessResponse(userMessage);
        therapeuticGoals = ['Duygusal düzenleme', 'An\'da kalma becerileri'];
        homework = {
          type: 'mindfulness_practice' as const,
          description: '5 dakika nefes farkındalığı egzersizi yapın',
          duration: 5
        };
        break;

      case CBTTechnique.BEHAVIORAL_EXPERIMENT:
        responseText = this.generateBehavioralExperiment(userMessage);
        therapeuticGoals = ['Davranışsal değişim', 'Deneyimsel öğrenme'];
        homework = {
          type: 'behavioral_experiment' as const,
          description: 'Küçük bir davranış değişikliği deneyin ve sonuçları gözlemleyin',
          duration: 30
        };
        break;

      default:
        responseText = this.generateSupportiveResponse(userMessage);
        therapeuticGoals = ['Empatik destek sağlama'];
    }

    return {
      content: responseText,
      role: 'assistant',
      timestamp: new Date(),
      confidence: 0.85,
      technique,
      sessionType,
      identifiedDistortions: distortions,
      therapeuticGoals,
      homework,
      progressNotes: `CBT ${technique} uygulandı. ${distortions.length} bilişsel çarpıtma tespit edildi.`
    };
  }

  /**
   * Socratic soru oluştur
   */
  private generateSocraticResponse(userMessage: string): string {
    // Mesaja göre soru kategorisini belirle
    const questionCategory = this.determineSocraticCategory(userMessage);
    const questions = SOCRATIC_QUESTIONS[questionCategory];
    const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];

    return `Anlıyorum. ${selectedQuestion} Bu konuda birlikte düşünelim.`;
  }

  /**
   * Düşünce challenging yanıtı oluştur
   */
  private generateThoughtChallenge(
    userMessage: string, 
    distortions: CognitiveDistortion[]
  ): string {
    if (distortions.length === 0) {
      return "Bu düşünceyi bir kez daha inceleyelim. Gerçekten bu kadar kesin mi?";
    }

    const distortionNames = {
      [CognitiveDistortion.ALL_OR_NOTHING]: "siyah-beyaz düşünce",
      [CognitiveDistortion.CATASTROPHIZING]: "felaketleştirme",
      [CognitiveDistortion.SHOULD_STATEMENTS]: "yapmalıyım düşüncesi",
      [CognitiveDistortion.OVERGENERALIZATION]: "aşırı genelleme"
    };

    const mainDistortion = distortions[0];
    const distortionName = distortionNames[mainDistortion] || "düşünce pattern'i";

    return `Bu düşüncede bir ${distortionName} pattern'i fark ediyorum. ` +
           `Bu duruma daha dengeli nasıl bakabiliriz? Ara tonlar var mı?`;
  }

  /**
   * Mindfulness yanıtı oluştur
   */
  private generateMindfulnessResponse(userMessage: string): string {
    return "Şu anda çok yoğun duygular yaşıyorsunuz gibi görünüyor. " +
           "Birkaç derin nefes alalım. Bu duyguları yargılamadan fark etmeye çalışalım. " +
           "Bu an geçici, siz güvendesiniz.";
  }

  /**
   * Davranışsal deney önerisi oluştur
   */
  private generateBehavioralExperiment(userMessage: string): string {
    return "Bu düşünceyi test edebileceğiniz küçük bir deneyim düşünelim. " +
           "Korkunuzun gerçek olup olmadığını kontrollü bir şekilde öğrenebiliriz. " +
           "Hangi küçük adımla başlayabiliriz?";
  }

  /**
   * Destekleyici yanıt oluştur
   */
  private generateSupportiveResponse(userMessage: string): string {
    return "Bunu paylaştığınız için teşekkürler. Duygularınız tamamen anlaşılabilir. " +
           "Bu süreçte yalnız değilsiniz. Birlikte adım adım ilerleyebiliriz.";
  }

  // Yardımcı metodlar
  private assessEmotionalIntensity(message: string): number {
    const intensityWords = {
      high: ['dehşet', 'korkunç', 'dayanamıyorum', 'çok kötü', 'berbat'],
      medium: ['kötü', 'üzgün', 'endişeli', 'stresli'],
      low: ['hafif', 'biraz', 'az']
    };

    if (intensityWords.high.some(word => message.toLowerCase().includes(word))) return 9;
    if (intensityWords.medium.some(word => message.toLowerCase().includes(word))) return 6;
    if (intensityWords.low.some(word => message.toLowerCase().includes(word))) return 3;
    
    return 5; // varsayılan
  }

  private extractThemes(message: string): string[] {
    const themes: string[] = [];
    const themeKeywords = {
      'perfectionism': ['mükemmel', 'hata', 'yeterli değil'],
      'control': ['kontrol', 'kontrol etmek', 'düzen'],
      'contamination': ['kirli', 'mikrop', 'temizlik'],
      'harm': ['zarar', 'birini incitmek', 'kötü düşünce']
    };

    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
        themes.push(theme);
      }
    });

    return themes;
  }

  private identifyThoughtPatterns(message: string): string[] {
    // Cognitive distortion patterns return edilir
    return this.identifyDistortions(message);
  }

  private assessSupportNeed(message: string): 'low' | 'medium' | 'high' {
    const crisisWords = ['intihar', 'ölmek istiyorum', 'dayanamıyorum'];
    const highNeedWords = ['yardım', 'çaresiz', 'yapamıyorum'];
    
    if (crisisWords.some(word => message.toLowerCase().includes(word))) return 'high';
    if (highNeedWords.some(word => message.toLowerCase().includes(word))) return 'high';
    
    return 'medium';
  }

  private determineSocraticCategory(message: string): keyof typeof SOCRATIC_QUESTIONS {
    if (message.includes('çünkü') || message.includes('kanıt')) return 'evidence';
    if (message.includes('hissediyorum') || message.includes('düşünüyorum')) return 'clarification';
    if (message.includes('başka') || message.includes('farklı')) return 'perspective';
    
    return 'clarification'; // varsayılan
  }
}

export const cbtEngine = CBTEngine.getInstance(); 