# TitanOS Backup & Restore Runbook

Generated: 2026-07-19T18:32:58.033Z

## Automated this run
- Table inventory: 10/10 reachable
- Auth admin API: ok
- Storage buckets: titanos-uploads
- Sample export: `C:\Users\Karen Lafferty\Projects\titanfieldos\ops\backups\logical-sample-1784485978031.json`

## Required manual drills (before public launch)

### 1. Confirm backups
1. Open Supabase → Project Settings → Database
2. Confirm daily backups (and PITR if Pro+)
3. Record last backup timestamp in this folder as `ops/backups/LAST_CONFIRMED.txt`

### 2. Logical restore drill (quarterly)
1. Create a **new** Supabase project (scratch)
2. Restore from backup / re-apply migrations in `supabase/migrations`
3. Import a logical dump or use PITR clone
4. Set Preview Vercel env:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Run:
   ```bash
   npm run auth:check
   node scripts/payment-failure-scenarios.mjs --base https://<preview>.vercel.app
   ```
6. Confirm customers/invoices/payments row counts match expectations
7. Tear down scratch project

### 3. Storage restore
1. List `titanos-uploads` objects
2. Copy to cold storage (S3/Backblaze) weekly until private+versioned bucket lands
3. Restore sample object and verify public/signed URL

### 4. App rollback (outage)
1. Vercel → Deployments → previous READY → Promote to Production
2. Or: `git revert` + push
3. Verify `/api/functions/health` and `/login`

## RTO / RPO targets
- RPO ≤ 60 minutes (data loss tolerance)
- RTO ≤ 30 minutes (time to serve traffic again)
