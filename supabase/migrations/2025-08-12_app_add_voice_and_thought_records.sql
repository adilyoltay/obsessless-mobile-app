-- Voice and Thought Records tables (privacy-first)

create table if not exists public.voice_checkins (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  text text not null,
  mood integer not null check (mood between 0 and 100),
  trigger text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  lang text default 'tr',
  created_at timestamptz default now() not null
);

alter table public.voice_checkins enable row level security;
create policy "Users manage own voice_checkins" on public.voice_checkins for all using (auth.uid() = user_id);
create index if not exists idx_voice_checkins_user_time on public.voice_checkins(user_id, created_at desc);

create table if not exists public.thought_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  automatic_thought text not null,
  evidence_for text,
  evidence_against text,
  distortions text[] default '{}',
  new_view text,
  lang text default 'tr',
  created_at timestamptz default now() not null
);

alter table public.thought_records enable row level security;
create policy "Users manage own thought_records" on public.thought_records for all using (auth.uid() = user_id);
create index if not exists idx_thought_records_user_time on public.thought_records(user_id, created_at desc);

create table if not exists public.voice_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_ms integer,
  transcription_count integer default 0,
  error_count integer default 0,
  created_at timestamptz default now() not null
);

alter table public.voice_sessions enable row level security;
create policy "Users manage own voice_sessions" on public.voice_sessions for all using (auth.uid() = user_id);
create index if not exists idx_voice_sessions_user_time on public.voice_sessions(user_id, created_at desc);


