/**
 * 🌬️ Breathwork Suggestion Service
 * 
 * Comprehensive breathwork recommendation engine with:
 * - Contextual triggers (mood, anxiety, compulsions, time)
 * - Delay management (snooze, frequency limits)  
 * - Protocol selection (box, 4-7-8, paced, custom)
 * - Progressive adaptation based on user response
 * 
 * v2.1 - Week 2 Implementation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface BreathworkSuggestion {
  id: string;
  trigger: BreathworkTrigger;
  protocol: BreathworkProtocol;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timing: BreathworkTiming;
  customization: BreathworkCustomization;
  metadata: SuggestionMetadata;
}

export interface BreathworkTrigger {
  type: 'anxiety' | 'low_mood' | 'post_compulsion' | 'stress' | 'sleep_prep' | 'morning_routine' | 'panic_episode' | 'maintenance';
  confidence: number;
  reason?: string; // ✅ FIXED: Added missing reason field for display purposes
  contextData: {
    moodScore?: number;
    anxietyLevel?: number;
    recentCompulsions?: number;
    timeOfDay?: string;
    lastBreathworkSession?: number;
    physicalSymptoms?: string[];
  };
}

export interface BreathworkProtocol {
  name: '4-7-8' | 'box' | 'paced' | 'extended' | 'quick_calm' | 'custom';
  duration: number; // seconds
  parameters: {
    inhale: number;
    hold?: number;
    exhale: number;
    pause?: number;
    cycles?: number;
  };
  description: string;
  effectiveness: {
    anxiety: number;    // 0-10 effectiveness for anxiety
    mood: number;       // 0-10 effectiveness for mood
    sleep: number;      // 0-10 effectiveness for sleep
    stress: number;     // 0-10 effectiveness for stress
  };
}

export interface BreathworkTiming {
  suggestedAt: number;
  expiresAt: number;
  canDelay: boolean;
  delayOptions: number[]; // minutes
  maxDelays: number;
  currentDelays: number;
}

export interface BreathworkCustomization {
  voiceGuidance: boolean;
  background: 'nature' | 'music' | 'silence' | 'white_noise';
  hapticFeedback: boolean;
  visualCue: 'breathing_circle' | 'wave' | 'minimal' | 'nature_scene';
  adaptToProgress: boolean;
}

export interface SuggestionMetadata {
  generatedAt: number;
  userId: string;
  sessionId: string;
  source: 'ai_analysis' | 'scheduled' | 'user_request' | 'emergency';
  priority: number; // 1-10
  expectedCompletion: number; // minutes
  fallbackOptions: BreathworkProtocol[];
}

export interface UserBreathworkProfile {
  userId: string;
  preferences: {
    preferredProtocols: string[];
    preferredDuration: number;
    preferredTimes: string[];
    dislikedTriggers: string[];
  };
  history: {
    totalSessions: number;
    avgRating: number;
    avgCompletionRate: number;
    protocolEffectiveness: Record<string, number>;
    lastSessionAt: number;
  };
  adaptations: {
    anxietyResponseRate: number;
    moodImprovementRate: number;
    consistencyScore: number;
    customProtocolNeeded: boolean;
  };
}

// =============================================================================
// BREATHWORK PROTOCOLS LIBRARY
// =============================================================================

const BREATHWORK_PROTOCOLS: Record<string, BreathworkProtocol> = {
  '4-7-8': {
    name: '4-7-8',
    duration: 240, // 4 minutes
    parameters: { inhale: 4, hold: 7, exhale: 8, cycles: 8 },
    description: 'Nefesi 4 sayım al, 7 sayım tut, 8 sayımda ver. Derin rahatlama için.',
    effectiveness: { anxiety: 9, mood: 6, sleep: 10, stress: 8 }
  },
  
  box: {
    name: 'box',
    duration: 300, // 5 minutes
    parameters: { inhale: 4, hold: 4, exhale: 4, pause: 4, cycles: 10 },
    description: 'Kare nefes: 4-4-4-4 ritmi. Genel denge ve odaklanma.',
    effectiveness: { anxiety: 7, mood: 8, sleep: 6, stress: 9 }
  },
  
  paced: {
    name: 'paced',
    duration: 360, // 6 minutes
    parameters: { inhale: 6, exhale: 6, cycles: 15 },
    description: 'Yavaş ve sürekli nefes. Bakım ve sürdürülebilirlik için.',
    effectiveness: { anxiety: 5, mood: 7, sleep: 7, stress: 6 }
  },
  
  extended: {
    name: 'extended',
    duration: 480, // 8 minutes
    parameters: { inhale: 6, hold: 2, exhale: 8, pause: 2, cycles: 12 },
    description: 'Uzatılmış nefes seansı. Derin meditasyon ve iyileşme.',
    effectiveness: { anxiety: 8, mood: 9, sleep: 8, stress: 7 }
  },
  
  quick_calm: {
    name: 'quick_calm',
    duration: 120, // 2 minutes
    parameters: { inhale: 3, exhale: 6, cycles: 8 },
    description: 'Hızlı sakinleşme. Acil durumlar için.',
    effectiveness: { anxiety: 8, mood: 5, sleep: 3, stress: 9 }
  },
  
  custom: {
    name: 'custom',
    duration: 300,
    parameters: { inhale: 5, exhale: 5, cycles: 12 },
    description: 'Kişiselleştirilmiş protokol. Kullanıcı tercihlerine göre.',
    effectiveness: { anxiety: 7, mood: 7, sleep: 7, stress: 7 }
  }
};

// =============================================================================
// MAIN BREATHWORK SUGGESTION SERVICE
// =============================================================================

export class BreathworkSuggestionService {
  private static instance: BreathworkSuggestionService;
  
  public static getInstance(): BreathworkSuggestionService {
    if (!BreathworkSuggestionService.instance) {
      BreathworkSuggestionService.instance = new BreathworkSuggestionService();
    }
    return BreathworkSuggestionService.instance;
  }
  
  /**
   * Generate comprehensive breathwork suggestion based on context
   */
  async generateSuggestion(context: {
    userId: string;
    moodScore?: number;
    anxietyLevel?: number;
    recentCompulsions?: number;
    currentTime?: Date;
    lastSession?: number;
    userInput?: string;
  }): Promise<BreathworkSuggestion | null> {
    try {
      if (!FEATURE_FLAGS.isEnabled('AI_BREATHWORK_SUGGESTIONS')) {
        return null;
      }
      
      // 1. Load user profile
      const userProfile = await this.getUserProfile(context.userId);
      
      // 2. Analyze context and determine triggers
      const triggers = await this.analyzeContextTriggers(context);
      
      if (triggers.length === 0) {
        return null; // No triggers detected
      }
      
      // 3. Check delay constraints
      const delayCheck = await this.checkDelayConstraints(context.userId);
      if (!delayCheck.canSuggest) {
        await this.trackSuggestion('delayed', { 
          userId: context.userId, 
          reason: delayCheck.reason,
          nextAvailable: delayCheck.nextAvailable
        });
        return null;
      }
      
      // 4. Select primary trigger and protocol
      const primaryTrigger = this.selectPrimaryTrigger(triggers);
      const protocol = await this.selectOptimalProtocol(primaryTrigger, userProfile, context);
      
      // 5. Determine timing and urgency
      const timing = this.calculateTiming(primaryTrigger, userProfile);
      const urgency = this.calculateUrgency(primaryTrigger, context);
      
      // 6. Create customization based on user preferences
      const customization = this.createCustomization(userProfile, primaryTrigger);
      
      // 7. Generate suggestion
      const suggestion: BreathworkSuggestion = {
        id: `breathwork_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        trigger: primaryTrigger,
        protocol,
        urgency,
        timing,
        customization,
        metadata: {
          generatedAt: Date.now(),
          userId: context.userId,
          sessionId: `session_${Date.now()}`,
          source: 'ai_analysis',
          priority: this.calculatePriority(urgency, primaryTrigger),
          expectedCompletion: Math.ceil(protocol.duration / 60),
          fallbackOptions: this.getFallbackProtocols(protocol, primaryTrigger)
        }
      };
      
      // 8. Save suggestion and track
      await this.saveSuggestion(suggestion);
      await this.trackSuggestion('generated', suggestion);
      
      return suggestion;
      
    } catch (error) {
      console.error('Breathwork suggestion generation failed:', error);
      await trackAIInteraction(AIEventType.SYSTEM_ERROR, {
        error: error instanceof Error ? error.message : String(error),
        userId: context?.userId,
        component: 'BreathworkSuggestionService'
      });
      return null;
    }
  }
  
  /**
   * Analyze context to identify breathwork triggers
   */
  private async analyzeContextTriggers(context: any): Promise<BreathworkTrigger[]> {
    const triggers: BreathworkTrigger[] = [];
    const currentTime = context.currentTime || new Date();
    const hour = currentTime.getHours();
    
    // 1. ANXIETY TRIGGER
    if (context.anxietyLevel && context.anxietyLevel >= 6) {
      triggers.push({
        type: 'anxiety',
        confidence: Math.min(context.anxietyLevel / 10, 1),
        reason: context.anxietyLevel >= 8 ? 'Yüksek anksiyete seviyesi tespit edildi' : 'Anksiyete artışı gözlendi',
        contextData: {
          anxietyLevel: context.anxietyLevel,
          timeOfDay: this.getTimeOfDay(hour),
          physicalSymptoms: this.extractPhysicalSymptoms(context.userInput)
        }
      });
    }
    
    // 2. LOW MOOD TRIGGER (NEW - Week 2 Feature)
    if (context.moodScore && context.moodScore <= 4) {
      triggers.push({
        type: 'low_mood',
        confidence: Math.max((5 - context.moodScore) / 5, 0),
        reason: context.moodScore <= 2 ? 'Çok düşük mood algılandı' : 'Mood düşüklüğü tespit edildi',
        contextData: {
          moodScore: context.moodScore,
          timeOfDay: this.getTimeOfDay(hour),
          lastBreathworkSession: context.lastSession
        }
      });
    }
    
    // 3. POST-COMPULSION TRIGGER
    if (context.recentCompulsions && context.recentCompulsions > 0) {
      const recency = Math.min(context.recentCompulsions / 3, 1); // Max confidence at 3+ compulsions
      triggers.push({
        type: 'post_compulsion',
        confidence: recency,
        reason: `Son ${context.recentCompulsions} kompulsiyon sonrası rahatlama`,
        contextData: {
          recentCompulsions: context.recentCompulsions,
          timeOfDay: this.getTimeOfDay(hour)
        }
      });
    }
    
    // 4. SLEEP PREPARATION TRIGGER
    if (hour >= 21 || hour <= 1) { // 9 PM - 1 AM
      triggers.push({
        type: 'sleep_prep',
        confidence: 0.7,
        reason: 'Uyku öncesi rahatlama zamanı',
        contextData: {
          timeOfDay: 'late_night',
          lastBreathworkSession: context.lastSession
        }
      });
    }
    
    // 5. MORNING ROUTINE TRIGGER
    if (hour >= 6 && hour <= 9) { // 6 AM - 9 AM
      triggers.push({
        type: 'morning_routine',
        confidence: 0.6,
        reason: 'Güne pozitif başlangıç için nefes egzersizi',
        contextData: {
          timeOfDay: 'morning',
          lastBreathworkSession: context.lastSession
        }
      });
    }
    
    // 6. STRESS TRIGGER (from text analysis)
    if (context.userInput) {
      const stressScore = this.analyzeStressFromText(context.userInput);
      if (stressScore > 0.5) {
        triggers.push({
          type: 'stress',
          confidence: stressScore,
          reason: 'Metinde stres belirtileri tespit edildi',
          contextData: {
            anxietyLevel: context.anxietyLevel,
            physicalSymptoms: this.extractPhysicalSymptoms(context.userInput)
          }
        });
      }
    }
    
    // 7. PANIC EPISODE TRIGGER (critical)
    if (context.anxietyLevel && context.anxietyLevel >= 9) {
      triggers.push({
        type: 'panic_episode',
        confidence: 0.95,
        reason: 'Panik atak belirtileri - acil sakinleştirme gerekli',
        contextData: {
          anxietyLevel: context.anxietyLevel,
          physicalSymptoms: this.extractPhysicalSymptoms(context.userInput),
          timeOfDay: this.getTimeOfDay(hour)
        }
      });
    }
    
    return triggers;
  }
  
  /**
   * Check delay constraints (snooze, frequency limits)
   */
  private async checkDelayConstraints(userId: string): Promise<{
    canSuggest: boolean;
    reason?: string;
    nextAvailable?: number;
  }> {
    const storageKey = `breathwork_delays_${userId}`;
    
    try {
      const delayData = await AsyncStorage.getItem(storageKey);
      const delays = delayData ? JSON.parse(delayData) : {};
      
      const now = Date.now();
      const today = new Date().toDateString();
      
      // Initialize today's data if not exists
      if (!delays[today]) {
        delays[today] = {
          suggestionCount: 0,
          lastSuggestion: 0,
          snoozedUntil: 0,
          totalDelays: 0
        };
      }
      
      const todayData = delays[today];
      
      // Check if currently snoozed
      if (todayData.snoozedUntil > now) {
        return {
          canSuggest: false,
          reason: 'snoozed',
          nextAvailable: todayData.snoozedUntil
        };
      }
      
      // Check minimum interval (2 hours between suggestions)
      const minInterval = 2 * 60 * 60 * 1000; // 2 hours
      if (todayData.lastSuggestion && (now - todayData.lastSuggestion) < minInterval) {
        return {
          canSuggest: false,
          reason: 'too_frequent',
          nextAvailable: todayData.lastSuggestion + minInterval
        };
      }
      
      // 🎯 REQUIREMENT UPDATE: Check daily limit (max 3 suggestions per day)
      if (todayData.suggestionCount >= 3) {
        return {
          canSuggest: false,
          reason: 'daily_limit',
          nextAvailable: new Date(new Date().setHours(24, 0, 0, 0)).getTime()
        };
      }
      
      return { canSuggest: true };
      
    } catch (error) {
      console.warn('Delay constraint check failed:', error);
      return { canSuggest: true }; // Allow on error
    }
  }
  
  /**
   * Select the most appropriate breathwork protocol
   */
  private async selectOptimalProtocol(
    trigger: BreathworkTrigger, 
    userProfile: UserBreathworkProfile,
    context: any
  ): Promise<BreathworkProtocol> {
    // Start with protocol based on trigger type
    let baseProtocol: string;
    
    switch (trigger.type) {
      case 'panic_episode':
        baseProtocol = 'quick_calm';
        break;
      case 'anxiety':
        baseProtocol = context.anxietyLevel >= 8 ? '4-7-8' : 'box';
        break;
      case 'low_mood':
        baseProtocol = 'paced'; // Gentle, sustainable for low mood
        break;
      case 'post_compulsion':
        baseProtocol = 'box'; // Structured, grounding
        break;
      case 'sleep_prep':
        baseProtocol = '4-7-8'; // Most effective for sleep
        break;
      case 'morning_routine':
        baseProtocol = 'box'; // Energizing but not overstimulating
        break;
      case 'stress':
        baseProtocol = trigger.confidence > 0.8 ? '4-7-8' : 'paced';
        break;
      default:
        baseProtocol = 'box';
    }
    
    // Consider user preferences
    if (userProfile.preferences.preferredProtocols.length > 0) {
      const userPreferred = userProfile.preferences.preferredProtocols[0];
      
      // Use user preference if it's reasonably effective for the trigger
      const userProtocol = BREATHWORK_PROTOCOLS[userPreferred];
      const baseProtocolObj = BREATHWORK_PROTOCOLS[baseProtocol];
      
      if (userProtocol && this.isProtocolSuitable(userProtocol, trigger, baseProtocolObj)) {
        baseProtocol = userPreferred;
      }
    }
    
    // Apply user adaptations
    let protocol = { ...BREATHWORK_PROTOCOLS[baseProtocol] };
    
    if (userProfile.adaptations.customProtocolNeeded) {
      protocol = this.adaptProtocolToUser(protocol, userProfile);
    }
    
    // Adjust duration based on user preferences
    if (userProfile.preferences.preferredDuration) {
      const targetDuration = userProfile.preferences.preferredDuration * 60; // convert to seconds
      protocol.duration = Math.max(120, Math.min(600, targetDuration)); // between 2-10 minutes
    }
    
    return protocol;
  }
  
  /**
   * Calculate timing constraints and delay options
   */
  private calculateTiming(trigger: BreathworkTrigger, userProfile: UserBreathworkProfile): BreathworkTiming {
    const now = Date.now();
    const baseExpiry = 60 * 60 * 1000; // 1 hour default
    
    // Adjust expiry based on urgency
    let expiry = baseExpiry;
    if (trigger.type === 'panic_episode') {
      expiry = 15 * 60 * 1000; // 15 minutes for panic
    } else if (trigger.type === 'anxiety' && trigger.confidence > 0.8) {
      expiry = 30 * 60 * 1000; // 30 minutes for high anxiety
    }
    
    // Delay options based on trigger urgency
    let delayOptions: number[] = [10, 30, 60]; // default: 10min, 30min, 1hr
    let maxDelays = 2;
    
    if (trigger.type === 'panic_episode') {
      delayOptions = [5, 10]; // limited delay for panic
      maxDelays = 1;
    } else if (trigger.type === 'low_mood') {
      delayOptions = [15, 45, 120]; // more flexible for mood
      maxDelays = 3;
    }
    
    return {
      suggestedAt: now,
      expiresAt: now + expiry,
      canDelay: trigger.type !== 'panic_episode',
      delayOptions,
      maxDelays,
      currentDelays: 0
    };
  }
  
  /**
   * Calculate suggestion urgency
   */
  private calculateUrgency(trigger: BreathworkTrigger, context: any): 'low' | 'medium' | 'high' | 'critical' {
    if (trigger.type === 'panic_episode') return 'critical';
    
    if (trigger.type === 'anxiety' && context.anxietyLevel >= 8) return 'high';
    if (trigger.type === 'post_compulsion' && context.recentCompulsions >= 3) return 'high';
    
    if (trigger.confidence >= 0.8) return 'high';
    if (trigger.confidence >= 0.6) return 'medium';
    
    return 'low';
  }
  
  // =============================================================================
  // DELAY AND SNOOZE MANAGEMENT
  // =============================================================================
  
  /**
   * Handle user snoozing a suggestion
   */
  async snoozeSuggestion(userId: string, suggestionId: string, delayMinutes: number): Promise<boolean> {
    try {
      const storageKey = `breathwork_delays_${userId}`;
      const delayData = await AsyncStorage.getItem(storageKey);
      const delays = delayData ? JSON.parse(delayData) : {};
      
      const today = new Date().toDateString();
      const now = Date.now();
      
      if (!delays[today]) {
        delays[today] = {
          suggestionCount: 0,
          lastSuggestion: 0,
          snoozedUntil: 0,
          totalDelays: 0
        };
      }
      
      delays[today].snoozedUntil = now + (delayMinutes * 60 * 1000);
      delays[today].totalDelays += 1;
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(delays));
      
      await this.trackSuggestion('snoozed', {
        userId,
        suggestionId,
        delayMinutes,
        totalDelaysToday: delays[today].totalDelays
      });
      
      return true;
    } catch (error) {
      console.error('Failed to snooze suggestion:', error);
      return false;
    }
  }
  
  /**
   * Handle user dismissing a suggestion permanently
   */
  async dismissSuggestion(userId: string, suggestionId: string, reason?: string): Promise<boolean> {
    try {
      // Track dismissal for learning
      await this.trackSuggestion('dismissed', {
        userId,
        suggestionId,
        reason: reason || 'user_dismissed'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
      return false;
    }
  }
  
  // =============================================================================
  // USER PROFILE MANAGEMENT
  // =============================================================================
  
  private async getUserProfile(userId: string): Promise<UserBreathworkProfile> {
    try {
      const storageKey = `breathwork_profile_${userId}`;
      const profileData = await AsyncStorage.getItem(storageKey);
      
      if (profileData) {
        return JSON.parse(profileData);
      }
      
      // Create default profile
      const defaultProfile: UserBreathworkProfile = {
        userId,
        preferences: {
          preferredProtocols: [],
          preferredDuration: 5, // 5 minutes default
          preferredTimes: [],
          dislikedTriggers: []
        },
        history: {
          totalSessions: 0,
          avgRating: 0,
          avgCompletionRate: 0,
          protocolEffectiveness: {},
          lastSessionAt: 0
        },
        adaptations: {
          anxietyResponseRate: 0,
          moodImprovementRate: 0,
          consistencyScore: 0,
          customProtocolNeeded: false
        }
      };
      
      await this.saveUserProfile(defaultProfile);
      return defaultProfile;
      
    } catch (error) {
      console.error('Failed to load user profile:', error);
      // Return minimal default on error
      return {
        userId,
        preferences: { preferredProtocols: [], preferredDuration: 5, preferredTimes: [], dislikedTriggers: [] },
        history: { totalSessions: 0, avgRating: 0, avgCompletionRate: 0, protocolEffectiveness: {}, lastSessionAt: 0 },
        adaptations: { anxietyResponseRate: 0, moodImprovementRate: 0, consistencyScore: 0, customProtocolNeeded: false }
      };
    }
  }
  
  private async saveUserProfile(profile: UserBreathworkProfile): Promise<void> {
    try {
      const storageKey = `breathwork_profile_${profile.userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  }
  
  // =============================================================================
  // HELPER METHODS
  // =============================================================================
  
  private getTimeOfDay(hour: number): string {
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'late_night';
  }
  
  private extractPhysicalSymptoms(text?: string): string[] {
    if (!text) return [];
    
    const symptoms = [];
    const lowerText = text.toLowerCase();
    
    if (/kalp.*?hızlı|çarpıntı/i.test(lowerText)) symptoms.push('palpitations');
    if (/nefes.*?dar|nefes.*?alamıyorum/i.test(lowerText)) symptoms.push('shortness_of_breath');
    if (/ter.*?döküyor|terleme/i.test(lowerText)) symptoms.push('sweating');
    if (/titreme|titriyor/i.test(lowerText)) symptoms.push('trembling');
    if (/baş.*?dönme|sersemlik/i.test(lowerText)) symptoms.push('dizziness');
    if (/mide.*?bulantı|bulantı/i.test(lowerText)) symptoms.push('nausea');
    
    return symptoms;
  }
  
  private analyzeStressFromText(text: string): number {
    const stressWords = [
      /stress|gergin|baskı|yük/gi,
      /endişe|kaygı|korku/gi,
      /yorgun|bitkin|tüken/gi,
      /dayanamıyorum|bunaldım/gi
    ];
    
    let score = 0;
    stressWords.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * 0.2;
      }
    });
    
    return Math.min(score, 1);
  }
  
  private selectPrimaryTrigger(triggers: BreathworkTrigger[]): BreathworkTrigger {
    // Sort by confidence and priority
    const priorityOrder = {
      'panic_episode': 10,
      'anxiety': 8,
      'stress': 7,
      'post_compulsion': 6,
      'low_mood': 5,
      'sleep_prep': 3,
      'morning_routine': 2,
      'maintenance': 1
    };
    
    return triggers.sort((a, b) => {
      const aPriority = priorityOrder[a.type] || 0;
      const bPriority = priorityOrder[b.type] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.confidence - a.confidence;
    })[0];
  }
  
  private isProtocolSuitable(
    userProtocol: BreathworkProtocol, 
    trigger: BreathworkTrigger,
    baseProtocol: BreathworkProtocol
  ): boolean {
    // Check if user protocol is reasonably effective for the trigger type
    const triggerTypeToEffectiveness = {
      'panic_episode': 'anxiety',
      'anxiety': 'anxiety',
      'stress': 'stress',
      'low_mood': 'mood',
      'sleep_prep': 'sleep',
      'post_compulsion': 'stress',
      'morning_routine': 'mood'
    };
    
    const effectivenessKey = triggerTypeToEffectiveness[trigger.type] || 'stress';
    const userEffectiveness = userProtocol.effectiveness[effectivenessKey];
    const baseEffectiveness = baseProtocol.effectiveness[effectivenessKey];
    
    // Allow user preference if it's at least 70% as effective as the base protocol
    return userEffectiveness >= (baseEffectiveness * 0.7);
  }
  
  private adaptProtocolToUser(protocol: BreathworkProtocol, userProfile: UserBreathworkProfile): BreathworkProtocol {
    const adapted = { ...protocol };
    
    // Adjust based on user's anxiety response rate
    if (userProfile.adaptations.anxietyResponseRate < 0.5) {
      // User doesn't respond well to standard protocols, make it gentler
      adapted.parameters.inhale = Math.max(adapted.parameters.inhale - 1, 3);
      adapted.parameters.exhale = Math.max(adapted.parameters.exhale - 1, 4);
    }
    
    // Adjust based on consistency score
    if (userProfile.adaptations.consistencyScore < 0.3) {
      // User has trouble completing sessions, make it shorter
      adapted.duration = Math.max(adapted.duration * 0.7, 120);
    }
    
    return adapted;
  }
  
  private createCustomization(userProfile: UserBreathworkProfile, trigger: BreathworkTrigger): BreathworkCustomization {
    return {
      voiceGuidance: true, // Default to true for guidance
      background: trigger.type === 'sleep_prep' ? 'nature' : 
                 trigger.type === 'panic_episode' ? 'silence' : 'music',
      hapticFeedback: trigger.type === 'panic_episode',
      visualCue: trigger.type === 'low_mood' ? 'nature_scene' : 'breathing_circle',
      adaptToProgress: userProfile.adaptations.consistencyScore > 0.7 // Only for consistent users
    };
  }
  
  private calculatePriority(urgency: string, trigger: BreathworkTrigger): number {
    const baseUrgency = {
      'critical': 10,
      'high': 8,
      'medium': 5,
      'low': 2
    }[urgency] || 2;
    
    const confidenceBonus = Math.round(trigger.confidence * 2);
    
    return Math.min(baseUrgency + confidenceBonus, 10);
  }
  
  private getFallbackProtocols(primary: BreathworkProtocol, trigger: BreathworkTrigger): BreathworkProtocol[] {
    const fallbacks = [];
    
    // Always include quick_calm as emergency fallback
    if (primary.name !== 'quick_calm') {
      fallbacks.push(BREATHWORK_PROTOCOLS['quick_calm']);
    }
    
    // Include protocol based on trigger type
    if (trigger.type === 'sleep_prep' && primary.name !== '4-7-8') {
      fallbacks.push(BREATHWORK_PROTOCOLS['4-7-8']);
    }
    
    return fallbacks.slice(0, 2); // Max 2 fallback options
  }
  
  private async saveSuggestion(suggestion: BreathworkSuggestion): Promise<void> {
    try {
      const storageKey = `breathwork_suggestion_${suggestion.metadata.userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(suggestion));
      
      // Update daily count
      const delayKey = `breathwork_delays_${suggestion.metadata.userId}`;
      const delayData = await AsyncStorage.getItem(delayKey);
      const delays = delayData ? JSON.parse(delayData) : {};
      
      const today = new Date().toDateString();
      if (!delays[today]) {
        delays[today] = { suggestionCount: 0, lastSuggestion: 0, snoozedUntil: 0, totalDelays: 0 };
      }
      
      delays[today].suggestionCount += 1;
      delays[today].lastSuggestion = Date.now();
      
      await AsyncStorage.setItem(delayKey, JSON.stringify(delays));
      
    } catch (error) {
      console.error('Failed to save suggestion:', error);
    }
  }
  
  private async trackSuggestion(event: string, data: any): Promise<void> {
    try {
      await trackAIInteraction(`breathwork_suggestion_${event}` as AIEventType, {
        ...data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn('Failed to track breathwork suggestion:', error);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const breathworkSuggestionService = BreathworkSuggestionService.getInstance();
