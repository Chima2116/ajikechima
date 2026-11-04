-- ROCKFALL leaderboard. Run this once in the Supabase SQL editor.
-- Only the server (service role key) can read or write: no public policies are created on purpose.

create table if not exists public.rockfall_scores (
  id          bigint generated always as identity primary key,
  run_id      text        not null unique,          -- one score per server-issued run token
  name        text        not null check (char_length(name) between 1 and 16),
  score       integer     not null check (score between 1 and 100000),
  duration    real        not null check (duration > 0),
  ip_hash     text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists rockfall_scores_rank_idx on public.rockfall_scores (score desc, duration desc, created_at asc);
create index if not exists rockfall_scores_recent_idx on public.rockfall_scores (created_at desc);
create index if not exists rockfall_scores_ip_idx on public.rockfall_scores (ip_hash, created_at desc);

alter table public.rockfall_scores enable row level security;
-- No policies = the anon and authenticated roles cannot touch the table. The API uses the service role.
