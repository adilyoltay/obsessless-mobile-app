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
      const aggregate = await aiDataAggregator.aggregateUserData(userId);
      const aiReady = await aiDataAggregator.prepareForAI(aggregate);
      // placeholder model call
      const modelResult = { interventions: [], schedule: [] };
      return { ...modelResult, meta: aiReady };
    } catch (e) {
      return { interventions: [], schedule: [], fallback: true };
    }
  }
}

export const enhancedTreatmentPlanning = EnhancedTreatmentPlanningEngine.getInstance();
export default enhancedTreatmentPlanning;


