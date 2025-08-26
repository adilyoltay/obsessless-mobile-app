-- Canonical mood_entries setup: content_hash function + trigger + view unification

-- Ensure columns exist
alter table if exists public.mood_entries
  add column if not exists triggers text[],
  add column if not exists activities text[],
  add column if not exists content_hash text;

-- Unique and index
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'mood_entries_user_content_unique'
  ) then
    alter table public.mood_entries
      add constraint mood_entries_user_content_unique unique (user_id, content_hash);
  end if;
end $$;

create index if not exists idx_mood_entries_hash on public.mood_entries(content_hash);

-- Canonical hash function (UTC day, excludes triggers/activities)
create or replace function public.compute_mood_content_hash(
  uid uuid,
  mood integer,
  energy integer,
  anxiety integer,
  notes text,
  created_at timestamptz
) returns text as $$
  select md5(
    uid::text || '|' ||
    coalesce(round(mood)::text, '0') || '|' ||
    coalesce(round(energy)::text, '0') || '|' ||
    coalesce(round(anxiety)::text, '0') || '|' ||
    coalesce(lower(trim(notes)), '') || '|' ||
    to_char((created_at at time zone 'UTC')::date, 'YYYY-MM-DD')
  );
$$ language sql immutable;

-- Insert trigger to set content_hash if missing
create or replace function public.set_mood_content_hash() returns trigger as $$
begin
  if new.content_hash is null then
    new.content_hash := public.compute_mood_content_hash(
      new.user_id, new.mood_score, new.energy_level, new.anxiety_level, new.notes, new.created_at
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_mood_content_hash on public.mood_entries;
create trigger trg_set_mood_content_hash
before insert on public.mood_entries
for each row execute function public.set_mood_content_hash();

-- Backfill missing hashes
update public.mood_entries me
set content_hash = public.compute_mood_content_hash(user_id, mood_score, energy_level, anxiety_level, notes, created_at)
where content_hash is null;

-- Deduplicate rows with same user_id+content_hash (keep earliest)
with d as (
  select id, row_number() over (partition by user_id, content_hash order by created_at asc) rn
  from public.mood_entries
)
delete from public.mood_entries where id in (select id from d where rn > 1);

-- Normalize mood_tracking as view
do $$
declare
  is_table boolean;
begin
  select exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'mood_tracking'
  ) into is_table;
  if is_table then
    begin
      alter table public.mood_tracking rename to mood_tracking_legacy_20250830;
    exception when others then
      -- ignore if not a table
      null;
    end;
  end if;
end $$;

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


