# Data Model (Supabase)

Tablolar (temel):
- user_profiles
  - user_id (unique), age, gender, locale, timezone
  - motivations[], first_mood_score, first_mood_tags[]
  - lifestyle_sleep_hours, lifestyle_exercise, lifestyle_social
  - reminder_enabled, reminder_time, reminder_days[]
  - feature_flags (jsonb), consent_accepted, consent_at
  - onboarding_version, onboarding_completed_at
  - updated_at (server write), created_at (ilk insert trigger/varsayılan)

- mood_entries
  - id, user_id, mood_score (1..10), energy_level, anxiety_level, triggers[], notes?, created_at

- ai_profiles
  - user_id (unique), profile_data (jsonb), onboarding_completed, updated_at, completed_at?

- ai_treatment_plans
  - user_id, plan_data (jsonb), status, updated_at

Notlar:
- UPSERT politikaları user_id üzerinde çalışır.
- RLS/POLICY uygulamaları için RLS_VALIDATION rehberi referans alınır.
