import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';

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
      try { trackAIInteraction('AI_AGGREGATION_ERROR', { scope: 'fetchCompulsions', error: String(e) } as any); } catch {}
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
      try { trackAIInteraction('AI_AGGREGATION_ERROR', { scope: 'fetchERPSessions', error: String(e) } as any); } catch {}
    }
    return [];
  }
  private async fetchMoodEntries(userId: string, days: number): Promise<any[]> {
    const entries: any[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      const key = `mood_entries_${userId}_${date}`;
      try { const raw = await AsyncStorage.getItem(key); if (raw) entries.push(...JSON.parse(raw)); } catch {}
    }
    return entries;
  }
  private async fetchUserProfile(userId: string): Promise<any> {
    try {
      const raw = await AsyncStorage.getItem(`ai_user_profile_${userId}`);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      try { trackAIInteraction('AI_AGGREGATION_ERROR', { scope: 'fetchUserProfile', error: String(e) } as any); } catch {}
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


