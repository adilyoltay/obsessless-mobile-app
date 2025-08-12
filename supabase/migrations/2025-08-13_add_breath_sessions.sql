create table if not exists public.breath_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  protocol text not null check (protocol in ('box','478','paced')),
  duration_ms integer not null check (duration_ms >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists breath_sessions_user_idx on public.breath_sessions(user_id);
create index if not exists breath_sessions_started_idx on public.breath_sessions(started_at desc);

alter table public.breath_sessions enable row level security;

create policy "Users can insert own breath sessions"
  on public.breath_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can select own breath sessions"
  on public.breath_sessions for select
  using (auth.uid() = user_id);

create policy "Users can update own breath sessions"
  on public.breath_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own breath sessions"
  on public.breath_sessions for delete
  using (auth.uid() = user_id);
