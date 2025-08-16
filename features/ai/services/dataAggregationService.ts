import supabaseService from '@/services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineSyncService } from '@/services/offlineSync';
import { moodTracker } from '@/services/moodTrackingService';
import { dataStandardizer } from '@/utils/dataStandardization';
import { startOfWeek, endOfWeek, subDays, differenceInDays } from 'date-fns';

export interface UserDataAggregate {
  profile: {
    demographics: any;
    ocdHistory: any;
    culturalContext: any;
    treatmentPreferences: any;
  };
  symptoms: {
    ybocsScore: number;
    dominantCategories: string[];
    severityTrend: 'improving' | 'stable' | 'worsening';
    symptomDistribution: Record<string, number>;
  };
  performance: {
    erpCompletionRate: number;
    averageAnxietyReduction: number;
    streakDays: number;
    totalSessions: number;
    weeklyGoalProgress: number;
  };
  patterns: {
    peakAnxietyTimes: string[];
    commonTriggers: string[];
    resistancePatterns: any[];
    beneficialActivities: string[];
    difficultSituations: string[];
  };
}

interface TimePattern {
  hour: number;
  avgAnxiety: number;
  avgMood: number;
  activityCount: number;
}

class AIDataAggregationService {
  private static instance: AIDataAggregationService;
  
  static getInstance(): AIDataAggregationService {
    if (!AIDataAggregationService.instance) {
      AIDataAggregationService.instance = new AIDataAggregationService();
    }
    return AIDataAggregationService.instance;
  }

  /**
   * Kullanıcı verilerini topla ve AI için hazırla
   */
  async aggregateUserData(userId: string): Promise<UserDataAggregate> {
    try {
      // Paralel veri toplama - tüm veri kaynaklarını aynı anda çek
      const [
        profile,
        erpSessions,
        compulsions,
        achievements,
        moodData,
        onboardingData
      ] = await Promise.all([
        this.getUserProfile(userId),
        this.getERPHistory(userId),
        this.getCompulsionHistory(userId),
        this.getAchievements(userId),
        moodTracker.getMoodHistory(userId, 14), // Son 14 gün
        this.getOnboardingData(userId)
      ]);

      // Veri analizi ve pattern çıkarma
      const patterns = await this.extractPatterns({
        erpSessions,
        compulsions,
        moodData
      });

      // Performans metrikleri hesapla
      const performance = this.calculatePerformanceMetrics({
        erpSessions,
        compulsions,
        achievements
      });

      // Semptom analizi
      const symptoms = await this.analyzeSymptoms({
        profile,
        compulsions,
        erpSessions,
        onboardingData
      });

      return {
        profile: {
          demographics: profile.demographics || {},
          ocdHistory: profile.ocdHistory || {},
          culturalContext: profile.culturalContext || {},
          treatmentPreferences: profile.treatmentPreferences || {}
        },
        symptoms,
        performance,
        patterns
      };
    } catch (error) {
      console.error('Veri toplama hatası:', error);
      // Fallback değerler döndür
      return this.getDefaultAggregate();
    }
  }

  /**
   * Kullanıcı profilini getir
   */
  private async getUserProfile(userId: string): Promise<any> {
    try {
      // Local storage'dan profil verilerini al
      const profileKey = `user_profile_${userId}`;
      const profileData = await AsyncStorage.getItem(profileKey);
      
      if (profileData) {
        return JSON.parse(profileData);
      }

      // Supabase'den çek
      const { data, error } = await supabaseService.client
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      // Cache'e kaydet
      if (data) {
        await AsyncStorage.setItem(profileKey, JSON.stringify(data));
      }

      return data || {};
    } catch (error) {
      console.error('Profil getirme hatası:', error);
      return {};
    }
  }

  /**
   * ERP geçmişini getir
   */
  private async getERPHistory(userId: string, days: number = 30): Promise<any[]> {
    try {
      // Önce local'den al
      const localSessions = await offlineSyncService.getLocalERPSessions();
      const userSessions = localSessions.filter(s => s.user_id === userId);

      // Tarih filtresi uygula
      const cutoffDate = subDays(new Date(), days);
      const recentSessions = userSessions.filter(s => 
        new Date(s.timestamp || s.createdAt) >= cutoffDate
      );

      // Standardize et
      const standardized = await Promise.all(
        recentSessions.map(s => dataStandardizer.standardizeERPSessionData(s))
      );

      return standardized;
    } catch (error) {
      console.error('ERP geçmişi getirme hatası:', error);
      return [];
    }
  }

  /**
   * Kompulsiyon geçmişini getir
   */
  private async getCompulsionHistory(userId: string, days: number = 30): Promise<any[]> {
    try {
      const localCompulsions = await offlineSyncService.getLocalCompulsions();
      const userCompulsions = localCompulsions.filter(c => c.user_id === userId);

      const cutoffDate = subDays(new Date(), days);
      const recentCompulsions = userCompulsions.filter(c => 
        new Date(c.timestamp || c.createdAt) >= cutoffDate
      );

      // Standardize et
      const standardized = await Promise.all(
        recentCompulsions.map(c => dataStandardizer.standardizeCompulsionData(c))
      );

      return standardized;
    } catch (error) {
      console.error('Kompulsiyon geçmişi getirme hatası:', error);
      return [];
    }
  }

  /**
   * Achievement verilerini getir
   */
  private async getAchievements(userId: string): Promise<any> {
    try {
      const key = `ach_unlocks_${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Onboarding verilerini getir
   */
  private async getOnboardingData(userId: string): Promise<any> {
    try {
      const key = `onboarding_data_${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  /**
   * Pattern extraction algoritması
   */
  private async extractPatterns(data: {
    erpSessions: any[];
    compulsions: any[];
    moodData: any[];
  }): Promise<UserDataAggregate['patterns']> {
    const { erpSessions, compulsions, moodData } = data;

    // Zaman bazlı pattern analizi
    const timePatterns = this.analyzeTimePatterns(compulsions, moodData);
    
    // Tetikleyici analizi
    const triggerAnalysis = this.analyzeTriggers(compulsions, moodData);
    
    // Direnç pattern'leri
    const resistancePatterns = this.analyzeResistancePatterns(compulsions, erpSessions);
    
    // Faydalı aktiviteler
    const beneficialActivities = this.identifyBeneficialActivities(moodData, erpSessions);
    
    // Zor durumlar
    const difficultSituations = this.identifyDifficultSituations(compulsions, erpSessions);

    return {
      peakAnxietyTimes: timePatterns.peakHours,
      commonTriggers: triggerAnalysis.topTriggers,
      resistancePatterns,
      beneficialActivities,
      difficultSituations
    };
  }

  /**
   * Zaman pattern analizi
   */
  private analyzeTimePatterns(compulsions: any[], moodData: any[]): any {
    const hourData: TimePattern[] = new Array(24).fill(null).map((_, hour) => ({
      hour,
      avgAnxiety: 0,
      avgMood: 0,
      activityCount: 0
    }));

    // Kompulsiyon zamanlarını analiz et
    compulsions.forEach(c => {
      const hour = new Date(c.timestamp).getHours();
      hourData[hour].activityCount++;
    });

    // Mood verilerini analiz et
    const hourAnxiety: number[][] = new Array(24).fill(null).map(() => []);
    const hourMood: number[][] = new Array(24).fill(null).map(() => []);

    moodData.forEach(m => {
      const hour = new Date(m.timestamp).getHours();
      if (m.anxiety_level) hourAnxiety[hour].push(m.anxiety_level);
      if (m.mood_score) hourMood[hour].push(m.mood_score);
    });

    // Ortalamaları hesapla
    hourData.forEach((data, hour) => {
      data.avgAnxiety = hourAnxiety[hour].length > 0
        ? hourAnxiety[hour].reduce((a, b) => a + b, 0) / hourAnxiety[hour].length
        : 0;
      data.avgMood = hourMood[hour].length > 0
        ? hourMood[hour].reduce((a, b) => a + b, 0) / hourMood[hour].length
        : 0;
    });

    // En yoğun 3 saat
    const peakHours = hourData
      .sort((a, b) => b.avgAnxiety - a.avgAnxiety)
      .slice(0, 3)
      .map(item => `${item.hour}:00`);

    return { peakHours, hourlyDistribution: hourData };
  }

  /**
   * Tetikleyici analizi
   */
  private analyzeTriggers(compulsions: any[], moodData: any[]): any {
    const triggerCounts: Map<string, number> = new Map();

    // Kompulsiyon tetikleyicileri
    compulsions.forEach(c => {
      if (c.trigger) {
        const trigger = c.trigger.toLowerCase().trim();
        triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
      }
    });

    // Mood tetikleyicileri
    moodData.forEach(m => {
      if (m.triggers && Array.isArray(m.triggers)) {
        m.triggers.forEach((trigger: string) => {
          const normalized = trigger.toLowerCase().trim();
          triggerCounts.set(normalized, (triggerCounts.get(normalized) || 0) + 1);
        });
      }
    });

    // En yaygın tetikleyiciler
    const topTriggers = Array.from(triggerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trigger]) => trigger);

    return { topTriggers, allTriggers: triggerCounts };
  }

  /**
   * Direnç pattern analizi
   */
  private analyzeResistancePatterns(compulsions: any[], erpSessions: any[]): any[] {
    const patterns: any[] = [];

    // Başarılı direnç zamanları
    const successfulResistance = compulsions.filter(c => 
      c.resistance_level && c.resistance_level >= 7
    );

    // ERP sonrası iyileşmeler
    const improvedAfterERP = erpSessions.filter(s => 
      s.completed && (s.anxiety_initial - s.anxiety_final) >= 2
    );

    // Pattern'leri derle
    if (successfulResistance.length > 0) {
      patterns.push({
        type: 'high_resistance',
        count: successfulResistance.length,
        avgResistanceLevel: successfulResistance.reduce((sum, c) => 
          sum + c.resistance_level, 0) / successfulResistance.length
      });
    }

    if (improvedAfterERP.length > 0) {
      patterns.push({
        type: 'erp_effectiveness',
        count: improvedAfterERP.length,
        avgImprovement: improvedAfterERP.reduce((sum, s) => 
          sum + (s.anxiety_initial - s.anxiety_final), 0) / improvedAfterERP.length
      });
    }

    return patterns;
  }

  /**
   * Faydalı aktiviteleri belirle
   */
  private identifyBeneficialActivities(moodData: any[], erpSessions: any[]): string[] {
    const activities: Set<string> = new Set();

    // Mood'u iyileştiren aktiviteler
    moodData.forEach(m => {
      if (m.mood_score >= 7 && m.activities) {
        m.activities.forEach((activity: string) => activities.add(activity));
      }
    });

    // Başarılı ERP egzersizleri
    erpSessions
      .filter(s => s.completed && s.anxiety_final < s.anxiety_initial)
      .forEach(s => {
        if (s.exercise_name) activities.add(`ERP: ${s.exercise_name}`);
      });

    return Array.from(activities).slice(0, 5);
  }

  /**
   * Zor durumları belirle
   */
  private identifyDifficultSituations(compulsions: any[], erpSessions: any[]): string[] {
    const situations: Map<string, number> = new Map();

    // Yüksek anksiyeteli kompulsiyonlar
    compulsions
      .filter(c => c.resistance_level && c.resistance_level <= 3)
      .forEach(c => {
        if (c.trigger) {
          situations.set(c.trigger, (situations.get(c.trigger) || 0) + 1);
        }
      });

    // Tamamlanamayan ERP'ler
    erpSessions
      .filter(s => !s.completed || s.anxiety_final >= 8)
      .forEach(s => {
        if (s.category) {
          const situation = `${s.category} egzersizleri`;
          situations.set(situation, (situations.get(situation) || 0) + 1);
        }
      });

    return Array.from(situations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([situation]) => situation);
  }

  /**
   * Performans metrikleri hesaplama
   */
  private calculatePerformanceMetrics(data: {
    erpSessions: any[];
    compulsions: any[];
    achievements: any[];
  }): UserDataAggregate['performance'] {
    const { erpSessions, compulsions, achievements } = data;

    // ERP tamamlama oranı
    const completedSessions = erpSessions.filter(s => s.completed).length;
    const completionRate = erpSessions.length > 0 
      ? Math.round((completedSessions / erpSessions.length) * 100)
      : 0;

    // Ortalama anksiyete azalması
    const anxietyReductions = erpSessions
      .filter(s => s.completed && s.anxiety_initial && s.anxiety_final)
      .map(s => s.anxiety_initial - s.anxiety_final);
    
    const avgReduction = anxietyReductions.length > 0
      ? Math.round(anxietyReductions.reduce((a, b) => a + b, 0) / anxietyReductions.length * 10) / 10
      : 0;

    // Streak hesaplama
    const streakDays = this.calculateStreak(erpSessions);

    // Haftalık hedef ilerlemesi
    const weeklyGoalProgress = this.calculateWeeklyProgress(erpSessions);

    return {
      erpCompletionRate: completionRate,
      averageAnxietyReduction: avgReduction,
      streakDays,
      totalSessions: erpSessions.length,
      weeklyGoalProgress
    };
  }

  /**
   * Streak hesaplama
   */
  private calculateStreak(sessions: any[]): number {
    if (sessions.length === 0) return 0;

    // Tarihleri sırala
    const dates = sessions
      .map(s => new Date(s.timestamp).toDateString())
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const today = new Date().toDateString();
    
    // Bugünden geriye doğru kontrol et
    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (dates[i] === expectedDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Haftalık ilerleme hesaplama
   */
  private calculateWeeklyProgress(sessions: any[]): number {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    const weekSessions = sessions.filter(s => {
      const sessionDate = new Date(s.timestamp);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    });

    // Hedef: Haftada 7 session
    const targetSessions = 7;
    const progress = Math.min(100, Math.round((weekSessions.length / targetSessions) * 100));

    return progress;
  }

  /**
   * Semptom analizi
   */
  private async analyzeSymptoms(data: {
    profile: any;
    compulsions: any[];
    erpSessions: any[];
    onboardingData: any;
  }): Promise<UserDataAggregate['symptoms']> {
    const { profile, compulsions, erpSessions, onboardingData } = data;

    // Y-BOCS skoru
    const ybocsScore = onboardingData.ybocsScore || profile.ybocs_score || 0;

    // Kategori dağılımı
    const categoryCount: Map<string, number> = new Map();
    
    compulsions.forEach(c => {
      if (c.category) {
        const standardized = dataStandardizer.standardizeCategory(c.category);
        categoryCount.set(standardized, (categoryCount.get(standardized) || 0) + 1);
      }
    });

    // Dominant kategoriler
    const dominantCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);

    // Semptom dağılımı
    const totalCompulsions = compulsions.length || 1;
    const symptomDistribution: Record<string, number> = {};
    
    categoryCount.forEach((count, category) => {
      symptomDistribution[category] = Math.round((count / totalCompulsions) * 100);
    });

    // Trend analizi
    const severityTrend = this.analyzeSeverityTrend(compulsions, erpSessions);

    return {
      ybocsScore: dataStandardizer.standardizeYBOCSScore(ybocsScore),
      dominantCategories,
      severityTrend,
      symptomDistribution
    };
  }

  /**
   * Şiddet trendi analizi
   */
  private analyzeSeverityTrend(compulsions: any[], erpSessions: any[]): 'improving' | 'stable' | 'worsening' {
    // Son 2 hafta vs önceki 2 hafta
    const twoWeeksAgo = subDays(new Date(), 14);
    const fourWeeksAgo = subDays(new Date(), 28);

    const recentCompulsions = compulsions.filter(c => 
      new Date(c.timestamp) >= twoWeeksAgo
    );
    
    const olderCompulsions = compulsions.filter(c => {
      const date = new Date(c.timestamp);
      return date >= fourWeeksAgo && date < twoWeeksAgo;
    });

    const recentERPs = erpSessions.filter(s => 
      new Date(s.timestamp) >= twoWeeksAgo && s.completed
    );

    // Metrikler
    const recentCompulsionRate = recentCompulsions.length / 14;
    const olderCompulsionRate = olderCompulsions.length / 14;
    const erpSuccessRate = recentERPs.length / 14;

    // Trend belirleme
    if (recentCompulsionRate < olderCompulsionRate * 0.8 && erpSuccessRate > 0.5) {
      return 'improving';
    } else if (recentCompulsionRate > olderCompulsionRate * 1.2) {
      return 'worsening';
    }

    return 'stable';
  }

  /**
   * AI-ready format'a dönüştürme
   */
  async prepareForAI(aggregate: UserDataAggregate): Promise<any> {
    return {
      user_context: {
        age: aggregate.profile.demographics?.age,
        gender: aggregate.profile.demographics?.gender,
        cultural_background: aggregate.profile.culturalContext,
        treatment_history: aggregate.profile.ocdHistory,
        preferences: aggregate.profile.treatmentPreferences
      },
      clinical_data: {
        ybocs_score: aggregate.symptoms.ybocsScore,
        severity_level: this.mapSeverityLevel(aggregate.symptoms.ybocsScore),
        dominant_symptoms: aggregate.symptoms.dominantCategories,
        symptom_trend: aggregate.symptoms.severityTrend,
        symptom_distribution: aggregate.symptoms.symptomDistribution
      },
      behavioral_data: {
        erp_compliance: aggregate.performance.erpCompletionRate,
        anxiety_management: aggregate.performance.averageAnxietyReduction,
        consistency_score: aggregate.performance.streakDays,
        total_sessions: aggregate.performance.totalSessions,
        weekly_progress: aggregate.performance.weeklyGoalProgress
      },
      pattern_insights: {
        peak_difficulty_times: aggregate.patterns.peakAnxietyTimes,
        primary_triggers: aggregate.patterns.commonTriggers,
        effective_strategies: aggregate.patterns.beneficialActivities,
        challenging_areas: aggregate.patterns.difficultSituations,
        resistance_patterns: aggregate.patterns.resistancePatterns
      },
      recommendations_context: {
        preferred_intervention_times: this.calculateOptimalInterventionTimes(aggregate),
        avoid_triggers: aggregate.patterns.commonTriggers.slice(0, 3),
        strength_areas: this.identifyStrengths(aggregate),
        focus_areas: this.identifyFocusAreas(aggregate),
        personalization_hints: this.generatePersonalizationHints(aggregate)
      }
    };
  }

  /**
   * Şiddet seviyesi haritalama
   */
  private mapSeverityLevel(ybocsScore: number): string {
    if (ybocsScore <= 7) return 'subclinical';
    if (ybocsScore <= 15) return 'mild';
    if (ybocsScore <= 23) return 'moderate';
    if (ybocsScore <= 31) return 'severe';
    return 'extreme';
  }

  /**
   * Optimal müdahale zamanları
   */
  private calculateOptimalInterventionTimes(aggregate: UserDataAggregate): string[] {
    const peakTimes = aggregate.patterns.peakAnxietyTimes;
    
    // Peak zamanlardan 1 saat önce müdahale et
    return peakTimes.map(time => {
      const hour = parseInt(time.split(':')[0]);
      const optimalHour = hour > 0 ? hour - 1 : 23;
      return `${optimalHour}:00`;
    });
  }

  /**
   * Güçlü yönleri belirle
   */
  private identifyStrengths(aggregate: UserDataAggregate): string[] {
    const strengths: string[] = [];

    if (aggregate.performance.erpCompletionRate > 70) {
      strengths.push('Yüksek egzersiz tamamlama oranı');
    }

    if (aggregate.performance.averageAnxietyReduction > 2) {
      strengths.push('Etkili anksiyete yönetimi');
    }

    if (aggregate.performance.streakDays >= 7) {
      strengths.push('Tutarlı pratik alışkanlığı');
    }

    if (aggregate.patterns.beneficialActivities.length > 0) {
      strengths.push('Faydalı aktiviteleri belirleme becerisi');
    }

    return strengths;
  }

  /**
   * Odaklanılacak alanlar
   */
  private identifyFocusAreas(aggregate: UserDataAggregate): string[] {
    const focusAreas: string[] = [];

    if (aggregate.performance.erpCompletionRate < 50) {
      focusAreas.push('Egzersiz tamamlama oranını artırma');
    }

    if (aggregate.symptoms.severityTrend === 'worsening') {
      focusAreas.push('Semptom yönetimi stratejileri');
    }

    if (aggregate.patterns.difficultSituations.length > 3) {
      focusAreas.push('Zor durumlarla başa çıkma teknikleri');
    }

    if (aggregate.performance.streakDays < 3) {
      focusAreas.push('Düzenli pratik rutini oluşturma');
    }

    return focusAreas;
  }

  /**
   * Kişiselleştirme ipuçları
   */
  private generatePersonalizationHints(aggregate: UserDataAggregate): string[] {
    const hints: string[] = [];

    // Kültürel bağlam
    if (aggregate.profile.culturalContext?.religiousConsiderations) {
      hints.push('Dini hassasiyetlere uygun içerik');
    }

    // Cinsiyet bazlı
    if (aggregate.profile.demographics?.gender) {
      hints.push(`${aggregate.profile.demographics.gender} odaklı örnekler`);
    }

    // Yaş grubu
    const age = aggregate.profile.demographics?.age;
    if (age) {
      if (age < 25) hints.push('Genç yetişkin yaklaşımı');
      else if (age < 40) hints.push('Yetişkin profesyonel bağlam');
      else hints.push('Olgun yetişkin perspektifi');
    }

    return hints;
  }

  /**
   * Default aggregate (fallback)
   */
  private getDefaultAggregate(): UserDataAggregate {
    return {
      profile: {
        demographics: {},
        ocdHistory: {},
        culturalContext: {},
        treatmentPreferences: {}
      },
      symptoms: {
        ybocsScore: 0,
        dominantCategories: [],
        severityTrend: 'stable',
        symptomDistribution: {}
      },
      performance: {
        erpCompletionRate: 0,
        averageAnxietyReduction: 0,
        streakDays: 0,
        totalSessions: 0,
        weeklyGoalProgress: 0
      },
      patterns: {
        peakAnxietyTimes: [],
        commonTriggers: [],
        resistancePatterns: [],
        beneficialActivities: [],
        difficultSituations: []
      }
    };
  }
}

export const aiDataAggregator = AIDataAggregationService.getInstance();
export default aiDataAggregator;


