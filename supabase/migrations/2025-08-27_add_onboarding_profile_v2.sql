-- Onboarding v2 profile fields for user_profiles
-- Safe-add with IF NOT EXISTS guards

alter table if exists public.user_profiles
  add column if not exists age smallint,
  add column if not exists gender text check (gender in ('female','male','non_binary','prefer_not_to_say')),
  add column if not exists locale text,
  add column if not exists timezone text,
  add column if not exists motivations text[] default '{}'::text[],
  add column if not exists first_mood_score smallint,
  add column if not exists first_mood_tags text[] default '{}'::text[],
  add column if not exists lifestyle_sleep_hours numeric(3,1),
  add column if not exists lifestyle_exercise text check (lifestyle_exercise in ('none','light','moderate','intense')),
  add column if not exists lifestyle_social text check (lifestyle_social in ('low','medium','high')),
  add column if not exists reminder_enabled boolean default false,
  add column if not exists reminder_time text,
  add column if not exists reminder_days text[] default '{}'::text[],
  add column if not exists feature_flags jsonb default '{}'::jsonb,
  add column if not exists consent_accepted boolean default false,
  add column if not exists consent_at timestamptz,
  add column if not exists onboarding_version smallint default 2,
  add column if not exists onboarding_completed_at timestamptz;

-- Ensure uniqueness by user_id
create unique index if not exists user_profiles_user_id_uniq on public.user_profiles(user_id);


