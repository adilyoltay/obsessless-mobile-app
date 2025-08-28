import aiDataAggregator from '@/features/ai/services/dataAggregationService';

class EnhancedTreatmentPlanningEngine {
  private static instance: EnhancedTreatmentPlanningEngine;
  static getInstance(): EnhancedTreatmentPlanningEngine {
    if (!EnhancedTreatmentPlanningEngine.instance) {
      EnhancedTreatmentPlanningEngine.instance = new EnhancedTreatmentPlanningEngine();
    }
    return EnhancedTreatmentPlanningEngine.instance;
  }

  async generateDataDrivenTreatmentPlan(userId: string): Promise<any> {
    try {
      let aggregate: any = null;
      try {
        const { enhancedAIDataAggregator } = await import('@/features/ai/pipeline/enhancedDataAggregation');
        aggregate = await enhancedAIDataAggregator.aggregateComprehensiveData(userId);
      } catch {
        aggregate = await aiDataAggregator.aggregateUserData(userId);
      }
      const aiReady = await aiDataAggregator.prepareForAI(aggregate);
      // Heuristic personalization using enhanced aggregate
      const triggers: string[] = Array.isArray(aggregate?.patterns?.commonTriggers) ? aggregate.patterns.commonTriggers : [];
      const peakTimes: string[] = Array.isArray(aggregate?.patterns?.peakAnxietyTimes) ? aggregate.patterns.peakAnxietyTimes : [];
      // ✅ REMOVED: therapyCompletionRate - ERP module deleted
      const practiceConsistency: number = Number(aggregate?.performance?.weeklyActivity ?? 100);
      const priorityCategory: string | undefined = Array.isArray(aggregate?.symptoms?.primaryCategories) ? aggregate.symptoms.primaryCategories[0] : undefined;
      const personalized = {
        interventions: [
          practiceConsistency < 50 ? { type: 'micro_interventions', rationale: 'Düşük aktivite sürekliliği - kısa ama sık pratik', priority: 'high' } : { type: 'behavioral_practice', priority: 'medium' },
          triggers[0] ? { type: 'trigger_exposure', trigger: triggers[0], priority: 'high' } : null,
        ].filter(Boolean),
        schedule: peakTimes.slice(0, 2).map(t => ({ time: t, suggestion: 'nefes + mindfulness', durationMin: 5 })),
        focus: priorityCategory,
      };
      return { ...personalized, meta: aiReady };
    } catch (e) {
      return { interventions: [], schedule: [], fallback: true };
    }
  }
}

export const enhancedTreatmentPlanning = EnhancedTreatmentPlanningEngine.getInstance();
export default enhancedTreatmentPlanning;


