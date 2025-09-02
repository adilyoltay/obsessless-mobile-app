import type { User, Session } from '@supabase/supabase-js';

// Database/User Profile
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  provider: 'email' | 'google';
  created_at: string;
  updated_at: string;
}

export interface OCDProfile {
  id: string;
  user_id: string;
  ocd_symptoms: string[];
  daily_goal: number;
  ybocs_score: number;
  ybocs_severity: string;
  onboarding_completed: boolean;
  created_at: string;
}

export interface CompulsionRecord {
  id: string;
  user_id: string;
  category: string;
  subcategory?: string;
  resistance_level: number;
  trigger?: string;
  notes?: string;
  timestamp: string;
}

export interface TherapySession {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  category: string;
  duration_seconds: number;
  anxiety_initial: number;
  anxiety_final: number;
  anxiety_readings: any[];
  completed: boolean;
  timestamp: string;
}

export interface GamificationProfile {
  user_id: string;
  streak_count: number;
  healing_points_total: number;
  healing_points_today: number;
  streak_last_update: string; // date (YYYY-MM-DD)
  level: number;
  achievements: string[];
  micro_rewards: any[];
  updated_at?: string;
}

export interface VoiceCheckinRecord {
  id?: string;
  user_id: string;
  text: string;
  mood: number;
  trigger: string;
  confidence: number;
  lang: string;
  created_at?: string;
}

export interface ThoughtRecordItem {
  id?: string;
  user_id: string;
  automatic_thought: string;
  evidence_for?: string;
  evidence_against?: string;
  distortions: string[];
  new_view?: string;
  lang: string;
  created_at?: string;
}

export interface VoiceSessionDB {
  id?: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  transcription_count?: number;
  error_count?: number;
  created_at?: string;
}

export type BreathSessionDB = {
  user_id: string;
  protocol: 'box' | '478' | 'paced';
  duration_ms: number;
  started_at: string;
  completed_at?: string | null;
};

// Auth Results
export interface AuthResult {
  user: User | null;
  session: Session | null;
  needsConfirmation?: boolean;
}

export interface SignUpResult extends AuthResult {
  needsConfirmation: boolean;
}

