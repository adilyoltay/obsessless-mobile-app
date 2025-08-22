/**
 * 🎮 OCD Gamification Service - Recovery-Focused Motivational System
 * 
 * Bu service OKB recovery sürecini gamify ederek treatment compliance artırır
 * ve recovery motivation sağlar. Klinik olarak uygun achievement system,
 * progress tracking ve recovery milestone sistemi ile OKB'ye özel yaklaşım.
 * 
 * ⚠️ CRITICAL: Clinical appropriateness - OKB trivialize etmemek
 * ⚠️ Evidence-based rewards - harmful behaviors encourage etmemek  
 * ⚠️ Cultural sensitivity - Turkish recovery values
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
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

export interface OCDAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'resistance' | 'honesty' | 'pattern' | 'progress' | 'milestone' | 'consistency';
  points: number;
  unlocked: boolean;
  unlockedAt?: string;
  
  // Clinical criteria
  criteria: {
    type: 'compulsion_count' | 'resistance_level' | 'y_bocs_improvement' | 'pattern_awareness' | 'consistency' | 'custom';
    threshold: number;
    timeframe?: '1d' | '7d' | '30d' | 'all_time';
    customLogic?: string;
  };
  
  // Recovery relevance
  clinicalSignificance: string;
  motivationalMessage: string;
  riskLevel: 'safe' | 'caution' | 'clinical_review';
  
  // Cultural context
  culturalRelevance: {
    turkishValues: string[];
    familySupport: boolean;
    religiousConsiderations?: string;
  };
}

export interface OCDRecoveryMilestone {
  id: string;
  name: string;
  description: string;
  clinicalSignificance: string;
  
  requirements: {
    ybocsReduction?: number;          // Y-BOCS score reduction
    resistanceImprovement?: number;   // Average resistance improvement
    frequencyReduction?: number;      // % reduction in compulsions
    functionalImprovement?: number;   // Life quality improvement
    consistencyDays?: number;         // Consistent tracking days
    customCriteria?: {
      type: string;
      value: number;
    };
  };
  
  rewards: {
    points: number;
    badge: string;
    celebrationMessage: string;
    unlockFeatures?: string[];
    clinicalAcknowledgment: string;
  };
  
  supportResources: {
    educationalContent: string[];
    celebrationActivities: string[];
    familySharingOptions: string[];
  };
}

export interface OCDPointsCalculation {
  compulsionLogging: {
    base: number;
    honestyBonus: (severity: number) => number;
    resistanceBonus: (resistance: number) => number;
    detailBonus: (notesLength: number) => number;
  };
  
  recoveryProgress: {
    ybocsImprovement: (improvement: number) => number;
    resistanceGrowth: (growth: number) => number;
    patternAwareness: {
      triggerIdentification: number;
      categoryAccuracy: number;
      selfInsight: number;
    };
  };
  
  consistency: {
    dailyLogging: number;
    weeklyAssessment: number;
    therapyCompliance: number;
  };
  
  // Penalty system for unhealthy behaviors
  penalties: {
    excessiveLogging: number;        // Prevent obsessive logging
    avoidanceBehaviors: number;      // Discourage avoidance
    selfHarmIndicators: number;      // Clinical concern triggers
  };
}

export interface OCDGamificationStats {
  totalPoints: number;
  currentLevel: number;
  levelProgress: number;            // 0-1 towards next level
  
  achievements: {
    unlocked: OCDAchievement[];
    available: OCDAchievement[];
    locked: OCDAchievement[];
  };
  
  milestones: {
    completed: OCDRecoveryMilestone[];
    inProgress: OCDRecoveryMilestone[];
    upcoming: OCDRecoveryMilestone[];
  };
  
  streaks: {
    currentLoggingStreak: number;
    longestLoggingStreak: number;
    currentResistanceStreak: number;  // Days with 6+ resistance
    recoveryMomentum: 'building' | 'stable' | 'declining';
  };
  
  clinicalProgress: {
    ybocsScoreHistory: { date: string; score: number }[];
    functionalImprovementTrend: 'improving' | 'stable' | 'declining';
    riskLevel: 'low' | 'medium' | 'high';
    recommendedFocus: string[];
  };
}

export interface OCDGamificationAlert {
  type: 'achievement' | 'milestone' | 'streak' | 'concern' | 'celebration';
  title: string;
  message: string;
  icon: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  actionRequired: boolean;
  recommendations?: string[];
  celebrationAnimation?: string;
}

// =============================================================================
// 🏗️ MAIN SERVICE CLASS
// =============================================================================

class OCDGamificationService {
  private static instance: OCDGamificationService;
  private isInitialized = false;
  private achievements: OCDAchievement[] = [];
  private milestones: OCDRecoveryMilestone[] = [];
  private pointsCalculation: OCDPointsCalculation;

  static getInstance(): OCDGamificationService {
    if (!OCDGamificationService.instance) {
      OCDGamificationService.instance = new OCDGamificationService();
    }
    return OCDGamificationService.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // Initialize achievement system
      this.initializeAchievements();
      
      // Initialize milestone system
      this.initializeMilestones();
      
      // Initialize points calculation
      this.initializePointsCalculation();

      this.isInitialized = true;
      console.log('🎮 OCD Gamification Service initialized');

      await trackAIInteraction(AIEventType.FEATURE_INITIALIZED, {
        feature: 'OCD_GAMIFICATION',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Failed to initialize OCD Gamification Service:', error);
      await trackAIError(AIEventType.INITIALIZATION_ERROR, {
        feature: 'OCD_GAMIFICATION',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // =============================================================================
  // 🎯 MAIN GAMIFICATION METHODS
  // =============================================================================

  /**
   * Calculate points for a compulsion entry
   */
  calculateCompulsionPoints(entry: CompulsionEntry, userHistory?: CompulsionEntry[]): {
    points: number;
    breakdown: Record<string, number>;
    achievements: OCDAchievement[];
    alerts: OCDGamificationAlert[];
  } {
    if (!this.isInitialized || !FEATURE_FLAGS.isEnabled('OCD_GAMIFICATION')) {
      return { points: 0, breakdown: {}, achievements: [], alerts: [] };
    }

    const breakdown: Record<string, number> = {};
    let totalPoints = 0;
    const newAchievements: OCDAchievement[] = [];
    const alerts: OCDGamificationAlert[] = [];

    // Base logging points
    const basePoints = this.pointsCalculation.compulsionLogging.base;
    breakdown['Kayıt Tutma'] = basePoints;
    totalPoints += basePoints;

    // Honesty bonus - higher severity gets bonus for courage
    if (entry.intensity >= 7) {
      const honestyBonus = this.pointsCalculation.compulsionLogging.honestyBonus(entry.intensity);
      breakdown['Dürüstlük Bonusu'] = honestyBonus;
      totalPoints += honestyBonus;
      
      alerts.push({
        type: 'celebration',
        title: 'Cesaret Bonusu! 🦁',
        message: 'Yüksek şiddetli kompülsiyonu kaydetmek cesaret gerektirir',
        icon: '💪',
        severity: 'success',
        actionRequired: false,
        celebrationAnimation: 'courage'
      });
    }

    // Resistance bonus
    if (entry.resistanceLevel && entry.resistanceLevel > 0) {
      const resistanceBonus = this.pointsCalculation.compulsionLogging.resistanceBonus(entry.resistanceLevel);
      breakdown['Direnç Bonusu'] = resistanceBonus;
      totalPoints += resistanceBonus;

      if (entry.resistanceLevel >= 8) {
        alerts.push({
          type: 'achievement',
          title: 'Güçlü Direnç! ⚔️',
          message: 'Kompulsiyona güçlü direnç gösterdiniz',
          icon: '🛡️',
          severity: 'success',
          actionRequired: false,
          celebrationAnimation: 'resistance'
        });
      }
    }

    // Detail bonus for comprehensive notes
    if (entry.notes && entry.notes.length > 20) {
      const detailBonus = this.pointsCalculation.compulsionLogging.detailBonus(entry.notes.length);
      breakdown['Detay Bonusu'] = detailBonus;
      totalPoints += detailBonus;
    }

    // Pattern awareness bonus
    if (entry.trigger) {
      const patternBonus = this.pointsCalculation.recoveryProgress.patternAwareness.triggerIdentification;
      breakdown['Tetikleyici Farkındalığı'] = patternBonus;
      totalPoints += patternBonus;
    }

    // Check for achievements
    const triggeredAchievements = this.checkAchievementTriggers(entry, userHistory || []);
    newAchievements.push(...triggeredAchievements);

    // Clinical safety checks
    const safetyAlerts = this.performClinicalSafetyCheck(entry, userHistory || []);
    alerts.push(...safetyAlerts);

    return {
      points: totalPoints,
      breakdown,
      achievements: newAchievements,
      alerts
    };
  }

  /**
   * Get comprehensive gamification stats
   */
  async getGamificationStats(
    userId: string,
    compulsions: CompulsionEntry[],
    ybocsHistory?: { date: string; score: number }[]
  ): Promise<OCDGamificationStats> {
    if (!this.isInitialized) {
      throw new Error('OCD Gamification Service not initialized');
    }

    try {
      // Load user achievement data
      const userAchievements = await this.loadUserAchievements(userId);
      const userMilestones = await this.loadUserMilestones(userId);

      // Calculate total points
      let totalPoints = 0;
      compulsions.forEach(entry => {
        const result = this.calculateCompulsionPoints(entry, compulsions);
        totalPoints += result.points;
      });

      // Calculate level
      const currentLevel = Math.floor(totalPoints / 1000) + 1;
      const levelProgress = (totalPoints % 1000) / 1000;

      // Categorize achievements
      const unlockedAchievements = this.achievements.filter(a => 
        userAchievements.includes(a.id)
      );
      const availableAchievements = this.achievements.filter(a => 
        !userAchievements.includes(a.id) && this.isAchievementAvailable(a, compulsions)
      );
      const lockedAchievements = this.achievements.filter(a => 
        !userAchievements.includes(a.id) && !this.isAchievementAvailable(a, compulsions)
      );

      // Categorize milestones
      const completedMilestones = this.milestones.filter(m => 
        userMilestones.includes(m.id)
      );
      const inProgressMilestones = this.milestones.filter(m => 
        !userMilestones.includes(m.id) && this.isMilestoneInProgress(m, compulsions, ybocsHistory)
      );
      const upcomingMilestones = this.milestones.filter(m => 
        !userMilestones.includes(m.id) && !this.isMilestoneInProgress(m, compulsions, ybocsHistory)
      );

      // Calculate streaks
      const streaks = this.calculateStreaks(compulsions);

      // Clinical progress analysis
      const clinicalProgress = this.analyzeClinicalProgress(compulsions, ybocsHistory);

      return {
        totalPoints,
        currentLevel,
        levelProgress,
        achievements: {
          unlocked: unlockedAchievements,
          available: availableAchievements,
          locked: lockedAchievements
        },
        milestones: {
          completed: completedMilestones,
          inProgress: inProgressMilestones,
          upcoming: upcomingMilestones
        },
        streaks,
        clinicalProgress
      };

    } catch (error) {
      console.error('❌ Failed to get gamification stats:', error);
      throw error;
    }
  }

  /**
   * Check for milestone completion
   */
  async checkMilestoneCompletion(
    userId: string,
    compulsions: CompulsionEntry[],
    ybocsHistory?: { date: string; score: number }[]
  ): Promise<{
    newMilestones: OCDRecoveryMilestone[];
    alerts: OCDGamificationAlert[];
  }> {
    const newMilestones: OCDRecoveryMilestone[] = [];
    const alerts: OCDGamificationAlert[] = [];

    try {
      const userMilestones = await this.loadUserMilestones(userId);

      for (const milestone of this.milestones) {
        if (!userMilestones.includes(milestone.id)) {
          const isCompleted = this.evaluateMilestoneRequirements(milestone, compulsions, ybocsHistory);
          
          if (isCompleted) {
            newMilestones.push(milestone);
            await this.saveMilestoneCompletion(userId, milestone.id);

            alerts.push({
              type: 'milestone',
              title: `🏆 Kilometre Taşı: ${milestone.name}`,
              message: milestone.rewards.celebrationMessage,
              icon: milestone.rewards.badge,
              severity: 'success',
              actionRequired: false,
              celebrationAnimation: 'milestone',
              recommendations: [
                milestone.rewards.clinicalAcknowledgment,
                ...milestone.supportResources.celebrationActivities.slice(0, 2)
              ]
            });

            // Track milestone completion
            await trackAIInteraction(AIEventType.MILESTONE_ACHIEVED, {
              userId,
              milestoneId: milestone.id,
              milestoneName: milestone.name,
              clinicalSignificance: milestone.clinicalSignificance
            });
          }
        }
      }

      return { newMilestones, alerts };

    } catch (error) {
      console.error('❌ Failed to check milestone completion:', error);
      return { newMilestones: [], alerts: [] };
    }
  }

  // =============================================================================
  // 🏆 ACHIEVEMENT SYSTEM
  // =============================================================================

  private initializeAchievements(): void {
    this.achievements = [
      {
        id: 'first_entry',
        name: 'İlk Adım',
        description: 'İlk kompülsiyon kaydı',
        icon: '🌱',
        category: 'milestone',
        points: 100,
        unlocked: false,
        criteria: {
          type: 'compulsion_count',
          threshold: 1,
          timeframe: 'all_time'
        },
        clinicalSignificance: 'Self-monitoring başlangıcı - recovery\'nin ilk adımı',
        motivationalMessage: 'Harika! Recovery yolculuğunun ilk adımını attınız.',
        riskLevel: 'safe',
        culturalRelevance: {
          turkishValues: ['başlangıç', 'cesaret'],
          familySupport: true
        }
      },

      {
        id: 'honest_tracker',
        name: 'Dürüst Takipçi',
        description: 'Yüksek şiddette kompülsiyonları da kaydet (10 kez)',
        icon: '💯',
        category: 'honesty',
        points: 200,
        unlocked: false,
        criteria: {
          type: 'custom',
          threshold: 10,
          customLogic: 'high_severity_entries'
        },
        clinicalSignificance: 'Accurate self-reporting - tedavi etkinliği için kritik',
        motivationalMessage: 'Zorlu anları da kaydetmek büyük cesaret gerektirir!',
        riskLevel: 'safe',
        culturalRelevance: {
          turkishValues: ['dürüstlük', 'cesaret'],
          familySupport: true
        }
      },

      {
        id: 'resistance_warrior',
        name: 'Direnç Savaşçısı',
        description: '7+ direnç seviyesi ile 20 kompülsiyon kaydet',
        icon: '⚔️',
        category: 'resistance',
        points: 300,
        unlocked: false,
        criteria: {
          type: 'custom',
          threshold: 20,
          customLogic: 'high_resistance_entries'
        },
        clinicalSignificance: 'Resistance building - terapinin temel hedefi',
        motivationalMessage: 'Kompülsiyonlara direnmek gerçek güç gösterisidir!',
        riskLevel: 'safe',
        culturalRelevance: {
          turkishValues: ['dayanıklılık', 'mücadele ruhu'],
          familySupport: true
        }
      },

      {
        id: 'pattern_detective',
        name: 'Kalıp Dedektifi',
        description: '5 farklı tetikleyici türü tespit et',
        icon: '🔍',
        category: 'pattern',
        points: 150,
        unlocked: false,
        criteria: {
          type: 'custom',
          threshold: 5,
          customLogic: 'unique_trigger_types'
        },
        clinicalSignificance: 'Pattern awareness - cognitive insight development',
        motivationalMessage: 'Kalıpları fark etmek iyileşmenin anahtarıdır!',
        riskLevel: 'safe',
        culturalRelevance: {
          turkishValues: ['farkındalık', 'bilgelik'],
          familySupport: true
        }
      },

      {
        id: 'y_bocs_improver',
        name: 'Y-BOCS İyileştirici',
        description: 'Y-BOCS skorunu 5 puan iyileştir',
        icon: '📈',
        category: 'progress',
        points: 500,
        unlocked: false,
        criteria: {
          type: 'y_bocs_improvement',
          threshold: 5
        },
        clinicalSignificance: 'Clinically significant improvement - major milestone',
        motivationalMessage: 'Klinik iyileşme harika bir başarı!',
        riskLevel: 'safe',
        culturalRelevance: {
          turkishValues: ['başarı', 'iyileşme'],
          familySupport: true,
          religiousConsiderations: 'Allah\'ın lütfuyla iyileşme'
        }
      },

      {
        id: 'consistency_champion',
        name: 'Tutarlılık Şampiyonu',
        description: '30 gün ardı ardına kayıt tut',
        icon: '📅',
        category: 'consistency',
        points: 250,
        unlocked: false,
        criteria: {
          type: 'consistency',
          threshold: 30,
          timeframe: '30d'
        },
        clinicalSignificance: 'Treatment adherence - recovery sustainability',
        motivationalMessage: 'Süreklilik başarının anahtarıdır!',
        riskLevel: 'safe',
        culturalRelevance: {
          turkishValues: ['sebat', 'disiplin'],
          familySupport: true
        }
      },

      {
        id: 'family_supporter',
        name: 'Aile Destekçisi',
        description: 'Aile ile 3 recovery konuşması yap',
        icon: '👨‍👩‍👧‍👦',
        category: 'progress',
        points: 200,
        unlocked: false,
        criteria: {
          type: 'custom',
          threshold: 3,
          customLogic: 'family_support_sessions'
        },
        clinicalSignificance: 'Family involvement - culturally important support',
        motivationalMessage: 'Aile desteği Türk kültüründe çok değerlidir!',
        riskLevel: 'safe',
        culturalRelevance: {
          turkishValues: ['aile bağları', 'dayanışma'],
          familySupport: true
        }
      },

      {
        id: 'cultural_balance',
        name: 'Kültürel Denge',
        description: 'Dini değerler ile OKB\'yi ayırt et',
        icon: '⚖️',
        category: 'progress',
        points: 300,
        unlocked: false,
        criteria: {
          type: 'custom',
          threshold: 1,
          customLogic: 'religious_ocd_distinction'
        },
        clinicalSignificance: 'Cultural adaptation - separating faith from OCD',
        motivationalMessage: 'Dini değerlerle OKB\'yi ayırt etmek büyük anlayış!',
        riskLevel: 'caution',
        culturalRelevance: {
          turkishValues: ['din', 'anlayış'],
          familySupport: true,
          religiousConsiderations: 'Dini skrupül ile gerçek ibadet ayırımı'
        }
      }
    ];
  }

  private initializeMilestones(): void {
    this.milestones = [
      {
        id: 'first_resistance',
        name: 'İlk Direnç',
        description: 'Kompulsiyona ilk kez direnç gösterme',
        clinicalSignificance: 'First successful resistance - behavioral change initiation',
        requirements: {
          resistanceImprovement: 1
        },
        rewards: {
          points: 100,
          badge: '🛡️',
          celebrationMessage: 'İlk adımı attınız! Direnç göstermek büyük cesaret.',
          clinicalAcknowledgment: 'İlk başarılı direnç davranışsal değişimin başlangıcıdır',
          unlockFeatures: ['resistance_tracking_advanced']
        },
        supportResources: {
          educationalContent: ['Direnç teknikleri', 'ERP temelleri'],
          celebrationActivities: ['Aile ile paylaşım', 'Kişisel kutlama'],
          familySharingOptions: ['Başarı hikayesi paylaşımı']
        }
      },

      {
        id: 'weekly_consistency',
        name: 'Haftalık Düzen',
        description: '7 gün ardı ardına kayıt tutma',
        clinicalSignificance: 'Treatment adherence establishment',
        requirements: {
          consistencyDays: 7
        },
        rewards: {
          points: 200,
          badge: '📊',
          celebrationMessage: 'Harika düzen! Süreklilik iyileşmenin temelidir.',
          clinicalAcknowledgment: 'Düzenli self-monitoring tedavi adheransının göstergesidir',
          unlockFeatures: ['weekly_reports', 'pattern_insights']
        },
        supportResources: {
          educationalContent: ['Self-monitoring faydaları', 'Habit formation'],
          celebrationActivities: ['İlerleme grafiği inceleme', 'Başarı değerlendirmesi'],
          familySharingOptions: ['Haftalık rapor paylaşımı']
        }
      },

      {
        id: 'y_bocs_mild',
        name: 'Hafif Seviye',
        description: 'Y-BOCS skoru hafif seviyeye düşme (≤16)',
        clinicalSignificance: 'Clinically significant improvement - mild severity achieved',
        requirements: {
          ybocsReduction: 10
        },
        rewards: {
          points: 1000,
          badge: '🌅',
          celebrationMessage: 'Harika! Y-BOCS skorunuz hafif seviyeye düştü.',
          clinicalAcknowledgment: 'Klinik olarak anlamlı iyileşme sağlandı',
          unlockFeatures: ['advanced_analytics', 'peer_support', 'family_dashboard']
        },
        supportResources: {
          educationalContent: ['İyileşme sürecinin devamı', 'Relapse prevention'],
          celebrationActivities: ['Doktor ile kutlama', 'Aile toplantısı', 'Kişisel ödül'],
          familySharingOptions: ['Klinik başarı raporu', 'Aile bilgilendirme']
        }
      },

      {
        id: 'functional_improvement',
        name: 'İşlevsellik Artışı',
        description: 'Günlük yaşamda önemli iyileşme (%30+)',
        clinicalSignificance: 'Functional improvement - quality of life enhancement',
        requirements: {
          functionalImprovement: 30
        },
        rewards: {
          points: 1500,
          badge: '🎯',
          celebrationMessage: 'Yaşam kaliteniz artıyor! Günlük işlevsellikte harika ilerleme.',
          clinicalAcknowledgment: 'İşlevsel iyileşme yaşam kalitesinin artışını gösterir',
          unlockFeatures: ['life_quality_tracking', 'goal_setting', 'social_features']
        },
        supportResources: {
          educationalContent: ['Yaşam kalitesi artırma', 'Social functioning'],
          celebrationActivities: ['Sosyal aktivite planlaması', 'Hedef belirleme'],
          familySharingOptions: ['Yaşam kalitesi raporu']
        }
      },

      {
        id: 'resistance_mastery',
        name: 'Direnç Ustası',
        description: 'Ortalama 8+ direnç seviyesi (30 gün)',
        clinicalSignificance: 'Resistance mastery - advanced ERP skills',
        requirements: {
          resistanceImprovement: 8,
          consistencyDays: 30
        },
        rewards: {
          points: 2000,
          badge: '🏆',
          celebrationMessage: 'Dirençte ustalik! Kompülsiyonlara karşı güçlü duruş.',
          clinicalAcknowledgment: 'İleri düzey ERP becerileri geliştirildi',
          unlockFeatures: ['mentor_program', 'advanced_erp', 'peer_teaching']
        },
        supportResources: {
          educationalContent: ['Advanced ERP techniques', 'Mentoring basics'],
          celebrationActivities: ['Başarı hikayesi yazma', 'Deneyim paylaşımı'],
          familySharingOptions: ['Uzmanlık hikayesi']
        }
      }
    ];
  }

  private initializePointsCalculation(): void {
    this.pointsCalculation = {
      compulsionLogging: {
        base: 15,
        honestyBonus: (severity: number) => {
          if (severity >= 8) return 15;
          if (severity >= 6) return 10;
          if (severity >= 4) return 5;
          return 0;
        },
        resistanceBonus: (resistance: number) => resistance * 5,
        detailBonus: (notesLength: number) => {
          if (notesLength > 100) return 12;
          if (notesLength > 50) return 8;
          if (notesLength > 20) return 4;
          return 0;
        }
      },
      
      recoveryProgress: {
        ybocsImprovement: (improvement: number) => improvement * 50,
        resistanceGrowth: (growth: number) => growth * 25,
        patternAwareness: {
          triggerIdentification: 20,
          categoryAccuracy: 15,
          selfInsight: 25
        }
      },
      
      consistency: {
        dailyLogging: 10,
        weeklyAssessment: 50,
        therapyCompliance: 30
      },
      
      penalties: {
        excessiveLogging: -20,      // More than 10 entries per day
        avoidanceBehaviors: -30,    // Detected avoidance patterns
        selfHarmIndicators: -100    // Clinical concern trigger
      }
    };
  }

  // =============================================================================
  // 🛡️ CLINICAL SAFETY CHECKS
  // =============================================================================

  private performClinicalSafetyCheck(
    entry: CompulsionEntry,
    userHistory: CompulsionEntry[]
  ): OCDGamificationAlert[] {
    const alerts: OCDGamificationAlert[] = [];

    // Check for excessive logging (potential compulsive behavior)
    const todayEntries = userHistory.filter(e => 
      format(new Date(e.timestamp), 'yyyy-MM-dd') === format(new Date(entry.timestamp), 'yyyy-MM-dd')
    );

    if (todayEntries.length > 10) {
      alerts.push({
        type: 'concern',
        title: '⚠️ Aşırı Kayıt Uyarısı',
        message: 'Günde çok fazla kayıt OKB belirtisi olabilir',
        icon: '⚠️',
        severity: 'warning',
        actionRequired: true,
        recommendations: [
          'Kayıt tutmayı günde 3-5 ile sınırlayın',
          'Terapi danışmanınız ile görüşün',
          'App kullanımında mola verin'
        ]
      });
    }

    // Check for concerning severity patterns
    const recentHighSeverity = userHistory
      .filter(e => new Date(e.timestamp) > subDays(new Date(), 7))
      .filter(e => e.intensity >= 9);

    if (recentHighSeverity.length > 5) {
      alerts.push({
        type: 'concern',
        title: '🚨 Yüksek Şiddet Uyarısı',
        message: 'Son hafta çok yüksek şiddet seviyeleri görülüyor',
        icon: '🚨',
        severity: 'error',
        actionRequired: true,
        recommendations: [
          'ACİL: Ruh sağlığı uzmanı ile görüşün',
          'Destek hattını arayın: 444 7 ASK',
          'Güvenlik planını uygulayın'
        ]
      });
    }

    // Check for self-harm indicators
    const concerningWords = ['zarar', 'intihar', 'öldürme', 'kendine zarar'];
    if (entry.notes && concerningWords.some(word => 
      entry.notes!.toLowerCase().includes(word)
    )) {
      alerts.push({
        type: 'concern',
        title: '🆘 Güvenlik Uyarısı',
        message: 'Kendine zarar verme belirtisi tespit edildi',
        icon: '🆘',
        severity: 'error',
        actionRequired: true,
        recommendations: [
          'ACİL: Ruh sağlığı uzmanı ile iletişime geçin',
          'Kriz hattını arayın: 444 7 ASK',
          'Güvenli bir ortama geçin',
          'Aile/arkadaş desteği alın'
        ]
      });
    }

    return alerts;
  }

  // =============================================================================
  // 🎖️ ACHIEVEMENT & MILESTONE EVALUATION
  // =============================================================================

  private checkAchievementTriggers(
    entry: CompulsionEntry,
    userHistory: CompulsionEntry[]
  ): OCDAchievement[] {
    const newAchievements: OCDAchievement[] = [];
    
    for (const achievement of this.achievements) {
      if (achievement.unlocked) continue;
      
      const isTriggered = this.evaluateAchievementCriteria(achievement, entry, userHistory);
      if (isTriggered) {
        achievement.unlocked = true;
        achievement.unlockedAt = new Date().toISOString();
        newAchievements.push(achievement);
      }
    }
    
    return newAchievements;
  }

  private evaluateAchievementCriteria(
    achievement: OCDAchievement,
    entry: CompulsionEntry,
    userHistory: CompulsionEntry[]
  ): boolean {
    const allEntries = [...userHistory, entry];
    
    switch (achievement.criteria.type) {
      case 'compulsion_count':
        return allEntries.length >= achievement.criteria.threshold;
        
      case 'resistance_level':
        return (entry.resistanceLevel || 0) >= achievement.criteria.threshold;
        
      case 'custom':
        return this.evaluateCustomCriteria(achievement.criteria.customLogic!, allEntries, achievement.criteria.threshold);
        
      default:
        return false;
    }
  }

  private evaluateCustomCriteria(
    customLogic: string,
    entries: CompulsionEntry[],
    threshold: number
  ): boolean {
    switch (customLogic) {
      case 'high_severity_entries':
        return entries.filter(e => e.intensity >= 7).length >= threshold;
        
      case 'high_resistance_entries':
        return entries.filter(e => (e.resistanceLevel || 0) >= 7).length >= threshold;
        
      case 'unique_trigger_types':
        const uniqueTriggers = new Set(entries.map(e => e.trigger).filter(Boolean));
        return uniqueTriggers.size >= threshold;
        
      case 'family_support_sessions':
        // This would need to be tracked separately in user data
        return false; // Placeholder
        
      case 'religious_ocd_distinction':
        // Complex logic for detecting religious OCD awareness
        const religiousEntries = entries.filter(e => 
          e.notes?.toLowerCase().includes('din') ||
          e.notes?.toLowerCase().includes('namaz') ||
          e.notes?.toLowerCase().includes('günah')
        );
        return religiousEntries.length > 0 && entries.length >= 10;
        
      default:
        return false;
    }
  }

  private evaluateMilestoneRequirements(
    milestone: OCDRecoveryMilestone,
    compulsions: CompulsionEntry[],
    ybocsHistory?: { date: string; score: number }[]
  ): boolean {
    const req = milestone.requirements;

    // Y-BOCS improvement check
    if (req.ybocsReduction && ybocsHistory && ybocsHistory.length >= 2) {
      const sortedHistory = ybocsHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const firstScore = sortedHistory[0].score;
      const latestScore = sortedHistory[sortedHistory.length - 1].score;
      const improvement = firstScore - latestScore;
      
      if (improvement < req.ybocsReduction) return false;
    }

    // Resistance improvement check
    if (req.resistanceImprovement) {
      const avgResistance = compulsions
        .filter(c => c.resistanceLevel !== undefined)
        .reduce((sum, c) => sum + (c.resistanceLevel || 0), 0) / compulsions.length;
      
      if (avgResistance < req.resistanceImprovement) return false;
    }

    // Consistency check
    if (req.consistencyDays) {
      const uniqueDays = new Set(
        compulsions.map(c => format(new Date(c.timestamp), 'yyyy-MM-dd'))
      );
      
      if (uniqueDays.size < req.consistencyDays) return false;
    }

    // Frequency reduction check
    if (req.frequencyReduction) {
      // This would require baseline comparison - placeholder
      return true;
    }

    return true;
  }

  // =============================================================================
  // 📊 STATISTICS & ANALYTICS
  // =============================================================================

  private calculateStreaks(compulsions: CompulsionEntry[]): {
    currentLoggingStreak: number;
    longestLoggingStreak: number;
    currentResistanceStreak: number;
    recoveryMomentum: 'building' | 'stable' | 'declining';
  } {
    // Calculate logging streak
    const sortedEntries = compulsions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    let currentLoggingStreak = 0;
    let longestLoggingStreak = 0;
    let tempStreak = 0;

    const uniqueDays = Array.from(new Set(
      sortedEntries.map(e => format(new Date(e.timestamp), 'yyyy-MM-dd'))
    )).sort().reverse();

    // Current streak calculation
    const today = format(new Date(), 'yyyy-MM-dd');
    let checkDate = new Date();
    
    for (let i = 0; i < uniqueDays.length; i++) {
      const dayStr = format(checkDate, 'yyyy-MM-dd');
      if (uniqueDays.includes(dayStr)) {
        currentLoggingStreak++;
        checkDate = subDays(checkDate, 1);
      } else if (i === 0 && dayStr !== today) {
        // If no entry today, start from yesterday
        checkDate = subDays(checkDate, 1);
        continue;
      } else {
        break;
      }
    }

    // Longest streak calculation
    for (let i = 0; i < uniqueDays.length - 1; i++) {
      const currentDate = new Date(uniqueDays[i]);
      const nextDate = new Date(uniqueDays[i + 1]);
      const dayDiff = (currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        longestLoggingStreak = Math.max(longestLoggingStreak, tempStreak + 1);
        tempStreak = 0;
      }
    }
    longestLoggingStreak = Math.max(longestLoggingStreak, tempStreak + 1);

    // Resistance streak (consecutive days with 6+ resistance)
    let currentResistanceStreak = 0;
    const recentDays = uniqueDays.slice(0, 30); // Last 30 days
    
    for (const day of recentDays) {
      const dayEntries = compulsions.filter(e => 
        format(new Date(e.timestamp), 'yyyy-MM-dd') === day
      );
      const avgResistance = dayEntries
        .filter(e => e.resistanceLevel !== undefined)
        .reduce((sum, e) => sum + (e.resistanceLevel || 0), 0) / dayEntries.length;
      
      if (avgResistance >= 6) {
        currentResistanceStreak++;
      } else {
        break;
      }
    }

    // Recovery momentum
    const recentEntries = sortedEntries.slice(0, 10);
    const olderEntries = sortedEntries.slice(-10);
    
    const recentAvgResistance = recentEntries
      .reduce((sum, e) => sum + (e.resistanceLevel || 0), 0) / recentEntries.length;
    const olderAvgResistance = olderEntries
      .reduce((sum, e) => sum + (e.resistanceLevel || 0), 0) / olderEntries.length;
    
    let recoveryMomentum: 'building' | 'stable' | 'declining' = 'stable';
    const resistanceDiff = recentAvgResistance - olderAvgResistance;
    
    if (resistanceDiff > 1) recoveryMomentum = 'building';
    else if (resistanceDiff < -1) recoveryMomentum = 'declining';

    return {
      currentLoggingStreak,
      longestLoggingStreak,
      currentResistanceStreak,
      recoveryMomentum
    };
  }

  private analyzeClinicalProgress(
    compulsions: CompulsionEntry[],
    ybocsHistory?: { date: string; score: number }[]
  ): {
    ybocsScoreHistory: { date: string; score: number }[];
    functionalImprovementTrend: 'improving' | 'stable' | 'declining';
    riskLevel: 'low' | 'medium' | 'high';
    recommendedFocus: string[];
  } {
    const ybocsScoreHistory = ybocsHistory || [];
    
    // Functional improvement analysis based on resistance trends
    const recentCompulsions = compulsions.slice(0, 20);
    const olderCompulsions = compulsions.slice(-20);
    
    const recentAvgSeverity = recentCompulsions.reduce((sum, c) => sum + c.intensity, 0) / recentCompulsions.length;
    const olderAvgSeverity = olderCompulsions.reduce((sum, c) => sum + c.intensity, 0) / olderCompulsions.length;
    
    let functionalImprovementTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentAvgSeverity < olderAvgSeverity - 1) functionalImprovementTrend = 'improving';
    else if (recentAvgSeverity > olderAvgSeverity + 1) functionalImprovementTrend = 'declining';

    // Risk level assessment
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const highSeverityCount = recentCompulsions.filter(c => c.intensity >= 8).length;
    const lowResistanceCount = recentCompulsions.filter(c => (c.resistanceLevel || 0) <= 3).length;
    
    if (highSeverityCount > 10 || lowResistanceCount > 15) riskLevel = 'high';
    else if (highSeverityCount > 5 || lowResistanceCount > 10) riskLevel = 'medium';

    // Recommended focus areas
    const recommendedFocus: string[] = [];
    
    if (lowResistanceCount > 5) recommendedFocus.push('Direnç tekniklerini güçlendirin');
    if (highSeverityCount > 3) recommendedFocus.push('Şiddet azaltma stratejileri');
    if (functionalImprovementTrend === 'declining') recommendedFocus.push('Profesyonel destek alın');
    
    const uniqueTriggers = new Set(compulsions.map(c => c.trigger).filter(Boolean));
    if (uniqueTriggers.size < 3) recommendedFocus.push('Tetikleyici farkındalığını artırın');

    return {
      ybocsScoreHistory,
      functionalImprovementTrend,
      riskLevel,
      recommendedFocus
    };
  }

  // =============================================================================
  // 💾 DATA PERSISTENCE
  // =============================================================================

  private async loadUserAchievements(userId: string): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(`ocd_achievements_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private async saveAchievementUnlock(userId: string, achievementId: string): Promise<void> {
    try {
      const existing = await this.loadUserAchievements(userId);
      if (!existing.includes(achievementId)) {
        existing.push(achievementId);
        await AsyncStorage.setItem(`ocd_achievements_${userId}`, JSON.stringify(existing));
      }
    } catch (error) {
      console.error('Failed to save achievement:', error);
    }
  }

  private async loadUserMilestones(userId: string): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(`ocd_milestones_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private async saveMilestoneCompletion(userId: string, milestoneId: string): Promise<void> {
    try {
      const existing = await this.loadUserMilestones(userId);
      if (!existing.includes(milestoneId)) {
        existing.push(milestoneId);
        await AsyncStorage.setItem(`ocd_milestones_${userId}`, JSON.stringify(existing));
      }
    } catch (error) {
      console.error('Failed to save milestone:', error);
    }
  }

  // =============================================================================
  // 🛠️ UTILITY METHODS
  // =============================================================================

  private isAchievementAvailable(achievement: OCDAchievement, compulsions: CompulsionEntry[]): boolean {
    // Simple availability check - could be enhanced with prerequisite logic
    return compulsions.length >= 1;
  }

  private isMilestoneInProgress(
    milestone: OCDRecoveryMilestone,
    compulsions: CompulsionEntry[],
    ybocsHistory?: { date: string; score: number }[]
  ): boolean {
    // Check if user is making progress towards milestone
    const req = milestone.requirements;
    
    if (req.consistencyDays) {
      const uniqueDays = new Set(
        compulsions.map(c => format(new Date(c.timestamp), 'yyyy-MM-dd'))
      );
      return uniqueDays.size >= req.consistencyDays * 0.5; // 50% progress
    }
    
    if (req.resistanceImprovement) {
      const avgResistance = compulsions
        .filter(c => c.resistanceLevel !== undefined)
        .reduce((sum, c) => sum + (c.resistanceLevel || 0), 0) / compulsions.length;
      return avgResistance >= req.resistanceImprovement * 0.6; // 60% progress
    }
    
    return false;
  }

  /**
   * Get motivational message based on current progress
   */
  getMotivationalMessage(stats: OCDGamificationStats): string {
    if (stats.streaks.recoveryMomentum === 'building') {
      return 'Harika ilerleme! Recovery momentumunuz güçleniyor! 🚀';
    }
    
    if (stats.streaks.currentResistanceStreak > 7) {
      return 'Direnç konusunda gerçek bir savaşçısınız! 💪';
    }
    
    if (stats.achievements.unlocked.length > 5) {
      return 'Başarılarınız ilham verici! Devam edin! ⭐';
    }
    
    if (stats.streaks.currentLoggingStreak > 14) {
      return 'Tutarlılığınız örnek alınacak düzeyde! 📈';
    }
    
    return 'Her adım iyileşmeye doğru atılan değerli bir adım! 🌟';
  }

  /**
   * Get next recommended action
   */
  getNextRecommendedAction(stats: OCDGamificationStats): string {
    if (stats.achievements.available.length > 0) {
      const nextAchievement = stats.achievements.available[0];
      return `Sonraki hedef: ${nextAchievement.name} - ${nextAchievement.description}`;
    }
    
    if (stats.milestones.inProgress.length > 0) {
      const nextMilestone = stats.milestones.inProgress[0];
      return `Milestone ilerleme: ${nextMilestone.name} - ${nextMilestone.description}`;
    }
    
    if (stats.streaks.currentLoggingStreak === 0) {
      return 'Günlük kayıt tutmaya başlayın - recovery\'nin temeli!';
    }
    
    if (stats.clinicalProgress.riskLevel === 'high') {
      return 'Profesyonel destek alın - ruh sağlığınız öncelikli!';
    }
    
    return 'Düzenli kayıt tutarak iyileşme yolculuğunuzu sürdürün!';
  }
}

// =============================================================================
// 🎯 SINGLETON EXPORT
// =============================================================================

export const ocdGamificationService = OCDGamificationService.getInstance();
export type { 
  OCDAchievement, 
  OCDRecoveryMilestone, 
  OCDGamificationStats, 
  OCDGamificationAlert 
};
