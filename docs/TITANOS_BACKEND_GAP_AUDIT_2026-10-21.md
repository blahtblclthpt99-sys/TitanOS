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
