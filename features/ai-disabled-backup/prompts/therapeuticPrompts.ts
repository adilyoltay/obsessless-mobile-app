/**
 * 📝 Therapeutic Prompts - Advanced Prompt Engineering for Mental Health
 * 
 * Bu sistem, OKB tedavisinde kullanılan kanıta dayalı terapötik yaklaşımları
 * AI prompt'larına dönüştürür. CBT, mindfulness ve diğer evidence-based
 * teknikleri kullanarak context-aware, kişiselleştirilmiş prompt'lar üretir.
 * 
 * ⚠️ CRITICAL: Tüm prompt'lar klinik rehberlere dayalıdır
 * ⚠️ Feature flag kontrolü: AI_THERAPEUTIC_PROMPTS
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage, 
  ConversationContext, 
  UserTherapeuticProfile,
  ConversationState,
  RiskLevel as CrisisRiskLevel,
  CBTTechnique
} from '@/features/ai/types';
import { InterventionType } from '@/features/ai/types';
type CognitiveDistortion = string;
interface CBTIntervention {
  title: string;
  description: string;
  userPrompt: string;
  followUpQuestions: string[];
  expectedOutcome: string;
  contraindications?: string[];
}
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 PROMPT TEMPLATE DEFINITIONS
// =============================================================================

/**
 * Prompt kategorileri
 */
export enum PromptCategory {
  SYSTEM = 'system',
  THERAPEUTIC = 'therapeutic',
  CBT_SPECIFIC = 'cbt_specific',
  // Legacy crisis prompts removed
  PSYCHOEDUCATION = 'psychoeducation',
  MINDFULNESS = 'mindfulness',
  Terapi_GUIDANCE = 'therapy_guidance',
  PROGRESS_CELEBRATION = 'progress_celebration'
}

/**
 * Prompt contexti
 */
export interface PromptContext {
  userProfile?: UserTherapeuticProfile;
  conversationState: ConversationState;
  recentMessages: AIMessage[];
  sessionGoals?: string[];
  detectedDistortions?: CognitiveDistortion[];
  recommendedTechnique?: CBTTechnique;
  userMood?: string;
  crisisLevel?: CrisisRiskLevel;
  culturalContext?: 'turkish' | 'international';
  preferredLanguage: 'tr' | 'en';
}

/**
 * Therapeutic prompt result
 */
export interface TherapeuticPrompt {
  category: PromptCategory;
  systemPrompt: string;
  contextInstructions: string;
  safeguards: string[];
  expectedTone: 'supportive' | 'challenging' | 'validating' | 'educational';
  techniques: CBTTechnique[];
  culturalAdaptations: string[];
  contraindications: string[];
  followUpSuggestions: string[];
}

// =============================================================================
// 🧠 THERAPEUTIC PROMPT ENGINE
// =============================================================================

class TherapeuticPromptEngine {
  private static instance: TherapeuticPromptEngine;
  private isEnabled: boolean = false;
  private promptTemplates: Map<PromptCategory, string[]> = new Map();
  private culturalAdaptations: Map<string, any> = new Map();

  private constructor() {
    this.initializePromptTemplates();
    this.initializeCulturalAdaptations();
  }

  static getInstance(): TherapeuticPromptEngine {
    if (!TherapeuticPromptEngine.instance) {
      TherapeuticPromptEngine.instance = new TherapeuticPromptEngine();
    }
    return TherapeuticPromptEngine.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION
  // =============================================================================

  async initialize(): Promise<void> {
    console.log('📝 Therapeutic Prompt Engine: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_THERAPEUTIC_PROMPTS')) {
        console.log('🚫 Therapeutic Prompts disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      this.isEnabled = true;
      
      // Telemetry
      await trackAIInteraction(AIEventType.THERAPEUTIC_PROMPTS_INITIALIZED, {
        templateCount: this.getTemplateCount(),
        categoriesLoaded: Array.from(this.promptTemplates.keys())
      });

      console.log('✅ Therapeutic Prompt Engine initialized');

    } catch (error) {
      console.error('❌ Therapeutic Prompt Engine initialization failed:', error);
      this.isEnabled = false;
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN PROMPT GENERATION METHODS
  // =============================================================================

  /**
   * Ana sistem prompt'u oluştur
   */
  async generateSystemPrompt(context: PromptContext): Promise<TherapeuticPrompt> {
    if (!this.isEnabled) {
      throw new Error('Therapeutic Prompt Engine is not enabled');
    }

    const baseSystemPrompt = this.getBaseSystemPrompt(context.preferredLanguage);
    const contextualEnhancements = this.generateContextualEnhancements(context);
    const safeguards = this.generateSafeguards(context);
    const culturalAdaptations = this.getCulturalAdaptations(context.culturalContext || 'turkish');

    const systemPrompt = this.combinePromptComponents([
      baseSystemPrompt,
      contextualEnhancements,
      this.getUserProfileInstructions(context.userProfile),
      this.getConversationStateInstructions(context.conversationState),
      this.getCrisisLevelInstructions(context.crisisLevel),
      culturalAdaptations
    ]);

    return {
      category: PromptCategory.SYSTEM,
      systemPrompt,
      contextInstructions: contextualEnhancements,
      safeguards,
      expectedTone: this.determineOptimalTone(context),
      techniques: this.recommendTechniques(context),
      culturalAdaptations: typeof culturalAdaptations === 'string' ? [culturalAdaptations] : (Array.isArray(culturalAdaptations) ? culturalAdaptations : []),
      contraindications: this.getContraindications(context),
      followUpSuggestions: this.generateFollowUpSuggestions(context)
    };
  }

  /**
   * CBT-specific prompt oluştur
   */
  async generateCBTPrompt(
    technique: CBTTechnique,
    intervention: CBTIntervention,
    context: PromptContext
  ): Promise<TherapeuticPrompt> {
    const basePrompt = this.getCBTTechniquePrompt(technique, context.preferredLanguage);
    const interventionInstructions = this.formatInterventionInstructions(intervention);
    const distortionFocus = this.getDistortionFocusInstructions(context.detectedDistortions);

    const systemPrompt = this.combinePromptComponents([
      basePrompt,
      interventionInstructions,
      distortionFocus,
      this.getUserContextInstructions(context)
    ]);

    return {
      category: PromptCategory.CBT_SPECIFIC,
      systemPrompt,
      contextInstructions: interventionInstructions,
      safeguards: this.getCBTSafeguards(technique),
      expectedTone: this.getCBTTone(technique),
      techniques: [technique],
      culturalAdaptations: [this.getCulturalAdaptations((context.culturalContext as any) || 'turkish')],
      contraindications: intervention.contraindications || [],
      followUpSuggestions: intervention.followUpQuestions
    };
  }

  // Legacy crisis prompt generator removed

  // =============================================================================
  // 📚 PROMPT TEMPLATE LIBRARY
  // =============================================================================

  private initializePromptTemplates(): void {
    // Base System Prompts
    this.promptTemplates.set(PromptCategory.SYSTEM, [
      // Turkish Base System Prompt
      `Sen ObsessLess uygulamasının AI terapistisisin ve Obsesif Kompulsif Bozukluk (OKB) konusunda uzman bir CBT terapistisisin.

ROL VE KİMLİĞİN:
- OKB tedavisinde deneyimli, empatik ve bilimsel kanıta dayalı yaklaşım sergileyen uzman
- Kullanıcının duygusal ihtiyaçlarını anlayan, yargılamayan, destekleyici rehber
- CBT, Terapi ve mindfulness tekniklerini ustaca kullanan terapötik AI
- Türk kültürüne duyarlı, warm ve güvenilir bir destek kaynağı

TEMEL PRENSİPLERİN:
1. 🧠 KANITA DAYALI YAKLAŞIM: Sadece bilimsel olarak kanıtlanmış CBT teknikleri kullan
2. 🤗 EMPATİK DOĞRULAMA: Kullanıcının duygularını önce doğrula, sonra rehberlik et
3. 🎯 KIŞISELLEŞTIRILMIŞ YAKLAŞIM: Her yanıtı kullanıcının özel durumuna göre uyarla
4. 🛡️ GÜVENLİK ÖNCELİĞİ: Kriz durumlarında derhal profesyonel yardım öner
5. 🌱 UMUT VE GÜÇLENDİRME: Her etkileşimde kullanıcının güçlü yanlarını vurgula

İLETİŞİM STİLİN:
- Sıcak, anlayışlı ama profesyonel
- Basit, anlaşılır Türkçe kullan
- Tıbbi jargon yerine günlük dil tercih et
- Cesaretlendirici ama gerçekçi
- Kullanıcının özerkliğine saygılı

YASAKLARIN:
- Tıbbi tanı koyma
- İlaç önerme  
- Profesyonel terapi yerine geçme iddiası
- Garantili sonuçlar vaat etme
- Kullanıcıyı yargılama veya suçlama

ÖZEL TALİMATLARIN:
- OKB konusunda uzman bir terapist gibi davran
- CBT teknikleri kullan
- Türk kültürüne uygun yaklaş
- Empatik ve destekleyici ol`,

      // English Base System Prompt
      `You are ObsessLess app's AI therapist, an expert in Obsessive-Compulsive Disorder (OCD) treatment using evidence-based Cognitive Behavioral Therapy approaches.

YOUR ROLE AND IDENTITY:
- Expert in OCD treatment with empathetic, scientifically-grounded approach
- Understanding, non-judgmental, supportive guide for users' emotional needs
- Therapeutic AI skilled in CBT, Terapi, and mindfulness techniques
- Culturally sensitive, warm, and trustworthy support resource

YOUR CORE PRINCIPLES:
1. 🧠 EVIDENCE-BASED APPROACH: Use only scientifically proven CBT techniques
2. 🤗 EMPATHIC VALIDATION: First validate user emotions, then provide guidance
3. 🎯 PERSONALIZED APPROACH: Adapt every response to user's specific situation
4. 🛡️ SAFETY PRIORITY: Immediately suggest professional help in crisis situations
5. 🌱 HOPE AND EMPOWERMENT: Highlight user strengths in every interaction

YOUR COMMUNICATION STYLE:
- Warm, understanding yet professional
- Use simple, clear language
- Prefer everyday language over medical jargon
- Encouraging but realistic
- Respectful of user autonomy

YOUR PROHIBITIONS:
- Making medical diagnoses
- Recommending medications
- Claiming to replace professional therapy
- Promising guaranteed results
- Judging or blaming the user`
    ]);

    // CBT-Specific Prompts
    this.promptTemplates.set(PromptCategory.CBT_SPECIFIC, [
      `CBT TEKNİK UYGULAMA MODU:
Şu anda ${'{technique}'} tekniğini uyguluyorsun. Bu teknikle ilgili:

YAKLAŞIMIN:
- Sokratik sorgulama kullan
- Düşünce-duygu-davranış üçgenini göster
- Somut örnekler iste
- Küçük adımları teşvik et
- İlerlemeyi kabul ettir

TEKNİK REHBERİN:
${'{interventionInstructions}'}

UYARILARIN:
- Kullanıcıyı zorlamaya
- Aşırı hızlı ilerletmeye
- Tekniği dogmatik olarak uygulamaya

Bu tekniği kullanıcının hızına ve ihtiyaçlarına göre uyarla.`
    ]);

    // Crisis Intervention templates removed

    console.log('📚 Prompt templates initialized');
  }

  private initializeCulturalAdaptations(): void {
    // Turkish Cultural Context
    this.culturalAdaptations.set('turkish', {
      greetings: ['Merhaba', 'Selam', 'İyi günler'],
      encouragement: ['Ellerinize sağlık', 'Aferin', 'Çok iyi gidiyorsunuz', 'Harika'],
      metaphors: [
        'Bu süreç tıpkı kas geliştirmek gibi - her tekrar sizi güçlendirir',
        'Düşünceler bulut gibidir - gelir, geçer',
        'Her küçük adım, büyük yolculuğun parçasıdır'
      ],
      culturalValues: [
        'Aile desteğinin önemi',
        'Sabır ve sebatın değeri', 
        'Toplumsal dayanışma',
        'İnsan onuru ve değeri'
      ],
      communicationStyle: {
        formality: 'respectful', // "siz" kullan
        warmth: 'high',
        directness: 'moderate'
      }
    });

    // International Context
    this.culturalAdaptations.set('international', {
      greetings: ['Hello', 'Hi there', 'Good day'],
      encouragement: ['Well done', 'Great job', 'You\'re doing amazing', 'Excellent'],
      metaphors: [
        'This process is like building muscle - each repetition makes you stronger',
        'Thoughts are like clouds - they come and go',
        'Every small step is part of a bigger journey'
      ],
      culturalValues: [
        'Individual autonomy',
        'Personal growth',
        'Self-compassion',
        'Evidence-based progress'
      ],
      communicationStyle: {
        formality: 'casual',
        warmth: 'moderate',
        directness: 'high'
      }
    });

    console.log('🌍 Cultural adaptations initialized');
  }

  // =============================================================================
  // 🔧 PROMPT BUILDING HELPERS
  // =============================================================================

  private getBaseSystemPrompt(language: 'tr' | 'en'): string {
    const templates = this.promptTemplates.get(PromptCategory.SYSTEM) || [];
    return language === 'tr' ? templates[0] : templates[1];
  }

  private generateContextualEnhancements(context: PromptContext): string {
    let enhancements = '';

    // Conversation state
    if (context.conversationState === ConversationState.THERAPEUTIC) {
      enhancements += '\n🎯 TERAPÖTİK SÜREÇ AKTIF - CBT tekniklerini uygula';
    }

    // Detected distortions
    if (context.detectedDistortions && context.detectedDistortions.length > 0) {
      enhancements += `\n🧠 TESPİT EDİLEN ÇARPITMALAR: ${context.detectedDistortions.join(', ')}`;
    }

    // User mood
    if (context.userMood) {
      enhancements += `\n💭 KULLANICI RUH HALİ: ${context.userMood}`;
    }

    // Session goals
    if (context.sessionGoals && context.sessionGoals.length > 0) {
      enhancements += `\n🎯 SEANS HEDEFLERİ: ${context.sessionGoals.join(', ')}`;
    }

    return enhancements;
  }

  private generateSafeguards(context: PromptContext): string[] {
    const safeguards = [
      'Tıbbi tanı koyma',
      'İlaç önerme',
      'Garantili sonuç vaat etme',
      'Kullanıcıyı yargılama'
    ];

    if (context.crisisLevel && context.crisisLevel !== CrisisRiskLevel.NONE) {
      safeguards.push('Challenging teknikleri kullanma');
      safeguards.push('Terapi egzersizi önerme');
    }

    return safeguards;
  }

  private getUserProfileInstructions(profile?: UserTherapeuticProfile): string {
    if (!profile) return '';

    return `
KULLANICI PROFİLİ:
- Tercih edilen dil: ${profile.preferredLanguage}
- Belirti şiddeti: ${profile.symptomSeverity}/10
- İletişim stili: ${profile.communicationStyle.formality}
- Tetikleyici kelimeler: ${profile.triggerWords.join(', ')}
- Terapötik hedefler: ${profile.therapeuticGoals.join(', ')}`;
  }

  private getConversationStateInstructions(state: ConversationState): string {
    const map: Record<string, string> = {
      stable: 'Normal terapötik yaklaşım kullan',
      therapeutic: 'Aktif CBT teknikleri uygula',
      educational: 'Eğitici ve bilgilendirici yaklaş',
      celebration: 'İlerlemeni kutla ve pekiştir'
    };
    return map[String(state)] || map.stable;
  }

  private getCrisisLevelInstructions(level?: CrisisRiskLevel): string {
    if (!level || level === CrisisRiskLevel.NONE) return '';

    const map: Record<string, string> = {
      low: 'Dikkatli izle, destekleyici ol',
      medium: 'Aktif destek ver, coping stratejiler öner',
      high: 'Profesyonel yardım öner, sakinleştirici teknikler kullan',
      critical: '🚨 ACİL DURUM - Derhal profesyonel yardım yönlendir'
    };
    return `\n⚠️ KRİZ SEVİYESİ (${level}): ${map[String(level)] || ''}`;
  }

  private getCulturalAdaptations(culturalContext: string): string {
    const adaptations = this.culturalAdaptations.get(culturalContext);
    if (!adaptations) return '';

    return `
KÜLTÜREL UYARLAMALAR:
- İletişim stili: ${adaptations.communicationStyle.formality}
- Sıcaklık seviyesi: ${adaptations.communicationStyle.warmth}
- Değerler: ${adaptations.culturalValues.join(', ')}`;
  }

  private combinePromptComponents(components: string[]): string {
    return components.filter(Boolean).join('\n\n');
  }

  private determineOptimalTone(context: PromptContext): 'supportive' | 'challenging' | 'validating' | 'educational' {
    // crisis logic removed

    if (context.conversationState === ConversationState.THERAPEUTIC) {
      return 'challenging';
    }

    return 'validating';
  }

  private recommendTechniques(context: PromptContext): CBTTechnique[] {
    const techniques: CBTTechnique[] = [];

    if (context.detectedDistortions) {
      context.detectedDistortions.forEach(distortion => {
        const key = String(distortion).toLowerCase();
        if (key.includes('all') || key.includes('hep') || key.includes('hiç')) {
          techniques.push(CBTTechnique.COGNITIVE_RESTRUCTURING);
        } else if (key.includes('catas') || key.includes('felaket')) {
          techniques.push(CBTTechnique.COGNITIVE_RESTRUCTURING);
        } else {
          techniques.push(CBTTechnique.MINDFULNESS);
        }
      });
    }

    return [...new Set(techniques)];
  }

  private getContraindications(context: PromptContext): string[] {
    const contraindications: string[] = [];

    if (context.crisisLevel && context.crisisLevel !== CrisisRiskLevel.NONE) {
      contraindications.push('Exposure exercises');
      contraindications.push('Challenging techniques');
    }

    return contraindications;
  }

  private generateFollowUpSuggestions(context: PromptContext): string[] {
    const suggestions = [
      'Bu konuyu daha detayına inelim mi?',
      'Hangi durumlarda bu düşünceler daha yoğun oluyor?',
      'Bu durumla başa çıkmak için hangi stratejileri denediniz?'
    ];

    if (context.recommendedTechnique) {
      suggestions.push(`${context.recommendedTechnique} tekniğini birlikte deneyelim mi?`);
    }

    return suggestions;
  }

  // CBT-specific helpers
  private getCBTTechniquePrompt(technique: CBTTechnique, language: 'tr' | 'en'): string {
    const templates = this.promptTemplates.get(PromptCategory.CBT_SPECIFIC) || [];
    return templates[0]?.replace('${technique}', technique) || '';
  }

  private formatInterventionInstructions(intervention: CBTIntervention): string {
    return `
TEKNİK: ${intervention.title}
AÇIKLAMA: ${intervention.description}
KULLANICI PROMPT: ${intervention.userPrompt}
TAKİP SORULARI: ${intervention.followUpQuestions.join(', ')}
BEKLENİLEN SONUÇ: ${intervention.expectedOutcome}`;
  }

  private getDistortionFocusInstructions(distortions?: CognitiveDistortion[]): string {
    if (!distortions || distortions.length === 0) return '';

    return `
ODAKLANILACAK ÇARPITMALAR:
${distortions.map(d => `- ${d}`).join('\n')}

Bu çarpıtmaları ele alırken kullanıcının savunmaya geçmesini önle, meraklı ve yardımsever ol.`;
  }

  private getUserContextInstructions(context: PromptContext): string {
    let instructions = '';

    if (context.recentMessages && context.recentMessages.length > 0) {
      const lastMessage = context.recentMessages[context.recentMessages.length - 1];
      instructions += `\nSON KULLANICI MESAJI: "${lastMessage.content}"`;
    }

    return instructions;
  }

  // Crisis-specific helpers removed

  private getCrisisActions(level: CrisisRiskLevel): string {
    const map: Record<string, string> = {
      low: 'Destekleyici yaklaşım, coping stratejiler',
      medium: 'Aktif müdahale, sakinleştirici teknikler',
      high: 'Profesyonel yardım önerisi, güvenlik planı',
      critical: 'ACİL müdahale, derhal yardım hattı yönlendirme'
    };
    return map[String(level)] || '';
  }

  private getCrisisResources(culturalContext: string): string {
    if (culturalContext === 'turkish') {
      return `
ACİL YARDIM HATLARI (TÜRKİYE):
📞 Yaşam Hattı: 183
📞 AMATEM: 444 0 644
📞 Acil Servis: 112
📞 Polis: 155
📞 İtfaiye: 110`;
    }

    return `
EMERGENCY RESOURCES:
📞 National Suicide Prevention Lifeline: 988
📞 Crisis Text Line: Text HOME to 741741
📞 Emergency Services: 911
📞 Local Emergency Services: Contact your local authorities`;
  }

  private getEmergencyProtocols(): string {
    return `
ACİL DURUM PROTOKOLLERİ:
1. Kullanıcının güvenli olduğunu teyit et
2. Acil yardım hatlarını öner
3. Profesyonel yardım alma konusunda ısrarlı ol
4. Bu anın geçici olduğunu hatırlat
5. Destek sistemlerini devreye sokmasını öner`;
  }

  private getCBTSafeguards(technique: CBTTechnique): string[] {
    return [
      'Kullanıcıyı aşırı zorlamaya',
      'Tekniği dogmatik olarak uygulamaya',
      'Kullanıcının sınırlarını görmezden gelmeye'
    ];
  }

  private getCBTTone(technique: CBTTechnique): 'supportive' | 'challenging' | 'validating' | 'educational' {
    switch (technique) {
      case CBTTechnique.PROBLEM_SOLVING: return 'educational';
      case CBTTechnique.COGNITIVE_RESTRUCTURING: return 'educational';
      case CBTTechnique.MINDFULNESS: return 'supportive';
      case CBTTechnique.BEHAVIORAL_EXPERIMENT: return 'challenging';
      default: return 'supportive';
    }
  }

  private getCrisisSafeguards(): string[] {
    return [
      'Challenging teknikleri kullanma',
      'Terapi egzersizi önerme',
      'Kullanıcıyı tek başına bırakma',
      'Profesyonel yardım önerisini atlamaya'
    ];
  }

  private getCrisisFollowUp(level: CrisisRiskLevel): string[] {
    return [
      'Şu anda güvende misiniz?',
      'Yanınızda güvendiğiniz biri var mı?',
      'Bu numaraları aramayı düşünür müsünüz?',
      'Profesyonel yardım almanızı destekleyebilir miyim?'
    ];
  }

  private getTemplateCount(): number {
    let total = 0;
    this.promptTemplates.forEach(templates => {
      total += templates.length;
    });
    return total;
  }

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_THERAPEUTIC_PROMPTS');
  }

  async shutdown(): Promise<void> {
    console.log('📝 Therapeutic Prompt Engine: Shutting down...');
    this.isEnabled = false;
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const therapeuticPromptEngine = TherapeuticPromptEngine.getInstance();
export default therapeuticPromptEngine;
// Types ve enum'lar yalnızca bu dosyanın default export'uyla birlikte kullanılacak; 
// çoklu re-export uyarılarını önlemek için tekrar dışa aktarmıyoruz.