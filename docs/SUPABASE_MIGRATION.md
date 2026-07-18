# TitanOS Supabase Migration — Step-by-Step

This guide walks through Supabase setup, Vercel env vars, and moving data off Base44.

---

## Part A — Create Supabase (15 min)

### A1. New project

1. Sign in at [supabase.com](https://supabase.com)
2. **New project** → pick org, name (`titanos`), strong DB password, region close to users
3. Wait for the project to finish provisioning

### A2. Run the database schema

1. Open **SQL Editor** → **New query**
2. Paste the full contents of `supabase/migrations/001_titanos_schema.sql`
3. Click **Run** — you should see “Success” with no errors

### A3. Copy API keys

1. **Project Settings** → **API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never put in frontend)

### A4. Update `.env.local`

Replace the old Base44 lines with:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

Keep a backup of your old Base44 vars in `env.migration.example` if you still need to export data.

### A5. Verify locally

```powershell
npm run supabase:check
```

You should see green checks for all entity tables.

---

## Part B — Configure Auth (10 min)

### B1. URL configuration

**Authentication** → **URL Configuration**

| Field | Value |
|-------|--------|
| Site URL | `https://titanos1.vercel.app` |
| Redirect URLs | `https://titanos1.vercel.app/auth/callback` |
| | `http://localhost:5173/auth/callback` |

### B2. Email provider

**Authentication** → **Providers** → **Email**

- Enable email sign-in
- For OTP signup (Register page): enable **Confirm email** and choose **OTP** if available

### B3. Google provider

**Authentication** → **Providers** → **Google**

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Authorized redirect URI (Supabase shows this):  
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. Paste Client ID + Secret into Supabase
4. Save

Google sign-in will redirect: App → Supabase → Google → Supabase → `https://titanos1.vercel.app/auth/callback`

---

## Part C — Vercel environment variables (5 min)

In [Vercel](https://vercel.com) → your **titanos** project → **Settings** → **Environment Variables**, add:

| Name | Environments | Notes |
|------|----------------|-------|
| `VITE_SUPABASE_URL` | Production, Preview, Development | Same as `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview, Development | Public anon key |
| `SUPABASE_URL` | Production, Preview, Development | Same URL as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview only | **Never** expose to browser |
| `RESEND_API_KEY` | Production | Optional — real email |
| `RESEND_FROM` | Production | e.g. `TitanOS <noreply@yourdomain.com>` |
| `OPENAI_API_KEY` | Production | Optional — Titan AI |

Then **Deployments** → latest → **Redeploy** (required for env changes).

### CLI alternative (if `vercel` CLI is logged in)

```powershell
cd C:\Users\Karen Lafferty\Projects\titanfieldos
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel --prod
```

---

## Part D — Migrate Base44 data (optional)

Auth users **cannot** be bulk-migrated with passwords. Plan on users signing up again (or invite them after).

Entity data (customers, jobs, invoices, etc.) **can** be migrated.

### D1. Get a Base44 access token

1. Log into your app on Base44 hosting (or any environment where email login works)
2. Open browser DevTools → **Application** → **Local Storage**
3. Copy value of `titanos_access_token` or `base44_access_token`

### D2. Configure migration env

Copy `env.migration.example` → `.env.migration.local`:

```env
BASE44_APP_ID=6a40a4487d932972c860f13e
BASE44_ACCESS_TOKEN=paste-token-here
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### D3. Export + import

```powershell
# Export only (saves migration-data/latest.json)
npm run migrate:export

# Import from last export
npm run migrate:import

# Or both in one step
npm run migrate:all
```

### D4. After import

1. Sign up in the new app with your email
2. In Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

3. Re-assign `created_by_id` on old rows if needed (they keep original UUIDs from Base44; new logins get new UUIDs unless you migrate auth users manually via Supabase Admin API).

---

## Part E — Smoke test checklist

After deploy to `https://titanos1.vercel.app`:

- [ ] Email login at `/login`
- [ ] Google login → lands on dashboard
- [ ] Create a customer on `/customers`
- [ ] Marketplace loads modules (first visit may call `seedMarketplace`)
- [ ] Customer portal OTP at `/portal` (needs `RESEND_API_KEY` or check Vercel function logs for OTP code)
- [ ] Titan AI on `/ai` (needs `OPENAI_API_KEY` for real replies)

---

## Part F — Android rebuild

After Supabase env is in `.env.production`:

```powershell
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.production first
npm run android:build
npm run android:sign
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| “Supabase is not configured” on load | Add `VITE_SUPABASE_*` to `.env.local`, restart `npm run dev` |
| Google login loops or fails | Check redirect URLs in Supabase match `/auth/callback` exactly |
| Empty data after login | RLS — rows need `created_by_id` = your new user id; re-import or update SQL |
| API functions 404 locally | Use `npx vercel dev` instead of `npm run dev` |
| CORS / CSP errors | `vercel.json` already allows `*.supabase.co` |

---

## Architecture reference

```
Browser (React)
  ├── Supabase Auth (Google, email/password)
  ├── Supabase Postgres + RLS (entities)
  ├── Supabase Storage (file uploads)
  └── Vercel /api/functions/* (portal, AI, email, seed)
```

Legacy Base44 pieces removed: `@base44/sdk`, Vercel proxy to `base44.app`, domain allowlist for OAuth.
