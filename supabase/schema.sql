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

create table if not exists puzzle_bank (
  puzzle_id text primary key,
  fen text not null,
  side_to_move text not null check (side_to_move in ('w', 'b')),
  rating integer not null,
  piece_count integer not null,
  white_pieces text[] not null,
  black_pieces text[] not null,
  continuation_san text[] not null,
  continuation_text text not null,
  source text not null default 'lichess',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists attempts_user_id_idx on attempts(user_id);
create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists puzzle_bank_rating_idx on puzzle_bank(rating);
create index if not exists puzzle_bank_piece_count_idx on puzzle_bank(piece_count);
create index if not exists puzzle_bank_rating_piece_idx on puzzle_bank(rating, piece_count);
create index if not exists puzzle_bank_created_at_idx on puzzle_bank(created_at);
create index if not exists puzzle_bank_last_seen_at_idx on puzzle_bank(last_seen_at);

alter table profiles enable row level security;
alter table attempts enable row level security;
alter table sessions enable row level security;
alter table puzzle_bank enable row level security;

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

drop policy if exists "puzzle_bank_select_auth" on puzzle_bank;
create policy "puzzle_bank_select_auth" on puzzle_bank
  for select
  using (auth.role() = 'authenticated');
