# TitanOS Database Recovery Runbook

Status: **P0 recovery procedure — production NO-GO**

This runbook exists because the TitanOS Supabase project's public application schema was removed after the legitimate TitanOS migration chain had already been applied.

## Non-negotiable safety rules

1. **Do not replay recovery DDL directly against production first.** Rehearse on an isolated Supabase branch/project.
2. **Do not edit `supabase_migrations.schema_migrations` by hand.** Preserve the forensic migration ledger.
3. **Do not replay the Attention migrations as TitanOS recovery migrations.**
4. **Never replay `purge_legacy_titanos_public_schema`.**
5. **Do not copy secret-bearing migration SQL into Git.** In particular, treat `add_server_runtime_secrets` as sensitive until manually redacted/rebuilt from secret-manager values.
6. **Do not run mutation-based security probes until `scripts/db-recovery-preflight.mjs` reports `safeForMutationProbes: true`.**
7. A schema rebuild does **not** imply user/application data recovery. Data restoration requires a verified backup/export source.

## Verified migration boundary

The Supabase migration ledger identifies the final legitimate TitanOS migration before the unrelated Attention schema was introduced:

- `20260818203624` — `engagement_event_triggers` — **last TitanOS migration before contamination**

The unrelated schema then begins:

- `20260818215755` — `create_attention_marketplace_core`
- `20260818215820` — `add_attention_atomic_reward_functions`
- `20260818215916` — `add_attention_active_view_heartbeats`
- `20260818220148` — `purge_legacy_titanos_public_schema` — **destructive boundary; never replay**

The purge statement dropped every `public` table except the original Attention tables, dropped every public view/materialized view, and dropped public functions except the Attention service functions. Its migration ledger entry has no rollback.

## Recovery sources of truth

TitanOS cannot currently be reconstructed safely by blindly running only the files in `supabase/migrations/`.

There are two required sources:

### A. Repository baseline migrations

The repository contains the original TitanOS schema chain beginning with:

- `001_titanos_schema.sql`
- `002_platform_expansion.sql`
- ...
- numbered hardening/feature migrations through the later 04x series
- timestamped TitanOS migrations through Support, three-sided work, employment profiles, and Engagement

These files provide the base objects and much of the intended schema history.

### B. Supabase forensic migration ledger

`supabase_migrations.schema_migrations` retains the **actual SQL statement arrays** that were applied to the project. This matters because several applied TitanOS migrations are absent from the current Git tree, including examples such as:

- `harden_lead_outreach`
- `driver_performance_benchmarks`
- `titan_memory_and_rules`
- `context_threads`
- `production_action_runs`
- `founding_25_lifetime_and_three_day_trial`
- `reconcile_founding_25_backfill`
- `harden_internal_security_definer_rpcs`
- `harden_authorization_helper_rpc_visibility`
- `harden_public_contract_share_rpc`
- `restore_contract_signature_metadata_columns`
- `restore_jobs_site_geofence_columns`
- `persist_public_contract_signature_image`
- `harden_public_contract_capability`
- `index_core_titan_foreign_keys`
- `titan_ai_knowledge`
- `align_admin_authority_and_revoke_trigger_rpc`
- `harden_is_admin_security_invoker`
- `optimize_core_rls_initplans`
- `optimize_hot_secondary_rls`
- `harden_marketplace_table_privileges`
- `split_marketplace_catalog_admin_policies`

The ledger therefore remains an essential forensic source for exact reconstruction.

## Why a normal `db push` is insufficient

The production ledger already records the historical TitanOS migrations as applied. After the purge, those migration versions remain recorded even though their tables/functions no longer exist. A normal migration runner can therefore consider them complete and **not recreate the deleted objects**.

Recovery must instead use one of these controlled approaches:

1. **Preferred:** create a clean isolated project, apply the repository baseline in deterministic order, then apply recovered missing TitanOS statements through the legitimate cutoff.
2. **Alternative rehearsal:** clone/branch the damaged project, then apply a new, explicitly named post-purge reconstruction migration that recreates the expected TitanOS objects. Do not falsify or delete existing migration-ledger rows.

Only after the isolated environment passes all gates may a production cutover/rebuild be planned.

## Recovery sequence

### Phase 0 — Preserve evidence

Before mutation:

- capture the complete migration ledger (`version`, `name`, statement count/hash, rollback presence);
- capture current public table/view/function inventories;
- record auth user count and Storage bucket/object inventory;
- do not export raw secret-bearing statement text into the repository.

### Phase 1 — Build deterministic baseline

1. Start from an empty isolated Supabase environment.
2. Apply repository baseline migrations in dependency order.
3. Map semantically duplicated files to the actual ledger names before replaying them twice.
4. Recover ledger-only TitanOS migration SQL up to and including `20260818203624 engagement_event_triggers`.
5. Rebuild secret-dependent configuration from current secret manager/environment values, not copied historical plaintext.
6. Exclude all Attention migrations and the purge.

### Phase 2 — Structural verification

At minimum verify:

- all critical TitanOS tables exist;
- foreign keys are valid;
- expected unique constraints and indexes exist;
- expected triggers/functions exist;
- all user/tenant tables have RLS enabled;
- no client role has direct write authority over server-only money/trust fields;
- Storage policies and private bucket behavior match the application contract;
- the auth new-user/profile path is restored;
- Support tables and realtime publication are present before applying workspace hardening.

Run the read-only preflight first:

```bash
node scripts/db-recovery-preflight.mjs
```

Do **not** proceed to mutation-based probes unless it returns:

```text
safeForMutationProbes: true
```

### Phase 3 — Security/behavior verification

Only in the isolated recovery environment:

- run database security verification;
- exercise RLS as authenticated non-admin users;
- test privilege-escalation denial;
- test invoice/payment authority boundaries;
- test Stripe webhook idempotency tables and state controls;
- test company membership ownership boundaries;
- test Support RLS/realtime boundaries;
- run Supabase security/performance advisors;
- run the full TitanOS automated test/build gate against the recovered backend.

### Phase 4 — Apply pending TitanOS migrations

Only after the pre-purge TitanOS state is reconstructed and certified, apply newer legitimate TitanOS migrations that were never applied to the damaged production schema, including:

- `20260819013000_titan_support_workspaces.sql`

Then rerun the full structural, RLS, security, and application regression gates.

### Phase 5 — Production decision

Production remains **NO-GO** until all of the following are true:

- isolated reconstruction is repeatable from documented inputs;
- the exact reconstruction artifact has been reviewed;
- no secret material is embedded in committed recovery SQL;
- full CI is green on the exact application head;
- recovered database security/RLS gates pass;
- production deployment is live;
- web and Android smoke tests pass against the recovered backend;
- backup/rollback/cutover procedure is documented and tested.

## Current known production state

As of the 2026-08-26 recovery investigation:

- TitanOS public application tables are absent from the current production schema inventory.
- Attention application tables remain.
- the migration ledger still preserves TitanOS migration names and SQL statement arrays;
- the purge migration has no stored rollback;
- the repository alone is not a complete representation of all SQL that had been applied;
- the pending Support workspace migration must not be applied to production yet.

This is a **schema reconstruction incident**, not an ordinary forward-migration task.
