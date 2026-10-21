# TitanOS careers backend: verified deployment gap (2026-10-21)

## Evidence (read-only checks)

- Android Codemagic uses Supabase URL `https://xcfjpxcmokdfwkarwomy.supabase.co` via private `VITE_SUPABASE_URL`.
- The active project's **only public tables** are `attention_campaigns`, `attention_payment_events`, `attention_profiles`, `attention_views`, and `attention_withdrawals`.
- There is no `public.hire_jobs`, `public.hire_applications`, `public.hire_saves`, `public.jobs`, or support table on this project.
- Only two Supabase Edge Functions are present: `attention-api`, `purge-legacy-storage`. **Important:** TitanOS `api.functions.invoke` routes through Vercel's `/api/functions/<name>`, not Supabase Edge Functions. Missing Supabase Edge Functions do *not* establish whether a Vercel endpoint exists.
- `src/api/entityTables.js` expects `hire_jobs`, `hire_applications`, and many additional business tables. `src/lib/hireApi.js` falls back to **device-only local storage** on missing tables or API errors. Therefore the Hire screen can show no jobs or local-only jobs despite login working.
- `src/lib/jobMatchApi.js` requests Vercel `/api/functions/jobMatchesV2`. Confirm that endpoint exists in the **currently deployed Vercel project**, not merely in a development branch.
- `src/lib/supportApi.js` likewise calls Vercel `supportListCases`, `supportCreateCase` etc. Verify their deployment and backing tables separately.

## Safe resolution sequence

1. Confirm the actual historical production Supabase project ID from the old working TitanOS build/environment and locate any prior `hire_jobs` data. Do **not** point the app at staging or overwrite the attention project without evidence.
2. Back up original data and obtain verified schema/migration history.
3. Provision the minimal **jobs-first** data model with ownership-based RLS and tested authenticated read/write permissions; no blanket public grants or unsafe definer functions.
4. Verify current Vercel deployments and inspect `jobMatchesV2` and support function logs. Deploy missing compatible endpoints via normal reviewed CI.
5. Smoke test signed-in candidate browsing, employer posting, applying, saved jobs, job matching and Support with real accounts.
6. Only then rebuild test APK, verify Android, and prepare Google Play AAB.

No production schema or authentication policy was changed as part of this audit.


## Vercel inspection follow-up

- Verified accessible Vercel projects `titanos-web`, `titan-os`, `titanos` in team `team_y4JdYzbNnxR4TSXANG84GN9j`.
- `titanos-web` project contains production variable *names* `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Their values were **not decrypted or disclosed** in this audit. Presence does not validate the project target or application tables.
- Recent `titanos-web` deployment entries with status READY were on `product/titan-core-four` (e.g. commit `39ef952`), rather than the Android improvement branch. READY only establishes a successful Vercel deployment, not functional endpoints.
- Android `src/api/functions.js` calls `https://titanos-web.vercel.app/api/functions/<functionName>` using `VITE_API_BASE_URL`. Therefore check the Vercel project's **production** deployment and routing explicitly.
- Connected Supabase production project's public schema has only five `attention_*` tables; this is independently incompatible with `src/api/entityTables.js`, which maps `HireJob` to `hire_jobs` and `HireApplication` to `hire_applications`.
- Next safe technical gate: inspect the actual Vercel production deployment and relevant server logs, then identify the legitimate historical jobs schema and private RLS policy baseline before any migrations.

This inspection did not modify production Vercel deployments, environment variables, database schema or roles.


## Schema recovery source files discovered

- The repository already contains `supabase/migrations/001_titanos_schema.sql`, which creates `public.profiles` and `public.jobs`, and enables RLS on them.
- `supabase/migrations/002_platform_expansion.sql` creates `public.hire_jobs` and `public.hire_applications`, with RLS enabled.
- This is **source code evidence only**; it does not mean those migrations were applied to the current Supabase project.
- Do not execute the old migrations blindly: inspect each policy, function, trigger, dependency, and existing historical data. Old migrations contain many unrelated business/marketplace tables, so a jobs-first rebuild should be scoped and reviewed.
- The configured client API targets Vercel `/api/functions/...`, including `jobMatchesV2` and `supportListCases`; the files `api/functions/jobMatchesV2.js` and `api/functions/supportListCases.js` exist on the improvement branch.
- Latest `titanos-web` production deployment found in Vercel was from 2026-08-18 `main`, commit `4d09fbc`; current feature-branch code cannot be assumed deployed. A Vercel production **READY** status is not an end-to-end test.
- Production schema recovery should be separately reviewed and migration-tested on an isolated environment with valid test users and ownership-based RLS before publication.
