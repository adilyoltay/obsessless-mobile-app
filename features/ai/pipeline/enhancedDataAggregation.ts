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
    const [compulsions, erpSessions, moodEntries, profile] = await Promise.all([
      this.fetchCompulsions(userId, 30),
      this.fetchERPSessions(userId, 30),
      this.fetchMoodEntries(userId, 30),
      this.fetchUserProfile(userId)
    ]);

    const symptoms = await this.analyzeSymptoms(compulsions, moodEntries);
    const performance = await this.calculateDetailedPerformance(erpSessions, compulsions);
    const patterns = await this.extractAdvancedPatterns(compulsions, moodEntries, erpSessions);
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
  private async fetchERPSessions(userId: string, days: number): Promise<any[]> {
    try {
      const svc: any = supabaseService as any;
      if (svc && typeof svc.getERPSessions === 'function') {
        return await svc.getERPSessions.call(svc, userId);
      }
    } catch (e) {
      try { trackAIInteraction(AIEventType.API_ERROR, { scope: 'fetchERPSessions', error: String(e) } as any); } catch {}
    }
    return [];
  }
  private async fetchMoodEntries(userId: string, days: number): Promise<any[]> {
    // Prefer local cached by day, fallback remote
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
    // Remote fallback
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await (supabaseService as any).supabaseClient
        .from('mood_tracking')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (!error && data) return data.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        mood_score: d.mood_score,
        energy_level: d.energy_level,
        anxiety_level: d.anxiety_level,
        notes: d.notes,
        triggers: d.triggers,
        activities: d.activities,
        timestamp: d.created_at
      }));
    } catch {}
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
    compulsions.forEach(c => {
      const k = c.category || 'other';
      categoryFreq.set(k, (categoryFreq.get(k) || 0) + 1);
    });
    const primaryCategories = Array.from(categoryFreq.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
    return { primaryCategories, severityTrend: 'stable' };
  }
  private async calculateDetailedPerformance(erp: any[], comp: any[]): Promise<any> {
    return { erpCompletionRate: erp.length === 0 ? 100 : Math.round((erp.filter((e:any)=>e.completed).length/erp.length)*100), streakDays: 0 };
  }
  private async extractAdvancedPatterns(compulsions: any[], moods: any[], erpSessions: any[]): Promise<any> {
    return { timeBasedPatterns: [], successFactors: [], riskPeriods: [] };
  }
  private async generateInsights(symptoms: any, performance: any, patterns: any): Promise<any> {
    return { key_findings: [], improvement_areas: [], strengths: [], warnings: [] };
  }
  private async generateRecommendations(insights: any, symptoms: any, performance: any): Promise<any> {
    return { immediate: [], weekly: [], longTerm: [] };
  }
}

export const enhancedAIDataAggregator = EnhancedAIDataAggregationService.getInstance();
export default enhancedAIDataAggregator;


