-- Mood tracking table
create table if not exists public.mood_tracking (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  mood_score integer not null check (mood_score between 1 and 10),
  energy_level integer not null check (energy_level between 1 and 10),
  anxiety_level integer not null check (anxiety_level between 1 and 10),
  notes text,
  triggers text[],
  activities text[],
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.mood_tracking enable row level security;
create policy "Users manage own mood entries" on public.mood_tracking
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Achievement unlocks table
create table if not exists public.achievement_unlocks (
  achievement_id text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  unlocked_at timestamptz not null default timezone('utc'::text, now()),
  trigger_event text not null,
  context_data jsonb,
  primary key (achievement_id, user_id, unlocked_at)
);

alter table public.achievement_unlocks enable row level security;
create policy "Users manage own unlocks" on public.achievement_unlocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


