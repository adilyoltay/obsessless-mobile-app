export type MotivationKey =
  | 'stress_reduction'
  | 'insight'
  | 'habit_tracking'
  | 'sleep_energy'
  | 'therapy_report';

export interface OnboardingPayload {
  profile?: {
    age?: number;
    gender?: 'male' | 'female' | 'other';
    locale?: string;
  };
  motivation: MotivationKey[];
  first_mood?: {
    score?: 1 | 2 | 3 | 4 | 5;
    tags?: string[];
    source: 'onboarding';
  };
  lifestyle?: {
    sleep_hours?: number;
    exercise?: 'none' | 'light' | 'regular';
    social?: 'low' | 'medium' | 'high';
  };
  reminders?: {
    enabled: boolean;
    time?: string; // HH:mm
    days?: string[]; // ['Mon','Tue',...]
    timezone?: string;
  };
  feature_flags?: {
    daily_prompt?: boolean;
    weekly_report?: boolean;
    meditation?: boolean;
    ai_suggestions?: boolean;
    pdf_export?: boolean;
    habit_cards?: boolean;
    sleep_energy_cards?: boolean;
  };
  meta: { version: 1; created_at: string };
}


