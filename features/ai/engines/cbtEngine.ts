/**
 * 🧠 CBT Engine - Cognitive Behavioral Therapy Implementation
 * 
 * Bu engine, kanıta dayalı CBT tekniklerini kullanarak kullanıcıya
 * terapötik rehberlik sağlar. OKB tedavisinde etkili olan CBT yöntemlerini
 * AI destekli olarak uygular.
 * 
 * ⚠️ CRITICAL: Tüm CBT teknikleri klinik araştırmalara dayanır
 * ⚠️ Feature flag kontrolü zorunludur: AI_CBT_ENGINE
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage, 
  ConversationContext, 
  UserTherapeuticProfile,
  AIError,
  AIErrorCode,
  ErrorSeverity 
} from '@/features/ai/types';
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
// Crisis detection entegrasyonu kaldırıldı

// =============================================================================
// 🎯 CBT TECHNIQUE DEFINITIONS
// =============================================================================

/**
 * CBT Teknikleri - Klinik araştırmalara dayalı
 */
export enum CBTTechnique {
  SOCRATIC_QUESTIONING = 'socratic_questioning',
  COGNITIVE_RESTRUCTURING = 'cognitive_restructuring',
  THOUGHT_CHALLENGING = 'thought_challenging',
  BEHAVIORAL_EXPERIMENT = 'behavioral_experiment',
  MINDFULNESS_INTEGRATION = 'mindfulness_integration',
  EXPOSURE_HIERARCHY = 'exposure_hierarchy',
  RELAPSE_PREVENTION = 'relapse_prevention',
  PROGRESS_CELEBRATION = 'progress_celebration',
  PSYCHOEDUCATION = 'psychoeducation',
  ACCEPTANCE_COMMITMENT = 'acceptance_commitment'
}

/**
 * Bilişsel Çarpıtmalar (Cognitive Distortions)
 */
export enum CognitiveDistortion {
  ALL_OR_NOTHING = 'all_or_nothing',
  OVERGENERALIZATION = 'overgeneralization',
  MENTAL_FILTER = 'mental_filter',
  CATASTROPHIZING = 'catastrophizing',
  MIND_READING = 'mind_reading',
  FORTUNE_TELLING = 'fortune_telling',
  EMOTIONAL_REASONING = 'emotional_reasoning',
  SHOULD_STATEMENTS = 'should_statements',
  LABELING = 'labeling',
  PERSONALIZATION = 'personalization'
}

/**
 * CBT Intervention Türleri
 */
export interface CBTIntervention {
  id: string;
  technique: CBTTechnique;
  title: string;
  description: string;
  userPrompt: string;
  systemPrompt: string;
  followUpQuestions: string[];
  expectedOutcome: string;
  contraindications?: string[];
  minimumSessions?: number;
}

/**
 * Bilişsel Değerlendirme Sonucu
 */
export interface CognitiveAssessment {
  detectedDistortions: CognitiveDistortion[];
  confidence: number;
  severity: 'low' | 'moderate' | 'high';
  suggestedTechniques: CBTTechnique[];
  immediateIntervention?: CBTIntervention;
  rationale: string;
}

/**
 * CBT Session Context
 */
export interface CBTSessionContext {
  sessionId: string;
  userId: string;
  currentTechnique?: CBTTechnique;
  previousInterventions: CBTIntervention[];
  userProgress: {
    mastereTechniques: CBTTechnique[];
    strugglingWith: CBTTechnique[];
    overallProgress: number; // 0-100
  };
  therapyGoals: string[];
  sessionObjectives: string[];
}

// =============================================================================
// 🧠 CBT ENGINE IMPLEMENTATION
// =============================================================================

class CBTEngine {
  private static instance: CBTEngine;
  private isEnabled: boolean = false;
  private interventionLibrary: Map<CBTTechnique, CBTIntervention[]> = new Map();
  private userSessions: Map<string, CBTSessionContext> = new Map();
  
  private constructor() {
    this.initializeInterventionLibrary();
  }

  static getInstance(): CBTEngine {
    if (!CBTEngine.instance) {
      CBTEngine.instance = new CBTEngine();
    }
    return CBTEngine.instance;
  }

  // =============================================================================
  // 🚀 INITIALIZATION & SETUP
  // =============================================================================

  /**
   * CBT Engine'i başlat
   */
  async initialize(): Promise<void> {
    console.log('🧠 CBT Engine: Initializing...');
    
    try {
      // Feature flag kontrolü
      if (!FEATURE_FLAGS.isEnabled('AI_CBT_ENGINE')) {
        console.log('🚫 CBT Engine disabled by feature flag');
        this.isEnabled = false;
        return;
      }

      // Intervention library'yi yükle
      await this.loadInterventionLibrary();
      
      this.isEnabled = true;
      
      // Telemetry
      await trackAIInteraction(AIEventType.CBT_ENGINE_INITIALIZED, {
        interventionCount: this.getTotalInterventionCount(),
        techniquesAvailable: Object.values(CBTTechnique).length
      });

      console.log('✅ CBT Engine initialized successfully');

    } catch (error) {
      console.error('❌ CBT Engine initialization failed:', error);
      this.isEnabled = false;
      
      await trackAIError({
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: 'CBT Engine başlatılamadı',
        severity: ErrorSeverity.HIGH,
        context: { component: 'CBTEngine', method: 'initialize' }
      });
    }
  }

  /**
   * Intervention library'yi başlat
   */
  private initializeInterventionLibrary(): void {
    // Socratic Questioning
    this.addIntervention(CBTTechnique.SOCRATIC_QUESTIONING, {
      id: 'socratic_basic',
      technique: CBTTechnique.SOCRATIC_QUESTIONING,
      title: 'Sokratik Sorgulama',
      description: 'Düşüncelerinizi sorularla keşfetme',
      userPrompt: 'Bu düşünceniz hakkında birlikte düşünelim. Bu düşüncenin doğru olduğuna dair ne gibi kanıtlarınız var?',
      systemPrompt: 'Kullanıcının düşüncelerini Sokratik sorularla keşfetmesine yardım et. Yargılamadan, meraklı sorular sor.',
      followUpQuestions: [
        'Bu düşüncenin tam tersini destekleyen kanıtlar var mı?',
        'En iyi arkadaşınız aynı durumda olsa ona ne söylerdiniz?',
        'Bu düşünce size nasıl hissettiriyor?',
        'Bu düşünceye inanmadan önceki hayatınız nasıldı?'
      ],
      expectedOutcome: 'Düşünce esnekliği artışı ve objektif perspektif kazanımı'
    });

    // Cognitive Restructuring
    this.addIntervention(CBTTechnique.COGNITIVE_RESTRUCTURING, {
      id: 'restructuring_basic',
      technique: CBTTechnique.COGNITIVE_RESTRUCTURING,
      title: 'Bilişsel Yeniden Yapılandırma',
      description: 'Zararlı düşünce kalıplarını yeniden değerlendirme',
      userPrompt: 'Bu düşünceyi daha dengeli ve gerçekçi bir şekilde nasıl ifade edebiliriz?',
      systemPrompt: 'Kullanıcının çarpıtılmış düşüncelerini daha dengeli ve gerçekçi alternatiflerle değiştirmesine yardım et.',
      followUpQuestions: [
        'Bu yeni düşünce size nasıl hissettiriyor?',
        'Bu perspektif size daha mantıklı geliyor mu?',
        'Bu yeni bakış açısını günlük hayatınızda nasıl uygulayabilirsiniz?'
      ],
      expectedOutcome: 'Daha dengeli ve işlevsel düşünce kalıpları'
    });

    // Mindfulness Integration
    this.addIntervention(CBTTechnique.MINDFULNESS_INTEGRATION, {
      id: 'mindfulness_basic',
      technique: CBTTechnique.MINDFULNESS_INTEGRATION,
      title: 'Farkındalık Entegrasyonu',
      description: 'Şimdiki ana odaklanma ve kabul',
      userPrompt: 'Bu obsesif düşünceyi yargılamadan, meraklı bir gözlemci gibi fark etmeye çalışalım.',
      systemPrompt: 'Kullanıcının düşüncelerini yargılamadan gözlemlemesine ve şimdiki ana odaklanmasına yardım et.',
      followUpQuestions: [
        'Bu düşünce şu anda vücudunuzda hangi hisleri yaratıyor?',
        'Nefesinizi fark edebiliyor musunuz?',
        'Bu düşünceyi bir bulut gibi geçip gitmesine izin verebilir misiniz?'
      ],
      expectedOutcome: 'Düşünce-gerçek ayrımı ve kabul kapasitesi artışı'
    });

    // Thought Challenging
    this.addIntervention(CBTTechnique.THOUGHT_CHALLENGING, {
      id: 'challenge_basic',
      technique: CBTTechnique.THOUGHT_CHALLENGING,
      title: 'Düşünce Sınama',
      description: 'Otomatik düşünceleri kanıtlarla sınama',
      userPrompt: 'Bu düşüncenizi mahkemede savunmanız gerekse, hangi kanıtları sunardınız?',
      systemPrompt: 'Kullanıcının otomatik düşüncelerini objektif kanıtlarla sınamasına yardım et. Mantıklı analiz yap.',
      followUpQuestions: [
        'Bu kanıtlar ne kadar güçlü?',
        'Karşı kanıtlar da var mı?',
        'Bu düşünce %100 kesin mi, yoksa bir olasılık mı?'
      ],
      expectedOutcome: 'Düşünce kanıtlarını objektif değerlendirme yetisi'
    });

    // Behavioral Experiment
    this.addIntervention(CBTTechnique.BEHAVIORAL_EXPERIMENT, {
      id: 'experiment_basic',
      technique: CBTTechnique.BEHAVIORAL_EXPERIMENT,
      title: 'Davranışsal Deney',
      description: 'Düşünceleri test etmek için güvenli deneyler',
      userPrompt: 'Bu düşüncenizi test etmek için küçük, güvenli bir deney tasarlayalım.',
      systemPrompt: 'Kullanıcının düşüncelerini güvenli davranışsal deneylerle test etmesine yardım et.',
      followUpQuestions: [
        'Bu deneyi yapmak için ne tür hazırlıklar gerekli?',
        'En kötü senaryoda ne olabilir?',
        'Bu deney sonucunda ne öğrenmiş olacaksınız?'
      ],
      expectedOutcome: 'Gerçek hayat kanıtları ile düşünce doğrulaması',
      contraindications: ['yüksek anksiyete dönemleri', 'kriz anları']
    });

    console.log('📚 CBT Intervention Library initialized with', this.getTotalInterventionCount(), 'interventions');
  }

  // =============================================================================
  // 🎯 CORE CBT ANALYSIS METHODS
  // =============================================================================

  /**
   * Kullanıcı mesajından bilişsel çarpıtmaları tespit et
   */
  async detectCognitiveDistortions(message: AIMessage, context: ConversationContext): Promise<CognitiveAssessment> {
    if (!this.isEnabled) {
      const error: AIError = {
        code: AIErrorCode.FEATURE_DISABLED,
        message: 'CBT Engine is not enabled',
        timestamp: new Date(),
        severity: ErrorSeverity.MEDIUM,
        recoverable: true
      };
      throw error;
    }

    try {
      const distortions: CognitiveDistortion[] = [];
      let totalConfidence = 0;

      // Pattern matching for cognitive distortions
      const messageContent = message.content.toLowerCase();

      // All-or-nothing thinking
      if (this.detectAllOrNothingThinking(messageContent)) {
        distortions.push(CognitiveDistortion.ALL_OR_NOTHING);
        totalConfidence += 0.8;
      }

      // Catastrophizing
      if (this.detectCatastrophizing(messageContent)) {
        distortions.push(CognitiveDistortion.CATASTROPHIZING);
        totalConfidence += 0.9;
      }

      // Overgeneralization
      if (this.detectOvergeneralization(messageContent)) {
        distortions.push(CognitiveDistortion.OVERGENERALIZATION);
        totalConfidence += 0.7;
      }

      // Should statements
      if (this.detectShouldStatements(messageContent)) {
        distortions.push(CognitiveDistortion.SHOULD_STATEMENTS);
        totalConfidence += 0.85;
      }

      // Emotional reasoning
      if (this.detectEmotionalReasoning(messageContent)) {
        distortions.push(CognitiveDistortion.EMOTIONAL_REASONING);
        totalConfidence += 0.75;
      }

      const confidence = distortions.length > 0 ? totalConfidence / distortions.length : 0;
      const severity = this.calculateSeverity(distortions, confidence);
      const suggestedTechniques = this.recommendTechniques(distortions, context);

      const assessment: CognitiveAssessment = {
        detectedDistortions: distortions,
        confidence,
        severity,
        suggestedTechniques,
        rationale: this.generateRationale(distortions, suggestedTechniques)
      };

      // Immediate intervention gerekli mi?
      if (severity === 'high' && confidence > 0.8) {
        assessment.immediateIntervention = this.selectImmediateIntervention(distortions[0], context);
      }

      // Telemetry
      await trackAIInteraction(AIEventType.CBT_ANALYSIS_COMPLETED, {
        distortionsDetected: distortions.length,
        confidence,
        severity,
        techniquesRecommended: suggestedTechniques.length
      });

      return assessment;

    } catch (error) {
      console.error('❌ CBT cognitive distortion detection failed:', error);
      
      await trackAIError({
        code: AIErrorCode.PROCESSING_FAILED,
        message: 'CBT analizi başarısız',
        severity: ErrorSeverity.MEDIUM,
        context: { 
          component: 'CBTEngine', 
          method: 'detectCognitiveDistortions',
          messageLength: message.content.length 
        }
      });

      throw error;
    }
  }

  /**
   * CBT tekniği uygula
   */
  async applyCBTTechnique(
    technique: CBTTechnique, 
    userMessage: AIMessage,
    context: ConversationContext
  ): Promise<CBTIntervention> {
    if (!this.isEnabled) {
      const error: AIError = {
        code: AIErrorCode.FEATURE_DISABLED,
        message: 'CBT Engine is not enabled',
        timestamp: new Date(),
        severity: ErrorSeverity.MEDIUM,
        recoverable: true
      };
      throw error;
    }

    try {
      const interventions = this.interventionLibrary.get(technique);
      if (!interventions || interventions.length === 0) {
        const error: AIError = {
          code: AIErrorCode.RESOURCE_NOT_FOUND,
          message: `No interventions found for technique: ${technique}`,
          timestamp: new Date(),
          severity: ErrorSeverity.MEDIUM,
          recoverable: true
        };
        throw error;
      }

      // En uygun intervention'ı seç
      const selectedIntervention = this.selectOptimalIntervention(interventions, context);

      // Session context güncelle
      await this.updateSessionContext(context.userId, technique, selectedIntervention);

      // Telemetry
      await trackAIInteraction(AIEventType.CBT_TECHNIQUE_APPLIED, {
        technique,
        interventionId: selectedIntervention.id,
        userId: context.userId
      });

      return selectedIntervention;

    } catch (error) {
      console.error('❌ CBT technique application failed:', error);
      
      await trackAIError({
        code: AIErrorCode.PROCESSING_FAILED,
        message: 'CBT tekniği uygulanamadı',
        severity: ErrorSeverity.MEDIUM,
        context: { 
          component: 'CBTEngine', 
          method: 'applyCBTTechnique',
          technique 
        }
      });

      throw error;
    }
  }

  // =============================================================================
  // 🔍 COGNITIVE DISTORTION DETECTION METHODS
  // =============================================================================

  private detectAllOrNothingThinking(content: string): boolean {
    const patterns = [
      /\b(hiç|hiçbir|asla|kesinlikle|tamamen|bütün|hep|her zaman)\b/gi,
      /\b(hiçbir şey|her şey|herkesi|kimseyi)\b/gi,
      /\b(ya hep ya hiç|ya da|kesin)\b/gi
    ];
    return patterns.some(pattern => pattern.test(content));
  }

  private detectCatastrophizing(content: string): boolean {
    const patterns = [
      /\b(korkunç|felaket|berbat|dehşet|kıyamet|mahvoldum)\b/gi,
      /\b(dayanamam|öleceğim|çıldıracağım|delireceğim)\b/gi,
      /\b(en kötü|en berbat|çok kötü şeyler)\b/gi
    ];
    return patterns.some(pattern => pattern.test(content));
  }

  private detectOvergeneralization(content: string): boolean {
    const patterns = [
      /\b(hep böyle|her zaman|sürekli|devamlı)\b/gi,
      /\b(hiçbir zaman|asla|kimse)\b/gi,
      /\b(tüm|bütün|herkesi|her şeyi)\b/gi
    ];
    return patterns.some(pattern => pattern.test(content));
  }

  private detectShouldStatements(content: string): boolean {
    const patterns = [
      /\b(yapmalıyım|etmeliyim|olmalıyım|gerekir|zorundayım)\b/gi,
      /\b(yapmamalıyım|etmemeliyim|olmamalıyım)\b/gi,
      /\b(gerekiyor|şart|mecbur|lazım)\b/gi
    ];
    return patterns.some(pattern => pattern.test(content));
  }

  private detectEmotionalReasoning(content: string): boolean {
    const patterns = [
      /\b(hissediyorum o yüzden|böyle hissediyorum çünkü)\b/gi,
      /\b(içgüdüm|sezgim|hissim|duyguların)\b/gi,
      /\b(öyle hissediyorum|böyle geliyor)\b/gi
    ];
    return patterns.some(pattern => pattern.test(content));
  }

  // =============================================================================
  // 🎯 HELPER METHODS
  // =============================================================================

  private calculateSeverity(distortions: CognitiveDistortion[], confidence: number): 'low' | 'moderate' | 'high' {
    const severityScore = distortions.length * confidence;
    
    if (severityScore >= 2.5) return 'high';
    if (severityScore >= 1.5) return 'moderate';
    return 'low';
  }

  private recommendTechniques(distortions: CognitiveDistortion[], context: ConversationContext): CBTTechnique[] {
    const techniques: CBTTechnique[] = [];
    
    // Distortion'a göre teknik önerileri
    distortions.forEach(distortion => {
      switch (distortion) {
        case CognitiveDistortion.ALL_OR_NOTHING:
          techniques.push(CBTTechnique.COGNITIVE_RESTRUCTURING);
          break;
        case CognitiveDistortion.CATASTROPHIZING:
          techniques.push(CBTTechnique.THOUGHT_CHALLENGING);
          break;
        case CognitiveDistortion.OVERGENERALIZATION:
          techniques.push(CBTTechnique.SOCRATIC_QUESTIONING);
          break;
        case CognitiveDistortion.SHOULD_STATEMENTS:
          techniques.push(CBTTechnique.ACCEPTANCE_COMMITMENT);
          break;
        case CognitiveDistortion.EMOTIONAL_REASONING:
          techniques.push(CBTTechnique.MINDFULNESS_INTEGRATION);
          break;
      }
    });

    return [...new Set(techniques)]; // Remove duplicates
  }

  private generateRationale(distortions: CognitiveDistortion[], techniques: CBTTechnique[]): string {
    if (distortions.length === 0) {
      return 'Mesajınızda belirgin bilişsel çarpıtma tespit edilmedi. Bu iyi bir durum!';
    }

    let rationale = `${distortions.length} farklı düşünce kalıbı fark ettim: `;
    rationale += distortions.map(d => this.getDistortionDescription(d)).join(', ');
    rationale += `. Bu durumda ${techniques.length} CBT tekniği yardımcı olabilir.`;
    
    return rationale;
  }

  private getDistortionDescription(distortion: CognitiveDistortion): string {
    const descriptions = {
      [CognitiveDistortion.ALL_OR_NOTHING]: 'ya hep ya hiç düşüncesi',
      [CognitiveDistortion.CATASTROPHIZING]: 'felaket senaryoları',
      [CognitiveDistortion.OVERGENERALIZATION]: 'aşırı genelleme',
      [CognitiveDistortion.SHOULD_STATEMENTS]: 'zorunluluk ifadeleri',
      [CognitiveDistortion.EMOTIONAL_REASONING]: 'duygusal akıl yürütme',
      [CognitiveDistortion.MIND_READING]: 'zihin okuma',
      [CognitiveDistortion.FORTUNE_TELLING]: 'gelecek tahmini',
      [CognitiveDistortion.MENTAL_FILTER]: 'zihinsel filtreleme',
      [CognitiveDistortion.LABELING]: 'etiketleme',
      [CognitiveDistortion.PERSONALIZATION]: 'kişiselleştirme'
    };
    return descriptions[distortion] || distortion;
  }

  private selectOptimalIntervention(interventions: CBTIntervention[], context: ConversationContext): CBTIntervention {
    // En basit intervention'ı seç (gelecekte user profiling ile geliştirilecek)
    return interventions[0];
  }

  private selectImmediateIntervention(distortion: CognitiveDistortion, context: ConversationContext): CBTIntervention {
    const technique = this.recommendTechniques([distortion], context)[0];
    const interventions = this.interventionLibrary.get(technique);
    return interventions ? interventions[0] : this.getDefaultIntervention();
  }

  private getDefaultIntervention(): CBTIntervention {
    return {
      id: 'default_mindfulness',
      technique: CBTTechnique.MINDFULNESS_INTEGRATION,
      title: 'Basit Farkındalık',
      description: 'Şu anda burada olma pratiği',
      userPrompt: 'Şu anda nerede olduğunuzu ve nasıl hissettiğinizi fark etmeye çalışalım.',
      systemPrompt: 'Kullanıcıyı şimdiki ana getir, basit farkındalık egzersizi yap.',
      followUpQuestions: ['Nefesinizi takip edebiliyor musunuz?'],
      expectedOutcome: 'Anksiyete azalması ve şimdiki an farkındalığı'
    };
  }

  private async updateSessionContext(userId: string, technique: CBTTechnique, intervention: CBTIntervention): Promise<void> {
    let sessionContext = this.userSessions.get(userId);
    
    if (!sessionContext) {
      sessionContext = {
        sessionId: `cbt_${userId}_${Date.now()}`,
        userId,
        previousInterventions: [],
        userProgress: {
          mastereTechniques: [],
          strugglingWith: [],
          overallProgress: 0
        },
        therapyGoals: [],
        sessionObjectives: []
      };
    }

    sessionContext.currentTechnique = technique;
    sessionContext.previousInterventions.push(intervention);
    
    this.userSessions.set(userId, sessionContext);
  }

  private addIntervention(technique: CBTTechnique, intervention: CBTIntervention): void {
    if (!this.interventionLibrary.has(technique)) {
      this.interventionLibrary.set(technique, []);
    }
    this.interventionLibrary.get(technique)!.push(intervention);
  }

  private async loadInterventionLibrary(): Promise<void> {
    // Future: Load from external source or API
    console.log('📚 CBT Intervention Library loaded from memory');
  }

  private getTotalInterventionCount(): number {
    let total = 0;
    this.interventionLibrary.forEach(interventions => {
      total += interventions.length;
    });
    return total;
  }

  // =============================================================================
  // 🔄 PUBLIC API
  // =============================================================================

  /**
   * CBT Engine durumunu kontrol et
   */
  get enabled(): boolean {
    return this.isEnabled && FEATURE_FLAGS.isEnabled('AI_CBT_ENGINE');
  }

  /**
   * Mevcut teknik sayısını al
   */
  getAvailableTechniques(): CBTTechnique[] {
    return Array.from(this.interventionLibrary.keys());
  }

  /**
   * Kullanıcı session context'ini al
   */
  getSessionContext(userId: string): CBTSessionContext | undefined {
    return this.userSessions.get(userId);
  }

  /**
   * Engine'i temizle
   */
  async shutdown(): Promise<void> {
    console.log('🧠 CBT Engine: Shutting down...');
    this.isEnabled = false;
    this.userSessions.clear();
    
    await trackAIInteraction(AIEventType.CBT_ENGINE_SHUTDOWN, {
      sessionsCleared: this.userSessions.size
    });
  }
}

// =============================================================================
// 🎯 EXPORT
// =============================================================================

export const cbtEngine = CBTEngine.getInstance();
export default cbtEngine;
// Note: CBTTechnique, CognitiveDistortion enums and interfaces are already exported above