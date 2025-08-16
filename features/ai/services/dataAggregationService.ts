import supabaseService from '@/services/supabase';

export interface UserDataAggregate {
  profile: any;
  symptoms: any;
  performance: any;
  patterns: any;
}

class AIDataAggregationService {
  private static instance: AIDataAggregationService;
  static getInstance(): AIDataAggregationService {
    if (!AIDataAggregationService.instance) {
      AIDataAggregationService.instance = new AIDataAggregationService();
    }
    return AIDataAggregationService.instance;
  }

  async aggregateUserData(userId: string): Promise<UserDataAggregate> {
    // skeleton implementation; replace with real pulls as needed
    const [compulsions, erpSessions] = await Promise.all([
      supabaseService.getCompulsions(userId),
      supabaseService.getERPSessions(userId),
    ]);

    return {
      profile: {},
      symptoms: {},
      performance: { erpCount: erpSessions.length, compulsionCount: compulsions.length },
      patterns: {},
    };
  }

  async prepareForAI(aggregate: UserDataAggregate): Promise<any> {
    return {
      behavioral_data: {
        erp_count: aggregate.performance?.erpCount ?? 0,
        compulsion_count: aggregate.performance?.compulsionCount ?? 0,
      },
    };
  }
}

export const aiDataAggregator = AIDataAggregationService.getInstance();
export default aiDataAggregator;


