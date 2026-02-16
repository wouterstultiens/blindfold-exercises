create table if not exists profiles (
  user_id uuid primary key,
  display_name text not null default 'Player',
  xp integer not null default 0,
  level integer not null default 1,
  streak integer not null default 0,
  last_session_date timestamptz,
  badges text[] not null default '{}'
);

create table if not exists attempts (
  id text primary key,
  session_id text not null,
  user_id uuid not null references profiles(user_id) on delete cascade,
  item_id text not null,
  stage text not null,
  prompt_payload jsonb not null,
  answer_payload jsonb not null,
  expected_answer text not null,
  correct boolean not null,
  latency_ms integer not null,
  difficulty integer not null,
  confidence integer not null check (confidence between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id uuid not null references profiles(user_id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s integer not null,
  xp_earned integer not null,
  streak_after integer not null,
  focus_stage text not null default 'square_color',
  status text not null default 'completed' check (status in ('active', 'completed')),
  attempt_count integer not null default 0
);

alter table sessions add column if not exists focus_stage text not null default 'square_color';
alter table sessions add column if not exists status text not null default 'completed';
alter table sessions add column if not exists attempt_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_status_check'
  ) then
    alter table sessions
      add constraint sessions_status_check check (status in ('active', 'completed'));
  end if;
end $$;

create table if not exists progress_snapshots (
  user_id uuid not null references profiles(user_id) on delete cascade,
  stage text not null,
  rating integer not null,
  rolling_accuracy numeric(5,3) not null,
  rolling_latency_ms integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, stage)
);

alter table profiles enable row level security;
alter table attempts enable row level security;
alter table sessions enable row level security;
alter table progress_snapshots enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update
  using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "attempts_rw_own" on attempts;
create policy "attempts_rw_own" on attempts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sessions_rw_own" on sessions;
create policy "sessions_rw_own" on sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "snapshots_rw_own" on progress_snapshots;
create policy "snapshots_rw_own" on progress_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
