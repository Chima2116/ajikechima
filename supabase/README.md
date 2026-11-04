# ROCKFALL leaderboard: setup

The game works without this. Until it is set up, the leaderboard simply stays hidden and the game keeps a personal best in the browser.

1. Create a free project at https://supabase.com.
2. Open the SQL editor and run `supabase/rockfall.sql`.
3. In Vercel, open the project's Settings, then Environment Variables, and add (Production, Preview and Development):
   - `SUPABASE_URL`: the project URL (Project Settings, API).
   - `SUPABASE_SERVICE_ROLE_KEY`: the secret key (Project Settings, API Keys: the "secret" key, or the legacy `service_role` key). Keep it secret; it is only used in `api/`.
   - `ROCKFALL_SECRET`: any long random string, for example `openssl rand -base64 32`.
4. Redeploy. The three routes then go live: `POST /api/rockfall/start`, `POST /api/rockfall/score`, `GET /api/rockfall/top`.

How scores are protected
- The browser asks `/start` for a signed token before each run. A score is only accepted against one token, once.
- The server checks the clock (a run cannot be longer than the time since its token), the score arithmetic (one point per second plus the fixed bonuses), and that the recorded pointer path looks like a real run.
- Submissions are rate limited per network address, and names are cleaned.
- Not covered: a script that plays perfectly in real time. For that, replay the run on the server from the token's seed and the sent inputs.
