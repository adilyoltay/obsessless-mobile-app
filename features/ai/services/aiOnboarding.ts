/**
 * AI Destekli Onboarding Servisi
 * 
 * KRITIK: Feature flag kontrolü zorunlu
 * Mevcut onboarding'i bozmadan progressive enhancement sağlar
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  AIMessage,
  ConversationContext,
  UserAIProfile,
  AIResponse,
  AIError,
  AIErrorCode
} from '@/features/ai/types';
import { aiManager } from '@/features/ai/config/aiManager';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';

// Y-BOCS soruları (Türkçe)
const YBOCS_QUESTIONS = [
  {
    id: 'obsessions_time',
    text: 'Obsesif düşünceleriniz günde ne kadar süre alıyor?',
    options: [
      { value: 0, label: 'Hiç' },
      { value: 1, label: '1 saatten az' },
      { value: 2, label: '1-3 saat' },
      { value: 3, label: '3-8 saat' },
      { value: 4, label: '8 saatten fazla' }
    ]
  },
  {
    id: 'obsessions_interference',
    text: 'Obsesif düşünceler günlük yaşamınızı ne kadar etkiliyor?',
    options: [
      { value: 0, label: 'Hiç etkilemiyor' },
      { value: 1, label: 'Hafif etkiliyor' },
      { value: 2, label: 'Orta derecede etkiliyor' },
      { value: 3, label: 'Ciddi şekilde etkiliyor' },
      { value: 4, label: 'Tamamen engelliyor' }
    ]
  },
  {
    id: 'obsessions_distress',
    text: 'Obsesif düşünceler size ne kadar sıkıntı veriyor?',
    options: [
      { value: 0, label: 'Hiç sıkıntı vermiyor' },
      { value: 1, label: 'Az sıkıntı veriyor' },
      { value: 2, label: 'Orta derecede sıkıntı veriyor' },
      { value: 3, label: 'Çok sıkıntı veriyor' },
      { value: 4, label: 'Aşırı sıkıntı veriyor' }
    ]
  },
  {
    id: 'obsessions_resistance',
    text: 'Obsesif düşüncelere ne kadar direniyorsunuz?',
    options: [
      { value: 0, label: 'Her zaman direniyorum' },
      { value: 1, label: 'Çoğu zaman direniyorum' },
      { value: 2, label: 'Bazen direniyorum' },
      { value: 3, label: 'Nadiren direniyorum' },
      { value: 4, label: 'Hiç direnmiyorum' }
    ]
  },
  {
    id: 'obsessions_control',
    text: 'Obsesif düşünceleriniz üzerinde ne kadar kontrolünüz var?',
    options: [
      { value: 0, label: 'Tam kontrol' },
      { value: 1, label: 'Çok kontrol' },
      { value: 2, label: 'Orta derecede kontrol' },
      { value: 3, label: 'Az kontrol' },
      { value: 4, label: 'Hiç kontrol yok' }
    ]
  }
  // Kompulsiyonlar için benzer sorular eklenebilir
];

export interface OnboardingSession {
  sessionId: string;
  userId: string;
  currentQuestionIndex: number;
  answers: YBOCSAnswer[];
  startTime: Date;
  completionTime?: Date;
  severity?: YBOCSSeverity;
  aiEnhanced: boolean;
  conversationContext?: ConversationContext;
}

export interface YBOCSAnswer {
  questionId: string;
  value: number;
  timestamp: Date;
  confidence?: number;
  aiClarification?: string;
}

export interface YBOCSSeverity {
  totalScore: number;
  category: 'minimal' | 'mild' | 'moderate' | 'severe' | 'extreme';
  obsessionScore: number;
  compulsionScore: number;
  recommendations: string[];
}

class AIOnboardingService {
  private static instance: AIOnboardingService;
  private currentSession: OnboardingSession | null = null;

  private constructor() {}

  static getInstance(): AIOnboardingService {
    if (!this.instance) {
      this.instance = new AIOnboardingService();
    }
    return this.instance;
  }

  /**
   * Onboarding oturumu başlat
   */
  async startSession(userId: string): Promise<OnboardingSession> {
    // Feature flag kontrolü
    const aiEnabled = FEATURE_FLAGS.isEnabled('AI_ONBOARDING');
    
    const session: OnboardingSession = {
      sessionId: this.generateSessionId(),
      userId,
      currentQuestionIndex: 0,
      answers: [],
      startTime: new Date(),
      aiEnhanced: aiEnabled
    };

    this.currentSession = session;
    await this.saveSession();

    // Telemetri
    await trackAIInteraction(AIEventType.CONVERSATION_START, {
      type: 'onboarding',
      ai_enhanced: aiEnabled
    });

    return session;
  }

  /**
   * Sonraki soruyu al (AI destekli veya normal)
   */
  async getNextQuestion(): Promise<{
    question: typeof YBOCS_QUESTIONS[0];
    aiEnhancement?: AIEnhancedQuestion;
  }> {
    if (!this.currentSession) {
      throw this.createError('No active session');
    }

    const currentIndex = this.currentSession.currentQuestionIndex;
    if (currentIndex >= YBOCS_QUESTIONS.length) {
      return { question: null as any };
    }

    const question = YBOCS_QUESTIONS[currentIndex];
    
    // AI enhancement
    let aiEnhancement;
    if (this.currentSession.aiEnhanced && aiManager.isEnabled()) {
      aiEnhancement = await this.enhanceQuestion(question);
    }

    return { question, aiEnhancement };
  }

  /**
   * Cevabı işle
   */
  async submitAnswer(
    questionId: string,
    value: number,
    openEndedResponse?: string
  ): Promise<{
    success: boolean;
    clarificationNeeded?: boolean;
    aiFollowUp?: string;
  }> {
    if (!this.currentSession) {
      throw this.createError('No active session');
    }

    const answer: YBOCSAnswer = {
      questionId,
      value,
      timestamp: new Date()
    };

    // AI ile cevap doğrulama
    if (this.currentSession.aiEnhanced && openEndedResponse) {
      const validation = await this.validateAnswer(
        questionId,
        value,
        openEndedResponse
      );

      if (validation.clarificationNeeded) {
        return {
          success: false,
          clarificationNeeded: true,
          aiFollowUp: validation.followUpQuestion
        };
      }

      answer.confidence = validation.confidence;
      answer.aiClarification = validation.clarification;
    }

    // Cevabı kaydet
    this.currentSession.answers.push(answer);
    this.currentSession.currentQuestionIndex++;
    
    await this.saveSession();

    // Son soru mu kontrol et
    if (this.currentSession.currentQuestionIndex >= YBOCS_QUESTIONS.length) {
      await this.completeSession();
    }

    return { success: true };
  }

  /**
   * Oturumu tamamla ve sonuçları hesapla
   */
  async completeSession(): Promise<YBOCSSeverity> {
    if (!this.currentSession) {
      throw this.createError('No active session');
    }

    // Skoru hesapla
    const totalScore = this.currentSession.answers.reduce(
      (sum, answer) => sum + answer.value,
      0
    );

    // Obsesyon ve kompulsiyon skorlarını ayır
    const obsessionScore = this.currentSession.answers
      .filter(a => a.questionId.includes('obsessions'))
      .reduce((sum, a) => sum + a.value, 0);

    const compulsionScore = totalScore - obsessionScore;

    // Kategori belirle
    let category: YBOCSSeverity['category'];
    if (totalScore <= 7) category = 'minimal';
    else if (totalScore <= 15) category = 'mild';
    else if (totalScore <= 23) category = 'moderate';
    else if (totalScore <= 31) category = 'severe';
    else category = 'extreme';

    // AI destekli öneriler
    const recommendations = await this.generateRecommendations(
      category,
      this.currentSession.answers
    );

    const severity: YBOCSSeverity = {
      totalScore,
      category,
      obsessionScore,
      compulsionScore,
      recommendations
    };

    // Oturumu güncelle
    this.currentSession.completionTime = new Date();
    this.currentSession.severity = severity;
    
    await this.saveSession();
    await this.saveUserProfile(severity);

    // Telemetri
    await trackAIInteraction(AIEventType.CONVERSATION_END, {
      type: 'onboarding',
      duration: Date.now() - this.currentSession.startTime.getTime(),
      severity: category,
      ai_enhanced: this.currentSession.aiEnhanced
    });

    return severity;
  }

  /**
   * AI ile soru zenginleştirme
   */
  private async enhanceQuestion(
    question: typeof YBOCS_QUESTIONS[0]
  ): Promise<AIEnhancedQuestion> {
    try {
      // Önceki cevaplara göre soruyu kişiselleştir
      const previousAnswers = this.currentSession?.answers || [];
      
      let contextualPrompt = question.text;
      if (previousAnswers.length > 0) {
        // Önceki cevaplara göre uyarla
        const lastAnswer = previousAnswers[previousAnswers.length - 1];
        if (lastAnswer.value >= 3) {
          contextualPrompt = `${question.text} (Önceki cevabınızı dikkate alarak daha detaylı açıklayabilir misiniz?)`;
        }
      }

      return {
        enhancedPrompt: contextualPrompt,
        examples: this.getContextualExamples(question.id),
        clarificationHints: [
          'Lütfen somut örnekler verin',
          'Ne sıklıkla olduğunu belirtin',
          'Size nasıl hissettirdiğini açıklayın'
        ]
      };
    } catch (error) {
      console.error('[AIOnboarding] Enhancement failed:', error);
      return {
        enhancedPrompt: question.text,
        examples: [],
        clarificationHints: []
      };
    }
  }

  /**
   * Cevap doğrulama
   */
  private async validateAnswer(
    questionId: string,
    numericValue: number,
    textResponse: string
  ): Promise<{
    confidence: number;
    clarificationNeeded: boolean;
    followUpQuestion?: string;
    clarification?: string;
  }> {
    // Basit doğrulama - gerçek uygulamada NLP kullanılabilir
    const responseLength = textResponse.trim().length;
    
    if (responseLength < 10) {
      return {
        confidence: 0.3,
        clarificationNeeded: true,
        followUpQuestion: 'Biraz daha detay verebilir misiniz? Örneğin, bu durum günlük hayatınızı nasıl etkiliyor?'
      };
    }

    // Tutarlılık kontrolü
    const isConsistent = this.checkConsistency(numericValue, textResponse);
    
    return {
      confidence: isConsistent ? 0.9 : 0.6,
      clarificationNeeded: false,
      clarification: textResponse
    };
  }

  /**
   * Öneriler oluştur
   */
  private async generateRecommendations(
    severity: YBOCSSeverity['category'],
    answers: YBOCSAnswer[]
  ): Promise<string[]> {
    const baseRecommendations = {
      minimal: [
        'Hafif belirtiler gösteriyorsunuz. Önleyici stratejiler öğrenmek faydalı olabilir.',
        'Düzenli egzersiz ve meditasyon önerilir.',
        'Stres yönetimi tekniklerini öğrenin.'
      ],
      mild: [
        'Hafif OKB belirtileri var. Erken müdahale önemli.',
        'CBT (Bilişsel Davranışçı Terapi) teknikleri yararlı olabilir.',
        'Günlük tutmayı düşünün.'
      ],
      moderate: [
        'Orta düzeyde belirtiler. Profesyonel destek önerilir.',
        'ERP (Maruz Bırakma ve Tepki Önleme) terapisi düşünülebilir.',
        'Düzenli terapi seansları faydalı olacaktır.'
      ],
      severe: [
        'Ciddi belirtiler. Mutlaka profesyonel yardım alın.',
        'Psikiyatrist değerlendirmesi önerilir.',
        'Yoğun terapi programı gerekebilir.'
      ],
      extreme: [
        'Çok ciddi belirtiler. Acil profesyonel müdahale gerekli.',
        'En kısa sürede psikiyatrist randevusu alın.',
        'Kapsamlı tedavi planı oluşturulmalı.'
      ]
    };

    const recommendations = baseRecommendations[severity] || [];

    // AI ile kişiselleştirilmiş öneriler
    if (this.currentSession?.aiEnhanced && aiManager.isEnabled()) {
      // Gelecekte AI ile zenginleştirilebilir
      recommendations.push('Uygulamadaki AI destekli özelliklerden yararlanabilirsiniz.');
    }

    return recommendations;
  }

  // Yardımcı metodlar

  private generateSessionId(): string {
    return `onboarding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createError(message: string): AIError {
    const error = new Error(message) as AIError;
    error.code = AIErrorCode.INVALID_RESPONSE;
    error.severity = 'medium';
    error.userMessage = 'Onboarding işlemi sırasında bir hata oluştu.';
    return error;
  }

  private async saveSession(): Promise<void> {
    if (!this.currentSession) return;
    
    try {
      await AsyncStorage.setItem(
        `@onboarding_session_${this.currentSession.sessionId}`,
        JSON.stringify(this.currentSession)
      );
    } catch (error) {
      console.error('[AIOnboarding] Failed to save session:', error);
    }
  }

  private async saveUserProfile(severity: YBOCSSeverity): Promise<void> {
    if (!this.currentSession) return;

    const profile: Partial<UserAIProfile> = {
      symptomSeverity: severity.totalScore,
      therapeuticGoals: severity.recommendations.slice(0, 3),
      preferredLanguage: 'tr'
    };

    try {
      await AsyncStorage.setItem(
        `@user_ai_profile_${this.currentSession.userId}`,
        JSON.stringify(profile)
      );
    } catch (error) {
      console.error('[AIOnboarding] Failed to save profile:', error);
    }
  }

  private getContextualExamples(questionId: string): string[] {
    const examples = {
      obsessions_time: [
        'Örnek: Kapıları kontrol etme düşüncesi',
        'Örnek: Kirlenme korkusu',
        'Örnek: Zarar verme endişesi'
      ],
      obsessions_interference: [
        'Örnek: İşe geç kalma',
        'Örnek: Sosyal aktiviteleri kaçırma',
        'Örnek: Günlük rutinlerin bozulması'
      ]
    };

    return examples[questionId] || [];
  }

  private checkConsistency(numericValue: number, textResponse: string): boolean {
    // Basit tutarlılık kontrolü
    const severeKeywords = ['çok', 'aşırı', 'sürekli', 'her zaman', 'tamamen'];
    const mildKeywords = ['bazen', 'nadiren', 'az', 'hafif'];

    const hasSevereKeywords = severeKeywords.some(keyword => 
      textResponse.toLowerCase().includes(keyword)
    );
    const hasMildKeywords = mildKeywords.some(keyword => 
      textResponse.toLowerCase().includes(keyword)
    );

    if (numericValue >= 3 && hasSevereKeywords) return true;
    if (numericValue <= 1 && hasMildKeywords) return true;
    if (numericValue === 2 && !hasSevereKeywords && !hasMildKeywords) return true;

    return false;
  }
}

// Types
interface AIEnhancedQuestion {
  enhancedPrompt: string;
  examples: string[];
  clarificationHints: string[];
}

// Singleton export
export const aiOnboardingService = AIOnboardingService.getInstance(); 