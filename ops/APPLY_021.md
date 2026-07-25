# Apply migration 021 — Privilege + money integrity (REQUIRED)

**Verified 2026-07-24:** Live probe showed **019 applied**, **021 NOT applied**.

- Clients **cannot** set `payments.status = succeeded` (019) — PASS  
- Clients **can** set `invoices.status = paid` — FAIL  
- Clients **can** set `profiles.role = admin` / `is_pro` / `plan_tier` — FAIL  

## Apply (one step)

1. Open Supabase SQL Editor for project `xcfjpxcmokdfwkarwomy`:  
   https://supabase.com/dashboard/project/xcfjpxcmokdfwkarwomy/sql/new
2. Paste the full contents of `supabase/migrations/021_privilege_money_integrity.sql`
3. Run
4. Verify:

```bash
node scripts/verify-db-security.mjs
```

Expect `conclusion.overall: "PASS"`.

## What 021 adds

| Object | Purpose |
|--------|---------|
| `protect_profile_privileges` + trigger | Blocks client privilege/billing column changes |
| `protect_invoice_paid_status` + trigger | Blocks client `invoice.status = paid` |
| `protect_message_body` + trigger | Recipients cannot rewrite message bodies |

Service role / admin still can update (webhook path uses service role).

## App-layer note

`entityAdapter` + `updateMe` also block these paths in the SPA, but **raw PostgREST still bypasses app code**. Database triggers are mandatory for launch.
