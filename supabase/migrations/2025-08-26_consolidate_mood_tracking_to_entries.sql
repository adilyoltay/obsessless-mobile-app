-- ===================================================================
-- Migration: Consolidate mood_tracking into mood_entries (canonical)
-- Date: 2025-08-26
-- Purpose: Remove ambiguity, enforce idempotency, preserve history
-- ===================================================================

-- 1) Ensure mood_entries has required columns
alter table if exists public.mood_entries
  add column if not exists triggers text[],
  add column if not exists activities text[],
  add column if not exists content_hash text;

-- 2) Backfill content_hash where missing (stable per-user per-day key)
update public.mood_entries me
set content_hash = md5(
  cast(me.user_id as text) || '|' ||
  cast(coalesce(round(me.mood_score)::int, 0) as text) || '|' ||
  cast(coalesce(round(me.energy_level)::int, 0) as text) || '|' ||
  cast(coalesce(round(me.anxiety_level)::int, 0) as text) || '|' ||
  coalesce(trim(lower(me.notes)), '') || '|' ||
  coalesce(array_to_string(me.triggers, ','), '') || '|' ||
  coalesce(array_to_string(me.activities, ','), '') || '|' ||
  cast(date(me.created_at) as text)
)
where me.content_hash is null;

-- 3) Unique constraint for idempotent upserts
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'mood_entries_user_content_unique'
  ) then
    alter table public.mood_entries
      add constraint mood_entries_user_content_unique unique (user_id, content_hash);
  end if;
end $$;

-- 4) Migrate data from mood_tracking if table exists
do $$
declare
  exists_tracking boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mood_tracking'
  ) into exists_tracking;

  if exists_tracking then
    insert into public.mood_entries (
      user_id, mood_score, energy_level, anxiety_level, notes, triggers, activities, created_at, updated_at, content_hash
    )
    select
      mt.user_id,
      least(greatest(mt.mood_score * 10, 0), 100) as mood_score,
      mt.energy_level,
      mt.anxiety_level,
      mt.notes,
      mt.triggers,
      mt.activities,
      mt.created_at,
      coalesce(mt.created_at, now()),
      md5(
        cast(mt.user_id as text) || '|' ||
        cast(least(greatest(mt.mood_score * 10, 0), 100) as text) || '|' ||
        cast(mt.energy_level as text) || '|' ||
        cast(mt.anxiety_level as text) || '|' ||
        coalesce(trim(lower(mt.notes)), '') || '|' ||
        coalesce(array_to_string(mt.triggers, ','), '') || '|' ||
        coalesce(array_to_string(mt.activities, ','), '') || '|' ||
        cast(date(mt.created_at) as text)
      ) as content_hash
    from public.mood_tracking mt
    on conflict (user_id, content_hash) do nothing;
  end if;
end $$;

-- 5) Deprecate mood_tracking: create view for backward compatibility
do $$
declare
  exists_tracking boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mood_tracking'
  ) into exists_tracking;

  if exists_tracking then
    -- Rename old table to preserve raw data
    alter table public.mood_tracking rename to mood_tracking_legacy;
  end if;
end $$;

-- Recreate a compatibility view that reads from mood_entries
create or replace view public.mood_tracking as
select
  me.id::text as id,
  me.user_id,
  greatest(1, least(10, round(me.mood_score::numeric / 10)))::int as mood_score,
  me.energy_level,
  me.anxiety_level,
  me.notes,
  me.triggers,
  me.activities,
  me.created_at
from public.mood_entries me;

-- Ensure RLS on view (inherits from base table policies)
grant select on public.mood_tracking to anon, authenticated;


