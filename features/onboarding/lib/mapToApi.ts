import type { OnboardingPayload } from '../types';

export function mapOnboardingToUserMetadata(payload: OnboardingPayload) {
  const meta: any = {
    onboarding_v1: {
      motivation: payload.motivation,
      lifestyle: payload.lifestyle || {},
      reminders: payload.reminders || { enabled: false },
      feature_flags: payload.feature_flags || {},
      version: payload.meta?.version || 1,
      created_at: payload.meta?.created_at || new Date().toISOString(),
    }
  };
  return meta;
}

export function mapFirstMoodToCreateParams(userId: string, payload: OnboardingPayload) {
  const score = payload.first_mood?.score;
  const mood_score = score != null ? (score * 2) + 1 : 5; // 1..5 → approx 3,5,7,9,11 mapped to 1..10 scale heuristically
  return {
    user_id: userId,
    mood_score,
    energy_level: 5,
    anxiety_level: 5,
    notes: undefined,
    triggers: payload.first_mood?.tags || [],
    activities: [],
  };
}


