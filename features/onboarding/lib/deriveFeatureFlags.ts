import type { OnboardingPayload, MotivationKey } from '../types';

export interface DerivedFlags {
  daily_prompt?: boolean;
  weekly_report?: boolean;
  meditation?: boolean;
  ai_suggestions?: boolean;
  pdf_export?: boolean;
  habit_cards?: boolean;
  sleep_energy_cards?: boolean;
}

export function deriveFeatureFlags(motivations: MotivationKey[]): DerivedFlags {
  const flags: DerivedFlags = {};
  const set = (k: keyof DerivedFlags, v = true) => { flags[k] = v; };

  for (const m of motivations) {
    switch (m) {
      case 'stress_reduction':
        set('meditation');
        break;
      case 'insight':
        set('daily_prompt');
        set('weekly_report');
        break;
      case 'habit_tracking':
        set('habit_cards');
        break;
      case 'sleep_energy':
        set('sleep_energy_cards');
        break;
      case 'therapy_report':
        set('pdf_export');
        break;
    }
  }
  return flags;
}

export function applyReminderRule(flags: DerivedFlags, remindersEnabled?: boolean): DerivedFlags {
  // If reminders enabled → daily_prompt true (flags unaffected on permission deny)
  if (remindersEnabled) {
    flags.daily_prompt = true;
  }
  return flags;
}


