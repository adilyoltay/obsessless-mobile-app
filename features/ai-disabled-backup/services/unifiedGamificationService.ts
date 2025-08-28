/**
 * 🎮 Unified Gamification Service
 * 
 * Consolidated gamification system that includes:
 * - Dynamic AI-powered adaptive gamification from dynamicGamificationService
 * - Mood-specific scoring and achievements from moodGamificationService
 * - Unified points calculation with contextual multipliers
 * - Achievement system with progression tracking
 * - Dynamic missions and challenges
 * - Cross-module gamification (mood, compulsion, breathwork) // ✅ REMOVED: ERP
 * 
 * Created: Jan 2025 - Consolidation of multiple gamification services
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { MoodEntry } from '@/services/moodTrackingService';

// =============================================================================
// TYPES AND INTERFACES (Unified from both services)
// =============================================================================

export interface UnifiedPointsCalculation {
  basePoints: number;
  contextMultipliers: {
    difficultyBonus: number;
    streakMultiplier: number;
    progressBonus: number;
    timingBonus: number;
    consistencyBonus: number;
    achievementMultiplier: number;
    honestyBonus?: number;      // From mood gamification
    improvementBonus?: number;  // From mood gamification
    detailBonus?: number;       // From mood gamification
  };
  totalPoints: number;
  reasoning: string[];
  breakdown?: {
    reason: string;
    points: number;
  }[];
  cappedAt?: number;
}

export interface UnifiedMission {
  id: string;
  title: string;
  description: string;
  category: 'compulsion' | 'mood' | 'breathwork' | 'consistency' | 'challenge'; // ✅ REMOVED: 'erp'
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  targetValue: number;
  currentProgress: number;
  healingPoints: number;
  bonusMultiplier?: number;
  expiresAt: number;
  generatedFrom: string;
  personalizedMessage: string;
  aiGenerated: boolean;
  metadata: MissionMetadata;
}

export interface MissionMetadata {
  generatedAt: number;
  basePattern: string;
  userLevel: number;
  contextFactors: string[];
  expectedDifficulty: number;
  aiConfidence: number;
  adaptationReasons: string[];
}

export interface UnifiedAchievement {
  id: string;
  name: string;
  description: string;
  badge: string;
  points: number;
  category: 'tracking' | 'consistency' | 'improvement' | 'insight' | 'milestone' | 'resistance' | 'mindfulness';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  condition: (history: any[], stats: any, context?: any) => boolean;
  progress?: {
    current: number;
    target: number;
    percentage: number;
  };
  unlockedAt?: Date;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface UnifiedChallenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  difficulty: 'easy' | 'medium' | 'hard';
  targetValue: number;
  currentProgress: number;
  reward: {
    points: number;
    badge?: string;
    title?: string;
  };
  expiresAt: Date;
  completed: boolean;
}

export interface UnifiedGamificationProfile {
  userId: string;
  currentLevel: number;
  totalHealingPoints: number;
  todayHealingPoints: number;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
  
  // Adaptation metrics (from dynamic service)
  adaptationProfile: {
    preferredDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
    consistencyScore: number;
    challengeCompletionRate: number;
    averageDailyEngagement: number;
    motivationalPreferences: string[];
  };
  
  // Pattern analysis for mission generation
  behaviorPatterns: {
    peakActivityHours: number[];
    commonCompulsionTypes: string[];
    // ✅ REMOVED: erpPreferences - ERP module deleted
    strugglingAreas: string[];
    improvementTrends: string[];
    moodPatterns?: {
      averageMood: number;
      improvementRate: number;
      lowMoodTimes: number[];
    };
    lastAnalyzedAt: number;
  };
  
  // Current missions and achievements
  currentMissions: UnifiedMission[];
  completedMissionsToday: number;
  weeklyMissionStreak: number;
  customAchievements: UnifiedAchievement[];
}

export interface GamificationContext {
  userId: string;
  currentTime: Date;
  recentActivity: {
    compulsions: any[];
    // ✅ REMOVED: erpSessions - ERP module deleted
    moodEntries: any[];
    breathworkSessions: any[];
  };
  userProfile: UnifiedGamificationProfile;
  currentChallenges?: string[];
}

// =============================================================================
// UNIFIED POINTS CALCULATION ENGINE
// =============================================================================

export class UnifiedPointsEngine {
  /**
   * Calculate unified healing points with context from all modules
   */
  static calculateUnifiedPoints(
    action: string,
    context: any,
    userProfile: UnifiedGamificationProfile,
    moduleData?: { moodEntry?: MoodEntry; compulsionData?: any } // ✅ REMOVED: erpData
  ): UnifiedPointsCalculation {
    // Base points for different actions (consolidated from both services)
    const basePointsMap: Record<string, number> = {
      // Compulsion related
      'compulsion_recorded': 10,
      'compulsion_resisted': 25,
      'high_resistance': 15,
      
      // ✅ REMOVED: ERP therapy related points - ERP module deleted
      
      // Mood related
      'mood_checkin': 10,
      'mood_improvement': 20,
      'honest_low_mood': 15,
      
      // Breathwork related
      'breathwork_completed': 20,
      
      // General achievements
      'daily_goal_achieved': 100,
      'weekly_consistency': 150,
      'pattern_recognized': 35,
      'trigger_identified': 20,
      'coping_strategy_used': 40
    };
    
    const basePoints = basePointsMap[action] || 10;
    
    // Calculate contextual multipliers
    const contextMultipliers = this.calculateUnifiedMultipliers(action, context, userProfile, moduleData);
    
    // Calculate breakdown for transparency
    const breakdown: { reason: string; points: number }[] = [];
    breakdown.push({ reason: `Base ${action}`, points: basePoints });
    
    // Apply multipliers and track reasoning
    let totalPoints = basePoints;
    Object.entries(contextMultipliers).forEach(([key, multiplier]) => {
      if (multiplier > 1 && key !== 'difficultyBonus') {
        const bonusPoints = Math.round(basePoints * (multiplier - 1));
        if (bonusPoints > 0) {
          breakdown.push({ 
            reason: this.getMultiplierDescription(key), 
            points: bonusPoints 
          });
          totalPoints += bonusPoints;
        }
      }
    });
    
    // Apply difficulty bonus last
    totalPoints *= contextMultipliers.difficultyBonus;
    if (contextMultipliers.difficultyBonus > 1) {
      breakdown.push({ 
        reason: `Zorluk bonusu (${Math.round((contextMultipliers.difficultyBonus - 1) * 100)}%)`, 
        points: Math.round(basePoints * (contextMultipliers.difficultyBonus - 1))
      });
    }
    
    // Round and apply caps
    totalPoints = Math.round(totalPoints);
    const cappedAt = this.getPointsCap(action, userProfile.currentLevel);
    if (totalPoints > cappedAt) {
      totalPoints = cappedAt;
    }
    
    // Generate reasoning
    const reasoning = this.generateUnifiedReasoning(basePoints, contextMultipliers, totalPoints, action);
    
    return {
      basePoints,
      contextMultipliers,
      totalPoints,
      reasoning,
      breakdown,
      cappedAt: totalPoints >= cappedAt ? cappedAt : undefined
    };
  }
  
  private static calculateUnifiedMultipliers(
    action: string,
    context: any,
    userProfile: UnifiedGamificationProfile,
    moduleData?: any
  ): UnifiedPointsCalculation['contextMultipliers'] {
    const multipliers = {
      difficultyBonus: 1.0,
      streakMultiplier: 1.0,
      progressBonus: 1.0,
      timingBonus: 1.0,
      consistencyBonus: 1.0,
      achievementMultiplier: 1.0,
      honestyBonus: 1.0,
      improvementBonus: 1.0,
      detailBonus: 1.0
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
    const streakBonus = Math.min(userProfile.currentStreak * 0.05, 0.5);
    multipliers.streakMultiplier = 1 + streakBonus;
    
    // 3. PROGRESS BONUS (based on user level)
    if (userProfile.currentLevel <= 10) {
      multipliers.progressBonus = 1.2; // Newbie bonus
    } else if (userProfile.currentLevel >= 50) {
      multipliers.progressBonus = 0.9; // Veteran penalty
    }
    
    // 4. TIMING BONUS
    const hour = new Date().getHours();
    // ✅ REMOVED: ERP timing bonus - ERP module deleted
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
    
    // 6. MOOD-SPECIFIC BONUSES (from mood gamification)
    if (action.includes('mood') && moduleData?.moodEntry) {
      const moodEntry = moduleData.moodEntry;
      
      // Honesty bonus for low mood tracking
      if (moodEntry.mood_score < 40) {
        multipliers.honestyBonus = 1.5; // 50% bonus for honest low mood tracking
      }
      
      // Detail bonus for comprehensive mood tracking
      let detailMultiplier = 1.0;
      if (moodEntry.notes && moodEntry.notes.length > 20) detailMultiplier += 0.3;
      if (moodEntry.triggers && moodEntry.triggers.length > 0) detailMultiplier += 0.2;
      if (moodEntry.activities && moodEntry.activities.length > 0) detailMultiplier += 0.2;
      multipliers.detailBonus = detailMultiplier;
    }
    
    // 7. ACHIEVEMENT MULTIPLIER
    const todayAchievements = userProfile.completedMissionsToday;
    if (todayAchievements >= 3) {
      multipliers.achievementMultiplier = 1.2;
    }
    
    return multipliers;
  }
  
  private static getMultiplierDescription(key: string): string {
    const descriptions: Record<string, string> = {
      streakMultiplier: 'Seri bonusu',
      progressBonus: 'İlerleme bonusu',
      timingBonus: 'Zamanlama bonusu',
      consistencyBonus: 'Tutarlılık bonusu',
      achievementMultiplier: 'Başarı bonusu',
      honestyBonus: 'Dürüstlük bonusu',
      improvementBonus: 'İyileşme bonusu',
      detailBonus: 'Detay bonusu'
    };
    return descriptions[key] || key;
  }
  
  private static getPointsCap(action: string, userLevel: number): number {
    const baseCaps: Record<string, number> = {
      'compulsion_recorded': 30,
      'compulsion_resisted': 60,
      // ✅ REMOVED: ERP achievements - ERP module deleted
      'mood_checkin': 40,
      'mood_improvement': 60,
      'breathwork_completed': 50,
      'daily_goal_achieved': 300,
      'weekly_consistency': 500
    };
    
    const baseCap = baseCaps[action] || 50;
    
    // Higher level users get higher caps
    const levelMultiplier = 1 + (userLevel / 100);
    return Math.round(baseCap * levelMultiplier);
  }
  
  private static generateUnifiedReasoning(
    basePoints: number,
    multipliers: any,
    totalPoints: number,
    action: string
  ): string[] {
    const reasoning = [`Base: ${basePoints} points`];
    
    Object.entries(multipliers).forEach(([key, value]) => {
      const multiplier = value as number;
      if (multiplier > 1.05) {
        const percentage = Math.round((multiplier - 1) * 100);
        reasoning.push(`+${percentage}% ${this.getMultiplierDescription(key)}`);
      }
    });
    
    reasoning.push(`Total: ${totalPoints} healing points ✨`);
    return reasoning;
  }
}

// =============================================================================
// UNIFIED MISSION GENERATION ENGINE
// =============================================================================

export class UnifiedMissionGenerator {
  /**
   * Generate personalized missions from all modules
   */
  static async generateUnifiedMissions(
    context: GamificationContext
  ): Promise<UnifiedMission[]> {
    try {
      const missions: UnifiedMission[] = [];
      
      // 1. Analyze user patterns across all modules
      const patternAnalysis = this.analyzeUnifiedPatterns(context);
      
      // 2. Generate 2-4 missions based on patterns
      const missionCount = this.calculateOptimalMissionCount(context.userProfile);
      
      for (let i = 0; i < missionCount; i++) {
        const mission = await this.generateSingleUnifiedMission(context, patternAnalysis, i);
        if (mission) {
          missions.push(mission);
        }
      }
      
      // 3. Ensure mission diversity across modules
      const diversifiedMissions = this.ensureUnifiedMissionDiversity(missions);
      
      return diversifiedMissions;
      
    } catch (error) {
      console.error('Unified mission generation failed:', error);
      return this.generateFallbackMissions(context);
    }
  }
  
  private static analyzeUnifiedPatterns(context: GamificationContext): any {
    const { recentActivity, userProfile } = context;
    const patterns = userProfile.behaviorPatterns;
    
    return {
      // Compulsion patterns
      compulsionTrend: this.analyzeCompulsionTrend(recentActivity.compulsions),
      commonCompulsions: patterns.commonCompulsionTypes || [],
      
      // ✅ REMOVED: ERP patterns - ERP module deleted
      
      // Mood patterns (unified from mood service)
      moodConsistency: this.calculateMoodConsistency(recentActivity.moodEntries),
      moodTrend: this.analyzeMoodTrend(recentActivity.moodEntries),
      averageMood: patterns.moodPatterns?.averageMood || 50,
      
      // Cross-module patterns
      overallConsistency: userProfile.adaptationProfile.consistencyScore,
      challengeCompletion: userProfile.adaptationProfile.challengeCompletionRate,
      currentLevel: userProfile.currentLevel,
      strugglingAreas: patterns.strugglingAreas || []
    };
  }
  
  private static async generateSingleUnifiedMission(
    context: GamificationContext,
    analysis: any,
    missionIndex: number
  ): Promise<UnifiedMission | null> {
    const missionTypes = [
      'consistency_challenge',
      'resistance_building',
      // ✅ REMOVED: 'therapy_progression' - ERP module deleted
      'mood_improvement',
      'pattern_awareness',
      'cross_module_integration'
    ];
    
    const missionType = this.selectUnifiedMissionType(analysis, missionIndex);
    
    switch (missionType) {
      case 'consistency_challenge':
        return this.generateConsistencyMission(context, analysis);
      
      case 'resistance_building':
        return this.generateConsistencyMission(context, analysis); // ✅ FIX: Use existing method
      
      // ✅ REMOVED: therapy_progression case - ERP module deleted
      
      case 'mood_improvement':
        return this.generateMoodMission(context, analysis);
      
      case 'pattern_awareness':
        return this.generateMoodMission(context, analysis); // ✅ FIX: Use existing method for awareness
      
      case 'cross_module_integration':
        return this.generateCrossModuleMission(context, analysis);
      
      default:
        return null;
    }
  }
  
  // Unified mission generation methods (simplified examples)
  private static generateConsistencyMission(context: GamificationContext, analysis: any): UnifiedMission {
    const userLevel = context.userProfile.currentLevel;
    const consistency = analysis.overallConsistency;
    
    let targetValue = 3;
    let difficulty: UnifiedMission['difficulty'] = 'medium';
    
    if (consistency < 0.3) {
      targetValue = 2;
      difficulty = 'easy';
    } else if (consistency > 0.7) {
      targetValue = 5;
      difficulty = 'hard';
    }
    
    return {
      id: `unified_consistency_${Date.now()}`,
      title: '🎯 Tutarlılık Ustası',
      description: `${targetValue} gün boyunca herhangi bir modülde aktif ol`,
      category: 'consistency',
      difficulty,
      targetValue,
      currentProgress: Math.min(context.userProfile.currentStreak, targetValue),
      healingPoints: this.calculateMissionPoints('consistency', difficulty, userLevel),
      bonusMultiplier: 1.2,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
      generatedFrom: `Unified consistency: ${consistency.toFixed(2)}`,
      personalizedMessage: consistency < 0.5 ? 
        'Küçük adımlarla büyük değişimler!' :
        'Tutarlılığınız örnek alınacak düzeyde!',
      aiGenerated: true,
      metadata: {
        generatedAt: Date.now(),
        basePattern: 'unified_consistency',
        userLevel,
        contextFactors: ['overall_consistency', 'current_streak'],
        expectedDifficulty: difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.6 : 0.8,
        aiConfidence: 0.9,
        adaptationReasons: [`Consistency: ${consistency.toFixed(2)}`]
      }
    };
  }
  
  private static generateMoodMission(context: GamificationContext, analysis: any): UnifiedMission {
    const userLevel = context.userProfile.currentLevel;
    
    return {
      id: `unified_mood_${Date.now()}`,
      title: '🌈 Mood Takipçisi',
      description: 'Günde 2 kez mood check-in yap ve notlarını detaylandır',
      category: 'mood',
      difficulty: 'easy',
      targetValue: 2,
      currentProgress: 0,
      healingPoints: this.calculateMissionPoints('mood', 'easy', userLevel),
      bonusMultiplier: 1.0,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000),
      generatedFrom: `Mood consistency: ${analysis.moodConsistency}`,
      personalizedMessage: 'Duygularını tanımak iyileşmenin ilk adımı!',
      aiGenerated: true,
      metadata: {
        generatedAt: Date.now(),
        basePattern: 'mood_tracking',
        userLevel,
        contextFactors: ['mood_consistency'],
        expectedDifficulty: 0.3,
        aiConfidence: 0.85,
        adaptationReasons: ['Mood tracking improvement needed']
      }
    };
  }
  
  private static generateCrossModuleMission(context: GamificationContext, analysis: any): UnifiedMission {
    const userLevel = context.userProfile.currentLevel;
    
    return {
      id: `unified_cross_${Date.now()}`,
      title: '⚡ Bütüncül Yaklaşım',
      description: 'Bugün en az 3 farklı modülde aktif ol (mood, kompulsiyon, nefes)',
      category: 'challenge',
      difficulty: 'hard',
      targetValue: 3,
      currentProgress: 0,
      healingPoints: this.calculateMissionPoints('integration', 'hard', userLevel),
      bonusMultiplier: 1.5,
      expiresAt: Date.now() + (48 * 60 * 60 * 1000),
      generatedFrom: 'Cross-module integration challenge',
      personalizedMessage: 'Bütüncül yaklaşım en güçlü iyileşme yöntemidir!',
      aiGenerated: true,
      metadata: {
        generatedAt: Date.now(),
        basePattern: 'cross_module_integration',
        userLevel,
        contextFactors: ['multi_module_engagement'],
        expectedDifficulty: 0.7,
        aiConfidence: 0.8,
        adaptationReasons: ['Cross-module synergy needed']
      }
    };
  }
  
  // Helper methods (simplified)
  private static selectUnifiedMissionType(analysis: any, index: number): string {
    const types = ['consistency_challenge', 'resistance_building', 'mood_improvement', 'pattern_awareness', 'cross_module_integration']; // ✅ REMOVED: 'therapy_progression'
    
    // Intelligent selection
    if (analysis.overallConsistency < 0.4) return 'consistency_challenge';
    if (analysis.moodConsistency < 0.5) return 'mood_improvement';
    // ✅ REMOVED: ERP consistency check - ERP module deleted
    if (analysis.currentLevel > 15) return 'cross_module_integration';
    
    return types[index % types.length];
  }
  
  private static calculateOptimalMissionCount(profile: UnifiedGamificationProfile): number {
    const engagement = profile.adaptationProfile.averageDailyEngagement;
    const level = profile.currentLevel;
    
    if (engagement < 10 || level < 5) return 2;
    if (engagement > 30 && level > 20) return 4;
    return 3;
  }
  
  private static ensureUnifiedMissionDiversity(missions: UnifiedMission[]): UnifiedMission[] {
    const seen = new Set();
    return missions.filter(mission => {
      if (seen.has(mission.category)) return false;
      seen.add(mission.category);
      return true;
    });
  }
  
  private static calculateMissionPoints(type: string, difficulty: UnifiedMission['difficulty'], level: number): number {
    const basePoints: Record<string, number> = {
      consistency: 60,
      resistance: 40,
      // ✅ REMOVED: erp level calculation - ERP module deleted
      mood: 35,
      integration: 80,
      pattern: 45
    };
    
    const difficultyMultipliers = {
      easy: 0.8, medium: 1.0, hard: 1.3, expert: 1.6
    };
    
    const base = basePoints[type] || 30;
    const diffBonus = difficultyMultipliers[difficulty];
    const levelBonus = 1 + (level / 100);
    
    return Math.round(base * diffBonus * levelBonus);
  }
  
  private static generateFallbackMissions(context: GamificationContext): UnifiedMission[] {
    return [
      {
        id: `unified_fallback_${Date.now()}`,
        title: '🎯 Günlük Aktivite',
        description: 'Bugün herhangi bir modülde aktif ol',
        category: 'consistency',
        difficulty: 'easy',
        targetValue: 1,
        currentProgress: 0,
        healingPoints: 30,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        generatedFrom: 'Fallback mission',
        personalizedMessage: 'Her küçük adım önemlidir!',
        aiGenerated: false,
        metadata: {
          generatedAt: Date.now(),
          basePattern: 'fallback',
          userLevel: context.userProfile.currentLevel,
          contextFactors: [],
          expectedDifficulty: 0.3,
          aiConfidence: 0.5,
          adaptationReasons: ['Fallback due to error']
        }
      }
    ];
  }
  
  // Analysis helper methods
  private static analyzeCompulsionTrend(compulsions: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (!compulsions || compulsions.length < 6) return 'stable';
    const recent = compulsions.slice(-3).length;
    const older = compulsions.slice(-6, -3).length;
    if (recent > older * 1.5) return 'increasing';
    if (recent < older * 0.5) return 'decreasing';
    return 'stable';
  }
  
  // ✅ REMOVED: ERP calculation methods - ERP module deleted
  
  private static calculateMoodConsistency(moodEntries: any[]): number {
    if (!moodEntries || moodEntries.length === 0) return 0;
    // Calculate based on how regularly mood entries are made
    const uniqueDays = new Set(
      moodEntries.map(e => new Date(e.timestamp).toDateString())
    ).size;
    const totalDays = Math.min(30, Math.ceil((Date.now() - new Date(moodEntries[0]?.timestamp || Date.now()).getTime()) / (1000 * 60 * 60 * 24)));
    return totalDays > 0 ? uniqueDays / totalDays : 0;
  }
  
  private static analyzeMoodTrend(moodEntries: any[]): 'improving' | 'declining' | 'stable' {
    if (!moodEntries || moodEntries.length < 4) return 'stable';
    const recent = moodEntries.slice(-2).reduce((sum, e) => sum + e.mood_score, 0) / 2;
    const older = moodEntries.slice(-4, -2).reduce((sum, e) => sum + e.mood_score, 0) / 2;
    if (recent > older + 10) return 'improving';
    if (recent < older - 10) return 'declining';
    return 'stable';
  }
}

// =============================================================================
// MAIN UNIFIED GAMIFICATION SERVICE
// =============================================================================

export class UnifiedGamificationService {
  private static instance: UnifiedGamificationService;
  
  public static getInstance(): UnifiedGamificationService {
    if (!UnifiedGamificationService.instance) {
      UnifiedGamificationService.instance = new UnifiedGamificationService();
    }
    return UnifiedGamificationService.instance;
  }
  
  /**
   * Award unified points for any action across all modules
   */
  async awardUnifiedPoints(
    userId: string,
    action: string,
    context: any = {},
    moduleData?: { moodEntry?: MoodEntry; compulsionData?: any } // ✅ REMOVED: erpData
  ): Promise<UnifiedPointsCalculation> {
    try {
      if (!FEATURE_FLAGS.isEnabled('AI_DYNAMIC_GAMIFICATION')) {
        return this.awardStaticPoints(action);
      }
      
      // Load user profile
      const userProfile = await this.getUserProfile(userId);
      
      // Calculate unified points
      const pointsCalculation = UnifiedPointsEngine.calculateUnifiedPoints(
        action, 
        context, 
        userProfile, 
        moduleData
      );
      
      // Update user profile
      userProfile.todayHealingPoints += pointsCalculation.totalPoints;
      userProfile.totalHealingPoints += pointsCalculation.totalPoints;
      userProfile.lastActiveDate = new Date().toISOString().split('T')[0];
      
      await this.saveUserProfile(userProfile);
      
      // Track the points award
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId,
        action,
        basePoints: pointsCalculation.basePoints,
        totalPoints: pointsCalculation.totalPoints,
        multipliers: pointsCalculation.contextMultipliers,
        reasoning: pointsCalculation.reasoning,
        source: 'unified_gamification'
      });
      
      return pointsCalculation;
      
    } catch (error) {
      console.error('Unified points calculation failed:', error);
      return this.awardStaticPoints(action);
    }
  }
  
  /**
   * Generate unified daily missions across all modules
   */
  async generateUnifiedMissions(userId: string): Promise<UnifiedMission[]> {
    try {
      if (!FEATURE_FLAGS.isEnabled('AI_DYNAMIC_MISSIONS')) {
        return [];
      }
      
      const userProfile = await this.getUserProfile(userId);
      
      // Check if missions already exist for today
      const today = new Date().toISOString().split('T')[0];
      const hasTodasMissions = userProfile.currentMissions.some(mission => 
        new Date(mission.metadata.generatedAt).toISOString().split('T')[0] === today
      );
      
      if (hasTodasMissions) {
        return userProfile.currentMissions.filter(mission => mission.expiresAt > Date.now());
      }
      
      // Load recent activity for context
      const recentActivity = await this.loadRecentActivity(userId);
      
      const context: GamificationContext = {
        userId,
        currentTime: new Date(),
        recentActivity,
        userProfile
      };
      
      // Generate unified missions
      const missions = await UnifiedMissionGenerator.generateUnifiedMissions(context);
      
      // Update user profile with new missions
      userProfile.currentMissions = [
        ...userProfile.currentMissions.filter(m => m.expiresAt > Date.now()),
        ...missions
      ];
      await this.saveUserProfile(userProfile);
      
      // Track mission generation
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId,
        source: 'unified_missions_generated',
        missionCount: missions.length,
        categories: missions.map(m => m.category),
        difficulties: missions.map(m => m.difficulty)
      });
      
      return missions;
      
    } catch (error) {
      console.error('Unified mission generation failed:', error);
      return [];
    }
  }
  
  /**
   * Update mission progress with unified tracking
   */
  async updateUnifiedMissionProgress(
    userId: string, 
    missionId: string, 
    progressIncrement: number = 1
  ): Promise<boolean> {
    try {
      const userProfile = await this.getUserProfile(userId);
      const mission = userProfile.currentMissions.find(m => m.id === missionId);
      
      if (!mission || mission.expiresAt < Date.now()) {
        return false;
      }
      
      mission.currentProgress += progressIncrement;
      
      // Check if mission completed
      if (mission.currentProgress >= mission.targetValue) {
        const bonusPoints = Math.round(mission.healingPoints * (mission.bonusMultiplier || 1));
        userProfile.todayHealingPoints += bonusPoints;
        userProfile.totalHealingPoints += bonusPoints;
        userProfile.completedMissionsToday += 1;
        
        // Remove completed mission
        userProfile.currentMissions = userProfile.currentMissions.filter(m => m.id !== missionId);
        
                  await trackAIInteraction(AIEventType.USER_FEEDBACK_POSITIVE, { // ✅ FIX: Use existing event type
          userId,
          missionId: mission.id,
          category: mission.category,
          difficulty: mission.difficulty,
          bonusPoints,
          source: 'unified_mission_completed'
        });
      }
      
      await this.saveUserProfile(userProfile);
      return true;
      
    } catch (error) {
      console.error('Unified mission progress update failed:', error);
      return false;
    }
  }
  
  // Helper methods
  private async getUserProfile(userId: string): Promise<UnifiedGamificationProfile> {
    try {
      const storageKey = `unified_gamification_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      return this.createDefaultProfile(userId);
      
    } catch (error) {
      console.error('Failed to load unified gamification profile:', error);
      return this.createDefaultProfile(userId);
    }
  }
  
  private async saveUserProfile(profile: UnifiedGamificationProfile): Promise<void> {
    try {
      const storageKey = `unified_gamification_${profile.userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to save unified gamification profile:', error);
    }
  }
  
  private createDefaultProfile(userId: string): UnifiedGamificationProfile {
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
        // ✅ REMOVED: erpPreferences - ERP module deleted
        strugglingAreas: [],
        improvementTrends: [],
        moodPatterns: {
          averageMood: 50,
          improvementRate: 0,
          lowMoodTimes: []
        },
        lastAnalyzedAt: 0
      },
      currentMissions: [],
      completedMissionsToday: 0,
      weeklyMissionStreak: 0,
      customAchievements: []
    };
  }
  
  private async loadRecentActivity(userId: string): Promise<GamificationContext['recentActivity']> {
    // This would load actual user activity from AsyncStorage/Supabase
    return {
      compulsions: [],
      // ✅ REMOVED: erpSessions - ERP module deleted
      moodEntries: [],
      breathworkSessions: []
    };
  }
  
  private awardStaticPoints(action: string): UnifiedPointsCalculation {
    const staticPoints = {
      'compulsion_recorded': 10,
      // ✅ REMOVED: erp_completed static points - ERP module deleted
      'mood_checkin': 5,
      'breathwork_completed': 15
    };
    
    const points = (staticPoints as any)[action] || 10; // ✅ FIX: Type assertion for dynamic access
    
    return {
      basePoints: points,
      contextMultipliers: {
        difficultyBonus: 1,
        streakMultiplier: 1,
        progressBonus: 1,
        timingBonus: 1,
        consistencyBonus: 1,
        achievementMultiplier: 1,
        honestyBonus: 1,
        improvementBonus: 1,
        detailBonus: 1
      },
      totalPoints: points,
      reasoning: [`Static points: ${points}`],
      breakdown: [{ reason: `Static ${action}`, points }]
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const unifiedGamificationService = UnifiedGamificationService.getInstance();
export default unifiedGamificationService;
