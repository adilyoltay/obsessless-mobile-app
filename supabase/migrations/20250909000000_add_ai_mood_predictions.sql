-- ai_mood_predictions: cihaz-içi AI tahminlerini saklamak için çekirdek tablo
-- Not: gen_random_uuid() için pgcrypto eklentisi Supabase projelerinde hazırdır.

create table if not exists public.ai_mood_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  bucket_granularity text not null check (bucket_granularity in ('hour','day')) default 'day',
  bucket_start_ts_utc timestamptz not null,
  bucket_ymd_local text not null,
  mood_score_pred smallint not null check (mood_score_pred between 0 and 100),
  energy_level_pred smallint not null check (energy_level_pred between 1 and 10),
  anxiety_level_pred smallint not null check (anxiety_level_pred between 1 and 10),
  depression_risk double precision,
  bipolar_risk double precision,
  confidence double precision,
  model_name text not null,
  model_version text not null,
  features_hash text,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (user_id, bucket_granularity, bucket_ymd_local, model_name, model_version),
  unique (user_id, content_hash)
);

create index if not exists ai_pred_user_ymd_idx on public.ai_mood_predictions (user_id, bucket_ymd_local);
create index if not exists ai_pred_user_created_idx on public.ai_mood_predictions (user_id, created_at);

alter table public.ai_mood_predictions enable row level security;

-- Ensure policy exists (pg_policies.policyname)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_mood_predictions' and policyname = 'ai_pred_rls'
  ) then
    create policy ai_pred_rls on public.ai_mood_predictions
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Ensure unique (user_id, content_hash) exists for onConflict in API
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ai_mood_predictions'::regclass
      and conname = 'ai_mood_predictions_user_hash_key'
  ) then
    alter table public.ai_mood_predictions
      add constraint ai_mood_predictions_user_hash_key unique (user_id, content_hash);
  end if;
end $$;
