# Progress Tracker

## Local setup

Requires Node.js 20 or newer.

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Set the Supabase project URL and publishable key, plus the YouTube Data API key, in `.env`.
4. Run `npm run dev` and open `http://localhost:3000`.

Use `npm start` to start the backend without watch mode.

## Environment variables

- `YOUTUBE_API_KEY` is a server-side secret used only by the backend playlist endpoint. Never add it to frontend JavaScript or commit it.
- `SUPABASE_URL` is the Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY` is the public Supabase client key. Never use a service-role key in this application.
- `PORT` selects the backend port and defaults to `3000`.

Email/password sign-up, sign-in, persisted sessions, and logout use Supabase Auth. The browser receives only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from the backend auth-config endpoint; the YouTube API key remains server-side. The reusable Node client helper is in `supabaseClient.js`.

Projects, tasks, and daily study time are stored in Supabase and scoped through Auth and existing RLS policies. On sign-in, the app offers to migrate data from `progressTrackerV1`; it retains the local backup and records a per-user completion marker only after all migration writes succeed. Theme preference may remain in localStorage. The database stores daily study time as whole minutes; playback speed remains a current-session display setting because the existing schema has no column for it. Email confirmation behavior follows the Supabase project's Auth settings.