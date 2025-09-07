export type OnboardingPayload = any;

// Maps onboarding payload to user_profiles row body used for Supabase upsert
export function mapOnboardingPayloadToUserProfileRow(userId: string, payload: OnboardingPayload) {
  const mapEnum = (val: any, allowed: string[], normalize?: (s: string) => string): string | undefined => {
    if (!val || typeof val !== 'string') return undefined;
    const base = (normalize ? normalize(val) : val).trim().toLowerCase().replace(/-/g, '_');
    return allowed.includes(base) ? base : undefined;
  };

  const genderRaw = payload?.profile?.gender;
  const lifestyleExerciseRaw = payload?.lifestyle?.exercise;
  const lifestyleSocialRaw = payload?.lifestyle?.social;

  const gender = mapEnum(genderRaw, ['female','male','non_binary','prefer_not_to_say']);
  const lifestyle_exercise = mapEnum(lifestyleExerciseRaw, ['none','light','moderate','intense']);
  const lifestyle_social = mapEnum(lifestyleSocialRaw, ['low','medium','high']);
  const motivations = Array.isArray(payload?.motivation) ? payload.motivation.filter((m: any) => typeof m === 'string') : [];
  const firstMoodScoreRaw = payload?.first_mood?.score;
  const first_mood_score = typeof firstMoodScoreRaw === 'number' ? Math.min(5, Math.max(1, firstMoodScoreRaw)) : (firstMoodScoreRaw != null ? Number(firstMoodScoreRaw) : null);
  const first_mood_tags = Array.isArray(payload?.first_mood?.tags) ? payload.first_mood.tags.filter((t: any) => typeof t === 'string') : [];

  return {
    user_id: userId,
    age: payload?.profile?.age,
    gender,
    locale: payload?.profile?.locale,
    timezone: payload?.profile?.timezone || payload?.reminders?.timezone,
    motivations,
    first_mood_score: first_mood_score != null ? Number(first_mood_score) : null,
    first_mood_tags,
    lifestyle_sleep_hours: payload?.lifestyle?.sleep_hours,
    lifestyle_exercise,
    lifestyle_social,
    reminder_enabled: !!payload?.reminders?.enabled,
    reminder_time: payload?.reminders?.time || null,
    reminder_days: payload?.reminders?.days || [],
    feature_flags: payload?.feature_flags || {},
    consent_accepted: !!payload?.consent?.accepted,
    consent_at: payload?.consent?.accepted ? new Date().toISOString() : null,
    onboarding_version: 2,
    onboarding_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

