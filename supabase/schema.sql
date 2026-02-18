create table if not exists profiles (
  user_id uuid primary key,
  display_name text not null default 'Player'
);

create table if not exists attempts (
  id text primary key,
  session_id text not null,
  user_id uuid not null references profiles(user_id) on delete cascade,
  item_id text not null,
  stage text not null check (stage in ('square_color', 'puzzle_recall')),
  prompt_payload jsonb not null,
  answer_payload jsonb not null,
  expected_answer text not null,
  correct boolean not null,
  latency_ms integer not null,
  difficulty integer not null default 1,
  confidence integer not null default 3 check (confidence between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id uuid not null references profiles(user_id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s integer not null,
  xp_earned integer not null default 0,
  streak_after integer not null default 0,
  focus_stage text not null default 'square_color' check (focus_stage in ('square_color', 'puzzle_recall')),
  status text not null default 'completed' check (status in ('active', 'completed')),
  attempt_count integer not null default 0
);

drop table if exists puzzle_bank;

create index if not exists attempts_user_id_idx on attempts(user_id);
create index if not exists sessions_user_id_idx on sessions(user_id);

alter table profiles enable row level security;
alter table attempts enable row level security;
alter table sessions enable row level security;

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
