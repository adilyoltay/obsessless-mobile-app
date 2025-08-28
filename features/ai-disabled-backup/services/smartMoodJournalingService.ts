/**
 * 📝 Smart Mood Journaling Service
 * 
 * Advanced NLP analysis for mood journal entries including:
 * - Sentiment analysis with Turkish language support
 * - Emotion detection and intensity measurement
 * - Trigger extraction (explicit and implicit)
 * - Theme analysis and key phrase extraction
 * - Journaling insights and writing prompts
 * - NLP metrics and text quality assessment
 * 
 * Created: Jan 2025 - Part of Mood Screen AI Enhancement Project
 */

import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface JournalAnalysisResult {
  sentimentAnalysis: {
    score: number; // -100 to +100
    confidence: number;
    polarity: 'positive' | 'negative' | 'neutral';
    subjectivity: number; // 0-1 (0=objective, 1=subjective)
  };
  emotionDetection: {
    primary: string;
    secondary?: string;
    intensity: number; // 0-10
    emotionScores: Record<string, number>;
  };
  triggerExtraction: {
    explicit: string[]; // Directly mentioned triggers
    implicit: string[]; // Inferred triggers
    categories: string[];
    confidence: Record<string, number>;
  };
  themes: {
    topics: string[];
    concerns: string[];
    positives: string[];
    keyPhrases: string[];
  };
  insights: {
    moodPrediction?: number; // Predicted mood score from text
    riskIndicators: string[];
    suggestions: string[];
    writingPrompts?: string[];
  };
  nlpMetrics: {
    readabilityScore: number;
    emotionalComplexity: number;
    linguisticMarkers: string[];
    textQuality: number;
  };
}

export interface JournalMetadata {
  timestamp?: Date;
  existingMoodScore?: number;
  context?: string;
}

// =============================================================================
// MAIN SERVICE CLASS
// =============================================================================

export class SmartMoodJournalingService {
  private static instance: SmartMoodJournalingService;
  
  static getInstance(): SmartMoodJournalingService {
    if (!SmartMoodJournalingService.instance) {
      SmartMoodJournalingService.instance = new SmartMoodJournalingService();
    }
    return SmartMoodJournalingService.instance;
  }

  /**
   * 📝 Main analysis entry point for journal text
   */
  async analyzeJournalEntry(
    userId: string,
    journalText: string,
    metadata?: JournalMetadata
  ): Promise<JournalAnalysisResult> {
    console.log('📝 Starting smart mood journaling analysis...');

    const startTime = Date.now();
    
    // Track journaling analysis start
    await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
      userId,
      dataType: 'mood_journaling',
      textLength: journalText.length,
      timestamp: startTime
    });

    try {
      // 1. SENTIMENT ANALYSIS
      const sentimentAnalysis = this.performSentimentAnalysis(journalText);
      
      // 2. EMOTION DETECTION
      const emotionDetection = this.detectEmotionsFromText(journalText);
      
      // 3. TRIGGER EXTRACTION
      const triggerExtraction = this.extractTriggersFromText(journalText);
      
      // 4. THEME ANALYSIS
      const themes = this.analyzeThemes(journalText);
      
      // 5. GENERATE INSIGHTS
      const insights = this.generateJournalingInsights(
        journalText, 
        sentimentAnalysis, 
        emotionDetection, 
        triggerExtraction,
        metadata
      );
      
      // 6. NLP METRICS
      const nlpMetrics = this.calculateNLPMetrics(journalText);

      const result: JournalAnalysisResult = {
        sentimentAnalysis,
        emotionDetection,
        triggerExtraction,
        themes,
        insights,
        nlpMetrics
      };

      // Track successful analysis
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId,
        source: 'smart_mood_journaling',
        insightsCount: insights.suggestions.length,
        processingTime: Date.now() - startTime,
        sentimentScore: sentimentAnalysis.score,
        emotionIntensity: emotionDetection.intensity,
        triggersFound: triggerExtraction.explicit.length + triggerExtraction.implicit.length
      });

      console.log(`✅ Smart journaling analysis completed: ${sentimentAnalysis.polarity} sentiment`);
      return result;

    } catch (error) {
      console.error('❌ Smart mood journaling failed:', error);
      
      await trackAIInteraction(AIEventType.SYSTEM_ERROR, {
        userId,
        component: 'smartMoodJournaling',
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      });

      // Return safe fallback
      return this.getFallbackResult();
    }
  }

  // =============================================================================
  // SENTIMENT ANALYSIS
  // =============================================================================

  private performSentimentAnalysis(text: string): JournalAnalysisResult['sentimentAnalysis'] {
    const words = text.toLowerCase().split(/\s+/);
    
    // Comprehensive Turkish sentiment lexicon
    const positiveWords = [
      'mutlu', 'sevinçli', 'harika', 'mükemmel', 'güzel', 'iyi', 'başarılı',
      'keyifli', 'hoş', 'rahat', 'huzurlu', 'sakin', 'memnun', 'tatmin',
      'umutlu', 'iyimser', 'pozitif', 'neşeli', 'coşkulu', 'gururlu',
      'şanslı', 'bereket', 'nimet', 'şükür', 'minnettarlık', 'sevgi',
      'aşk', 'dostluk', 'arkadaşlık', 'destek', 'yardım', 'çözüm',
      'başarı', 'kazanım', 'gelişim', 'iyileşme', 'düzelme', 'ilerleme'
    ];

    const negativeWords = [
      'üzgün', 'mutsuz', 'kötü', 'berbat', 'korkunç', 'endişeli', 'kaygılı',
      'depresif', 'çökkün', 'umutsuz', 'karamsarlık', 'stresli', 'gergin',
      'sinirli', 'öfkeli', 'kızgın', 'nefret', 'tiksinme', 'iğrenme',
      'korku', 'panik', 'anksiyete', 'endişe', 'kaygı', 'tedirginlik',
      'yalnız', 'izole', 'reddedilmiş', 'dışlanmış', 'değersiz', 'başarısız',
      'çaresiz', 'aciz', 'güçsüz', 'yorgun', 'bitkin', 'tükenmiş'
    ];

    // Intensity modifiers
    const intensifiers = ['çok', 'aşırı', 'son derece', 'oldukça', 'epey', 'fazla', 'az', 'biraz', 'hafif'];
    const negators = ['değil', 'yok', 'olmayan', 'hiç', 'asla', 'kesinlikle değil'];

    let positiveScore = 0;
    let negativeScore = 0;
    let subjectivityScore = 0;
    let totalWords = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let modifier = 1.0;

      // Check for intensifiers before current word
      if (i > 0 && intensifiers.includes(words[i - 1])) {
        if (['çok', 'aşırı', 'son derece'].includes(words[i - 1])) modifier = 1.5;
        else if (['oldukça', 'epey'].includes(words[i - 1])) modifier = 1.2;
        else if (['az', 'biraz', 'hafif'].includes(words[i - 1])) modifier = 0.7;
      }

      // Check for negators
      if (i > 0 && negators.includes(words[i - 1])) {
        modifier *= -1;
      }

      // Score words
      if (positiveWords.includes(word)) {
        positiveScore += 1 * modifier;
        subjectivityScore += 0.8;
        totalWords++;
      } else if (negativeWords.includes(word)) {
        negativeScore += 1 * modifier;
        subjectivityScore += 0.8;
        totalWords++;
      }

      // Personal pronouns indicate subjectivity
      if (['ben', 'benim', 'bana', 'beni', 'bende', 'benden'].includes(word)) {
        subjectivityScore += 0.5;
      }

      // Emotional expressions
      if (['hissediyorum', 'düşünüyorum', 'sanıyorum', 'inanıyorum'].includes(word)) {
        subjectivityScore += 0.7;
      }
    }

    // Calculate final scores
    const netScore = positiveScore - negativeScore;
    const normalizedScore = totalWords > 0 ? (netScore / Math.sqrt(totalWords)) * 50 : 0;
    const finalScore = Math.max(-100, Math.min(100, normalizedScore));

    // Determine polarity
    let polarity: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (finalScore > 10) polarity = 'positive';
    else if (finalScore < -10) polarity = 'negative';

    // Calculate confidence
    const confidence = totalWords > 0 
      ? Math.min(1, (Math.abs(finalScore) / 50) + (totalWords / words.length))
      : 0.5;

    // Calculate subjectivity
    const subjectivity = Math.min(1, subjectivityScore / Math.max(words.length * 0.3, 1));

    return {
      score: Math.round(finalScore * 10) / 10,
      confidence: Math.round(confidence * 100) / 100,
      polarity,
      subjectivity: Math.round(subjectivity * 100) / 100
    };
  }

  // =============================================================================
  // EMOTION DETECTION
  // =============================================================================

  private detectEmotionsFromText(text: string): JournalAnalysisResult['emotionDetection'] {
    const words = text.toLowerCase().split(/\s+/);
    
    // Turkish emotion patterns
    const emotionPatterns = {
      mutlu: ['mutlu', 'sevinçli', 'neşeli', 'keyifli', 'memnun', 'tatmin'],
      üzgün: ['üzgün', 'mutsuz', 'kederli', 'hüzünlü', 'melankolik'],
      kızgın: ['kızgın', 'öfkeli', 'sinirli', 'hiddetli', 'asabi'],
      korkmuş: ['korkmuş', 'ürkmüş', 'endişeli', 'tedirgin', 'panikli'],
      şaşkın: ['şaşkın', 'hayret', 'meraklı', 'ilginç', 'tuhaf'],
      heyecanlı: ['heyecanlı', 'coşkulu', 'istekli', 'arzulu', 'sabırsız'],
      sakin: ['sakin', 'huzurlu', 'rahat', 'dingin', 'sükûnet'],
      yorgun: ['yorgun', 'bitkin', 'tükenmiş', 'halsiz', 'dermansız'],
      umutlu: ['umutlu', 'iyimser', 'pozitif', 'güvenli'],
      çaresiz: ['çaresiz', 'umutsuz', 'karamsarlık', 'bezgin']
    };

    const emotionScores: Record<string, number> = {};
    let totalMatches = 0;

    // Calculate scores for each emotion
    Object.entries(emotionPatterns).forEach(([emotion, patterns]) => {
      let score = 0;
      patterns.forEach(pattern => {
        const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length;
          totalMatches += matches.length;
        }
      });
      emotionScores[emotion] = score;
    });

    // Find primary and secondary emotions
    const sortedEmotions = Object.entries(emotionScores)
      .sort(([, a], [, b]) => b - a)
      .filter(([, score]) => score > 0);

    const primary = sortedEmotions.length > 0 ? sortedEmotions[0][0] : 'karışık';
    const secondary = sortedEmotions.length > 1 ? sortedEmotions[1][0] : undefined;

    // Calculate intensity based on frequency and text length
    const maxScore = Math.max(...Object.values(emotionScores));
    const intensity = totalMatches > 0 
      ? Math.min(10, (maxScore / Math.sqrt(words.length)) * 15)
      : 5;

    return {
      primary,
      secondary,
      intensity: Math.round(intensity),
      emotionScores
    };
  }

  // =============================================================================
  // TRIGGER EXTRACTION
  // =============================================================================

  private extractTriggersFromText(text: string): JournalAnalysisResult['triggerExtraction'] {
    const explicit: string[] = [];
    const implicit: string[] = [];
    const categories: string[] = [];
    const confidence: Record<string, number> = {};

    // Explicit trigger patterns
    const triggerPatterns = {
      work: {
        patterns: ['işte', 'iş', 'çalışma', 'patron', 'maaş', 'toplantı', 'proje', 'mesai'],
        category: 'İş/Kariyer'
      },
      relationship: {
        patterns: ['aşk', 'sevgili', 'ilişki', 'arkadaş', 'dost', 'aile', 'eş', 'çift'],
        category: 'İlişkiler'
      },
      health: {
        patterns: ['sağlık', 'hasta', 'doktor', 'ilaç', 'ağrı', 'acı', 'rahatsız'],
        category: 'Sağlık'
      },
      money: {
        patterns: ['para', 'maaş', 'borç', 'kredi', 'fatura', 'harcama', 'ekonomi'],
        category: 'Finansal'
      },
      family: {
        patterns: ['anne', 'baba', 'kardeş', 'çocuk', 'aile', 'ebeveyn', 'akraba'],
        category: 'Aile'
      },
      social: {
        patterns: ['sosyal', 'arkadaş', 'toplum', 'grup', 'etkinlik', 'parti'],
        category: 'Sosyal'
      }
    };

    // Extract explicit triggers
    Object.entries(triggerPatterns).forEach(([key, { patterns, category }]) => {
      patterns.forEach(pattern => {
        const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          if (!explicit.includes(pattern)) {
            explicit.push(pattern);
            confidence[pattern] = 0.9;
          }
          if (!categories.includes(category)) {
            categories.push(category);
          }
        }
      });
    });

    // Implicit trigger inference
    const implicitPatterns = {
      stres: ['stres', 'gerginlik', 'baskı', 'yoğun', 'zor'],
      endişe: ['endişe', 'kaygı', 'tedirgin', 'huzursuz'],
      yalnızlık: ['yalnız', 'tek', 'izole', 'dışlanmış'],
      başarısızlık: ['başarısız', 'hata', 'yanlış', 'kaybetmek'],
      değişim: ['değişim', 'yeni', 'farklı', 'alışkın değil']
    };

    Object.entries(implicitPatterns).forEach(([trigger, patterns]) => {
      let score = 0;
      patterns.forEach(pattern => {
        const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
        if (regex.test(text)) score++;
      });
      
      if (score > 0) {
        implicit.push(trigger);
        confidence[trigger] = Math.min(0.8, score * 0.3);
      }
    });

    return {
      explicit,
      implicit,
      categories,
      confidence
    };
  }

  // =============================================================================
  // THEME ANALYSIS
  // =============================================================================

  private analyzeThemes(text: string): JournalAnalysisResult['themes'] {
    const words = text.toLowerCase().split(/\s+/);
    const topics: string[] = [];
    const concerns: string[] = [];
    const positives: string[] = [];
    const keyPhrases: string[] = [];

    // Topic extraction
    const topicKeywords = {
      'Gelişim': ['öğrenme', 'gelişim', 'ilerleme', 'büyüme', 'değişim'],
      'Kariyer': ['kariyer', 'meslek', 'iş', 'başarı', 'hedef'],
      'Sağlık': ['sağlık', 'beslenme', 'spor', 'egzersiz', 'dinlenme'],
      'İlişkiler': ['aşk', 'dostluk', 'aile', 'sevgi', 'bağ'],
      'Hobi': ['hobi', 'eğlence', 'oyun', 'sanat', 'müzik']
    };

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => words.includes(keyword))) {
        topics.push(topic);
      }
    });

    // Concern extraction
    const concernPatterns = [
      /endişe.*ediyorum/gi,
      /kaygılanıyorum/gi,
      /korkarım/gi,
      /umarım.*olmaz/gi,
      /ya.*olursa/gi
    ];

    concernPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        concerns.push(...matches.map(m => m.trim()));
      }
    });

    // Positive extraction
    const positivePatterns = [
      /mutlu.*hissediyorum/gi,
      /seviniyorum/gi,
      /başardım/gi,
      /gurur.*duyuyorum/gi,
      /şanslıyım/gi
    ];

    positivePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        positives.push(...matches.map(m => m.trim()));
      }
    });

    // Key phrases (simple sentence extraction)
    const sentences = text.split(/[.!?]+/);
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 100) {
        keyPhrases.push(trimmed);
      }
    });

    return {
      topics,
      concerns: concerns.slice(0, 5),
      positives: positives.slice(0, 5),
      keyPhrases: keyPhrases.slice(0, 3)
    };
  }

  // =============================================================================
  // INSIGHTS GENERATION
  // =============================================================================

  private generateJournalingInsights(
    text: string,
    sentiment: JournalAnalysisResult['sentimentAnalysis'],
    emotions: JournalAnalysisResult['emotionDetection'],
    triggers: JournalAnalysisResult['triggerExtraction'],
    metadata?: JournalMetadata
  ): JournalAnalysisResult['insights'] {
    const insights = {
      riskIndicators: [] as string[],
      suggestions: [] as string[],
      writingPrompts: [] as string[]
    };

    // Mood prediction based on sentiment and emotion
    let moodPrediction = 50; // baseline
    if (sentiment.score !== 0) {
      moodPrediction = 50 + (sentiment.score * 0.5);
    }
    
    if (emotions.intensity > 7) {
      if (emotions.primary === 'üzgün' || emotions.primary === 'çaresiz') {
        moodPrediction -= 15;
      } else if (emotions.primary === 'mutlu' || emotions.primary === 'umutlu') {
        moodPrediction += 15;
      }
    }

    // Risk indicators
    if (sentiment.score < -30) {
      insights.riskIndicators.push('Belirgin negatif duygu durumu');
    }

    if (emotions.intensity > 8 && ['üzgün', 'çaresiz', 'kızgın'].includes(emotions.primary)) {
      insights.riskIndicators.push('Yüksek emosyonel yoğunluk');
    }

    if (triggers.categories.length > 3) {
      insights.riskIndicators.push('Birden fazla stres kaynağı');
    }

    if (triggers.implicit.includes('yalnızlık') || triggers.implicit.includes('endişe')) {
      insights.riskIndicators.push('Sosyal destek ihtiyacı');
    }

    // Generate suggestions
    if (sentiment.polarity === 'negative') {
      insights.suggestions.push('Olumsuz duygularınızı dengelemek için nefes egzersizi deneyiniz');
      insights.suggestions.push('Bu duyguların geçici olduğunu hatırlayın');
    }

    if (emotions.intensity > 7) {
      insights.suggestions.push('Yoğun duygularınızı kabul edin ve onlara karşı nazik olun');
      insights.suggestions.push('Mindfulness teknikleri ile anı yaşamaya odaklanın');
    }

    if (triggers.explicit.length > 0) {
      insights.suggestions.push(`"${triggers.explicit[0]}" konusunda başa çıkma stratejileri geliştirin`);
    }

    if (emotions.primary === 'yorgun' || triggers.implicit.includes('stres')) {
      insights.suggestions.push('Dinlenme ve self-care aktivitelerine zaman ayırın');
    }

    // Writing prompts based on emotional state
    if (emotions.primary === 'üzgün') {
      insights.writingPrompts = [
        'Bu üzüntünün ardında hangi ihtiyaç var?',
        'Geçmişte benzer durumları nasıl aştınız?',
        'Size destek veren 3 şeyi yazın'
      ];
    } else if (emotions.primary === 'mutlu') {
      insights.writingPrompts = [
        'Bu mutluluk anını yaratan faktörler nelerdi?',
        'Bu pozitif enerjiyi nasıl koruyabilirsiniz?',
        'Bu duyguyu başkalarıyla nasıl paylaşabilirsiniz?'
      ];
    } else if (emotions.primary === 'kızgın') {
      insights.writingPrompts = [
        'Bu öfkenin arkasındaki temel ihtiyaç nedir?',
        'Bu durumu farklı bir perspektiften nasıl görebilirsiniz?',
        'Öfkenizi yapıcı şekilde nasıl ifade edebilirsiniz?'
      ];
    } else {
      insights.writingPrompts = [
        'Bugün kendiniz hakkında öğrendiğiniz bir şey var mı?',
        'Hangi duygunuzu daha derinlemesine keşfetmek istersiniz?',
        'Yarın kendinizi nasıl destekleyebilirsiniz?'
      ];
    }

    return {
      moodPrediction: Math.round(Math.max(0, Math.min(100, moodPrediction))),
      ...insights
    };
  }

  // =============================================================================
  // NLP METRICS
  // =============================================================================

  private calculateNLPMetrics(text: string): JournalAnalysisResult['nlpMetrics'] {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Readability (based on word/sentence length)
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / Math.max(words.length, 1);
    const readabilityScore = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence * 2) - (avgWordLength * 3)));

    // Emotional complexity (variety of emotions)
    const emotionalWords = words.filter(word => 
      ['mutlu', 'üzgün', 'kızgın', 'korku', 'şaşkın', 'heyecan', 'sakin', 'endişe'].some(emotion => 
        word.toLowerCase().includes(emotion)
      )
    );
    const emotionalComplexity = Math.min(100, (emotionalWords.length / Math.max(words.length, 1)) * 500);

    // Linguistic markers
    const linguisticMarkers: string[] = [];
    if (text.includes('ben')) linguisticMarkers.push('self_reference');
    if (text.includes('?')) linguisticMarkers.push('questioning');
    if (text.includes('!')) linguisticMarkers.push('exclamatory');
    if (text.includes('ama') || text.includes('ancak')) linguisticMarkers.push('contrasting');
    if (text.includes('çünkü') || text.includes('nedeniyle')) linguisticMarkers.push('causal');

    // Text quality
    const lengthScore = Math.min(50, words.length / 2); // Up to 50 points for length
    const varietyScore = new Set(words.map(w => w.toLowerCase())).size / Math.max(words.length, 1) * 50; // Vocabulary variety
    const textQuality = Math.min(100, lengthScore + varietyScore);

    return {
      readabilityScore: Math.round(readabilityScore),
      emotionalComplexity: Math.round(emotionalComplexity),
      linguisticMarkers,
      textQuality: Math.round(textQuality)
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private getFallbackResult(): JournalAnalysisResult {
    return {
      sentimentAnalysis: {
        score: 0,
        confidence: 0.5,
        polarity: 'neutral',
        subjectivity: 0.5
      },
      emotionDetection: {
        primary: 'karışık',
        intensity: 5,
        emotionScores: {}
      },
      triggerExtraction: {
        explicit: [],
        implicit: [],
        categories: [],
        confidence: {}
      },
      themes: {
        topics: [],
        concerns: [],
        positives: [],
        keyPhrases: []
      },
      insights: {
        riskIndicators: [],
        suggestions: ['Journal analizi sırasında hata oluştu. Tekrar deneyiniz.']
      },
      nlpMetrics: {
        readabilityScore: 50,
        emotionalComplexity: 50,
        linguisticMarkers: [],
        textQuality: 50
      }
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const smartMoodJournalingService = SmartMoodJournalingService.getInstance();
export default smartMoodJournalingService;
