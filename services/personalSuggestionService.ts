export type PersonalSuggestion = {
  title: string;
  text: string;
  ctaText: string;
  route: string; // expo-router path e.g., '/(tabs)/breathwork'
  params?: Record<string, string>;
  icon?: string; // MaterialCommunityIcons name
  category: 'breathwork' | 'mood' | 'consistency';
};

type OnboardingPayloadLite = {
  motivation?: string[];
  first_mood?: { score?: number };
};

type TodayStatsLite = {
  healingPoints: number;
  moodCheckins: number;
  breathworkSessions: number;
  weeklyProgress: { mood: number; breathwork: number };
  breathworkAnxietyDelta: number;
};

type ProfileLite = {
  activeDaysThisWeek?: number;
  streakCurrent?: number;
};

export function buildPersonalSuggestion(
  payload: OnboardingPayloadLite | undefined,
  today: TodayStatsLite | undefined,
  profile: ProfileLite | undefined
): PersonalSuggestion | null {
  if (!today) return null;

  const motivations = payload?.motivation || [];
  const activeDays = profile?.activeDaysThisWeek ?? 0;
  const streak = profile?.streakCurrent ?? 0;
  const moodTodayCount = today.moodCheckins || 0;
  const breathTodayCount = today.breathworkSessions || 0;
  const breathDelta = today.breathworkAnxietyDelta || 0;

  const hasStressFocus = motivations.some(m =>
    ['stress_reduction','anxiety_management','emotional_regulation'].includes(String(m))
  );

  // 1) Breathwork suggestion: if stress focus AND (breath today 0 OR delta <= 0)
  if (hasStressFocus && (breathTodayCount === 0 || breathDelta <= 0)) {
    return {
      title: '5 dk nefes molası',
      text: 'Strese yönelik 4‑7‑8 nefes tekniği ile kısa bir rahatlama deneyin.',
      ctaText: '4‑7‑8 ile Başla',
      route: '/(tabs)/breathwork',
      params: { protocol: '478', autoStart: 'true' },
      icon: 'weather-windy',
      category: 'breathwork'
    };
  }

  // 2) Mood check‑in suggestion: if no mood today OR weekly mood < 3
  if (moodTodayCount === 0 || (today.weeklyProgress?.mood || 0) < 3) {
    return {
      title: 'Kısa mood kaydı',
      text: 'Bugün nasıl hissettiğini 10 saniyede kaydet. Düzenli kayıt fark yaratır.',
      ctaText: 'Mood Kaydı Yap',
      route: '/(tabs)/mood',
      icon: 'emoticon-happy-outline',
      category: 'mood'
    };
  }

  // 3) Consistency suggestion: if active days < 5 this week, nudge
  if (activeDays < 5) {
    return {
      title: 'Bugün küçük bir adım',
      text: 'Haftalık hedefe yaklaşmak için kısa bir seans daha planlayın.',
      ctaText: 'Nefes ile Devam Et',
      route: '/(tabs)/breathwork',
      params: { protocol: 'box' },
      icon: 'calendar-check',
      category: 'consistency'
    };
  }

  // 4) Default fallback
  return {
    title: 'Kendine 2 dk ayır',
    text: 'Hızlı bir mood kaydı veya kısa bir nefes egzersizi ile devam et.',
    ctaText: 'Devam',
    route: '/(tabs)/mood',
    icon: 'heart-outline',
    category: 'mood'
  };
}

