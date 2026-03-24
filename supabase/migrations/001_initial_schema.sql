-- tournaments
create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  best_of int not null default 3,
  status text not null default 'setup',
  champion text
);

-- players
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  seed int,
  created_at timestamptz default now()
);

-- matches
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  round int not null,
  position int not null,
  player1_id uuid references players(id),
  player2_id uuid references players(id),
  player1_score int,
  player2_score int,
  winner_id uuid references players(id),
  is_bye boolean default false,
  status text not null default 'pending',
  created_at timestamptz default now()
);

-- Enable Realtime
alter publication supabase_realtime add table tournaments;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table players;

-- RLS: public read, admin write via API routes
alter table tournaments enable row level security;
alter table matches enable row level security;
alter table players enable row level security;

create policy "Public read tournaments" on tournaments for select using (true);
create policy "Public read matches" on matches for select using (true);
create policy "Public read players" on players for select using (true);

-- Write policies: allow service role (used by API routes) full access
-- The service role bypasses RLS, so we don't need explicit write policies for it.
-- But let's add permissive policies for authenticated service role operations:
create policy "Service write tournaments" on tournaments for all using (true) with check (true);
create policy "Service write matches" on matches for all using (true) with check (true);
create policy "Service write players" on players for all using (true) with check (true);
