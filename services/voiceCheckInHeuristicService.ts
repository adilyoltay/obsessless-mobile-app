/**
 * Voice Check-in Heuristic Analysis Service
 * 
 * Özel olarak geliştirilen rule-based mood analiz sistemi.
 * Speech-to-text'ten gelen Türkçe metin üzerinde emotion, mood score, 
 * anxiety level, triggers gibi bilgileri otomatik çıkarır.
 * 
 * Bu algoritma sadece voice check-in işine özel geliştirilmiştir.
 */

import { TranscriptionResult } from './speechToTextService';

interface MoodAnalysisResult {
  moodScore: number;        // 1-10 arası mood skoru
  energyLevel: number;      // 1-10 arası enerji seviyesi  
  anxietyLevel: number;     // 1-10 arası anksiyete seviyesi
  dominantEmotion: string;  // Ana duygu (mutlu, üzgün, kaygılı, etc)
  triggers: string[];       // Tetikleyici faktörler
  activities: string[];     // Belirtilen aktiviteler
  notes: string;           // Orijinal metin (temizlenmiş)
  confidence: number;      // Analiz güven skoru (0-1)
  analysisDetails: {
    keywords: string[];     // Bulunan anahtar kelimeler
    emotionSignals: string[]; // Duygu işaretleri
    intensity: 'low' | 'medium' | 'high'; // Yoğunluk seviyesi
    sentiment: 'negative' | 'neutral' | 'positive'; // Genel sentiment
  };
}

interface KeywordPattern {
  keywords: string[];
  moodImpact: number;     // -5 to +5
  energyImpact: number;   // -5 to +5  
  anxietyImpact: number;  // -5 to +5
  emotion?: string;
  trigger?: string;
  activity?: string;
  weight: number;         // Pattern ağırlığı
}

class VoiceCheckInHeuristicService {
  private static instance: VoiceCheckInHeuristicService;
  
  // 🎯 ENHANCED Türkçe Mood Analiz Patterns (v2.0)
  private readonly moodPatterns: KeywordPattern[] = [
    // 😊 High Positive Patterns
    {
      keywords: ['çok mutlu', 'aşırı mutlu', 'son derece mutlu', 'harika', 'mükemmel', 'fantastik', 'muhteşem'],
      moodImpact: +5, energyImpact: +4, anxietyImpact: -3,
      emotion: 'çok_mutlu', weight: 1.3
    },
    {
      keywords: ['mutlu', 'neşeli', 'sevinçli', 'keyifli', 'güzel', 'süper', 'iyi hissediyorum'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -2,
      emotion: 'mutlu', weight: 1.0
    },
    {
      keywords: ['enerjik', 'dinamik', 'aktif', 'canlı', 'zinde', 'motivasyonum yüksek', 'şevkli'],
      moodImpact: +3, energyImpact: +5, anxietyImpact: -1,
      emotion: 'enerjik', weight: 1.2
    },
    {
      keywords: ['sakin', 'huzurlu', 'rahat', 'dingin', 'sükûnet', 'ferah', 'rahatlıyım'],
      moodImpact: +2, energyImpact: 0, anxietyImpact: -4,
      emotion: 'sakin', weight: 1.0
    },
    {
      keywords: ['umutlu', 'iyimser', 'pozitif', 'başarabilirim', 'güvenliyim', 'kendime güveniyorum'],
      moodImpact: +4, energyImpact: +2, anxietyImpact: -3,
      emotion: 'umutlu', weight: 1.1
    },

    // 😰 High Anxiety Patterns
    {
      keywords: ['çok kaygılı', 'aşırı endişeli', 'panik halinde', 'korku duyuyorum', 'dehşet', 'çok korkuyorum'],
      moodImpact: -5, energyImpact: -2, anxietyImpact: +5,
      emotion: 'panik', weight: 1.5
    },
    {
      keywords: ['kaygılı', 'endişeli', 'tedirgin', 'gergin', 'stresli', 'korkuyorum', 'endişe'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      emotion: 'kaygılı', weight: 1.2
    },
    
    // 😢 Depression/Sadness Patterns
    {
      keywords: ['çok üzgün', 'depresyondayım', 'çaresiz', 'umutsuz', 'hayata küsmüş', 'boş'],
      moodImpact: -5, energyImpact: -4, anxietyImpact: +2,
      emotion: 'depresif', weight: 1.4
    },
    {
      keywords: ['üzgün', 'kederli', 'mahzun', 'buruk', 'melankolik', 'hüzünlü', 'mutsuz'],
      moodImpact: -4, energyImpact: -2, anxietyImpact: +1,
      emotion: 'üzgün', weight: 1.1
    },
    
    // 😴 Low Energy Patterns
    {
      keywords: ['aşırı yorgun', 'bitap', 'tükenmiş', 'enerjim sıfır', 'hiçbir şey yapmak istemiyorum'],
      moodImpact: -3, energyImpact: -5, anxietyImpact: +1,
      emotion: 'bitkin', weight: 1.3
    },
    {
      keywords: ['yorgun', 'bitkin', 'halsiz', 'enerjim yok', 'yorgunum', 'bezgin'],
      moodImpact: -2, energyImpact: -4, anxietyImpact: +1,
      emotion: 'yorgun', weight: 1.0
    },
    
    // 😡 Anger Patterns
    {
      keywords: ['çok sinirli', 'öfke', 'hiddetli', 'çileden çıkmış', 'deliriyorum', 'patlatacağım'],
      moodImpact: -4, energyImpact: +3, anxietyImpact: +4,
      emotion: 'öfkeli', weight: 1.3
    },
    {
      keywords: ['sinirli', 'kızgın', 'rahatsız', 'canım sıkkın', 'bıktım', 'darıldım'],
      moodImpact: -3, energyImpact: +1, anxietyImpact: +2,
      emotion: 'sinirli', weight: 1.0
    },

    // 🔄 Neutral/Mixed Patterns
    {
      keywords: ['karışık', 'karmakarışık', 'belirsiz', 'emin değil', 'ne bileyim'],
      moodImpact: 0, energyImpact: -1, anxietyImpact: +2,
      emotion: 'karışık', weight: 0.8
    },

    // 🎯 ENHANCED Specific Triggers
    {
      keywords: ['iş stresi', 'patron baskısı', 'işten çıkarma', 'performans değerlendirme', 'deadline stresi'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      trigger: 'iş_yoğun_stres', weight: 1.2
    },
    {
      keywords: ['iş', 'çalışma', 'ofis', 'patron', 'toplantı', 'proje', 'deadline', 'mesai'],
      moodImpact: -1, energyImpact: 0, anxietyImpact: +2,
      trigger: 'iş_stres', weight: 0.9
    },
    {
      keywords: ['aile kavgası', 'boşanma', 'ilişki problemi', 'eş sorunu', 'evlilik krizi'],
      moodImpact: -4, energyImpact: -2, anxietyImpact: +3,
      trigger: 'ilişki_krizi', weight: 1.3
    },
    {
      keywords: ['aile', 'annem', 'babam', 'eş', 'çocuk', 'kardeş', 'aile problem', 'evlilik'],
      moodImpact: -1, energyImpact: 0, anxietyImpact: +1,
      trigger: 'aile_ilişki', weight: 0.8
    },
    {
      keywords: ['borç batağı', 'iflas', 'kredi kartı', 'maaş yetersiz', 'ekonomik kriz'],
      moodImpact: -4, energyImpact: -2, anxietyImpact: +5,
      trigger: 'finansal_kriz', weight: 1.4
    },
    {
      keywords: ['para', 'maaş', 'borç', 'fatura', 'ekonomik', 'finansal', 'banka'],
      moodImpact: -2, energyImpact: -1, anxietyImpact: +3,
      trigger: 'finansal_kaygı', weight: 1.0
    },
    {
      keywords: ['kanser', 'kalp krizi', 'ameliyat', 'ölüm korkusu', 'hastalık teşhisi'],
      moodImpact: -5, energyImpact: -3, anxietyImpact: +5,
      trigger: 'ciddi_sağlık', weight: 1.5
    },
    {
      keywords: ['sağlık', 'hastalık', 'doktor', 'ameliyat', 'ağrı', 'hasta', 'acil'],
      moodImpact: -2, energyImpact: -2, anxietyImpact: +4,
      trigger: 'sağlık_endişe', weight: 1.2
    },
    {
      keywords: ['okul stresi', 'sınav kaygısı', 'not korkusu', 'ders çalışma', 'akademik başarısızlık'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      trigger: 'eğitim_stres', weight: 1.1
    },
    {
      keywords: ['sosyal anksiyete', 'utanıyorum', 'herkesle sorunu var', 'dışlanmış', 'yalnızlık'],
      moodImpact: -3, energyImpact: -2, anxietyImpact: +4,
      trigger: 'sosyal_kaygı', weight: 1.2
    },
    {
      keywords: ['gelecek korkusu', 'belirsizlik', 'ne olacak', 'geleceğim yok', 'plan yapamıyorum'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      trigger: 'gelecek_kaygısı', weight: 1.1
    },

    // 💪 ENHANCED Activities (Positive Impact)
    {
      keywords: ['maraton', 'jimnastik', 'yüzme', 'bisiklet', 'dağcılık', 'ekstrem spor'],
      moodImpact: +4, energyImpact: +5, anxietyImpact: -3,
      activity: 'yoğun_egzersiz', weight: 1.2
    },
    {
      keywords: ['spor', 'koşu', 'yürüyüş', 'gym', 'egzersiz', 'fitness', 'antrenman'],
      moodImpact: +2, energyImpact: +3, anxietyImpact: -2,
      activity: 'egzersiz', weight: 0.9
    },
    {
      keywords: ['parti', 'doğum günü', 'konser', 'festival', 'kutlama', 'eğlence'],
      moodImpact: +4, energyImpact: +3, anxietyImpact: -2,
      activity: 'kutlama_eğlence', weight: 1.1
    },
    {
      keywords: ['arkadaş', 'sosyal', 'buluştuk', 'sohbet', 'gezi', 'kafe', 'sinema'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -1,
      activity: 'sosyal_aktivite', weight: 0.8
    },
    {
      keywords: ['meditasyon', 'mindfulness', 'derin nefes', 'yoga', 'gevşeme egzersizi'],
      moodImpact: +2, energyImpact: 0, anxietyImpact: -4,
      activity: 'mindfulness', weight: 1.2
    },
    {
      keywords: ['nefes', 'nefes aldım', 'soluk', 'nefes egzersizi'],
      moodImpact: +1, energyImpact: 0, anxietyImpact: -3,
      activity: 'nefes_egzersizi', weight: 1.0
    },
    {
      keywords: ['kitap okudum', 'okuma', 'dergi', 'gazete', 'araştırma'],
      moodImpact: +1, energyImpact: +1, anxietyImpact: -2,
      activity: 'okuma', weight: 0.8
    },
    {
      keywords: ['müzik dinledim', 'şarkı', 'konser', 'çalgı', 'enstrüman'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -2,
      activity: 'müzik', weight: 0.9
    },
    {
      keywords: ['doğa', 'park', 'orman', 'deniz', 'göl', 'dağ', 'piknik'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -3,
      activity: 'doğa_aktivite', weight: 1.1
    },
    {
      keywords: ['uyudum', 'dinlendim', 'istirahat', 'uzandım', 'vücudumu dinlendirdim'],
      moodImpact: +1, energyImpact: +4, anxietyImpact: -2,
      activity: 'dinlenme', weight: 0.9
    },
    {
      keywords: ['yemek yaptım', 'aşçılık', 'tarif', 'pişirme', 'mutfak'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -1,
      activity: 'yemek_yapma', weight: 0.8
    },
    {
      keywords: ['temizlik', 'düzen', 'organize', 'toplama', 'ev işi'],
      moodImpact: +1, energyImpact: +2, anxietyImpact: -2,
      activity: 'ev_düzeni', weight: 0.7
    }
  ];

  // 🔍 Intensity modifiers
  private readonly intensityModifiers: { [key: string]: number } = {
    'çok': 1.5, 'aşırı': 1.8, 'son derece': 1.7, 'fazla': 1.3,
    'biraz': 0.7, 'az': 0.6, 'hafif': 0.5, 'ufak': 0.5,
    'oldukça': 1.2, 'epey': 1.3, 'hayli': 1.3,
    'son': 1.4, 'gerçekten': 1.4, 'ciddi': 1.5
  };

  static getInstance(): VoiceCheckInHeuristicService {
    if (!VoiceCheckInHeuristicService.instance) {
      VoiceCheckInHeuristicService.instance = new VoiceCheckInHeuristicService();
    }
    return VoiceCheckInHeuristicService.instance;
  }

  /**
   * 🎯 Ana analiz fonksiyonu - Speech-to-text sonucunu mood verisine çevirir
   */
  async analyzeMoodFromVoice(
    transcriptionResult: TranscriptionResult
  ): Promise<MoodAnalysisResult> {
    console.log('🧠 Starting heuristic mood analysis...', {
      text: transcriptionResult.text.substring(0, 100),
      confidence: transcriptionResult.confidence
    });

    try {
      const text = transcriptionResult.text.toLowerCase().trim();
      
      if (!text || text.length < 5) {
        return this.createDefaultResult('Çok kısa metin, analiz yapılamadı.');
      }

      // 1. Text preprocessing
      const cleanText = this.preprocessText(text);
      
      // 2. Pattern matching
      const patternMatches = this.findPatternMatches(cleanText);
      
      // 3. Calculate mood metrics
      const metrics = this.calculateMoodMetrics(patternMatches, cleanText);
      
      // 4. Extract entities (triggers, activities, emotions)
      const entities = this.extractEntities(patternMatches, cleanText);
      
      // 5. Determine confidence
      const confidence = this.calculateConfidence(
        patternMatches,
        transcriptionResult.confidence,
        text.length
      );

      // 6. Build result
      const result: MoodAnalysisResult = {
        moodScore: this.normalizeScore(metrics.mood, 5), // Base 5, range 1-10
        energyLevel: this.normalizeScore(metrics.energy, 5),
        anxietyLevel: this.normalizeScore(metrics.anxiety, 5),
        dominantEmotion: entities.dominantEmotion || 'nötr',
        triggers: entities.triggers,
        activities: entities.activities,
        notes: transcriptionResult.text, // Original text
        confidence,
        analysisDetails: {
          keywords: entities.foundKeywords,
          emotionSignals: entities.emotionSignals,
          intensity: this.determineIntensity(metrics.totalIntensity),
          sentiment: this.determineSentiment(metrics.mood)
        }
      };

      console.log('✅ Heuristic analysis complete:', {
        mood: result.moodScore,
        energy: result.energyLevel,
        anxiety: result.anxietyLevel,
        emotion: result.dominantEmotion,
        confidence: result.confidence.toFixed(2)
      });

      return result;

    } catch (error) {
      console.error('❌ Heuristic analysis failed:', error);
      return this.createDefaultResult(
        transcriptionResult.text,
        `Analiz hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
      );
    }
  }

  /**
   * 📝 Text preprocessing - cleanup and normalize
   */
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\wşçğıöüâàáéèíóôúûñ\s]/gi, ' ') // Turkish chars allowed
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 🔍 Find pattern matches in text
   */
  private findPatternMatches(text: string): Array<KeywordPattern & { matchedKeywords: string[]; intensity: number }> {
    const matches: Array<KeywordPattern & { matchedKeywords: string[]; intensity: number }> = [];

    for (const pattern of this.moodPatterns) {
      const matchedKeywords: string[] = [];
      let totalIntensity = 1.0;

      // Check each keyword in pattern
      for (const keyword of pattern.keywords) {
        if (text.includes(keyword)) {
          matchedKeywords.push(keyword);
          
          // Check for intensity modifiers around keyword
          const intensityMod = this.findIntensityModifier(text, keyword);
          if (intensityMod > 0) {
            totalIntensity = Math.max(totalIntensity, intensityMod);
          }
        }
      }

      if (matchedKeywords.length > 0) {
        matches.push({
          ...pattern,
          matchedKeywords,
          intensity: totalIntensity
        });
      }
    }

    return matches;
  }

  /**
   * 🎚️ Find intensity modifiers around keywords
   */
  private findIntensityModifier(text: string, keyword: string): number {
    const keywordIndex = text.indexOf(keyword);
    if (keywordIndex === -1) return 1.0;

    // Look for modifiers in 5 words before the keyword
    const beforeText = text.substring(Math.max(0, keywordIndex - 50), keywordIndex);
    const words = beforeText.split(' ');
    
    for (const word of words.slice(-5)) {
      if (this.intensityModifiers[word]) {
        return this.intensityModifiers[word];
      }
    }

    return 1.0;
  }

  /**
   * 📊 Calculate mood metrics from pattern matches
   */
  private calculateMoodMetrics(matches: Array<KeywordPattern & { intensity: number }>, text: string): {
    mood: number;
    energy: number;
    anxiety: number;
    totalIntensity: number;
  } {
    let moodSum = 0;
    let energySum = 0;
    let anxietySum = 0;
    let totalWeight = 0;
    let totalIntensity = 0;

    for (const match of matches) {
      const weight = match.weight * match.intensity;
      
      moodSum += match.moodImpact * weight;
      energySum += match.energyImpact * weight;
      anxietySum += match.anxietyImpact * weight;
      totalWeight += weight;
      totalIntensity += match.intensity;
    }

    // Normalize by total weight, or use defaults if no matches
    if (totalWeight === 0) {
      return { mood: 0, energy: 0, anxiety: 0, totalIntensity: 1 };
    }

    return {
      mood: moodSum / totalWeight,
      energy: energySum / totalWeight,
      anxiety: anxietySum / totalWeight,
      totalIntensity: totalIntensity / matches.length
    };
  }

  /**
   * 🔍 Extract entities (emotions, triggers, activities)
   */
  private extractEntities(matches: Array<KeywordPattern & { matchedKeywords: string[] }>, text: string): {
    dominantEmotion: string;
    triggers: string[];
    activities: string[];
    foundKeywords: string[];
    emotionSignals: string[];
  } {
    const emotions: { [key: string]: number } = {};
    const triggers: string[] = [];
    const activities: string[] = [];
    const foundKeywords: string[] = [];
    const emotionSignals: string[] = [];

    for (const match of matches) {
      foundKeywords.push(...match.matchedKeywords);

      if (match.emotion) {
        emotions[match.emotion] = (emotions[match.emotion] || 0) + match.weight;
        emotionSignals.push(...match.matchedKeywords);
      }

      if (match.trigger && !triggers.includes(match.trigger)) {
        triggers.push(match.trigger);
      }

      if (match.activity && !activities.includes(match.activity)) {
        activities.push(match.activity);
      }
    }

    // Find dominant emotion
    const dominantEmotion = Object.keys(emotions).reduce((a, b) => 
      emotions[a] > emotions[b] ? a : b, Object.keys(emotions)[0] || 'nötr'
    );

    return {
      dominantEmotion,
      triggers,
      activities,
      foundKeywords: [...new Set(foundKeywords)], // Unique keywords
      emotionSignals: [...new Set(emotionSignals)]
    };
  }

  /**
   * 📊 Calculate analysis confidence
   */
  private calculateConfidence(
    matches: Array<KeywordPattern & { matchedKeywords: string[] }>,
    transcriptionConfidence: number,
    textLength: number
  ): number {
    // Base confidence from transcription
    let confidence = transcriptionConfidence;

    // Keyword match boost
    const keywordCount = matches.reduce((sum, match) => sum + match.matchedKeywords.length, 0);
    const keywordBoost = Math.min(0.2, keywordCount * 0.05);
    
    // Text length factor
    const lengthFactor = Math.min(1.0, textLength / 100); // Longer text = more reliable
    
    // Pattern diversity (different types of patterns matched)
    const patternTypes = new Set(matches.map(m => m.emotion || m.trigger || m.activity || 'general'));
    const diversityBoost = Math.min(0.15, (patternTypes.size - 1) * 0.05);

    confidence = Math.min(0.95, confidence + keywordBoost + diversityBoost) * lengthFactor;
    
    return Math.max(0.3, confidence); // Minimum 0.3 confidence
  }

  /**
   * 🎯 Normalize score to 1-10 range
   */
  private normalizeScore(value: number, baseline: number): number {
    const adjusted = baseline + value;
    return Math.max(1, Math.min(10, Math.round(adjusted)));
  }

  /**
   * 🎚️ Determine intensity level
   */
  private determineIntensity(avgIntensity: number): 'low' | 'medium' | 'high' {
    if (avgIntensity >= 1.4) return 'high';
    if (avgIntensity >= 1.1) return 'medium';
    return 'low';
  }

  /**
   * 😊 Determine overall sentiment
   */
  private determineSentiment(moodScore: number): 'negative' | 'neutral' | 'positive' {
    if (moodScore >= 1) return 'positive';
    if (moodScore <= -1) return 'negative';
    return 'neutral';
  }

  /**
   * 🔄 Create default result for error cases
   */
  private createDefaultResult(notes: string, error?: string): MoodAnalysisResult {
    return {
      moodScore: 5,
      energyLevel: 5,
      anxietyLevel: 5,
      dominantEmotion: 'nötr',
      triggers: [],
      activities: [],
      notes,
      confidence: 0.3,
      analysisDetails: {
        keywords: [],
        emotionSignals: [],
        intensity: 'low',
        sentiment: 'neutral'
      }
    };
  }

  /**
   * 🧪 Test analysis with sample text
   */
  async testAnalysis(sampleText: string): Promise<MoodAnalysisResult> {
    const mockTranscription: TranscriptionResult = {
      text: sampleText,
      confidence: 0.9,
      duration: 3,
      language: 'tr-TR',
      success: true
    };

    return await this.analyzeMoodFromVoice(mockTranscription);
  }
}

// Export singleton instance
const voiceCheckInHeuristicService = VoiceCheckInHeuristicService.getInstance();
export default voiceCheckInHeuristicService;

// Export types
export type { MoodAnalysisResult };
