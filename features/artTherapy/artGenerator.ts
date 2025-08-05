/**
 * Art Therapy Generator
 * 
 * Duyguları görselleştirme ve sanat terapisi entegrasyonu
 * Emotion-to-visual mapping ve therapeutic art creation
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  AIError,
  AIErrorCode
} from '@/features/ai/types';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';

// Art Therapy Styles
export enum ArtStyle {
  ABSTRACT = 'abstract',
  MANDALA = 'mandala',
  NATURE = 'nature',
  GEOMETRIC = 'geometric',
  WATERCOLOR = 'watercolor',
  MINIMALIST = 'minimalist',
  EXPRESSIVE = 'expressive',
  SYMBOLIC = 'symbolic'
}

// Emotion Categories
export enum EmotionCategory {
  ANXIETY = 'anxiety',
  CALM = 'calm',
  ANGER = 'anger',
  SADNESS = 'sadness',
  JOY = 'joy',
  FEAR = 'fear',
  CONFUSION = 'confusion',
  HOPE = 'hope',
  FRUSTRATION = 'frustration',
  PEACE = 'peace'
}

// Therapeutic Techniques
export enum ArtTherapyTechnique {
  EMOTIONAL_RELEASE = 'emotional_release',
  STRESS_REDUCTION = 'stress_reduction',
  SELF_EXPLORATION = 'self_exploration',
  TRAUMA_PROCESSING = 'trauma_processing',
  MINDFULNESS = 'mindfulness',
  GOAL_VISUALIZATION = 'goal_visualization',
  IDENTITY_EXPLORATION = 'identity_exploration',
  RELATIONSHIP_MAPPING = 'relationship_mapping'
}

// Art Creation Session
export interface ArtCreationSession {
  id: string;
  userId: string;
  
  // Session Details
  startTime: Date;
  endTime?: Date;
  duration?: number; // dakika
  
  // Therapeutic Context
  primaryEmotion: EmotionCategory;
  secondaryEmotions: EmotionCategory[];
  therapeuticGoal: ArtTherapyTechnique;
  intensityLevel: number; // 1-10
  
  // Art Configuration
  chosenStyle: ArtStyle;
  colorPalette: {
    primary: string;
    secondary: string[];
    mood: 'warm' | 'cool' | 'neutral' | 'vibrant' | 'muted';
  };
  
  // Creation Process
  creationSteps: {
    step: number;
    timestamp: Date;
    action: 'color_choice' | 'shape_addition' | 'texture_change' | 'reflection_note';
    description: string;
    emotionalState?: number; // 1-10
  }[];
  
  // Therapeutic Elements
  symbolism: {
    element: string;
    meaning: string;
    personalSignificance?: string;
  }[];
  
  reflectionQuestions: {
    question: string;
    answer?: string;
    timestamp: Date;
  }[];
  
  // Outcomes
  finalArtwork: {
    description: string;
    dominantColors: string[];
    shapes: string[];
    composition: 'balanced' | 'chaotic' | 'minimal' | 'complex';
    emotionalTone: string;
  };
  
  therapeuticInsights: string[];
  moodBefore: number; // 1-10
  moodAfter: number; // 1-10
  satisfactionLevel: number; // 1-10
  
  // Progress Tracking
  sessionNotes: string;
  therapistNotes?: string;
  nextSessionSuggestions: string[];
}

// Emotion-Color Mapping
const EMOTION_COLOR_MAP = {
  [EmotionCategory.ANXIETY]: {
    primary: ['#FF6B6B', '#FFA07A', '#FFD700'], // Reds, oranges, yellows
    secondary: ['#87CEEB', '#98FB98'], // Calming blues and greens
    avoid: ['#000000', '#800080'] // Dark colors
  },
  [EmotionCategory.CALM]: {
    primary: ['#87CEEB', '#98FB98', '#E0E6FF'], // Blues, greens, light purples
    secondary: ['#F0F8FF', '#FFFACD'], // Very light tones
    avoid: ['#FF0000', '#FF4500'] // Aggressive colors
  },
  [EmotionCategory.ANGER]: {
    primary: ['#DC143C', '#FF4500', '#B22222'], // Deep reds
    secondary: ['#000000', '#696969'], // Dark tones
    avoid: ['#FFB6C1', '#98FB98'] // Soft colors
  },
  [EmotionCategory.SADNESS]: {
    primary: ['#4169E1', '#6495ED', '#9370DB'], // Blues and purples
    secondary: ['#708090', '#2F4F4F'], // Grays
    avoid: ['#FFD700', '#FF69B4'] // Bright happy colors
  },
  [EmotionCategory.JOY]: {
    primary: ['#FFD700', '#FFA500', '#FF69B4'], // Yellows, oranges, bright colors
    secondary: ['#98FB98', '#87CEEB'], // Light greens and blues
    avoid: ['#000000', '#800000'] // Dark colors
  }
};

// Art Style Characteristics
const STYLE_CHARACTERISTICS = {
  [ArtStyle.ABSTRACT]: {
    shapes: ['flowing_lines', 'organic_forms', 'color_blends'],
    techniques: ['layering', 'blending', 'texture_variation'],
    symbolism: 'subconscious_expression'
  },
  [ArtStyle.MANDALA]: {
    shapes: ['circles', 'symmetrical_patterns', 'geometric_forms'],
    techniques: ['repetition', 'symmetry', 'center_focus'],
    symbolism: 'wholeness_unity'
  },
  [ArtStyle.NATURE]: {
    shapes: ['trees', 'flowers', 'landscapes', 'animals'],
    techniques: ['organic_lines', 'natural_colors', 'texture'],
    symbolism: 'connection_growth'
  },
  [ArtStyle.GEOMETRIC]: {
    shapes: ['triangles', 'squares', 'polygons', 'patterns'],
    techniques: ['precision', 'repetition', 'mathematical_harmony'],
    symbolism: 'order_control'
  }
};

// Therapeutic Prompts
const THERAPEUTIC_PROMPTS = {
  [ArtTherapyTechnique.EMOTIONAL_RELEASE]: [
    "Bu renk size hangi duyguyu hatırlatıyor?",
    "Şu andaki hislerinizi bir şekil olarak nasıl çizerdiniz?",
    "Bu çizgiler hangi anılarınızı canlandırıyor?"
  ],
  [ArtTherapyTechnique.STRESS_REDUCTION]: [
    "Nefes verin ve en rahatlatıcı rengi seçin",
    "Yumuşak, akıcı çizgiler çizin",
    "Kendinizi güvende hissettiğiniz bir yer hayal edin"
  ],
  [ArtTherapyTechnique.SELF_EXPLORATION]: [
    "Kendinizi bir renk olarak düşünün, hangi renk olurdu?",
    "İç gücünüzü temsil eden bir sembol çizin",
    "Kimliğinizin farklı yönlerini farklı renklerle gösterin"
  ],
  [ArtTherapyTechnique.MINDFULNESS]: [
    "Şu ana odaklanın ve sadece eldeki fırçayı hissedin",
    "Her çizgiyle birlikte nefesinizi takip edin",
    "Renklerin birbiriyle karışmasını izleyin"
  ]
};

class ArtTherapyGenerator {
  private static instance: ArtTherapyGenerator;
  private activeSessions: Map<string, ArtCreationSession> = new Map();
  
  static getInstance(): ArtTherapyGenerator {
    if (!this.instance) {
      this.instance = new ArtTherapyGenerator();
    }
    return this.instance;
  }

  /**
   * Art therapy session başlat
   */
  async startArtTherapySession(
    userId: string,
    primaryEmotion: EmotionCategory,
    therapeuticGoal: ArtTherapyTechnique,
    intensityLevel: number,
    preferences?: {
      preferredStyle?: ArtStyle;
      colorMoodPreference?: 'warm' | 'cool' | 'neutral';
    }
  ): Promise<ArtCreationSession> {
    
    // Emotion-based art style önerisi
    const suggestedStyle = this.suggestArtStyle(primaryEmotion, therapeuticGoal);
    const chosenStyle = preferences?.preferredStyle || suggestedStyle;
    
    // Color palette oluştur
    const colorPalette = this.generateEmotionBasedPalette(
      primaryEmotion,
      intensityLevel,
      preferences?.colorMoodPreference
    );
    
    const session: ArtCreationSession = {
      id: `art_${Date.now()}_${userId}`,
      userId,
      startTime: new Date(),
      primaryEmotion,
      secondaryEmotions: [],
      therapeuticGoal,
      intensityLevel,
      chosenStyle,
      colorPalette,
      creationSteps: [],
      symbolism: [],
      reflectionQuestions: this.generateInitialQuestions(therapeuticGoal),
      finalArtwork: {
        description: '',
        dominantColors: [],
        shapes: [],
        composition: 'balanced',
        emotionalTone: ''
      },
      therapeuticInsights: [],
      moodBefore: intensityLevel,
      moodAfter: 0,
      satisfactionLevel: 0,
      sessionNotes: '',
      nextSessionSuggestions: []
    };

    this.activeSessions.set(session.id, session);
    
    await trackAIInteraction(AIEventType.ART_THERAPY_STARTED, {
      sessionId: session.id,
      primaryEmotion,
      therapeuticGoal,
      chosenStyle,
      intensityLevel
    });

    return session;
  }

  /**
   * Emotion-based color palette oluştur
   */
  private generateEmotionBasedPalette(
    emotion: EmotionCategory,
    intensity: number,
    moodPreference?: 'warm' | 'cool' | 'neutral'
  ) {
    const emotionColors = EMOTION_COLOR_MAP[emotion];
    if (!emotionColors) {
      // Default neutral palette
      return {
        primary: '#87CEEB',
        secondary: ['#98FB98', '#FFE4B5', '#E6E6FA'],
        mood: 'neutral' as const
      };
    }

    // Intensity'ye göre renk seçimi
    const primaryOptions = emotionColors.primary;
    const primaryColor = primaryOptions[Math.floor(intensity / 4)] || primaryOptions[0];
    
    // Mood preference'a göre secondary colors ayarla
    let secondaryColors = emotionColors.secondary;
    if (moodPreference === 'warm') {
      secondaryColors = secondaryColors.filter(color => 
        ['FF', 'F', 'E', 'D'].some(warm => color.includes(warm))
      );
    } else if (moodPreference === 'cool') {
      secondaryColors = secondaryColors.filter(color => 
        ['87', '98', '4', '6', '8'].some(cool => color.includes(cool))
      );
    }

    return {
      primary: primaryColor,
      secondary: secondaryColors,
      mood: moodPreference || this.determineMoodFromEmotion(emotion)
    };
  }

  /**
   * Emotion ve therapeutic goal'a göre art style öner
   */
  private suggestArtStyle(
    emotion: EmotionCategory,
    therapeuticGoal: ArtTherapyTechnique
  ): ArtStyle {
    // Therapeutic goal priority
    const goalStyleMap = {
      [ArtTherapyTechnique.EMOTIONAL_RELEASE]: ArtStyle.ABSTRACT,
      [ArtTherapyTechnique.STRESS_REDUCTION]: ArtStyle.MANDALA,
      [ArtTherapyTechnique.MINDFULNESS]: ArtStyle.NATURE,
      [ArtTherapyTechnique.SELF_EXPLORATION]: ArtStyle.SYMBOLIC,
      [ArtTherapyTechnique.TRAUMA_PROCESSING]: ArtStyle.ABSTRACT,
      [ArtTherapyTechnique.GOAL_VISUALIZATION]: ArtStyle.GEOMETRIC,
      [ArtTherapyTechnique.IDENTITY_EXPLORATION]: ArtStyle.EXPRESSIVE,
      [ArtTherapyTechnique.RELATIONSHIP_MAPPING]: ArtStyle.SYMBOLIC
    };

    // Emotion-based fallback
    const emotionStyleMap = {
      [EmotionCategory.ANXIETY]: ArtStyle.MANDALA,
      [EmotionCategory.CALM]: ArtStyle.NATURE,
      [EmotionCategory.ANGER]: ArtStyle.ABSTRACT,
      [EmotionCategory.SADNESS]: ArtStyle.WATERCOLOR,
      [EmotionCategory.JOY]: ArtStyle.EXPRESSIVE,
      [EmotionCategory.FEAR]: ArtStyle.GEOMETRIC,
      [EmotionCategory.CONFUSION]: ArtStyle.ABSTRACT,
      [EmotionCategory.HOPE]: ArtStyle.NATURE,
      [EmotionCategory.FRUSTRATION]: ArtStyle.EXPRESSIVE,
      [EmotionCategory.PEACE]: ArtStyle.MINIMALIST
    };

    return goalStyleMap[therapeuticGoal] || emotionStyleMap[emotion] || ArtStyle.ABSTRACT;
  }

  /**
   * Therapeutic questions oluştur
   */
  private generateInitialQuestions(therapeuticGoal: ArtTherapyTechnique) {
    const prompts = THERAPEUTIC_PROMPTS[therapeuticGoal] || THERAPEUTIC_PROMPTS[ArtTherapyTechnique.EMOTIONAL_RELEASE];
    
    return prompts.map(question => ({
      question,
      timestamp: new Date()
    }));
  }

  /**
   * Art creation step ekle
   */
  async addCreationStep(
    sessionId: string,
    action: 'color_choice' | 'shape_addition' | 'texture_change' | 'reflection_note',
    description: string,
    emotionalState?: number
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new AIError(AIErrorCode.SESSION_NOT_FOUND, 'Art therapy session bulunamadı');
    }

    session.creationSteps.push({
      step: session.creationSteps.length + 1,
      timestamp: new Date(),
      action,
      description,
      emotionalState
    });

    // Dynamic guidance based on action
    if (action === 'color_choice') {
      await this.provideColorGuidance(session, description);
    } else if (action === 'shape_addition') {
      await this.provideShapeGuidance(session, description);
    }

    await this.saveSession(session);
  }

  /**
   * Reflection sorusu cevapla
   */
  async answerReflectionQuestion(
    sessionId: string,
    questionIndex: number,
    answer: string
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.reflectionQuestions[questionIndex]) {
      throw new AIError(AIErrorCode.INVALID_REQUEST, 'Geçersiz soru indeksi');
    }

    session.reflectionQuestions[questionIndex].answer = answer;
    
    // Answer'a göre therapeutic insight oluştur
    const insight = this.generateInsightFromAnswer(
      session.reflectionQuestions[questionIndex].question,
      answer,
      session.therapeuticGoal
    );
    
    if (insight) {
      session.therapeuticInsights.push(insight);
    }

    await this.saveSession(session);
  }

  /**
   * Session tamamla
   */
  async completeArtSession(
    sessionId: string,
    finalDescription: string,
    moodAfter: number,
    satisfactionLevel: number,
    sessionNotes?: string
  ): Promise<ArtCreationSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new AIError(AIErrorCode.SESSION_NOT_FOUND, 'Art therapy session bulunamadı');
    }

    session.endTime = new Date();
    session.duration = (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60);
    session.finalArtwork.description = finalDescription;
    session.moodAfter = moodAfter;
    session.satisfactionLevel = satisfactionLevel;
    session.sessionNotes = sessionNotes || '';

    // Analyze final artwork
    await this.analyzeArtwork(session);
    
    // Generate next session suggestions
    session.nextSessionSuggestions = this.generateNextSessionSuggestions(session);

    // Remove from active sessions
    this.activeSessions.delete(sessionId);
    
    // Final save
    await this.saveSession(session);

    await trackAIInteraction(AIEventType.ART_THERAPY_COMPLETED, {
      sessionId: session.id,
      duration: session.duration,
      moodImprovement: session.moodAfter - session.moodBefore,
      satisfactionLevel: session.satisfactionLevel,
      insightsGenerated: session.therapeuticInsights.length
    });

    return session;
  }

  /**
   * Sanatsal eseri analiz et
   */
  private async analyzeArtwork(session: ArtCreationSession): Promise<void> {
    // Color analysis
    const colors = session.creationSteps
      .filter(step => step.action === 'color_choice')
      .map(step => step.description);
    
    session.finalArtwork.dominantColors = [...new Set(colors)];

    // Shape analysis
    const shapes = session.creationSteps
      .filter(step => step.action === 'shape_addition')
      .map(step => step.description);
    
    session.finalArtwork.shapes = [...new Set(shapes)];

    // Composition analysis
    const stepCount = session.creationSteps.length;
    if (stepCount < 5) {
      session.finalArtwork.composition = 'minimal';
    } else if (stepCount > 15) {
      session.finalArtwork.composition = 'complex';
    } else if (this.hasSymmetry(session.creationSteps)) {
      session.finalArtwork.composition = 'balanced';
    } else {
      session.finalArtwork.composition = 'chaotic';
    }

    // Emotional tone analysis
    session.finalArtwork.emotionalTone = this.analyzeEmotionalTone(session);

    // Generate therapeutic insights
    const insights = this.generateArtworkInsights(session);
    session.therapeuticInsights.push(...insights);
  }

  /**
   * Sanat eserinden insight oluştur
   */
  private generateArtworkInsights(session: ArtCreationSession): string[] {
    const insights: string[] = [];
    
    // Color insights
    const warmColors = session.finalArtwork.dominantColors.filter(color => 
      ['red', 'orange', 'yellow', 'pink'].some(warm => color.toLowerCase().includes(warm))
    );
    
    if (warmColors.length > session.finalArtwork.dominantColors.length / 2) {
      insights.push("Sıcak renklerin kullanımı enerji ve yaşam sevginizi yansıtıyor.");
    }

    // Composition insights
    if (session.finalArtwork.composition === 'balanced') {
      insights.push("Dengeli kompozisyon, iç huzurunuzu ve kontrol duygularınızı gösteriyor.");
    } else if (session.finalArtwork.composition === 'chaotic') {
      insights.push("Serbest kompozisyon, yaratıcılığınızın ve spontanlığınızın ifadesi.");
    }

    // Progress insights
    const moodImprovement = session.moodAfter - session.moodBefore;
    if (moodImprovement > 2) {
      insights.push("Bu sanat süreci ruh halinizde belirgin bir iyileşme sağladı.");
    }

    return insights;
  }

  /**
   * Sonraki session önerileri oluştur
   */
  private generateNextSessionSuggestions(session: ArtCreationSession): string[] {
    const suggestions: string[] = [];
    
    // Based on satisfaction
    if (session.satisfactionLevel >= 8) {
      suggestions.push("Bu style'ı tekrar keşfetmek için daha karmaşık kompozisyonlar deneyin");
    } else if (session.satisfactionLevel <= 5) {
      suggestions.push("Farklı bir art style denemek faydalı olabilir");
    }

    // Based on therapeutic goal
    switch (session.therapeuticGoal) {
      case ArtTherapyTechnique.EMOTIONAL_RELEASE:
        suggestions.push("Daha derin duygusal keşif için abstract expressionism deneyin");
        break;
      case ArtTherapyTechnique.STRESS_REDUCTION:
        suggestions.push("Mindfulness odaklı mandala çalışması önerilir");
        break;
      case ArtTherapyTechnique.SELF_EXPLORATION:
        suggestions.push("Kimlik haritası çizimi ile devam edin");
        break;
    }

    // Based on mood improvement
    const moodImprovement = session.moodAfter - session.moodBefore;
    if (moodImprovement < 1) {
      suggestions.push("Daha interaktif ve dinamik art therapy teknikleri deneyin");
    }

    return suggestions;
  }

  // Yardımcı metodlar
  private determineMoodFromEmotion(emotion: EmotionCategory): 'warm' | 'cool' | 'neutral' | 'vibrant' | 'muted' {
    const warmEmotions = [EmotionCategory.JOY, EmotionCategory.ANGER, EmotionCategory.FRUSTRATION];
    const coolEmotions = [EmotionCategory.CALM, EmotionCategory.SADNESS, EmotionCategory.PEACE];
    
    if (warmEmotions.includes(emotion)) return 'warm';
    if (coolEmotions.includes(emotion)) return 'cool';
    return 'neutral';
  }

  private async provideColorGuidance(session: ArtCreationSession, colorChoice: string): Promise<void> {
    // Bu kısım UI'ya guidance mesajı gönderecek
    const guidance = `${colorChoice} rengi güzel bir seçim. Bu renk size ne hissettiriyor?`;
    // App state management ile entegre edilecek
  }

  private async provideShapeGuidance(session: ArtCreationSession, shapeDescription: string): Promise<void> {
    const guidance = `${shapeDescription} şekli ilginç. Bu form hangi anılarınızı çağrıştırıyor?`;
    // App state management ile entegre edilecek
  }

  private generateInsightFromAnswer(question: string, answer: string, goal: ArtTherapyTechnique): string | null {
    // Simple insight generation based on answer content
    if (answer.toLowerCase().includes('öfke') || answer.toLowerCase().includes('kızgın')) {
      return "Öfke duygularınızın farkında olmanız önemli bir adım.";
    }
    
    if (answer.toLowerCase().includes('huzur') || answer.toLowerCase().includes('sakin')) {
      return "İç huzurunuza bağlanabilmeniz değerli bir yetenek.";
    }
    
    return null;
  }

  private hasSymmetry(steps: any[]): boolean {
    // Basit simetri kontrolü - geliştirilecek
    return steps.length % 2 === 0;
  }

  private analyzeEmotionalTone(session: ArtCreationSession): string {
    const moodChange = session.moodAfter - session.moodBefore;
    
    if (moodChange > 3) return 'transformative';
    if (moodChange > 1) return 'positive';
    if (moodChange < -1) return 'challenging';
    return 'stable';
  }

  private async saveSession(session: ArtCreationSession): Promise<void> {
    try {
      await AsyncStorage.setItem(`art_session_${session.id}`, JSON.stringify(session));
    } catch (error) {
      console.error('Art therapy session kaydedilemedi:', error);
    }
  }
}

export const artTherapyGenerator = ArtTherapyGenerator.getInstance(); 