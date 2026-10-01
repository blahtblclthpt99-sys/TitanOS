# TitanOS Recovery Staging Certification — 2026-09-10

**Environment:** TitanOS Recovery Staging  
**Supabase project:** `wbymywwrpbljfbsemung`  
**Production project:** `xcfjpxcmokdfwkarwomy`  
**Production mutation performed by this certification:** **No**  
**Release state:** **PRODUCTION NO-GO**

This record certifies the current isolated recovery target as the authoritative schema target for forward-only TitanOS production recovery planning. It does **not** authorize production DDL, migration-history repair, historical migration replay, traffic cutover, or reconstruction of deleted historical row data.

## 1. Reproducibility

The initial staging reconstruction consists of 22 exact migration-ledger SQL snapshots preserved under `supabase/recovery/staging-applied/`.

- All 22 snapshots are byte-for-byte identical to the SQL recorded by the Supabase staging migration ledger.
- Verification used Git blob SHA-1 values independently recomputed from the original Supabase ledger bytes.
- The recovery evidence set is protected by repository QA and was merged through PR #74.
- The evidence directory is deliberately outside `supabase/migrations/`; it is evidence, not a production replay mechanism.

Post-reconstruction hardening is tracked separately so staging evolution remains auditable without turning historical recovery SQL into executable production migrations.

## 2. Current certified schema target

Current staging target:

| Surface | Verified count/state |
|---|---:|
| Public tables | 79 |
| RLS policies | 142 |
| Public indexes | 219 |
| Public functions | 16 |
| Private helper functions | 7 |
| Application triggers | 25 |
| Views | 0 |
| Auth users | 0 |
| Storage buckets | 2, both private |
| Unindexed public foreign keys | 0 |

The machine-readable inventory is `staging-target-2026-09-10.json`.

## 3. Security certification completed

Verified on the isolated staging database:

- RLS is enabled on every public table.
- `portal_sessions` and `titan_comms_channel_secrets` are intentionally server-only tables with RLS enabled and no client policy.
- `anon` and `authenticated` table privileges are revoked from both server-only tables.
- Browser entity mapping no longer exposes `PortalSession`.
- SECURITY DEFINER functions inspected during the hardening pass are not executable by `anon` or `authenticated` where they are intended to be service-only.
- Untrusted API roles cannot create objects in the public schema.
- Both storage buckets are private.
- `titanos-uploads` remains owner/path scoped, with anonymous visibility limited to explicit `public/` paths.
- `support-attachments` is owner/assigned-support scoped and enforces file-size/type limits.
- Supabase Security Advisor currently reports no staging WARN finding. Its two INFO findings are the intentional RLS-with-no-policy server-only tables above.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## 4. Performance hardening completed

A staging-only post-reconstruction hardening migration added covering indexes for all previously unindexed public foreign keys.

- Previous unindexed FK findings: 58.
- Current unindexed public foreign keys: **0**.
- Current public index count: **219**.
- Exact applied SQL is preserved at `staging-post/20260910040142_recovery_24_cover_public_foreign_keys.sql`.
- Its Git blob SHA-1 `452f56f9cfb60dd62e2c1b5385fbb15ab43d8d4c` exactly matches the SHA-1 independently computed from Supabase's applied migration bytes.

`unused_index` findings are intentionally not treated as defects in this zero-workload staging environment; no real usage history exists yet from which to justify index removal.

The remaining 26 `multiple_permissive_policies` advisor findings are performance findings, not demonstrated authorization failures. They are intentionally deferred until runtime two-account IDOR tests can prove semantic equivalence before policy consolidation.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## 5. Production baseline preserved

The current production baseline remains materially different and must be preserved during recovery:

- five Attention tables only,
- six Attention RLS policies,
- twelve indexes,
- four Attention service functions,
- zero application triggers,
- one Supabase Auth user,
- private `titanos-uploads` bucket,
- all five Attention tables currently contain zero rows.

The baseline is captured in `production-baseline-2026-09-10.json`.

Recovery is therefore **additive**: TitanOS objects must be created beside the existing Attention/Auth state. The historical TitanOS purge is not reversed or replayed.

## 6. Remaining staging/security exception

The required runtime two-account IDOR/cross-tenant test is still pending because the connected staging administration surface does not expose a supported Auth-user creation/deletion action and staging currently contains zero Auth users.

Manual inserts into `auth.users` are prohibited for this certification. They would bypass the actual Supabase Auth lifecycle and would not constitute valid runtime proof.

Until two real disposable Auth identities can be created through a supported Auth path, policy consolidation and final cross-tenant runtime certification remain blocked.

## 7. Production blockers still open

Production remains **NO-GO** until all of the following are verified:

1. Two-account runtime IDOR/cross-tenant denial tests against staging.
2. Supabase leaked-password protection enabled and rechecked in production Auth.
3. Forward-only production recovery migration(s) derived from the certified target versus the actual production baseline.
4. Live Stripe payment/webhook lifecycle, idempotency, reconciliation, refund/failure behavior, and production secrets verified.
5. Cloudflare Worker, routes/custom domain, bindings/secrets, immutable release mapping, and rollback mapping verified.
6. Final production web + Android E2E, observability, rollback, and failure-recovery certification.

Production Security Advisor currently reports `Leaked Password Protection Disabled`.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## 8. Release decision

**ISOLATED STAGING SCHEMA RECONSTRUCTION: VERIFIED.**  
**RECOVERY SQL EVIDENCE: BYTE-FOR-BYTE VERIFIED.**  
**SERVER-ONLY TABLE BOUNDARY: VERIFIED.**  
**FOREIGN-KEY INDEX COVERAGE: VERIFIED.**  
**TWO-ACCOUNT RUNTIME IDOR: PENDING.**  
**PRODUCTION RECOVERY: NO-GO.**

No statement in this document authorizes a production mutation.
