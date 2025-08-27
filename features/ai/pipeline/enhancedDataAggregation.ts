import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

export interface EnhancedUserDataAggregate {
  profile: any;
  symptoms: any;
  performance: any;
  patterns: any;
  insights: any;
  recommendations: any;
}

class EnhancedAIDataAggregationService {
  private static instance: EnhancedAIDataAggregationService;
  static getInstance(): EnhancedAIDataAggregationService {
    if (!EnhancedAIDataAggregationService.instance) {
      EnhancedAIDataAggregationService.instance = new EnhancedAIDataAggregationService();
    }
    return EnhancedAIDataAggregationService.instance;
  }

  async aggregateComprehensiveData(userId: string): Promise<EnhancedUserDataAggregate> {
    const [compulsions, moodEntries, profile] = await Promise.all([
      this.fetchCompulsions(userId, 30),
      // ✅ REMOVED: fetchTerapiSessions - ERP module deleted
      this.fetchMoodEntries(userId, 30),
      this.fetchUserProfile(userId)
    ]);

    const symptoms = await this.analyzeSymptoms(compulsions, moodEntries);
    const performance = await this.calculateDetailedPerformance(compulsions);
    const patterns = await this.extractAdvancedPatterns(compulsions, moodEntries);
    const insights = await this.generateInsights(symptoms, performance, patterns);
    const recommendations = await this.generateRecommendations(insights, symptoms, performance);

    return { profile, symptoms, performance, patterns, insights, recommendations };
  }

  private async fetchCompulsions(userId: string, days: number): Promise<any[]> {
    try {
      const svc: any = supabaseService as any;
      if (svc && typeof svc.getCompulsions === 'function') {
        return await svc.getCompulsions.call(svc, userId);
      }
    } catch (e) {
      try { trackAIInteraction(AIEventType.API_ERROR, { scope: 'fetchCompulsions', error: String(e) } as any); } catch {}
    }
    return [];
  }
  // ✅ REMOVED: fetchTerapiSessions method - ERP module deleted
  private async fetchMoodEntries(userId: string, days: number): Promise<any[]> {
    // Prefer local cached by day, fallback remote via supabaseService
    const entries: any[] = [];
    try {
      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        const key = `mood_entries_${userId}_${date}`;
        const raw = await AsyncStorage.getItem(key);
        if (raw) entries.push(...JSON.parse(raw));
      }
      if (entries.length > 0) return entries;
    } catch {}
    
    // Remote fallback - Use supabaseService.getMoodEntries (canonical mood_entries table)
    try {
      const remoteData = await supabaseService.getMoodEntries(userId, days);
      if (remoteData && remoteData.length > 0) {
        // Map data to expected format (already in correct format from getMoodEntries)
        return remoteData.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          mood_score: d.mood_score,
          energy_level: d.energy_level,
          anxiety_level: d.anxiety_level,
          notes: d.notes,
          triggers: d.triggers,
          activities: d.activities,
          timestamp: d.created_at || d.timestamp
        }));
      }
    } catch (error) {
      console.log('❌ Failed to fetch remote mood entries:', error);
    }
    return entries;
  }
  private async fetchUserProfile(userId: string): Promise<any> {
    // Prefer remote (Supabase) profile for cross-device continuity
    try {
      const svc: any = supabaseService as any;
      if (svc && svc.supabaseClient) {
        const { data, error } = await svc.supabaseClient
          .from('ai_profiles')
          .select('profile_data')
          .eq('user_id', userId)
          .single();
        if (!error && data?.profile_data) {
          return data.profile_data;
        }
      }
    } catch {}

    // Fallback to local
    try {
      const raw = await AsyncStorage.getItem(`ai_user_profile_${userId}`);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      try { trackAIInteraction(AIEventType.API_ERROR, { scope: 'fetchUserProfile', error: String(e) } as any); } catch {}
      return {};
    }
  }

  private async analyzeSymptoms(compulsions: any[], moods: any[]): Promise<any> {
    const categoryFreq = new Map<string, number>();
    const severityByCategory = new Map<string, number[]>();
    const timePatterns = new Map<string, number[]>();
    compulsions.forEach((c) => {
      const category = c.category || 'other';
      const hour = new Date(c.timestamp || c.created_at || Date.now()).getHours();
      categoryFreq.set(category, (categoryFreq.get(category) || 0) + 1);
      if (!severityByCategory.has(category)) severityByCategory.set(category, []);
      severityByCategory.get(category)!.push(Number(c.resistance_level ?? 5));
      if (!timePatterns.has(category)) timePatterns.set(category, Array(24).fill(0));
      timePatterns.get(category)![hour]++;
    });

    const primaryCategories = Array.from(categoryFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    // Severity trend
    let severityTrend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (compulsions.length >= 7) {
      const recent = compulsions.slice(-7);
      const previous = compulsions.slice(-14, -7);
      if (previous.length > 0) {
        const recentAvg = recent.reduce((s, c) => s + Number(c.resistance_level ?? 5), 0) / recent.length;
        const prevAvg = previous.reduce((s, c) => s + Number(c.resistance_level ?? 5), 0) / previous.length;
        if (recentAvg > prevAvg + 1) severityTrend = 'improving';
        else if (recentAvg < prevAvg - 1) severityTrend = 'worsening';
      }
    }

    // Peak hours
    const peakHours: number[] = [];
    timePatterns.forEach((hours) => {
      const maxCount = Math.max(...hours);
      hours.forEach((count, hour) => {
        if (count === maxCount && count > 0) peakHours.push(hour);
      });
    });

    // Mood correlation approximation
    const anxietyLevels = moods.map((m) => Number(m.anxiety_level ?? 5));
    const avgAnxiety = anxietyLevels.length > 0 ? anxietyLevels.reduce((a, b) => a + b, 0) / anxietyLevels.length : 5;

    return {
      primaryCategories,
      severityTrend,
      averageSeverity:
        compulsions.length > 0
          ? compulsions.reduce((sum, c) => sum + Number(c.resistance_level ?? 5), 0) / compulsions.length
          : 0,
      peakHours: Array.from(new Set(peakHours)).sort((a, b) => a - b),
      anxietyCorrelation: avgAnxiety > 7 ? 'high' : avgAnxiety > 4 ? 'moderate' : 'low',
      totalCompulsions: compulsions.length,
      categoryCounts: Object.fromEntries(categoryFreq),
    };
  }

  private async calculateDetailedPerformance(comp: any[]): Promise<any> {
    // ✅ REMOVED: ERP sessions logic - ERP module deleted

    // Streak calculation (activity per day) - only compulsions
    let streakDays = 0;
    const today = new Date();
    const activityDates = new Set<string>();
    comp.forEach((item: any) => {
      const ts = item.timestamp || item.created_at;
      if (!ts) return;
      activityDates.add(new Date(ts).toDateString());
    });
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today.getTime() - i * 86400000).toDateString();
      if (activityDates.has(checkDate)) streakDays++;
      else if (i > 0) break;
    }

    // Resistance improvement week over week
    let resistanceImprovement = 0;
    if (comp.length >= 14) {
      const recent = comp.slice(-7);
      const previous = comp.slice(-14, -7);
      if (previous.length > 0) {
        const recentAvg = recent.reduce((s: number, c: any) => s + Number(c.resistance_level ?? 0), 0) / recent.length;
        const prevAvg = previous.reduce((s: number, c: any) => s + Number(c.resistance_level ?? 0), 0) / previous.length;
        resistanceImprovement = ((recentAvg - prevAvg) / (prevAvg || 1)) * 100;
      }
    }

    return {
      // ✅ REMOVED: erpCompletionRate, anxietyReduction, totalTerapiSessions, completedTerapiSessions - ERP module deleted
      streakDays,
      resistanceImprovement: Math.round(resistanceImprovement),
      weeklyActivity: Math.round((activityDates.size / 7) * 100),
      totalCompulsions: comp.length,
    };
  }

  private async extractAdvancedPatterns(compulsions: any[], moods: any[]): Promise<any> {
    // ✅ REMOVED: erpSessions parameter - ERP module deleted
    // Placeholder for future advanced pattern mining; keep basic structure
    return { timeBasedPatterns: [], successFactors: [], riskPeriods: [] };
  }

  private async generateInsights(symptoms: any, performance: any, patterns: any): Promise<any> {
    const insights = { key_findings: [] as string[], improvement_areas: [] as string[], strengths: [] as string[], warnings: [] as string[] };
    if (symptoms.severityTrend === 'improving') insights.key_findings.push('Kompulsiyon direncinde iyileşme gözleniyor');
    if (performance.streakDays >= 7) insights.key_findings.push(`${performance.streakDays} gündür düzenli aktivite`);
    // ✅ REMOVED: Anxiety reduction finding - ERP module deleted

    // ✅ REMOVED: ERP completion rate check - ERP module deleted
    if (symptoms.primaryCategories && symptoms.primaryCategories.length > 0) insights.improvement_areas.push(`${symptoms.primaryCategories[0]} kompulsiyonlarına odaklanın`);

    if (performance.streakDays > 0) insights.strengths.push('Düzenli kullanım alışkanlığı');
    if (performance.resistanceImprovement > 10) insights.strengths.push('Kompulsiyonlara karşı direnç artıyor');

    if (symptoms.severityTrend === 'worsening') insights.warnings.push('Son hafta kompulsiyon şiddeti artmış olabilir');
    if (symptoms.anxietyCorrelation === 'high') insights.warnings.push('Anksiyete seviyeleri yüksek');
    return insights;
  }

  private async generateRecommendations(insights: any, symptoms: any, performance: any): Promise<any> {
    const recommendations = { immediate: [] as any[], weekly: [] as any[], longTerm: [] as any[] };
    if (symptoms.peakHours && symptoms.peakHours.length > 0) {
      const peak = symptoms.peakHours[0];
      recommendations.immediate.push({ type: 'timing', title: 'Kritik Saat Uyarısı', description: `Kompulsiyonlar genelde ${peak}:00 civarında artıyor`, action: 'Hatırlatıcı kur' });
    }
    // ✅ REMOVED: ERP completion rate recommendation - ERP module deleted
    if (symptoms.primaryCategories && symptoms.primaryCategories.length > 0) {
      const top = symptoms.primaryCategories[0];
      recommendations.weekly.push({ type: 'focus', title: `${top} kompulsiyonlarına odaklan`, description: `Bu hafta ${top} kategorisinde çalışın`, action: 'Plan oluştur' });
    }
    if (performance.streakDays < 7) {
      recommendations.longTerm.push({ type: 'habit', title: 'Düzenli Takip Alışkanlığı', description: '21 günlük takip hedefi belirleyin', action: 'Hedef belirle' });
    }
    return recommendations;
  }
}

export const enhancedAIDataAggregator = EnhancedAIDataAggregationService.getInstance();
export default enhancedAIDataAggregator;


