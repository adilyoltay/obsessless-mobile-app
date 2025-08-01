/**
 * Onboarding Intelligence Engine
 * 
 * Y-BOCS yanıtlarını işleyen ve kişiselleştirilmiş öneriler üreten motor
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  UserAIProfile,
  TherapeuticInsight,
  AIResponse,
  AIError,
  AIErrorCode
} from '@/features/ai/types';
import { aiManager } from '@/features/ai/config/aiManager';
import { trackTherapeuticOutcome } from '@/features/ai/telemetry/aiTelemetry';
import { YBOCSAnswer, YBOCSSeverity } from '@/features/ai/services/aiOnboarding';

// OKB alt tipleri
export enum OCDSubtype {
  CONTAMINATION = 'contamination',
  HARM = 'harm',
  SYMMETRY = 'symmetry',
  RELIGIOUS = 'religious',
  SEXUAL = 'sexual',
  HOARDING = 'hoarding',
  CHECKING = 'checking',
  MIXED = 'mixed'
}

// Terapi yaklaşımları
export enum TherapyApproach {
  CBT = 'CBT',
  ERP = 'ERP',
  ACT = 'ACT',
  MINDFULNESS = 'Mindfulness',
  COMBINED = 'Combined'
}

export interface OnboardingAnalysis {
  profile: EnhancedUserProfile;
  insights: TherapeuticInsight[];
  treatmentPlan: TreatmentPlan;
  riskAssessment: RiskAssessment;
}

export interface EnhancedUserProfile extends UserAIProfile {
  ocdSubtypes: OCDSubtype[];
  primarySubtype: OCDSubtype;
  secondarySubtype?: OCDSubtype;
  triggerPatterns: TriggerPattern[];
  copingStrategies: string[];
  readinessForChange: number; // 0-1
  culturalFactors: CulturalFactors;
}

export interface TreatmentPlan {
  recommendedApproach: TherapyApproach;
  shortTermGoals: Goal[];
  longTermGoals: Goal[];
  suggestedExercises: Exercise[];
  estimatedDuration: number; // hafta
  intensityLevel: 'low' | 'moderate' | 'high';
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  targetDate: Date;
  measurableOutcome: string;
  relatedSubtype: OCDSubtype;
}

export interface Exercise {
  id: string;
  name: string;
  type: 'exposure' | 'cognitive' | 'behavioral' | 'mindfulness';
  difficulty: number; // 1-10
  duration: number; // dakika
  frequency: string; // "günde 2 kez", "haftada 3 kez"
  instructions: string[];
}

export interface TriggerPattern {
  category: string;
  triggers: string[];
  frequency: 'rare' | 'occasional' | 'frequent' | 'constant';
  severity: number; // 1-10
  contexts: string[]; // "iş", "ev", "sosyal ortam"
}

export interface RiskAssessment {
  overallRisk: 'low' | 'moderate' | 'high';
  suicidalIdeation: boolean;
  functionalImpairment: number; // 0-10
  socialIsolation: number; // 0-10
  workImpairment: number; // 0-10
  needsImmediateHelp: boolean;
  recommendations: string[];
}

export interface CulturalFactors {
  language: string;
  religiousConsiderations: boolean;
  familyInvolvement: 'none' | 'low' | 'moderate' | 'high';
  stigmaConcerns: boolean;
  preferredCommunicationStyle: string;
}

class OnboardingEngine {
  private static instance: OnboardingEngine;

  private constructor() {}

  static getInstance(): OnboardingEngine {
    if (!this.instance) {
      this.instance = new OnboardingEngine();
    }
    return this.instance;
  }

  /**
   * Y-BOCS yanıtlarını analiz et
   */
  async analyzeResponses(
    answers: YBOCSAnswer[],
    severity: YBOCSSeverity,
    userId: string
  ): Promise<OnboardingAnalysis> {
    // Feature flag kontrolü
    if (!FEATURE_FLAGS.isEnabled('AI_ONBOARDING')) {
      return this.getBasicAnalysis(answers, severity);
    }

    try {
      // 1. OKB alt tiplerini belirle
      const subtypes = this.identifyOCDSubtypes(answers);

      // 2. Kullanıcı profilini oluştur
      const profile = await this.buildEnhancedProfile(
        answers,
        severity,
        subtypes,
        userId
      );

      // 3. Terapötik içgörüler üret
      const insights = this.generateInsights(profile, answers);

      // 4. Tedavi planı oluştur
      const treatmentPlan = this.createTreatmentPlan(profile, severity);

      // 5. Risk değerlendirmesi
      const riskAssessment = this.assessRisk(answers, severity);

      // Telemetri
      await this.trackAnalysisOutcome(profile, treatmentPlan);

      return {
        profile,
        insights,
        treatmentPlan,
        riskAssessment
      };
    } catch (error) {
      console.error('[OnboardingEngine] Analysis failed:', error);
      return this.getBasicAnalysis(answers, severity);
    }
  }

  /**
   * OKB alt tiplerini belirle
   */
  private identifyOCDSubtypes(answers: YBOCSAnswer[]): OCDSubtype[] {
    const subtypes: OCDSubtype[] = [];
    
    // Yanıt pattern'lerine göre alt tipleri belirle
    // Bu basit bir implementasyon - gerçek uygulamada daha sofistike olmalı
    
    const highScoreQuestions = answers.filter(a => a.value >= 3);
    
    if (highScoreQuestions.some(a => a.aiClarification?.includes('temizlik') || 
                                     a.aiClarification?.includes('kirli'))) {
      subtypes.push(OCDSubtype.CONTAMINATION);
    }
    
    if (highScoreQuestions.some(a => a.aiClarification?.includes('kontrol') || 
                                     a.aiClarification?.includes('kapı'))) {
      subtypes.push(OCDSubtype.CHECKING);
    }
    
    if (highScoreQuestions.some(a => a.aiClarification?.includes('düzen') || 
                                     a.aiClarification?.includes('simetri'))) {
      subtypes.push(OCDSubtype.SYMMETRY);
    }
    
    if (highScoreQuestions.some(a => a.aiClarification?.includes('zarar') || 
                                     a.aiClarification?.includes('kötü şey'))) {
      subtypes.push(OCDSubtype.HARM);
    }

    // En az bir alt tip belirle
    if (subtypes.length === 0) {
      subtypes.push(OCDSubtype.MIXED);
    }

    return subtypes;
  }

  /**
   * Gelişmiş kullanıcı profili oluştur
   */
  private async buildEnhancedProfile(
    answers: YBOCSAnswer[],
    severity: YBOCSSeverity,
    subtypes: OCDSubtype[],
    userId: string
  ): Promise<EnhancedUserProfile> {
    // Temel profil
    const profile: EnhancedUserProfile = {
      symptomSeverity: severity.totalScore,
      preferredLanguage: 'tr',
      triggerWords: this.extractTriggerWords(answers),
      therapeuticGoals: severity.recommendations,
      communicationStyle: 'supportive',
      privacyPreferences: {
        dataRetention: 'standard',
        analyticsConsent: true,
        therapistSharing: false,
        anonymizedDataUsage: true
      },
      ocdSubtypes: subtypes,
      primarySubtype: subtypes[0],
      secondarySubtype: subtypes[1],
      triggerPatterns: this.identifyTriggerPatterns(answers),
      copingStrategies: [],
      readinessForChange: this.assessReadiness(answers),
      culturalFactors: {
        language: 'tr',
        religiousConsiderations: false,
        familyInvolvement: 'moderate',
        stigmaConcerns: true,
        preferredCommunicationStyle: 'empathetic'
      }
    };

    return profile;
  }

  /**
   * Terapötik içgörüler üret
   */
  private generateInsights(
    profile: EnhancedUserProfile,
    answers: YBOCSAnswer[]
  ): TherapeuticInsight[] {
    const insights: TherapeuticInsight[] = [];

    // 1. Birincil alt tip içgörüsü
    insights.push({
      type: 'pattern',
      content: this.getSubtypeInsight(profile.primarySubtype),
      confidence: 0.85,
      clinicalRelevance: 0.9
    });

    // 2. Direnç pattern'i
    const resistancePattern = this.analyzeResistancePattern(answers);
    if (resistancePattern) {
      insights.push({
        type: 'pattern',
        content: resistancePattern,
        confidence: 0.75,
        clinicalRelevance: 0.8
      });
    }

    // 3. İlerleme potansiyeli
    insights.push({
      type: 'progress',
      content: this.assessProgressPotential(profile),
      confidence: 0.7,
      clinicalRelevance: 0.85
    });

    // 4. Öneriler
    const suggestions = this.generateSuggestions(profile);
    suggestions.forEach(suggestion => {
      insights.push({
        type: 'suggestion',
        content: suggestion,
        confidence: 0.8,
        clinicalRelevance: 0.75
      });
    });

    return insights;
  }

  /**
   * Tedavi planı oluştur
   */
  private createTreatmentPlan(
    profile: EnhancedUserProfile,
    severity: YBOCSSeverity
  ): TreatmentPlan {
    // Terapi yaklaşımını belirle
    const approach = this.selectTherapyApproach(profile, severity);

    // Hedefler oluştur
    const shortTermGoals = this.generateShortTermGoals(profile);
    const longTermGoals = this.generateLongTermGoals(profile);

    // Egzersizler öner
    const exercises = this.suggestExercises(profile, approach);

    // Süre ve yoğunluk tahmin et
    const duration = this.estimateTreatmentDuration(severity);
    const intensity = this.determineIntensity(severity);

    return {
      recommendedApproach: approach,
      shortTermGoals,
      longTermGoals,
      suggestedExercises: exercises,
      estimatedDuration: duration,
      intensityLevel: intensity
    };
  }

  /**
   * Risk değerlendirmesi
   */
  private assessRisk(
    answers: YBOCSAnswer[],
    severity: YBOCSSeverity
  ): RiskAssessment {
    const totalScore = severity.totalScore;
    
    // Risk faktörleri
    let riskScore = 0;
    
    if (totalScore > 24) riskScore += 3;
    else if (totalScore > 16) riskScore += 2;
    else if (totalScore > 8) riskScore += 1;

    // Fonksiyonel bozulma
    const functionalImpairment = Math.min(10, totalScore / 4);
    const socialIsolation = this.assessSocialIsolation(answers);
    const workImpairment = this.assessWorkImpairment(answers);

    // Genel risk
    let overallRisk: RiskAssessment['overallRisk'] = 'low';
    if (riskScore >= 3 || functionalImpairment > 7) overallRisk = 'high';
    else if (riskScore >= 2 || functionalImpairment > 5) overallRisk = 'moderate';

    const needsImmediateHelp = overallRisk === 'high' && totalScore > 30;

    return {
      overallRisk,
      suicidalIdeation: false, // Bu gerçek uygulamada özel sorularla değerlendirilmeli
      functionalImpairment,
      socialIsolation,
      workImpairment,
      needsImmediateHelp,
      recommendations: this.getRiskRecommendations(overallRisk, needsImmediateHelp)
    };
  }

  // Yardımcı metodlar

  private getBasicAnalysis(
    answers: YBOCSAnswer[],
    severity: YBOCSSeverity
  ): OnboardingAnalysis {
    // AI olmadan temel analiz
    const basicProfile: EnhancedUserProfile = {
      symptomSeverity: severity.totalScore,
      preferredLanguage: 'tr',
      triggerWords: [],
      therapeuticGoals: severity.recommendations,
      communicationStyle: 'supportive',
      privacyPreferences: {
        dataRetention: 'standard',
        analyticsConsent: true,
        therapistSharing: false,
        anonymizedDataUsage: true
      },
      ocdSubtypes: [OCDSubtype.MIXED],
      primarySubtype: OCDSubtype.MIXED,
      triggerPatterns: [],
      copingStrategies: [],
      readinessForChange: 0.5,
      culturalFactors: {
        language: 'tr',
        religiousConsiderations: false,
        familyInvolvement: 'moderate',
        stigmaConcerns: true,
        preferredCommunicationStyle: 'empathetic'
      }
    };

    return {
      profile: basicProfile,
      insights: [],
      treatmentPlan: this.getBasicTreatmentPlan(severity),
      riskAssessment: this.getBasicRiskAssessment(severity)
    };
  }

  private extractTriggerWords(answers: YBOCSAnswer[]): string[] {
    const triggerWords: string[] = [];
    
    // AI clarification'lardan trigger kelimelerini çıkar
    answers.forEach(answer => {
      if (answer.aiClarification) {
        // Basit keyword extraction - gerçek uygulamada NLP kullanılmalı
        const keywords = ['temizlik', 'kontrol', 'düzen', 'zarar', 'kirli', 
                         'kapı', 'simetri', 'sayma', 'tekrar'];
        
        keywords.forEach(keyword => {
          if (answer.aiClarification.includes(keyword)) {
            triggerWords.push(keyword);
          }
        });
      }
    });

    return [...new Set(triggerWords)]; // Unique değerler
  }

  private identifyTriggerPatterns(answers: YBOCSAnswer[]): TriggerPattern[] {
    // Basit pattern tanıma - gerçek uygulamada daha karmaşık olmalı
    const patterns: TriggerPattern[] = [];

    if (answers.some(a => a.value >= 3)) {
      patterns.push({
        category: 'environmental',
        triggers: ['kalabalık yerler', 'kirli yüzeyler', 'düzensizlik'],
        frequency: 'frequent',
        severity: 7,
        contexts: ['ev', 'iş', 'sosyal ortam']
      });
    }

    return patterns;
  }

  private assessReadiness(answers: YBOCSAnswer[]): number {
    // Değişime hazır olma durumunu değerlendir
    const avgScore = answers.reduce((sum, a) => sum + a.value, 0) / answers.length;
    
    // Yüksek skorlar düşük hazırlık anlamına gelebilir
    if (avgScore > 3) return 0.3;
    if (avgScore > 2) return 0.5;
    if (avgScore > 1) return 0.7;
    return 0.9;
  }

  private getSubtypeInsight(subtype: OCDSubtype): string {
    const insights = {
      [OCDSubtype.CONTAMINATION]: 'Kirlenme obsesyonlarınız günlük yaşamınızı etkiliyor gibi görünüyor. Bu tip obsesyonlar genellikle güvenlik arayışı ile ilişkilidir.',
      [OCDSubtype.CHECKING]: 'Kontrol etme kompulsiyonlarınız belirsizliğe tahammülsüzlükten kaynaklanıyor olabilir.',
      [OCDSubtype.SYMMETRY]: 'Düzen ve simetri ihtiyacınız, kontrol duygusu arayışınızla bağlantılı olabilir.',
      [OCDSubtype.HARM]: 'Zarar verme obsesyonları aslında değerlerinizin tam tersi olduğunuzu gösterir.',
      [OCDSubtype.RELIGIOUS]: 'Dini obsesyonlar, mükemmeliyetçilik ve kesinlik arayışıyla ilişkili olabilir.',
      [OCDSubtype.SEXUAL]: 'İstenmeyen cinsel düşünceler OKB\'nin bir parçasıdır ve karakterinizi yansıtmaz.',
      [OCDSubtype.HOARDING]: 'Biriktirme davranışları, kayıp korkusu ve bağlanma ile ilişkili olabilir.',
      [OCDSubtype.MIXED]: 'Farklı OKB belirtileri gösteriyorsunuz. Bu oldukça yaygındır.'
    };

    return insights[subtype] || insights[OCDSubtype.MIXED];
  }

  private analyzeResistancePattern(answers: YBOCSAnswer[]): string | null {
    const resistanceQuestion = answers.find(a => a.questionId === 'obsessions_resistance');
    if (!resistanceQuestion) return null;

    if (resistanceQuestion.value >= 3) {
      return 'Obsesyonlarınıza karşı düşük direnç gösteriyorsunuz. Bu, tükenmiş hissetmenize neden olabilir. Direnç stratejilerini öğrenmek size yardımcı olacaktır.';
    } else if (resistanceQuestion.value <= 1) {
      return 'Obsesyonlarınıza karşı yüksek direnç gösteriyorsunuz. Bu pozitif bir işaret, ancak bazen aşırı direnç de sıkıntıyı artırabilir.';
    }

    return null;
  }

  private assessProgressPotential(profile: EnhancedUserProfile): string {
    if (profile.readinessForChange > 0.7) {
      return 'Değişime hazır görünüyorsunuz! Bu, tedavide hızlı ilerleme için çok önemli bir faktör.';
    } else if (profile.readinessForChange > 0.4) {
      return 'Değişim konusunda bazı tereddütleriniz olabilir. Bu normal! Küçük adımlarla başlamak motivasyonunuzu artırabilir.';
    } else {
      return 'Şu anda değişim zor gelebilir. Önce motivasyon üzerine çalışmak faydalı olacaktır.';
    }
  }

  private generateSuggestions(profile: EnhancedUserProfile): string[] {
    const suggestions: string[] = [];

    // Alt tipe göre öneriler
    switch (profile.primarySubtype) {
      case OCDSubtype.CONTAMINATION:
        suggestions.push('Kademeli maruz bırakma egzersizleri ile başlayabilirsiniz.');
        suggestions.push('Temizlik ritüellerinizi yavaş yavaş azaltmayı deneyin.');
        break;
      case OCDSubtype.CHECKING:
        suggestions.push('Kontrol etme dürtüsü geldiğinde 5 dakika beklemeyi deneyin.');
        suggestions.push('Kontrol sayınızı günlük olarak kaydedin.');
        break;
      case OCDSubtype.SYMMETRY:
        suggestions.push('Kasıtlı olarak küçük düzensizliklere tolerans göstermeyi deneyin.');
        break;
      default:
        suggestions.push('Obsesyon ve kompulsiyonlarınızı günlük tutarak takip edin.');
    }

    suggestions.push('Düzenli egzersiz ve meditasyon faydalı olabilir.');
    suggestions.push('Destek grubu veya terapi seçeneklerini değerlendirin.');

    return suggestions;
  }

  private selectTherapyApproach(
    profile: EnhancedUserProfile,
    severity: YBOCSSeverity
  ): TherapyApproach {
    // Basit seçim mantığı
    if (severity.totalScore > 20) {
      return TherapyApproach.ERP; // Ciddi vakalar için ERP
    } else if (profile.readinessForChange < 0.5) {
      return TherapyApproach.ACT; // Motivasyon düşükse ACT
    } else if (profile.culturalFactors.religiousConsiderations) {
      return TherapyApproach.COMBINED; // Dini hassasiyetler varsa kombine
    } else {
      return TherapyApproach.CBT; // Varsayılan CBT
    }
  }

  private generateShortTermGoals(profile: EnhancedUserProfile): Goal[] {
    const goals: Goal[] = [];
    const now = new Date();

    goals.push({
      id: 'goal_1',
      title: 'Farkındalık Geliştirme',
      description: 'Obsesyon ve kompulsiyonlarınızı günlük olarak kaydetmek',
      targetDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 hafta
      measurableOutcome: 'Günde en az 3 kayıt',
      relatedSubtype: profile.primarySubtype
    });

    goals.push({
      id: 'goal_2',
      title: 'Tetikleyici Tanıma',
      description: 'OKB belirtilerinizi tetikleyen durumları belirlemek',
      targetDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 hafta
      measurableOutcome: 'En az 5 tetikleyici belirleme',
      relatedSubtype: profile.primarySubtype
    });

    return goals;
  }

  private generateLongTermGoals(profile: EnhancedUserProfile): Goal[] {
    const goals: Goal[] = [];
    const now = new Date();

    goals.push({
      id: 'goal_long_1',
      title: 'Semptom Azaltma',
      description: 'Y-BOCS skorunda %30 azalma sağlamak',
      targetDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 3 ay
      measurableOutcome: 'Y-BOCS skoru ' + Math.floor(profile.symptomSeverity * 0.7),
      relatedSubtype: profile.primarySubtype
    });

    goals.push({
      id: 'goal_long_2',
      title: 'Fonksiyonel İyileşme',
      description: 'Günlük aktivitelerde OKB engellemelerini azaltmak',
      targetDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000), // 6 ay
      measurableOutcome: 'Günlük rutin kesintilerinde %50 azalma',
      relatedSubtype: profile.primarySubtype
    });

    return goals;
  }

  private suggestExercises(
    profile: EnhancedUserProfile,
    approach: TherapyApproach
  ): Exercise[] {
    const exercises: Exercise[] = [];

    // ERP egzersizleri
    if (approach === TherapyApproach.ERP || approach === TherapyApproach.COMBINED) {
      exercises.push({
        id: 'ex_1',
        name: 'Kademeli Maruz Bırakma',
        type: 'exposure',
        difficulty: 3,
        duration: 15,
        frequency: 'günde 1 kez',
        instructions: [
          'En düşük anksiyete yaratan tetikleyiciyi seçin',
          'Bu tetikleyiciye 15 dakika maruz kalın',
          'Kompulsiyon yapmadan bekleyin',
          'Anksiyete seviyenizi 0-10 arasında kaydedin'
        ]
      });
    }

    // CBT egzersizleri
    if (approach === TherapyApproach.CBT || approach === TherapyApproach.COMBINED) {
      exercises.push({
        id: 'ex_2',
        name: 'Düşünce Kaydı',
        type: 'cognitive',
        difficulty: 2,
        duration: 10,
        frequency: 'günde 2 kez',
        instructions: [
          'Obsesif düşünce geldiğinde durumu yazın',
          'Düşüncenin gerçekçiliğini 0-100 arasında değerlendirin',
          'Alternatif, dengeli bir düşünce oluşturun',
          'Yeni düşünceye olan inancınızı değerlendirin'
        ]
      });
    }

    // Mindfulness egzersizleri
    exercises.push({
      id: 'ex_3',
      name: 'Farkındalık Meditasyonu',
      type: 'mindfulness',
      difficulty: 1,
      duration: 5,
      frequency: 'günde 2 kez',
      instructions: [
        'Rahat bir pozisyonda oturun',
        'Nefesinize odaklanın',
        'Düşünceler geldiğinde yargılamadan gözlemleyin',
        'Nazikçe dikkatinizi nefese geri getirin'
      ]
    });

    return exercises;
  }

  private estimateTreatmentDuration(severity: YBOCSSeverity): number {
    // Hafta cinsinden tahmin
    if (severity.category === 'extreme') return 52; // 1 yıl
    if (severity.category === 'severe') return 26; // 6 ay
    if (severity.category === 'moderate') return 16; // 4 ay
    if (severity.category === 'mild') return 12; // 3 ay
    return 8; // 2 ay
  }

  private determineIntensity(severity: YBOCSSeverity): 'low' | 'moderate' | 'high' {
    if (severity.totalScore > 24) return 'high';
    if (severity.totalScore > 16) return 'moderate';
    return 'low';
  }

  private assessSocialIsolation(answers: YBOCSAnswer[]): number {
    // Basit değerlendirme - gerçek uygulamada daha detaylı olmalı
    const interferenceAnswer = answers.find(a => a.questionId === 'obsessions_interference');
    if (!interferenceAnswer) return 5;
    
    return Math.min(10, interferenceAnswer.value * 2.5);
  }

  private assessWorkImpairment(answers: YBOCSAnswer[]): number {
    // Basit değerlendirme
    const timeAnswer = answers.find(a => a.questionId === 'obsessions_time');
    const interferenceAnswer = answers.find(a => a.questionId === 'obsessions_interference');
    
    if (!timeAnswer || !interferenceAnswer) return 5;
    
    return Math.min(10, (timeAnswer.value + interferenceAnswer.value) * 1.25);
  }

  private getRiskRecommendations(
    risk: RiskAssessment['overallRisk'],
    needsHelp: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (needsHelp) {
      recommendations.push('ACİL: En kısa sürede bir ruh sağlığı uzmanına başvurun.');
      recommendations.push('Kriz durumunda: 182 (Ruh Sağlığı Destek Hattı)');
    }

    if (risk === 'high') {
      recommendations.push('Profesyonel yardım almanızı şiddetle tavsiye ediyoruz.');
      recommendations.push('Aile veya güvendiğiniz biriyle durumunuzu paylaşın.');
    } else if (risk === 'moderate') {
      recommendations.push('Terapi seçeneklerini değerlendirmeniz önerilir.');
      recommendations.push('Destek gruplarına katılmayı düşünün.');
    } else {
      recommendations.push('Önleyici stratejiler öğrenmek faydalı olacaktır.');
      recommendations.push('Stres yönetimi tekniklerini uygulayın.');
    }

    return recommendations;
  }

  private getBasicTreatmentPlan(severity: YBOCSSeverity): TreatmentPlan {
    return {
      recommendedApproach: TherapyApproach.CBT,
      shortTermGoals: [],
      longTermGoals: [],
      suggestedExercises: [],
      estimatedDuration: 12,
      intensityLevel: severity.totalScore > 16 ? 'moderate' : 'low'
    };
  }

  private getBasicRiskAssessment(severity: YBOCSSeverity): RiskAssessment {
    const risk = severity.totalScore > 24 ? 'high' : 
                 severity.totalScore > 16 ? 'moderate' : 'low';
    
    return {
      overallRisk: risk,
      suicidalIdeation: false,
      functionalImpairment: severity.totalScore / 4,
      socialIsolation: 5,
      workImpairment: 5,
      needsImmediateHelp: risk === 'high',
      recommendations: this.getRiskRecommendations(risk, risk === 'high')
    };
  }

  private async trackAnalysisOutcome(
    profile: EnhancedUserProfile,
    treatmentPlan: TreatmentPlan
  ): Promise<void> {
    await trackTherapeuticOutcome(
      'onboarding_analysis',
      profile.readinessForChange,
      0.8
    );
  }
}

// Singleton export
export const onboardingEngine = OnboardingEngine.getInstance(); 