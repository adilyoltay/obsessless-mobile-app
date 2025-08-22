/**
 * 🇹🇷 Turkish OCD Cultural Adaptation Service - Kültürel Duyarlı OKB Desteği
 * 
 * Bu service OKB özelliklerini Türk kültürüne uyarlar ve klinik standartlarda
 * değerlendirme sağlar. Dini değerler, aile dinamikleri ve sosyal normları
 * dikkate alarak kültürel duyarlı terapötik yaklaşım sunar.
 * 
 * ⚠️ CRITICAL: Dini değerleri respect etmek - OKB ile karıştırmamak
 * ⚠️ Clinical accuracy - Turkish cultural context içinde
 * ⚠️ Family-centered approach - Turkish society structure
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { CompulsionEntry } from '@/types/compulsion';
import { 
  AIError,
  AIErrorCode,
  ErrorSeverity
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

export interface TurkishCulturalOCDProfile {
  userId: string;
  
  // Religious considerations
  religiousProfile: {
    practicingLevel: 'non_practicing' | 'moderate' | 'observant' | 'devout';
    religiousOCDRisk: 'low' | 'medium' | 'high';
    scrupulosityLevel: number; // 0-10
    religiousDistinctionAbility: number; // 0-10 (can distinguish OCD from faith)
    commonReligiousOCDThemes: string[];
    adaptedInterventions: string[];
  };
  
  // Family dynamics
  familyProfile: {
    familyStructure: 'nuclear' | 'extended' | 'single_parent' | 'multi_generational';
    familySupportLevel: 'high' | 'medium' | 'low' | 'conflicted';
    familyOCDAwareness: number; // 0-10
    familyInvolvementWillingness: number; // 0-10
    culturalExpectations: string[];
    familyBasedInterventions: string[];
  };
  
  // Social-cultural factors
  socialProfile: {
    socialAnxietyLevel: number; // 0-10
    communityPressure: number; // 0-10
    traditionalValueAdherence: number; // 0-10
    modernizationStress: number; // 0-10
    culturalIdentityStrength: number; // 0-10
    socialBasedTriggers: string[];
  };
  
  // Language and communication
  communicationProfile: {
    primaryLanguage: 'turkish' | 'bilingual' | 'other';
    culturalExpressionPatterns: string[];
    metaphoricalThinking: number; // 0-10
    directnessComfort: number; // 0-10
    preferredCommunicationStyle: 'formal' | 'informal' | 'respectful' | 'direct';
  };
  
  // Clinical adaptations
  clinicalAdaptations: {
    assessmentModifications: string[];
    interventionAdaptations: string[];
    progressMeasures: string[];
    culturallyRelevantGoals: string[];
    riskFactors: string[];
    protectiveFactors: string[];
  };
}

export interface TurkishOCDCulturalAnalysis {
  overallCulturalRisk: 'low' | 'medium' | 'high' | 'complex';
  
  // Religious OCD analysis
  religiousAnalysis: {
    isPresent: boolean;
    severity: 'mild' | 'moderate' | 'severe';
    themes: {
      theme: string;
      frequency: number;
      severity: number;
      intervention: string;
    }[];
    distinctionNeeded: boolean; // Does user need help distinguishing OCD from faith
    recommendedReligiousSupport: string[];
  };
  
  // Family impact analysis
  familyAnalysis: {
    familyImpactLevel: number; // 0-10
    accommodationPatterns: string[];
    familyStressFactors: string[];
    familyStrengths: string[];
    recommendedFamilyWork: string[];
  };
  
  // Cultural intervention recommendations
  interventionRecommendations: {
    immediate: {
      culturallyAdapted: string[];
      religiousConsiderations: string[];
      familyInvolvement: string[];
    };
    longTerm: {
      culturalTherapyApproaches: string[];
      communityResources: string[];
      culturalIdentityWork: string[];
    };
    avoid: string[]; // Culturally inappropriate interventions
  };
  
  // Progress indicators
  culturalProgressMarkers: {
    religiousOCDDistinction: boolean;
    familySupport: boolean;
    culturalIntegration: boolean;
    communityFunctioning: boolean;
  };
}

export interface TurkishOCDTheme {
  themeId: string;
  name: string;
  description: string;
  culturalContext: string;
  prevalence: 'common' | 'moderate' | 'rare';
  
  // Pattern recognition
  keywords: string[];
  patterns: RegExp[];
  culturalMarkers: string[];
  
  // Clinical considerations
  severity: 'mild' | 'moderate' | 'severe';
  treatmentComplexity: 'simple' | 'moderate' | 'complex';
  requiresSpecialist: boolean;
  
  // Interventions
  culturallyAdaptedTreatments: {
    treatment: string;
    culturalModification: string;
    effectiveness: 'high' | 'medium' | 'low';
  }[];
  
  // Support resources
  recommendedResources: {
    religiousGuidance: string[];
    familyEducation: string[];
    communitySupport: string[];
    clinicalSpecialists: string[];
  };
}

// =============================================================================
// 🏗️ MAIN SERVICE CLASS
// =============================================================================

class TurkishOCDCulturalService {
  private static instance: TurkishOCDCulturalService;
  private isInitialized = false;
  private turkishOCDThemes: TurkishOCDTheme[] = [];
  private culturalProfiles = new Map<string, TurkishCulturalOCDProfile>();

  static getInstance(): TurkishOCDCulturalService {
    if (!TurkishOCDCulturalService.instance) {
      TurkishOCDCulturalService.instance = new TurkishOCDCulturalService();
    }
    return TurkishOCDCulturalService.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // Initialize Turkish OCD cultural themes
      this.initializeTurkishOCDThemes();

      this.isInitialized = true;
      console.log('🇹🇷 Turkish OCD Cultural Service initialized');

      await trackAIInteraction(AIEventType.FEATURE_INITIALIZED, {
        feature: 'TURKISH_OCD_CULTURAL',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Failed to initialize Turkish OCD Cultural Service:', error);
      await trackAIError(AIEventType.INITIALIZATION_ERROR, {
        feature: 'TURKISH_OCD_CULTURAL',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN ANALYSIS METHODS
  // =============================================================================

  /**
   * Comprehensive Turkish cultural OCD analysis
   */
  async analyzeTurkishCulturalFactors(
    userId: string,
    compulsions: CompulsionEntry[],
    userProfile?: any
  ): Promise<TurkishOCDCulturalAnalysis> {
    if (!this.isInitialized) {
      throw new Error('Turkish OCD Cultural Service not initialized');
    }

    if (!FEATURE_FLAGS.isEnabled('TURKISH_CULTURAL_OCD')) {
      console.log('⚠️ Turkish Cultural OCD analysis disabled by feature flag');
      return this.getEmptyAnalysis();
    }

    try {
      console.log(`🇹🇷 Analyzing Turkish cultural factors for ${compulsions.length} compulsions`);

      // Get or create cultural profile
      let culturalProfile = this.culturalProfiles.get(userId);
      if (!culturalProfile) {
        culturalProfile = await this.createCulturalProfile(userId, compulsions, userProfile);
        this.culturalProfiles.set(userId, culturalProfile);
      }

      // Religious OCD analysis
      const religiousAnalysis = this.analyzeReligiousOCD(compulsions, culturalProfile);

      // Family impact analysis
      const familyAnalysis = this.analyzeFamilyImpact(compulsions, culturalProfile);

      // Generate cultural intervention recommendations
      const interventionRecommendations = this.generateCulturalInterventions(
        religiousAnalysis,
        familyAnalysis,
        culturalProfile
      );

      // Assess overall cultural risk
      const overallCulturalRisk = this.assessOverallCulturalRisk(
        religiousAnalysis,
        familyAnalysis,
        culturalProfile
      );

      // Determine cultural progress markers
      const culturalProgressMarkers = this.determineCulturalProgressMarkers(
        compulsions,
        culturalProfile
      );

      const analysis: TurkishOCDCulturalAnalysis = {
        overallCulturalRisk,
        religiousAnalysis,
        familyAnalysis,
        interventionRecommendations,
        culturalProgressMarkers
      };

      // Track analysis completion
      await trackAIInteraction(AIEventType.CULTURAL_ANALYSIS_COMPLETED, {
        userId,
        overallRisk: overallCulturalRisk,
        religiousOCD: religiousAnalysis.isPresent,
        familyImpact: familyAnalysis.familyImpactLevel
      });

      return analysis;

    } catch (error) {
      console.error('❌ Turkish cultural analysis failed:', error);
      await trackAIError(AIEventType.CULTURAL_ANALYSIS_ERROR, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create culturally adapted Y-BOCS questions
   */
  createCulturallyAdaptedYBOCS(baseQuestions: any[]): any[] {
    return baseQuestions.map(question => {
      const adapted = { ...question };

      // Add Turkish cultural examples
      switch (question.theme) {
        case 'contamination':
          adapted.culturalExamples = [
            'Namaz öncesi aşırı temizlik endişesi',
            'Aile yemeği hazırlığında hijyen kaygısı',
            'Misafir gelmeden önce ev temizliği obsesyonu'
          ];
          adapted.culturalContext = 'Dini ve kültürel temizlik pratikleri ile OKB ayırt edilmeli';
          break;

        case 'checking':
          adapted.culturalExamples = [
            'Ev güvenliği kontrollerini aşırı yapma',
            'Aile fertlerinin güvenliği için sürekli kontrol',
            'Kur\'an-ı Kerim\'i doğru okuyup okumadığını kontrol'
          ];
          adapted.culturalContext = 'Aile sorumluluğu ve dini doğruluk ile OKB ayırt edilmeli';
          break;

        case 'symmetry':
          adapted.culturalExamples = [
            'Ev düzenini mükemmel tutma zorunluluğu',
            'Misafir ağırlama için aşırı hazırlık',
            'Dini metinlerin simetrik yerleşimi'
          ];
          adapted.culturalContext = 'Türk misafirperverliği ve estetik değerleri göz önünde bulundurulmalı';
          break;

        case 'religious':
          adapted.culturalExamples = [
            'Günahkarlık korkusu ve aşırı tövbe',
            'İbadet sırasında mükemmeliyetçilik',
            'Dini kurallara aşırı uyma zorunluluğu'
          ];
          adapted.culturalContext = 'Gerçek dini değerler ile skrupülöz OKB ayırt edilmeli';
          adapted.specialConsiderations = 'Din görevlisi ile işbirliği öneriliyor';
          break;
      }

      // Turkish language adaptation
      adapted.turkishPhrasing = this.adaptQuestionToTurkish(question.text);
      
      return adapted;
    });
  }

  // =============================================================================
  // 🕌 RELIGIOUS OCD ANALYSIS
  // =============================================================================

  private analyzeReligiousOCD(
    compulsions: CompulsionEntry[],
    profile: TurkishCulturalOCDProfile
  ): TurkishOCDCulturalAnalysis['religiousAnalysis'] {
    const religiousThemes = this.turkishOCDThemes.filter(theme => 
      theme.themeId.startsWith('religious_')
    );

    const detectedThemes: { theme: string; frequency: number; severity: number; intervention: string }[] = [];
    let totalReligiousCompulsions = 0;

    // Analyze each compulsion for religious content
    compulsions.forEach(compulsion => {
      const text = `${compulsion.notes || ''} ${compulsion.trigger || ''}`.toLowerCase();
      
      religiousThemes.forEach(theme => {
        const isMatch = theme.keywords.some(keyword => text.includes(keyword)) ||
                       theme.patterns.some(pattern => pattern.test(text));
        
        if (isMatch) {
          totalReligiousCompulsions++;
          
          const existing = detectedThemes.find(t => t.theme === theme.name);
          if (existing) {
            existing.frequency++;
            existing.severity = Math.max(existing.severity, compulsion.intensity);
          } else {
            detectedThemes.push({
              theme: theme.name,
              frequency: 1,
              severity: compulsion.intensity,
              intervention: theme.culturallyAdaptedTreatments[0]?.treatment || 'Genel OKB terapisi'
            });
          }
        }
      });
    });

    const isPresent = totalReligiousCompulsions > 0;
    const severity = totalReligiousCompulsions > compulsions.length * 0.5 ? 'severe' :
                    totalReligiousCompulsions > compulsions.length * 0.2 ? 'moderate' : 'mild';

    // Determine if distinction help is needed
    const distinctionNeeded = profile.religiousProfile.religiousDistinctionAbility < 6 || 
                             profile.religiousProfile.scrupulosityLevel > 7;

    const recommendedReligiousSupport = this.generateReligiousSupport(detectedThemes, profile);

    return {
      isPresent,
      severity,
      themes: detectedThemes.sort((a, b) => b.frequency - a.frequency),
      distinctionNeeded,
      recommendedReligiousSupport
    };
  }

  private generateReligiousSupport(
    themes: { theme: string; frequency: number; severity: number; intervention: string }[],
    profile: TurkishCulturalOCDProfile
  ): string[] {
    const support: string[] = [];

    if (themes.length > 0) {
      support.push('Dini danışman ile OKB ayrımı çalışması');
      support.push('İmam/vaiz ile görüşme (OKB farkındalığı olan)');
    }

    if (profile.religiousProfile.scrupulosityLevel > 7) {
      support.push('Skrupülözite odaklı terapi');
      support.push('Dini değerleri koruyarak OKB tedavisi');
    }

    if (profile.religiousProfile.religiousDistinctionAbility < 6) {
      support.push('Din-OKB ayrım eğitimi');
      support.push('Kültürel duyarlı CBT');
    }

    return support;
  }

  // =============================================================================
  // 👨‍👩‍👧‍👦 FAMILY IMPACT ANALYSIS
  // =============================================================================

  private analyzeFamilyImpact(
    compulsions: CompulsionEntry[],
    profile: TurkishCulturalOCDProfile
  ): TurkishOCDCulturalAnalysis['familyAnalysis'] {
    // Calculate family impact level
    let familyImpactLevel = 0;

    // Check for family-related triggers and themes
    const familyRelatedCompulsions = compulsions.filter(c => {
      const text = `${c.notes || ''} ${c.trigger || ''}`.toLowerCase();
      const familyKeywords = ['aile', 'anne', 'baba', 'kardeş', 'eş', 'çocuk', 'akraba', 'misafir'];
      return familyKeywords.some(keyword => text.includes(keyword));
    });

    familyImpactLevel = Math.min(10, (familyRelatedCompulsions.length / compulsions.length) * 10);

    // Identify accommodation patterns
    const accommodationPatterns = this.identifyAccommodationPatterns(compulsions);

    // Family stress factors
    const familyStressFactors = this.identifyFamilyStressFactors(profile, compulsions);

    // Family strengths
    const familyStrengths = this.identifyFamilyStrengths(profile);

    // Recommended family work
    const recommendedFamilyWork = this.generateFamilyRecommendations(
      profile,
      familyImpactLevel,
      accommodationPatterns
    );

    return {
      familyImpactLevel,
      accommodationPatterns,
      familyStressFactors,
      familyStrengths,
      recommendedFamilyWork
    };
  }

  private identifyAccommodationPatterns(compulsions: CompulsionEntry[]): string[] {
    const patterns: string[] = [];
    const accommodationKeywords = [
      'yardım ediyor', 'beraber yapıyor', 'kontrol ediyor', 'temizliyor',
      'tekrar söylüyor', 'güvence veriyor', 'kabul ediyor'
    ];

    compulsions.forEach(c => {
      const text = `${c.notes || ''}`.toLowerCase();
      accommodationKeywords.forEach(keyword => {
        if (text.includes(keyword) && !patterns.includes(keyword)) {
          patterns.push(`Aile ${keyword.split(' ')[1] || keyword}`);
        }
      });
    });

    return patterns;
  }

  private identifyFamilyStressFactors(
    profile: TurkishCulturalOCDProfile,
    compulsions: CompulsionEntry[]
  ): string[] {
    const stressFactors: string[] = [];

    if (profile.familyProfile.familyOCDAwareness < 5) {
      stressFactors.push('Aile OKB konusunda bilgisiz');
    }

    if (profile.familyProfile.familySupportLevel === 'conflicted') {
      stressFactors.push('Aile desteğinde çelişkiler');
    }

    if (profile.socialProfile.communityPressure > 7) {
      stressFactors.push('Toplumsal baskı ve yargılama');
    }

    const highSeverityCount = compulsions.filter(c => c.intensity >= 8).length;
    if (highSeverityCount > compulsions.length * 0.3) {
      stressFactors.push('Aile üzerinde yüksek stres');
    }

    return stressFactors;
  }

  private identifyFamilyStrengths(profile: TurkishCulturalOCDProfile): string[] {
    const strengths: string[] = [];

    if (profile.familyProfile.familySupportLevel === 'high') {
      strengths.push('Güçlü aile desteği');
    }

    if (profile.familyProfile.familyInvolvementWillingness > 7) {
      strengths.push('Tedaviye katılım istekliliği');
    }

    if (profile.familyProfile.familyStructure === 'extended' || 
        profile.familyProfile.familyStructure === 'multi_generational') {
      strengths.push('Geniş aile desteği mevcut');
    }

    if (profile.socialProfile.culturalIdentityStrength > 7) {
      strengths.push('Güçlü kültürel kimlik');
    }

    return strengths;
  }

  private generateFamilyRecommendations(
    profile: TurkishCulturalOCDProfile,
    impactLevel: number,
    accommodationPatterns: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (profile.familyProfile.familyOCDAwareness < 6) {
      recommendations.push('Aile OKB eğitimi düzenle');
    }

    if (accommodationPatterns.length > 2) {
      recommendations.push('Aile accommodation davranışlarını azaltma');
    }

    if (impactLevel > 6) {
      recommendations.push('Aile terapisi değerlendir');
    }

    if (profile.familyProfile.familySupportLevel !== 'high') {
      recommendations.push('Aile iletişim becerilerini güçlendir');
    }

    // Always recommend culturally-appropriate family involvement
    recommendations.push('Kültürel değerleri koruyarak aile desteği artır');

    return recommendations;
  }

  // =============================================================================
  // 🎯 CULTURAL INTERVENTION GENERATION
  // =============================================================================

  private generateCulturalInterventions(
    religiousAnalysis: TurkishOCDCulturalAnalysis['religiousAnalysis'],
    familyAnalysis: TurkishOCDCulturalAnalysis['familyAnalysis'],
    profile: TurkishCulturalOCDProfile
  ): TurkishOCDCulturalAnalysis['interventionRecommendations'] {
    const immediate = {
      culturallyAdapted: [] as string[],
      religiousConsiderations: [] as string[],
      familyInvolvement: [] as string[]
    };

    const longTerm = {
      culturalTherapyApproaches: [] as string[],
      communityResources: [] as string[],
      culturalIdentityWork: [] as string[]
    };

    const avoid = [] as string[];

    // Immediate interventions
    if (religiousAnalysis.isPresent) {
      immediate.religiousConsiderations.push('Dini değerleri koruyarak terapi');
      immediate.religiousConsiderations.push('Din görevlisi işbirliği');
    }

    if (familyAnalysis.familyImpactLevel > 5) {
      immediate.familyInvolvement.push('Aile psikoeğitim başlat');
      immediate.familyInvolvement.push('Accommodation davranışları azalt');
    }

    immediate.culturallyAdapted.push('Türkçe terapi materyalleri kullan');
    immediate.culturallyAdapted.push('Kültürel metaforlar ile açıklama');

    // Long-term interventions
    longTerm.culturalTherapyApproaches.push('Kültürel duyarlı CBT');
    if (religiousAnalysis.isPresent) {
      longTerm.culturalTherapyApproaches.push('Religious accommodation ile ERP');
    }

    longTerm.communityResources.push('Türkçe OKB destek grupları');
    longTerm.communityResources.push('Kültürel mentörlük programı');

    if (profile.socialProfile.culturalIdentityStrength < 7) {
      longTerm.culturalIdentityWork.push('Kültürel kimlik güçlendirme');
      longTerm.culturalIdentityWork.push('Değer-temelli terapi');
    }

    // Interventions to avoid
    if (religiousAnalysis.isPresent) {
      avoid.push('Dini değerleri sorgulayan yaklaşımlar');
      avoid.push('Seküler odaklı terapi modelleri');
    }

    if (profile.familyProfile.familyStructure === 'multi_generational') {
      avoid.push('Aileyi dışlayan bireysel yaklaşımlar');
    }

    avoid.push('Kültürel değerleri göz ardı eden müdahaleler');

    return {
      immediate,
      longTerm,
      avoid
    };
  }

  // =============================================================================
  // 📊 RISK ASSESSMENT & PROGRESS MARKERS
  // =============================================================================

  private assessOverallCulturalRisk(
    religiousAnalysis: TurkishOCDCulturalAnalysis['religiousAnalysis'],
    familyAnalysis: TurkishOCDCulturalAnalysis['familyAnalysis'],
    profile: TurkishCulturalOCDProfile
  ): 'low' | 'medium' | 'high' | 'complex' {
    let riskScore = 0;

    // Religious factors
    if (religiousAnalysis.isPresent) {
      riskScore += religiousAnalysis.severity === 'severe' ? 3 : 
                   religiousAnalysis.severity === 'moderate' ? 2 : 1;
    }

    if (religiousAnalysis.distinctionNeeded) {
      riskScore += 2;
    }

    // Family factors
    riskScore += Math.round(familyAnalysis.familyImpactLevel / 3);

    if (profile.familyProfile.familySupportLevel === 'conflicted') {
      riskScore += 2;
    }

    // Social factors
    if (profile.socialProfile.communityPressure > 7) {
      riskScore += 2;
    }

    if (profile.socialProfile.modernizationStress > 7) {
      riskScore += 1;
    }

    // Determine risk level
    if (riskScore >= 8) return 'complex';
    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  private determineCulturalProgressMarkers(
    compulsions: CompulsionEntry[],
    profile: TurkishCulturalOCDProfile
  ): TurkishOCDCulturalAnalysis['culturalProgressMarkers'] {
    return {
      religiousOCDDistinction: profile.religiousProfile.religiousDistinctionAbility > 7,
      familySupport: profile.familyProfile.familySupportLevel === 'high',
      culturalIntegration: profile.socialProfile.culturalIdentityStrength > 7,
      communityFunctioning: profile.socialProfile.communityPressure < 5
    };
  }

  // =============================================================================
  // 🏗️ PROFILE CREATION & MANAGEMENT
  // =============================================================================

  private async createCulturalProfile(
    userId: string,
    compulsions: CompulsionEntry[],
    userProfile?: any
  ): Promise<TurkishCulturalOCDProfile> {
    // This would typically be created from user onboarding data
    // For now, we'll create a profile based on compulsion analysis

    const profile: TurkishCulturalOCDProfile = {
      userId,
      
      religiousProfile: {
        practicingLevel: this.inferReligiousPractice(compulsions),
        religiousOCDRisk: this.assessReligiousOCDRisk(compulsions),
        scrupulosityLevel: this.calculateScrupulosityLevel(compulsions),
        religiousDistinctionAbility: 5, // Default - would be assessed
        commonReligiousOCDThemes: this.identifyReligiousThemes(compulsions),
        adaptedInterventions: []
      },
      
      familyProfile: {
        familyStructure: 'nuclear', // Default
        familySupportLevel: this.assessFamilySupport(compulsions),
        familyOCDAwareness: 5, // Default
        familyInvolvementWillingness: 7, // Typically high in Turkish culture
        culturalExpectations: this.identifyFamilyExpectations(compulsions),
        familyBasedInterventions: []
      },
      
      socialProfile: {
        socialAnxietyLevel: this.calculateSocialAnxiety(compulsions),
        communityPressure: 6, // Moderate default for Turkish society
        traditionalValueAdherence: 7, // High default
        modernizationStress: this.calculateModernizationStress(compulsions),
        culturalIdentityStrength: 8, // Strong default for Turkish culture
        socialBasedTriggers: this.identifySocialTriggers(compulsions)
      },
      
      communicationProfile: {
        primaryLanguage: 'turkish',
        culturalExpressionPatterns: ['metaphorical', 'respectful', 'indirect'],
        metaphoricalThinking: 8, // High in Turkish culture
        directnessComfort: 5, // Moderate
        preferredCommunicationStyle: 'respectful'
      },
      
      clinicalAdaptations: {
        assessmentModifications: [],
        interventionAdaptations: [],
        progressMeasures: [],
        culturallyRelevantGoals: [],
        riskFactors: [],
        protectiveFactors: []
      }
    };

    // Save profile
    try {
      await AsyncStorage.setItem(`turkish_cultural_profile_${userId}`, JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to save cultural profile:', error);
    }

    return profile;
  }

  // =============================================================================
  // 🛠️ HELPER METHODS
  // =============================================================================

  private initializeTurkishOCDThemes(): void {
    this.turkishOCDThemes = [
      {
        themeId: 'religious_ablution',
        name: 'Abdest OKB\'si',
        description: 'Aşırı abdest alma veya abdest bozulma korkusu',
        culturalContext: 'İslami temizlik ritüeli ile OKB karıştırılabilir',
        prevalence: 'common',
        keywords: ['abdest', 'temizlik', 'kirli', 'bozuldu', 'yeniden'],
        patterns: [/abdest.*?al/i, /abdest.*?bozul/i, /temiz.*?değil/i],
        culturalMarkers: ['namaz', 'ibadet', 'temizlik'],
        severity: 'moderate',
        treatmentComplexity: 'complex',
        requiresSpecialist: true,
        culturallyAdaptedTreatments: [{
          treatment: 'Dini danışmanlık ile ERP',
          culturalModification: 'İmam/vaiz işbirliği ile normal abdest vs OKB ayırımı',
          effectiveness: 'high'
        }],
        recommendedResources: {
          religiousGuidance: ['OKB konusunda bilgili din görevlisi'],
          familyEducation: ['Dini OKB aile eğitimi'],
          communitySupport: ['Camii imam desteği'],
          clinicalSpecialists: ['Religious OCD uzmanı']
        }
      },

      {
        themeId: 'religious_prayer',
        name: 'Namaz OKB\'si',
        description: 'Namaz kılarken mükemmeliyetçilik ve tekrar etme',
        culturalContext: 'Dini hassasiyet ile OKB arasında ayrım zor',
        prevalence: 'common',
        keywords: ['namaz', 'tekrar', 'doğru', 'yanlış', 'baştan'],
        patterns: [/namaz.*?tekrar/i, /doğru.*?kıl/i, /baştan.*?al/i],
        culturalMarkers: ['ibadet', 'kıble', 'rükû', 'secde'],
        severity: 'moderate',
        treatmentComplexity: 'complex',
        requiresSpecialist: true,
        culturallyAdaptedTreatments: [{
          treatment: 'Gradual prayer exposure',
          culturalModification: 'Dini değerleri koruyarak exposure',
          effectiveness: 'high'
        }],
        recommendedResources: {
          religiousGuidance: ['İbadet konusunda esnek yaklaşımı olan din görevlisi'],
          familyEducation: ['Namaz OKB aile rehberliği'],
          communitySupport: ['Cemaat desteği'],
          clinicalSpecialists: ['Islamic OCD therapist']
        }
      },

      {
        themeId: 'family_responsibility',
        name: 'Aile Sorumluluğu OKB\'si',
        description: 'Aile güvenliği ve sorumluluklarına aşırı odaklanma',
        culturalContext: 'Türk kültüründe aile değerleri ile OKB karışabilir',
        prevalence: 'common',
        keywords: ['aile', 'güvenlik', 'sorumluluk', 'kontrol', 'koruma'],
        patterns: [/aile.*?güvenli/i, /sorumluluk.*?var/i, /korumak.*?zorunda/i],
        culturalMarkers: ['aile reisi', 'koruyucu', 'sorumluluk'],
        severity: 'moderate',
        treatmentComplexity: 'moderate',
        requiresSpecialist: false,
        culturallyAdaptedTreatments: [{
          treatment: 'Family-based ERP',
          culturalModification: 'Aile değerlerini koruyarak sorumluluk dengeleme',
          effectiveness: 'high'
        }],
        recommendedResources: {
          religiousGuidance: [],
          familyEducation: ['Aile OKB eğitimi', 'Sınır belirleme'],
          communitySupport: ['Aile danışmanlığı'],
          clinicalSpecialists: ['Family therapist']
        }
      },

      {
        themeId: 'social_honor',
        name: 'Sosyal İtibar OKB\'si',
        description: 'Toplumsal onur ve itibar kaygıları',
        culturalContext: 'Türk toplumunda namus ve şeref değerleri',
        prevalence: 'moderate',
        keywords: ['namus', 'şeref', 'utanma', 'mahcubiyet', 'komşu'],
        patterns: [/utanır.*?im/i, /ne.*?der/i, /mahcup/i],
        culturalMarkers: ['toplum', 'komşu', 'akraba', 'itibar'],
        severity: 'moderate',
        treatmentComplexity: 'moderate',
        requiresSpecialist: false,
        culturallyAdaptedTreatments: [{
          treatment: 'Social anxiety CBT',
          culturalModification: 'Kültürel değerleri koruyarak sosyal kaygı azaltma',
          effectiveness: 'medium'
        }],
        recommendedResources: {
          religiousGuidance: ['Sosyal değerler hakkında dini perspektif'],
          familyEducation: ['Sosyal baskı ile baş etme'],
          communitySupport: ['Toplumsal farkındalık'],
          clinicalSpecialists: ['Social anxiety specialist']
        }
      }
    ];
  }

  private inferReligiousPractice(compulsions: CompulsionEntry[]): 'non_practicing' | 'moderate' | 'observant' | 'devout' {
    const religiousKeywords = ['namaz', 'abdest', 'dua', 'günah', 'allah', 'din'];
    const religiousCount = compulsions.filter(c => {
      const text = `${c.notes || ''} ${c.trigger || ''}`.toLowerCase();
      return religiousKeywords.some(keyword => text.includes(keyword));
    }).length;

    const ratio = religiousCount / Math.max(1, compulsions.length);
    
    if (ratio > 0.5) return 'devout';
    if (ratio > 0.2) return 'observant';
    if (ratio > 0.1) return 'moderate';
    return 'non_practicing';
  }

  private assessReligiousOCDRisk(compulsions: CompulsionEntry[]): 'low' | 'medium' | 'high' {
    const scrupulosityIndicators = ['günah', 'haram', 'helal', 'tövbe', 'af'];
    const riskCount = compulsions.filter(c => {
      const text = `${c.notes || ''} ${c.trigger || ''}`.toLowerCase();
      return scrupulosityIndicators.some(indicator => text.includes(indicator));
    }).length;

    if (riskCount > compulsions.length * 0.3) return 'high';
    if (riskCount > compulsions.length * 0.1) return 'medium';
    return 'low';
  }

  private calculateScrupulosityLevel(compulsions: CompulsionEntry[]): number {
    const scrupulosityWords = ['günah', 'cehennem', 'azab', 'haram', 'helal'];
    let scrupulosityScore = 0;

    compulsions.forEach(c => {
      const text = `${c.notes || ''}`.toLowerCase();
      scrupulosityWords.forEach(word => {
        if (text.includes(word)) {
          scrupulosityScore += c.intensity * 0.1;
        }
      });
    });

    return Math.min(10, scrupulosityScore);
  }

  private identifyReligiousThemes(compulsions: CompulsionEntry[]): string[] {
    const themes = new Set<string>();
    const religiousThemeMap = {
      'abdest': 'Abdest OKB',
      'namaz': 'İbadet OKB',
      'günah': 'Skrupülözite',
      'temizlik': 'Dini Temizlik OKB'
    };

    compulsions.forEach(c => {
      const text = `${c.notes || ''} ${c.trigger || ''}`.toLowerCase();
      Object.entries(religiousThemeMap).forEach(([keyword, theme]) => {
        if (text.includes(keyword)) {
          themes.add(theme);
        }
      });
    });

    return Array.from(themes);
  }

  private assessFamilySupport(compulsions: CompulsionEntry[]): 'high' | 'medium' | 'low' | 'conflicted' {
    const supportIndicators = ['yardım', 'destek', 'anlıyor', 'beraber'];
    const conflictIndicators = ['kavga', 'anlamıyor', 'kızıyor', 'baskı'];

    let supportCount = 0;
    let conflictCount = 0;

    compulsions.forEach(c => {
      const text = `${c.notes || ''}`.toLowerCase();
      supportIndicators.forEach(indicator => {
        if (text.includes(indicator)) supportCount++;
      });
      conflictIndicators.forEach(indicator => {
        if (text.includes(indicator)) conflictCount++;
      });
    });

    if (conflictCount > supportCount) return 'conflicted';
    if (supportCount > compulsions.length * 0.2) return 'high';
    if (supportCount > compulsions.length * 0.1) return 'medium';
    return 'low';
  }

  private identifyFamilyExpectations(compulsions: CompulsionEntry[]): string[] {
    const expectations: string[] = [];
    const expectationMap = {
      'evlilik': 'Evlilik beklentileri',
      'çocuk': 'Çocuk sahibi olma baskısı',
      'başarı': 'Akademik/kariyer başarı beklentisi',
      'gelenek': 'Geleneksel değerlere uyma'
    };

    compulsions.forEach(c => {
      const text = `${c.notes || ''}`.toLowerCase();
      Object.entries(expectationMap).forEach(([keyword, expectation]) => {
        if (text.includes(keyword) && !expectations.includes(expectation)) {
          expectations.push(expectation);
        }
      });
    });

    return expectations;
  }

  private calculateSocialAnxiety(compulsions: CompulsionEntry[]): number {
    const socialAnxietyIndicators = ['utanma', 'mahcup', 'yargılanma', 'ne derler'];
    let anxietyScore = 0;

    compulsions.forEach(c => {
      const text = `${c.notes || ''}`.toLowerCase();
      socialAnxietyIndicators.forEach(indicator => {
        if (text.includes(indicator)) {
          anxietyScore += c.intensity * 0.1;
        }
      });
    });

    return Math.min(10, anxietyScore);
  }

  private calculateModernizationStress(compulsions: CompulsionEntry[]): number {
    const modernizationStressors = ['teknoloji', 'sosyal medya', 'modern', 'değişim'];
    let stressScore = 0;

    compulsions.forEach(c => {
      const text = `${c.notes || ''}`.toLowerCase();
      modernizationStressors.forEach(stressor => {
        if (text.includes(stressor)) {
          stressScore += c.intensity * 0.15;
        }
      });
    });

    return Math.min(10, stressScore);
  }

  private identifySocialTriggers(compulsions: CompulsionEntry[]): string[] {
    const triggers = new Set<string>();
    const socialTriggerMap = {
      'misafir': 'Misafir ağırlama stresi',
      'toplum': 'Toplumsal beklentiler',
      'komşu': 'Komşuluk ilişkileri',
      'akraba': 'Akraba baskısı'
    };

    compulsions.forEach(c => {
      const text = `${c.notes || ''} ${c.trigger || ''}`.toLowerCase();
      Object.entries(socialTriggerMap).forEach(([keyword, trigger]) => {
        if (text.includes(keyword)) {
          triggers.add(trigger);
        }
      });
    });

    return Array.from(triggers);
  }

  private adaptQuestionToTurkish(englishText: string): string {
    // Basic adaptation - in real implementation this would be more sophisticated
    return englishText
      .replace(/cleaning/gi, 'temizlik')
      .replace(/checking/gi, 'kontrol etme')
      .replace(/religious/gi, 'dini')
      .replace(/family/gi, 'aile');
  }

  private getEmptyAnalysis(): TurkishOCDCulturalAnalysis {
    return {
      overallCulturalRisk: 'low',
      religiousAnalysis: {
        isPresent: false,
        severity: 'mild',
        themes: [],
        distinctionNeeded: false,
        recommendedReligiousSupport: []
      },
      familyAnalysis: {
        familyImpactLevel: 0,
        accommodationPatterns: [],
        familyStressFactors: [],
        familyStrengths: [],
        recommendedFamilyWork: []
      },
      interventionRecommendations: {
        immediate: {
          culturallyAdapted: [],
          religiousConsiderations: [],
          familyInvolvement: []
        },
        longTerm: {
          culturalTherapyApproaches: [],
          communityResources: [],
          culturalIdentityWork: []
        },
        avoid: []
      },
      culturalProgressMarkers: {
        religiousOCDDistinction: true,
        familySupport: true,
        culturalIntegration: true,
        communityFunctioning: true
      }
    };
  }
}

// =============================================================================
// 🎯 SINGLETON EXPORT
// =============================================================================

export const turkishOCDCulturalService = TurkishOCDCulturalService.getInstance();
export type { 
  TurkishCulturalOCDProfile, 
  TurkishOCDCulturalAnalysis, 
  TurkishOCDTheme 
};
