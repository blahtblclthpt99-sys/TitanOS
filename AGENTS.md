# AGENTS.md

## Project Context

**TitanOS** — original field-service operations app (React + Vite + Supabase + Capacitor).
Package ID for Google Play: `com.titanos.myapp`.

## Key paths

- `src/` — frontend
- `src/api/` — Supabase auth, entities, functions client
- `api/functions/` — Vercel serverless functions
- `supabase/migrations/` — database schema
- `android/` — Capacitor Android / Play Store project
- `.env.local` — secrets (never commit)

## Working notes

- Use `npm run dev` for local web
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`)
- For OAuth / Play: set `VITE_TITANOS_PUBLIC_ORIGIN` to the HTTPS site URL
- Free launch mode: `src/lib/plan.js` → `FREE_LAUNCH = true`
- Lint/build before finishing significant changes: `npm run lint` && `npm run build`
- Play AAB: `npm run android:sign` → `release/TitanOS.aab`
