# TitanOS Database Recovery Runbook

## Status

**Incident confirmed. Production cutover remains blocked.**

The Supabase project `xcfjpxcmokdfwkarwomy` is the historical TitanOS production project. On 2026-08-18 it was repurposed for Titan Attention and a destructive migration removed the TitanOS application schema and data from `public`.

This document is intentionally recovery-oriented. It does **not** contain credentials, user PII, or a copy of the destructive SQL.

## Evidence-backed incident boundary

### Last known-safe TitanOS migration

- Version: `20260818203624`
- Name: `engagement_event_triggers`
- Applied SQL fingerprint (MD5): `094bb845d7c66d77665fc0731d9844bf`

The immediately preceding TitanOS migrations include:

| Version | Migration | Applied SQL fingerprint |
| --- | --- | --- |
| `20260818075156` | `titan_ai_knowledge` | `617c998bafb9ab5bbf71ff7a2101366b` |
| `20260818080634` | `align_admin_authority_and_revoke_trigger_rpc` | `363db170875ba4ed7343bdf6c4820f28` |
| `20260818080843` | `harden_is_admin_security_invoker` | `7edfa946678f9462b79404a01b4ab8a5` |
| `20260818082531` | `optimize_core_rls_initplans` | `238a9d880255a5d372ab18f737adac61` |
| `20260818083244` | `optimize_hot_secondary_rls` | `042a1e7710564afcd2c090a572076263` |
| `20260818084626` | `harden_marketplace_table_privileges` | `043a2895057cb8a0e750025cd89027eb` |
| `20260818085628` | `split_marketplace_catalog_admin_policies` | `08b36a6082fbcf9989e895438e1025a4` |
| `20260818113540` | `titan_support_core` | `a312bab03063bba17d5136346bca40ed` |
| `20260818114844` | `titan_support_realtime` | `3cde0c85372fdd1a5b5c2681702c487c` |
| `20260818135831` | `fix_company_rls_recursion` | `86095293287aec8fc359683a4d00f491` |
| `20260818195936` | `three_sided_work_ecosystem` | `a3b4f77fcebd4c3e577c8584a7ab2e38` |
| `20260818201919` | `employment_profiles` | `d91de218782a1010404ca9c2fa1b6383` |
| `20260818203624` | `engagement_event_triggers` | `094bb845d7c66d77665fc0731d9844bf` |

### Quarantined takeover boundary

The following remote migrations are **not TitanOS recovery migrations and must never be replayed into a recovered TitanOS database**:

- `20260818215755 create_attention_marketplace_core`
- `20260818215820 add_attention_atomic_reward_functions`
- `20260818215916 add_attention_active_view_heartbeats`
- `20260818220148 purge_legacy_titanos_public_schema`
- `20260818220301 enable_pg_net_for_storage_cleanup`
- `20260818220503 add_attention_campaign_funding`
- `20260818221440 harden_attention_rls_and_indexes`
- `20260828023235 harden_attention_funding_activation_session_binding`

All of the above remote migration records have no recorded rollback statements.

## Current live-project survival findings

Read-only inspection of `xcfjpxcmokdfwkarwomy` after the incident found:

- `public` contains only the five Attention-era tables.
- All five Attention tables are empty.
- No TitanOS/driver/job/invoice/customer/company/founding/Stripe application tables remain in any schema.
- No matching TitanOS application routines remain.
- `auth.users` contains one account created after the August 18 purge window; the prior TitanOS auth population is not present.
- `auth.audit_log_entries` is empty, so the live database cannot reconstruct historical account-deletion actions.
- Storage metadata contains one bucket and zero objects.
- A `purge-legacy-storage` Edge Function still exists only as a retired HTTP 410 implementation. Its original deployment occurred within roughly one minute of the schema purge.
- No Supabase development branches exist for this project.
- The organization is currently on the Free plan; do not assume daily backups or PITR exist.

## Recovery policy

1. **Do not mutate `xcfjpxcmokdfwkarwomy` during reconstruction.** Preserve it as incident evidence until the replacement TitanOS backend is certified.
2. **Do not replay the remote Supabase migration ledger wholesale.** It contains the Attention takeover chain.
3. **Use the repository's guarded TitanOS migration directory as the reconstruction source**, plus explicitly reviewed post-recovery hardening migrations.
4. Run `scripts/database-destructive-migration-guard.test.mjs` before any schema is applied.
5. Build into an isolated Supabase project first. Never reconstruct directly on the historical production project.
6. Keep payments disabled and Cloudflare `production_cutover_ready: false` throughout reconstruction.
7. Seed no fake production users, payments, jobs, invoices, or business records.
8. Restore user/application data only from a verified backup or export with provenance. If no backup exists, treat historical user data as unrecoverable rather than fabricating it.
9. Certify schema, RLS, grants, RPCs, auth hooks, storage policies, registration, `auth/me`, feature flags, Stripe webhook integrity, TitanAI, Driver Hub, and mobile behavior before any production origin switch.
10. Rotate/replace any legacy keys that were ever committed or exposed during the historical deployment lifecycle before launch.

## Reconstruction gates

### Gate A — isolated database creation

Requires an explicitly approved Supabase organization/cost decision before creating a new project or branch.

### Gate B — schema replay

- Base TitanOS schema migrations apply cleanly.
- No Attention marker exists in resulting schema.
- Core tables and required RPCs exist.
- New migrations `20260828033000_lock_profile_referral_company_context.sql` and `20260828041500_platform_launch_integrity.sql` apply successfully.

### Gate C — security certification

- RLS enabled where required.
- Privileged/service-only tables are not client-writable.
- Profile privilege/referral/company-context protections pass.
- Security advisors reviewed.
- No broad destructive migration is accepted by CI.

### Gate D — application integration

- Cloudflare preview receives only the isolated recovery project's URL/publishable key and required server secrets.
- `/api/functions/auth/me`, `/api/functions/featureFlags`, and registration candidates pass real database-backed integration tests.
- Existing unmigrated API routes remain fail-closed.

### Gate E — financial and release certification

- Stripe webhook raw-body verification, idempotency, reconciliation, refunds, and authoritative order/subscription state are certified.
- New checkout remains disabled until the payment gate is explicitly opened after certification.
- Android origin is updated and re-certified against the final Cloudflare origin.
- Production DNS is switched only after all preceding gates are green.

## Permanent prevention controls

- `.github/workflows/attention-build.yml` is removed from the recovery branch.
- Cloudflare validation fails if that workflow reappears.
- `scripts/database-destructive-migration-guard.test.mjs` rejects Titan Attention takeover markers, broad dynamic public-schema purge loops, and direct drops of protected TitanOS core tables.
- The old destructive Cloudflare migration branch/PR must never be merged.
