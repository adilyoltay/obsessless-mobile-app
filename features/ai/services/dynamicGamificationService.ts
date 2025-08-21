/**
 * 🎮 Dynamic Gamification Service
 * 
 * AI-powered adaptive gamification system with:
 * - Dynamic healing points calculation based on context & user progress
 * - AI-generated daily missions from user behavioral patterns
 * - Adaptive challenges that evolve with user journey
 * - Contextual bonuses and milestone rewards
 * - Personalized achievement generation
 * 
 * v2.1 - Week 2 Implementation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface DynamicMission {
  id: string;
  title: string;
  description: string;
  category: 'compulsion' | 'erp' | 'mood' | 'breathwork' | 'consistency' | 'challenge';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  targetValue: number;
  currentProgress: number;
  healingPoints: number;
  bonusMultiplier?: number;
  expiresAt: number;
  generatedFrom: string; // AI reasoning for mission creation
  personalizedMessage: string;
  aiGenerated: boolean;
  metadata: MissionMetadata;
}

export interface MissionMetadata {
  generatedAt: number;
  basePattern: string; // e.g., 'high_morning_compulsions'
  userLevel: number; // 1-10 difficulty adaptation
  contextFactors: string[];
  expectedDifficulty: number; // 0-1, how hard this should be
  aiConfidence: number; // 0-1, how confident AI is in this mission
  adaptationReasons: string[]; // Why this mission was chosen
}

export interface DynamicPointsCalculation {
  basePoints: number;
  contextMultipliers: {
    difficultyBonus: number;
    streakMultiplier: number;
    progressBonus: number;
    timingBonus: number;
    consistencyBonus: number;
    achievementMultiplier: number;
  };
  totalPoints: number;
  reasoning: string[];
  cappedAt?: number;
}

export interface UserGamificationProfile {
  userId: string;
  currentLevel: number; // 1-100
  totalHealingPoints: number;
  todayHealingPoints: number;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
  
  // Adaptation metrics
  adaptationProfile: {
    preferredDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
    consistencyScore: number; // 0-1
    challengeCompletionRate: number; // 0-1
    averageDailyEngagement: number; // minutes
    motivationalPreferences: string[]; // e.g., ['progress_focused', 'achievement_focused']
  };
  
  // Pattern analysis for mission generation
  behaviorPatterns: {
    peakActivityHours: number[];
    commonCompulsionTypes: string[];
    erpPreferences: string[];
    strugglingAreas: string[];
    improvementTrends: string[];
    lastAnalyzedAt: number;
  };
  
  // Current missions and achievements
  currentMissions: DynamicMission[];
  completedMissionsToday: number;
  weeklyMissionStreak: number;
  customAchievements: any[];
}

export interface MissionGenerationContext {
  userId: string;
  currentTime: Date;
  recentActivity: {
    compulsions: any[];
    erpSessions: any[];
    moodEntries: any[];
    breathworkSessions: any[];
  };
  userProfile: UserGamificationProfile;
  currentChallenges?: string[];
}

// =============================================================================
// DYNAMIC POINTS CALCULATION ENGINE
// =============================================================================

export class DynamicPointsEngine {
  /**
   * Calculate dynamic healing points based on context and user progress
   */
  static calculateDynamicPoints(
    action: string,
    context: any,
    userProfile: UserGamificationProfile
  ): DynamicPointsCalculation {
    // Base points for different actions
    const basePointsMap: Record<string, number> = {
      'compulsion_recorded': 8,
      'compulsion_resisted': 25,
      'erp_started': 15,
      'erp_completed': 30,
      'erp_breakthrough': 50,
      'mood_checkin': 5,
      'breathwork_completed': 20,
      'daily_goal_achieved': 100,
      'weekly_consistency': 150,
      'pattern_recognized': 35,
      'trigger_identified': 20,
      'coping_strategy_used': 40
    };
    
    const basePoints = basePointsMap[action] || 10;
    
    // Calculate contextual multipliers
    const contextMultipliers = this.calculateContextMultipliers(action, context, userProfile);
    
    // Apply multipliers
    let totalPoints = basePoints;
    Object.values(contextMultipliers).forEach(multiplier => {
      totalPoints *= multiplier;
    });
    
    // Round and apply caps
    totalPoints = Math.round(totalPoints);
    const cappedAt = this.getPointsCap(action, userProfile.currentLevel);
    if (totalPoints > cappedAt) {
      totalPoints = cappedAt;
    }
    
    // Generate reasoning
    const reasoning = this.generatePointsReasoning(basePoints, contextMultipliers, totalPoints, action);
    
    return {
      basePoints,
      contextMultipliers,
      totalPoints,
      reasoning,
      cappedAt: totalPoints >= cappedAt ? cappedAt : undefined
    };
  }
  
  private static calculateContextMultipliers(
    action: string,
    context: any,
    userProfile: UserGamificationProfile
  ): DynamicPointsCalculation['contextMultipliers'] {
    const multipliers = {
      difficultyBonus: 1.0,
      streakMultiplier: 1.0,
      progressBonus: 1.0,
      timingBonus: 1.0,
      consistencyBonus: 1.0,
      achievementMultiplier: 1.0
    };
    
    // 1. DIFFICULTY BONUS
    if (context.difficulty === 'hard') multipliers.difficultyBonus = 1.3;
    else if (context.difficulty === 'expert') multipliers.difficultyBonus = 1.5;
    else if (context.difficulty === 'easy') multipliers.difficultyBonus = 0.8;
    
    // High resistance gets extra bonus
    if (context.resistance && context.resistance >= 8) {
      multipliers.difficultyBonus += 0.2;
    }
    
    // 2. STREAK MULTIPLIER
    const streakBonus = Math.min(userProfile.currentStreak * 0.05, 0.5); // Max 50% bonus
    multipliers.streakMultiplier = 1 + streakBonus;
    
    // 3. PROGRESS BONUS (based on user level)
    if (userProfile.currentLevel <= 10) {
      multipliers.progressBonus = 1.2; // Newbie bonus
    } else if (userProfile.currentLevel >= 50) {
      multipliers.progressBonus = 0.9; // Veteran penalty to prevent inflation
    }
    
    // 4. TIMING BONUS
    const hour = new Date().getHours();
    if (action.includes('erp') && (hour >= 8 && hour <= 10)) {
      multipliers.timingBonus = 1.15; // Morning ERP bonus
    }
    if (action.includes('breathwork') && (hour >= 21 || hour <= 6)) {
      multipliers.timingBonus = 1.1; // Evening/night breathwork bonus
    }
    
    // 5. CONSISTENCY BONUS
    const consistencyScore = userProfile.adaptationProfile.consistencyScore;
    if (consistencyScore >= 0.8) {
      multipliers.consistencyBonus = 1.25; // High consistency bonus
    } else if (consistencyScore <= 0.3) {
      multipliers.consistencyBonus = 1.4; // Comeback bonus
    }
    
    // 6. ACHIEVEMENT MULTIPLIER (based on recent achievements)
    const todayAchievements = this.getTodayAchievementCount(userProfile);
    if (todayAchievements >= 3) {
      multipliers.achievementMultiplier = 1.2; // Achievement streak bonus
    }
    
    return multipliers;
  }
  
  private static getTodayAchievementCount(userProfile: UserGamificationProfile): number {
    // Simplified - would get from actual achievement data
    return userProfile.completedMissionsToday;
  }
  
  private static getPointsCap(action: string, userLevel: number): number {
    const baseCaps: Record<string, number> = {
      'compulsion_recorded': 20,
      'compulsion_resisted': 60,
      'erp_completed': 80,
      'erp_breakthrough': 150,
      'daily_goal_achieved': 300,
      'weekly_consistency': 500
    };
    
    const baseCap = baseCaps[action] || 50;
    
    // Higher level users get higher caps
    const levelMultiplier = 1 + (userLevel / 100);
    return Math.round(baseCap * levelMultiplier);
  }
  
  private static generatePointsReasoning(
    basePoints: number,
    multipliers: any,
    totalPoints: number,
    action: string
  ): string[] {
    const reasoning = [`Base: ${basePoints} points for ${action}`];
    
    if (multipliers.difficultyBonus > 1) {
      reasoning.push(`+${Math.round((multipliers.difficultyBonus - 1) * 100)}% difficulty bonus`);
    }
    if (multipliers.streakMultiplier > 1) {
      reasoning.push(`+${Math.round((multipliers.streakMultiplier - 1) * 100)}% streak bonus`);
    }
    if (multipliers.timingBonus > 1) {
      reasoning.push(`+${Math.round((multipliers.timingBonus - 1) * 100)}% perfect timing`);
    }
    if (multipliers.consistencyBonus > 1) {
      reasoning.push(`+${Math.round((multipliers.consistencyBonus - 1) * 100)}% consistency bonus`);
    }
    
    reasoning.push(`Total: ${totalPoints} healing points ✨`);
    
    return reasoning;
  }
}

// =============================================================================
// AI MISSION GENERATION ENGINE
// =============================================================================

export class AIMissionGenerator {
  /**
   * Generate personalized daily missions based on user patterns
   */
  static async generateDailyMissions(
    context: MissionGenerationContext
  ): Promise<DynamicMission[]> {
    try {
      const missions: DynamicMission[] = [];
      
      // 1. Analyze user patterns
      const patternAnalysis = this.analyzeUserPatterns(context);
      
      // 2. Generate 2-4 missions based on patterns
      const missionCount = this.calculateOptimalMissionCount(context.userProfile);
      
      for (let i = 0; i < missionCount; i++) {
        const mission = await this.generateSingleMission(context, patternAnalysis, i);
        if (mission) {
          missions.push(mission);
        }
      }
      
      // 3. Ensure mission diversity
      const diversifiedMissions = this.ensureMissionDiversity(missions);
      
      return diversifiedMissions;
      
    } catch (error) {
      console.error('AI Mission generation failed:', error);
      return this.generateFallbackMissions(context);
    }
  }
  
  private static analyzeUserPatterns(context: MissionGenerationContext): any {
    const { recentActivity, userProfile } = context;
    const patterns = userProfile.behaviorPatterns;
    
    const analysis = {
      // Compulsion patterns
      highCompulsionTimes: patterns.peakActivityHours || [],
      commonCompulsions: patterns.commonCompulsionTypes || [],
      recentCompulsionTrend: this.analyzeCompulsionTrend(recentActivity.compulsions),
      
      // ERP patterns
      erpConsistency: this.calculateERPConsistency(recentActivity.erpSessions),
      preferredERPTypes: patterns.erpPreferences || [],
      erpSuccessRate: this.calculateERPSuccessRate(recentActivity.erpSessions),
      
      // Mood & engagement patterns
      lowMoodTimes: this.identifyLowMoodPatterns(recentActivity.moodEntries),
      engagementLevel: userProfile.adaptationProfile.averageDailyEngagement,
      
      // Struggling areas
      needsImprovement: patterns.strugglingAreas || [],
      recentBreakthroughs: patterns.improvementTrends || [],
      
      // Meta patterns
      consistency: userProfile.adaptationProfile.consistencyScore,
      challengeCompletion: userProfile.adaptationProfile.challengeCompletionRate,
      currentLevel: userProfile.currentLevel
    };
    
    return analysis;
  }
  
  private static async generateSingleMission(
    context: MissionGenerationContext,
    analysis: any,
    missionIndex: number
  ): Promise<DynamicMission | null> {
    const missionTypes = [
      'consistency_challenge',
      'resistance_building', 
      'erp_progression',
      'pattern_awareness',
      'mood_improvement',
      'breakthrough_attempt'
    ];
    
    // Select mission type based on user needs and patterns
    const missionType = this.selectMissionType(analysis, missionIndex);
    
    switch (missionType) {
      case 'consistency_challenge':
        return this.generateConsistencyMission(context, analysis);
      
      case 'resistance_building':
        return this.generateResistanceMission(context, analysis);
      
      case 'erp_progression':
        return this.generateERPMission(context, analysis);
      
      case 'pattern_awareness':
        return this.generatePatternAwarenessMission(context, analysis);
      
      case 'mood_improvement':
        return this.generateMoodMission(context, analysis);
      
      case 'breakthrough_attempt':
        return this.generateBreakthroughMission(context, analysis);
      
      default:
        return null;
    }
  }
  
  private static generateConsistencyMission(context: MissionGenerationContext, analysis: any): DynamicMission {
    const userLevel = context.userProfile.currentLevel;
    const consistency = analysis.consistency;
    
    // Adapt target based on user's current consistency
    let targetValue = 3; // Default: 3 consecutive days
    let difficulty: DynamicMission['difficulty'] = 'medium';
    
    if (consistency < 0.3) {
      targetValue = 2;
      difficulty = 'easy';
    } else if (consistency > 0.7) {
      targetValue = 5;
      difficulty = 'hard';
    }
    
    const healingPoints = this.calculateMissionPoints('consistency', difficulty, userLevel);
    
    return {
      id: `consistency_${Date.now()}`,
      title: '🎯 Süreklilik Ustası',
      description: `${targetValue} gün üst üste uygulama kullanarak süreklilik becerini güçlendir.`,
      category: 'consistency',
      difficulty,
      targetValue,
      currentProgress: Math.min(context.userProfile.currentStreak, targetValue),
      healingPoints,
      bonusMultiplier: 1.2,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      generatedFrom: `Consistency score: ${consistency.toFixed(2)}, current streak: ${context.userProfile.currentStreak}`,
      personalizedMessage: consistency < 0.5 ? 
        'Küçük adımlarla büyük değişimler yaratabilirsin! Her gün biraz ilerleme.' :
        'Süreklilik konusunda harikasın! Bu momentum\'u sürdür.',
      aiGenerated: true,
      metadata: {
        generatedAt: Date.now(),
        basePattern: 'consistency_analysis',
        userLevel,
        contextFactors: ['current_streak', 'consistency_score'],
        expectedDifficulty: difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.6 : 0.8,
        aiConfidence: 0.9,
        adaptationReasons: [`User consistency: ${consistency.toFixed(2)}`, `Current streak: ${context.userProfile.currentStreak}`]
      }
    };
  }
  
  private static generateResistanceMission(context: MissionGenerationContext, analysis: any): DynamicMission {
    const commonCompulsions = analysis.commonCompulsions;
    const trend = analysis.recentCompulsionTrend;
    const userLevel = context.userProfile.currentLevel;
    
    // Adapt based on recent compulsion trends
    let targetValue = 3;
    let difficulty: DynamicMission['difficulty'] = 'medium';
    
    if (trend === 'increasing') {
      targetValue = 2;
      difficulty = 'hard'; // Harder because user is struggling
    } else if (trend === 'decreasing') {
      targetValue = 5;
      difficulty = 'easy'; // Easier because user is improving
    }
    
    const primaryCompulsion = commonCompulsions[0] || 'kompulsiyonlara';
    const healingPoints = this.calculateMissionPoints('resistance', difficulty, userLevel);
    
    return {
      id: `resistance_${Date.now()}`,
      title: '💪 Direnç Gücü',
      description: `Bugün ${targetValue} kez ${primaryCompulsion} karşısında direnerek iç gücünü göster.`,
      category: 'compulsion',
      difficulty,
      targetValue,
      currentProgress: 0,
      healingPoints,
      bonusMultiplier: trend === 'increasing' ? 1.5 : 1.2,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 1 day
      generatedFrom: `Primary compulsion: ${primaryCompulsion}, recent trend: ${trend}`,
      personalizedMessage: trend === 'increasing' ? 
        'Son zamanlarda zorluk yaşadığını fark ediyorum. Bu görev senin için özel olarak hazırlandı.' :
        'Direncin artıyor! Bu momentum ile daha büyük hedeflere ulaşabilirsin.',
      aiGenerated: true,
      metadata: {
        generatedAt: Date.now(),
        basePattern: 'compulsion_resistance',
        userLevel,
        contextFactors: ['compulsion_trend', 'common_types'],
        expectedDifficulty: difficulty === 'easy' ? 0.4 : difficulty === 'medium' ? 0.6 : 0.8,
        aiConfidence: 0.85,
        adaptationReasons: [`Compulsion trend: ${trend}`, `Primary type: ${primaryCompulsion}`]
      }
    };
  }
  
  private static generateERPMission(context: MissionGenerationContext, analysis: any): DynamicMission {
    const successRate = analysis.erpSuccessRate;
    const consistency = analysis.erpConsistency;
    const userLevel = context.userProfile.currentLevel;
    
    // Adapt ERP challenge based on success patterns
    let targetValue = 1;
    let difficulty: DynamicMission['difficulty'] = 'medium';
    let missionFocus = 'completion';
    
    if (successRate < 0.4) {
      missionFocus = 'attempt';
      difficulty = 'easy';
    } else if (successRate > 0.8) {
      targetValue = 2;
      missionFocus = 'advanced';
      difficulty = 'hard';
    }
    
    const healingPoints = this.calculateMissionPoints('erp', difficulty, userLevel);
    
    const titles = {
      attempt: '🌱 ERP Denemesi',
      completion: '🛡️ ERP Ustası', 
      advanced: '⚡ ERP Kahramanı'
    };
    
    const descriptions = {
      attempt: 'Bir ERP egzersizini deneyerek korku zincirininde bir halka kır.',
      completion: 'Bir ERP egzersizini başarıyla tamamla ve habitüasyonu gözlemle.',
      advanced: `${targetValue} farklı ERP egzersizi yaparak cesaret sınırlarını zorla.`
    };
    
    return {
      id: `erp_${Date.now()}`,
      title: titles[missionFocus],
      description: descriptions[missionFocus],
      category: 'erp',
      difficulty,
      targetValue,
      currentProgress: 0,
      healingPoints,
      bonusMultiplier: missionFocus === 'attempt' ? 1.3 : 1.0,
      expiresAt: Date.now() + (2 * 24 * 60 * 60 * 1000), // 2 days
      generatedFrom: `ERP success rate: ${successRate.toFixed(2)}, consistency: ${consistency.toFixed(2)}`,
      personalizedMessage: successRate < 0.4 ? 
        'ERP zor gelebilir, ama her deneme bir zafer! Adım adım ilerle.' :
        'ERP konusunda başarılısın! Bu güçlü yanını daha da geliştir.',
      aiGenerated: true,
      metadata: {
        generatedAt: Date.now(),
        basePattern: 'erp_performance',
        userLevel,
        contextFactors: ['success_rate', 'consistency'],
        expectedDifficulty: missionFocus === 'attempt' ? 0.3 : missionFocus === 'completion' ? 0.6 : 0.8,
        aiConfidence: 0.8,
        adaptationReasons: [`Success rate: ${successRate.toFixed(2)}`, `Focus: ${missionFocus}`]
      }
    };
  }
  
  private static generatePatternAwarenessMission(context: MissionGenerationContext, analysis: any): DynamicMission {
    const needsImprovement = analysis.needsImprovement;
    const userLevel = context.userProfile.currentLevel;
    
    const focusArea = needsImprovement[0] || 'tetikleyici tanıma';
    const healingPoints = this.calculateMissionPoints('awareness', 'medium', userLevel);
    
    return {
      id: `pattern_${Date.now()}`,
      title: '🔍 Kalıp Dedektifi',
      description: `${focusArea} konusunda 3 farklı kalıp/tetik fark ederek farkındalığını artır.`,
      category: 'challenge',
      difficulty: 'medium',
      targetValue: 3,
      currentProgress: 0,
      healingPoints,
      bonusMultiplier: 1.1,
      expiresAt: Date.now() + (3 * 24 * 60 * 60 * 1000), // 3 days
      generatedFrom: `Focus area: ${focusArea} from struggling areas analysis`,
      personalizedMessage: `${focusArea} alanında gelişime açık olduğunu görüyorum. Bu farkındalık egzersizi sana yardımcı olacak.`,
      aiGenerated: true,
      metadata: {
        generatedAt: Date.now(),
        basePattern: 'pattern_awareness',
        userLevel,
        contextFactors: ['struggling_areas'],
        expectedDifficulty: 0.5,
        aiConfidence: 0.75,
        adaptationReasons: [`Focus: ${focusArea}`, 'Pattern awareness building']
      }
    };
  }
  
  private static generateMoodMission(context: MissionGenerationContext, analysis: any): DynamicMission {
    const lowMoodTimes = analysis.lowMoodTimes;
    const userLevel = context.userProfile.currentLevel;
    
    const healingPoints = this.calculateMissionPoints('mood', 'easy', userLevel);
    
    return {
      id: `mood_${Date.now()}`,
      title: '🌈 Ruh Hali Ustası',
      description: 'Günde 2 kez mood check-in yaparak duygusal farkındalığını güçlendir.',
      category: 'mood',
      difficulty: 'easy',
      targetValue: 2,
      currentProgress: 0,
      healingPoints,
      bonusMultiplier: 1.0,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 1 day
      generatedFrom: `Low mood patterns detected at times: ${lowMoodTimes.join(', ')}`,
      personalizedMessage: 'Duygularını takip etmek, onları anlayıp yönetmek için ilk adım. Kendine şefkat göster.',
      aiGenerated: true,
      metadata: {
        generatedAt: Date.now(),
        basePattern: 'mood_tracking',
        userLevel,
        contextFactors: ['low_mood_patterns'],
        expectedDifficulty: 0.3,
        aiConfidence: 0.9,
        adaptationReasons: ['Mood awareness building', 'Daily check-in habit']
      }
    };
  }
  
  private static generateBreakthroughMission(context: MissionGenerationContext, analysis: any): DynamicMission {
    const userLevel = context.userProfile.currentLevel;
    const challengeCompletion = analysis.challengeCompletion;
    
    // High-challenge mission for users ready for breakthrough
    const healingPoints = this.calculateMissionPoints('breakthrough', 'expert', userLevel);
    
    return {
      id: `breakthrough_${Date.now()}`,
      title: '⚡ Sınır Aşan',
      description: 'Bugüne kadar yapmaya cesaret edemediğin bir şeyi yaparak comfort zone\'unu genişlet.',
      category: 'challenge',
      difficulty: 'expert',
      targetValue: 1,
      currentProgress: 0,
      healingPoints,
      bonusMultiplier: 2.0,
      expiresAt: Date.now() + (5 * 24 * 60 * 60 * 1000), // 5 days
      generatedFrom: `User ready for breakthrough based on challenge completion rate: ${challengeCompletion}`,
      personalizedMessage: 'Büyük atılımlara hazır olduğunu hissediyorum. Bu görev senin potansiyelini ortaya çıkaracak.',
      aiGenerated: true,
      metadata: {
        generatedAt: Date.now(),
        basePattern: 'breakthrough_readiness',
        userLevel,
        contextFactors: ['challenge_completion_rate', 'user_level'],
        expectedDifficulty: 0.9,
        aiConfidence: 0.7,
        adaptationReasons: [`Challenge completion: ${challengeCompletion.toFixed(2)}`, 'Breakthrough opportunity']
      }
    };
  }
  
  // Helper methods
  private static selectMissionType(analysis: any, missionIndex: number): string {
    const types = ['consistency_challenge', 'resistance_building', 'erp_progression', 'pattern_awareness', 'mood_improvement', 'breakthrough_attempt'];
    
    // Intelligent selection based on user needs
    if (analysis.consistency < 0.4) return 'consistency_challenge';
    if (analysis.recentCompulsionTrend === 'increasing') return 'resistance_building';
    if (analysis.erpConsistency < 0.5) return 'erp_progression';
    if (analysis.challengeCompletion > 0.8 && analysis.currentLevel > 20) return 'breakthrough_attempt';
    
    // Fallback to round-robin
    return types[missionIndex % types.length];
  }
  
  private static calculateOptimalMissionCount(userProfile: UserGamificationProfile): number {
    const engagementLevel = userProfile.adaptationProfile.averageDailyEngagement;
    const level = userProfile.currentLevel;
    
    if (engagementLevel < 10 || level < 5) return 2; // New users: fewer missions
    if (engagementLevel > 30 && level > 20) return 4; // Engaged users: more missions
    return 3; // Default
  }
  
  private static ensureMissionDiversity(missions: DynamicMission[]): DynamicMission[] {
    // Ensure no duplicate categories
    const seen = new Set();
    return missions.filter(mission => {
      if (seen.has(mission.category)) return false;
      seen.add(mission.category);
      return true;
    });
  }
  
  private static calculateMissionPoints(type: string, difficulty: DynamicMission['difficulty'], userLevel: number): number {
    const basePoints = {
      consistency: 60,
      resistance: 40,
      erp: 50,
      awareness: 35,
      mood: 25,
      breakthrough: 100
    };
    
    const difficultyMultipliers = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.3,
      expert: 1.6
    };
    
    const base = basePoints[type] || 30;
    const difficultyBonus = difficultyMultipliers[difficulty];
    const levelBonus = 1 + (userLevel / 100);
    
    return Math.round(base * difficultyBonus * levelBonus);
  }
  
  private static generateFallbackMissions(context: MissionGenerationContext): DynamicMission[] {
    // Simple fallback missions when AI generation fails
    return [
      {
        id: `fallback_daily_${Date.now()}`,
        title: '🎯 Günlük Hedef',
        description: 'Bugün 1 kompulsiyonunu kaydet ve 1 nefes egzersizi yap.',
        category: 'consistency',
        difficulty: 'easy',
        targetValue: 2,
        currentProgress: 0,
        healingPoints: 30,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        generatedFrom: 'Fallback mission due to AI generation failure',
        personalizedMessage: 'Bugün küçük ama anlamlı adımlar atarak kendine bakım vermeye odaklan.',
        aiGenerated: false,
        metadata: {
          generatedAt: Date.now(),
          basePattern: 'fallback',
          userLevel: context.userProfile.currentLevel,
          contextFactors: [],
          expectedDifficulty: 0.3,
          aiConfidence: 0.5,
          adaptationReasons: ['Fallback due to AI failure']
        }
      }
    ];
  }
  
  // Pattern analysis helper methods
  private static analyzeCompulsionTrend(compulsions: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (!compulsions || compulsions.length < 6) return 'stable';
    
    const recent = compulsions.slice(-3).length;
    const older = compulsions.slice(-6, -3).length;
    
    if (recent > older * 1.5) return 'increasing';
    if (recent < older * 0.5) return 'decreasing';
    return 'stable';
  }
  
  private static calculateERPConsistency(erpSessions: any[]): number {
    if (!erpSessions || erpSessions.length === 0) return 0;
    
    const completedSessions = erpSessions.filter(session => session.completed).length;
    return completedSessions / erpSessions.length;
  }
  
  private static calculateERPSuccessRate(erpSessions: any[]): number {
    if (!erpSessions || erpSessions.length === 0) return 0;
    
    const successfulSessions = erpSessions.filter(session => 
      session.completed && (session.anxietyReduction || 0) >= 20
    ).length;
    
    return successfulSessions / erpSessions.length;
  }
  
  private static identifyLowMoodPatterns(moodEntries: any[]): number[] {
    if (!moodEntries || moodEntries.length === 0) return [];
    
    const lowMoodTimes: number[] = [];
    moodEntries.forEach(entry => {
      if (entry.mood <= 4 && entry.timestamp) {
        const hour = new Date(entry.timestamp).getHours();
        if (!lowMoodTimes.includes(hour)) {
          lowMoodTimes.push(hour);
        }
      }
    });
    
    return lowMoodTimes.sort();
  }
}

// =============================================================================
// MAIN DYNAMIC GAMIFICATION SERVICE
// =============================================================================

export class DynamicGamificationService {
  private static instance: DynamicGamificationService;
  
  public static getInstance(): DynamicGamificationService {
    if (!DynamicGamificationService.instance) {
      DynamicGamificationService.instance = new DynamicGamificationService();
    }
    return DynamicGamificationService.instance;
  }
  
  /**
   * Award dynamic points for an action with contextual calculation
   */
  async awardDynamicPoints(
    userId: string,
    action: string,
    context: any = {}
  ): Promise<DynamicPointsCalculation> {
    try {
      if (!FEATURE_FLAGS.isEnabled('AI_DYNAMIC_GAMIFICATION')) {
        return this.awardStaticPoints(action);
      }
      
      // Load user profile
      const userProfile = await this.getUserProfile(userId);
      
      // Calculate dynamic points
      const pointsCalculation = DynamicPointsEngine.calculateDynamicPoints(action, context, userProfile);
      
      // Update user profile
      userProfile.todayHealingPoints += pointsCalculation.totalPoints;
      userProfile.totalHealingPoints += pointsCalculation.totalPoints;
      userProfile.lastActiveDate = new Date().toISOString().split('T')[0];
      
      await this.saveUserProfile(userProfile);
      
      // Track the dynamic points award
      await trackAIInteraction('gamification_dynamic_points_awarded' as AIEventType, {
        userId,
        action,
        basePoints: pointsCalculation.basePoints,
        totalPoints: pointsCalculation.totalPoints,
        multipliers: pointsCalculation.contextMultipliers,
        reasoning: pointsCalculation.reasoning
      });
      
      return pointsCalculation;
      
    } catch (error) {
      console.error('Dynamic points calculation failed:', error);
      return this.awardStaticPoints(action);
    }
  }
  
  /**
   * Generate daily missions for user
   */
  async generateDailyMissions(userId: string): Promise<DynamicMission[]> {
    try {
      if (!FEATURE_FLAGS.isEnabled('AI_DYNAMIC_MISSIONS')) {
        return [];
      }
      
      const userProfile = await this.getUserProfile(userId);
      
      // Don't generate if user already has missions for today
      const today = new Date().toISOString().split('T')[0];
      const hasTodasMissions = userProfile.currentMissions.some(mission => 
        new Date(mission.metadata.generatedAt).toISOString().split('T')[0] === today
      );
      
      if (hasTodasMissions) {
        return userProfile.currentMissions.filter(mission => mission.expiresAt > Date.now());
      }
      
      // Load recent activity for context
      const recentActivity = await this.loadRecentActivity(userId);
      
      const context: MissionGenerationContext = {
        userId,
        currentTime: new Date(),
        recentActivity,
        userProfile
      };
      
      // Generate AI-powered missions
      const missions = await AIMissionGenerator.generateDailyMissions(context);
      
      // Update user profile with new missions
      userProfile.currentMissions = [...userProfile.currentMissions.filter(m => m.expiresAt > Date.now()), ...missions];
      await this.saveUserProfile(userProfile);
      
      // Track mission generation
      await trackAIInteraction('gamification_missions_generated' as AIEventType, {
        userId,
        missionCount: missions.length,
        aiGenerated: missions.filter(m => m.aiGenerated).length,
        categories: missions.map(m => m.category),
        difficulties: missions.map(m => m.difficulty)
      });
      
      return missions;
      
    } catch (error) {
      console.error('Daily mission generation failed:', error);
      return [];
    }
  }
  
  /**
   * Update mission progress
   */
  async updateMissionProgress(userId: string, missionId: string, progressIncrement: number = 1): Promise<boolean> {
    try {
      const userProfile = await this.getUserProfile(userId);
      const mission = userProfile.currentMissions.find(m => m.id === missionId);
      
      if (!mission || mission.expiresAt < Date.now()) {
        return false;
      }
      
      mission.currentProgress += progressIncrement;
      
      // Check if mission completed
      if (mission.currentProgress >= mission.targetValue) {
        // Award mission completion points
        const bonusPoints = Math.round(mission.healingPoints * (mission.bonusMultiplier || 1));
        userProfile.todayHealingPoints += bonusPoints;
        userProfile.totalHealingPoints += bonusPoints;
        userProfile.completedMissionsToday += 1;
        
        // Remove completed mission
        userProfile.currentMissions = userProfile.currentMissions.filter(m => m.id !== missionId);
        
        await trackAIInteraction('gamification_mission_completed' as AIEventType, {
          userId,
          missionId: mission.id,
          category: mission.category,
          difficulty: mission.difficulty,
          bonusPoints,
          aiGenerated: mission.aiGenerated
        });
      }
      
      await this.saveUserProfile(userProfile);
      return true;
      
    } catch (error) {
      console.error('Mission progress update failed:', error);
      return false;
    }
  }
  
  // Helper methods
  private async getUserProfile(userId: string): Promise<UserGamificationProfile> {
    try {
      const storageKey = `dynamic_gamification_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Create default profile
      return this.createDefaultProfile(userId);
      
    } catch (error) {
      console.error('Failed to load gamification profile:', error);
      return this.createDefaultProfile(userId);
    }
  }
  
  private async saveUserProfile(profile: UserGamificationProfile): Promise<void> {
    try {
      const storageKey = `dynamic_gamification_${profile.userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to save gamification profile:', error);
    }
  }
  
  private createDefaultProfile(userId: string): UserGamificationProfile {
    return {
      userId,
      currentLevel: 1,
      totalHealingPoints: 0,
      todayHealingPoints: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastActiveDate: new Date().toISOString().split('T')[0],
      adaptationProfile: {
        preferredDifficulty: 'medium',
        consistencyScore: 0.5,
        challengeCompletionRate: 0.5,
        averageDailyEngagement: 15,
        motivationalPreferences: ['progress_focused']
      },
      behaviorPatterns: {
        peakActivityHours: [],
        commonCompulsionTypes: [],
        erpPreferences: [],
        strugglingAreas: [],
        improvementTrends: [],
        lastAnalyzedAt: 0
      },
      currentMissions: [],
      completedMissionsToday: 0,
      weeklyMissionStreak: 0,
      customAchievements: []
    };
  }
  
  private async loadRecentActivity(userId: string): Promise<MissionGenerationContext['recentActivity']> {
    // This would load actual user activity from AsyncStorage/Supabase
    // For now, return empty structure
    return {
      compulsions: [],
      erpSessions: [],
      moodEntries: [],
      breathworkSessions: []
    };
  }
  
  private awardStaticPoints(action: string): DynamicPointsCalculation {
    const staticPoints = {
      'compulsion_recorded': 10,
      'erp_completed': 20,
      'mood_checkin': 5
    };
    
    const points = staticPoints[action] || 10;
    
    return {
      basePoints: points,
      contextMultipliers: {
        difficultyBonus: 1,
        streakMultiplier: 1,
        progressBonus: 1,
        timingBonus: 1,
        consistencyBonus: 1,
        achievementMultiplier: 1
      },
      totalPoints: points,
      reasoning: [`Static points for ${action}: ${points}`]
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const dynamicGamificationService = DynamicGamificationService.getInstance();
