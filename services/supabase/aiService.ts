import type { SupabaseClient } from '@supabase/supabase-js';

export class AIService {
  constructor(private client: SupabaseClient) {}

  async upsertAIProfile(userId: string, profileData: any, onboardingCompleted: boolean = true): Promise<void> {
    const payload: any = {
      user_id: userId,
      profile_data: profileData,
      onboarding_completed: onboardingCompleted,
      updated_at: new Date().toISOString(),
    };
    if (onboardingCompleted) payload.completed_at = new Date().toISOString();
    const { error } = await this.client
      .from('ai_profiles')
      .upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async upsertAITreatmentPlan(userId: string, planData: any, status: string = 'active'): Promise<void> {
    const payload = {
      user_id: userId,
      plan_data: planData,
      status,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.client
      .from('ai_treatment_plans')
      .upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
  }
}

