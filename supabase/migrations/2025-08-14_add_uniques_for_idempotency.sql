-- Idempotent write constraints for app tables

alter table if exists public.voice_checkins
  add constraint if not exists uq_voice_checkins_user_time_text
  unique (user_id, created_at, text);

alter table if exists public.thought_records
  add constraint if not exists uq_thought_records_user_time_thought
  unique (user_id, created_at, automatic_thought);

alter table if exists public.voice_sessions
  add constraint if not exists uq_voice_sessions_user_started
  unique (user_id, started_at);

