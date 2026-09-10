# TitanOS Database Reconstruction Plan

**Status:** recovery engineering only — **production NO-GO**  
**Captured:** 2026-09-09  
**Production project:** `xcfjpxcmokdfwkarwomy`  
**Pre-Attention source boundary:** `4d09fbc09dbc4e19014124cc1c687d4cc79abfac`

This document is a recovery control, not a deployment runbook. It intentionally contains no command that mutates the production database.

## Non-negotiable rules

1. **Never replay the historical migration folder against production.**
2. **Never run a linked/production database reset.**
3. **Never use migration-history repair as a way to force old SQL to execute.** History repair changes tracking state; it does not prove schema correctness.
4. **Never synthesize deleted historical user/business/founding/payment rows.** Restore only data supported by an authoritative source.
5. **Never execute `20260818220148 purge_legacy_titanos_public_schema`.** It is permanently classified `NEVER_REPLAY`.
6. **Preserve the existing Attention/Auth surfaces.** Reconstruction must be additive unless an independently reviewed forward migration proves a change is required.
7. **Reconstruct and test in an isolated staging environment first.** Production DDL remains prohibited until staging certification is complete.

The machine-readable policy is `recovery-manifest.json`. The read-only production migration capture is `production-ledger-2026-09-09.json`.

## Why historical replay is unsafe

Supabase tracks remote migration application by migration version/timestamp. The production ledger and recovered source contain many migrations that share a semantic name but have different version identifiers. The source tree also contains two distinct `041_*` files.

Known examples from the 2026-09-09 reconciliation:

| Production ledger | Recovered source file | Classification |
|---|---|---|
| `20260802012204 google_play_subscriptions` | `041_google_play_subscriptions.sql` | version identity drift |
| `20260802092438 titan_autopilot` | `041_titan_autopilot.sql` | version identity drift + duplicate source prefix |
| `20260802094450 autopilot_membership_claims` | `042_autopilot_membership_claims.sql` | version identity drift |
| `20260802075447 credential_renewal_and_feedback_workflow` | `20260802073841_credential_renewal_and_feedback_workflow.sql` | timestamp drift |
| `20260802075530 secure_feedback_insert_policy` | `20260802075515_secure_feedback_insert_policy.sql` | timestamp drift |
| `20260815203704 invoice_payment_settlement_integrity` | `20260815201000_invoice_payment_settlement_integrity.sql` | timestamp drift |
| `20260815203714 payment_authority_lockdown` | `20260815202000_payment_authority_lockdown.sql` | timestamp drift |
| `20260815203721 core_tenant_ownership_lockdown` | `20260815203000_core_tenant_ownership_lockdown.sql` | timestamp drift |
| `20260815203730 contract_share_token_hashing` | `20260815204000_contract_share_token_hashing.sql` | timestamp drift + manual-review state transform |
| `20260815204146 revoke_5000x_trigger_function_execution` | `20260815205000_revoke_5000x_trigger_function_execution.sql` | timestamp drift |
| `20260816221930 second_me_action_idempotency` | `20260816_second_me_action_idempotency.sql` | noncanonical source version |
| `20260816230641 lock_profile_privileged_columns` | `20260816_lock_profile_privileged_columns.sql` | noncanonical source version |
| `20260816232320 durable_rate_limits` | `20260816231000_durable_rate_limits.sql` | timestamp drift |
| `20260817033425 job_match_profiles_and_requirements` | `20260817002500_job_match_profiles_and_requirements.sql` | timestamp drift |
| `20260817033826 private_job_match_preferences` | `20260817004000_private_job_match_preferences.sql` | timestamp drift + manual review |
| `20260817133543 job_match_radius_and_interactions` | `20260817083000_job_match_radius_and_interactions.sql` | timestamp drift |
| `20260817134320 private_job_match_origin` | `20260817084000_private_job_match_origin.sql` | timestamp drift + manual review |
| `20260817211956 account_deletion_requests` | `20260817204500_account_deletion_requests.sql` | timestamp drift |
| `20260817215246 play_ugc_safety` | `20260817_play_ugc_safety.sql` | noncanonical source version |
| `20260818113540 titan_support_core` | `20260818113000_titan_support_core.sql` | timestamp drift |
| `20260818114844 titan_support_realtime` | `20260818120500_titan_support_realtime.sql` | timestamp drift |
| `20260818135831 fix_company_rls_recursion` | `20260818141500_fix_company_rls_recursion.sql` | timestamp drift |
| `20260828023235 harden_attention_funding_activation_session_binding` | `20260828011500_harden_attention_funding_activation_session_binding.sql` | timestamp drift; Attention must be preserved |

Name equality is evidence that files are related; it is **not** permission to replay them. Timestamp/version identity must be treated as authoritative migration-history identity.

## Confirmed destructive cutover

The production ledger records this sequence:

1. `20260818215755 create_attention_marketplace_core`
2. `20260818215820 add_attention_atomic_reward_functions`
3. `20260818215916 add_attention_active_view_heartbeats`
4. **`20260818220148 purge_legacy_titanos_public_schema`**
5. `20260818220301 enable_pg_net_for_storage_cleanup`
6. `20260818220503 add_attention_campaign_funding`
7. `20260818221440 harden_attention_rls_and_indexes`

The purge ledger row remains historical evidence. It must not be deleted, reverted, renumbered, or marked differently merely to make local migration tooling agree with the recovered source.

## Reconstruction phases

### Phase A — Freeze and inventory

- Keep production read-only for recovery work.
- Preserve the current production ledger snapshot.
- Preserve the current five Attention tables and Auth account state.
- Preserve current storage bucket metadata and Edge Function inventory.
- Confirm the recovery source commit and expected application contract.

**Exit gate:** evidence snapshot is complete and no recovery command can target production by default.

### Phase B — Isolated schema reconstruction

Create a separate staging database only after cost/authorization approval. Do **not** create it by branching from the purged schema and assuming that equals the target TitanOS schema.

In staging:

- build the TitanOS schema from reviewed source definitions,
- omit every `NEVER_REPLAY` migration,
- separately review every `MANUAL_REVIEW` migration,
- preserve Attention as a distinct compatibility surface where required,
- use synthetic test fixtures only, never guessed production history,
- resolve the `041` source collision without rewriting production history.

**Exit gate:** final target schema is reproducible from a clean staging database without destructive historical replay.

### Phase C — Contract and security certification

Validate at minimum:

- Auth/profile bootstrap behavior,
- customers/jobs/estimates/invoices CRUD,
- company/workspace ownership,
- Driver Hub/geofence/check-in persistence,
- Titan memory/context/action tables,
- Titan Support isolation,
- marketplace/hire/job-match policies,
- payment and webhook persistence contracts,
- storage ownership/access,
- grants and SECURITY DEFINER search paths,
- RLS for anon/authenticated/service-role boundaries,
- two-account IDOR/cross-tenant denial tests,
- destructive-operation negative tests.

**Exit gate:** schema + RLS + ownership + application contract tests pass with no production data dependency.

### Phase D — Generate a forward-only recovery change

After staging is certified, derive new forward-only recovery migration(s) from the **verified target schema versus the actual production schema**. The recovery change must:

- create only verified missing TitanOS objects,
- preserve existing Attention/Auth state unless explicitly reviewed,
- contain no historical purge/cleanup operations,
- contain no inferred historical business rows,
- avoid migration-history repair as a deployment mechanism,
- be idempotency-aware where feasible,
- have a rollback/containment plan,
- pass a dry review of every DDL/DML statement.

**Exit gate:** reviewers can explain every production statement and prove why it is necessary.

### Phase E — Production recovery gate

Production remains NO-GO until all of the following are complete:

- forward-only recovery change reviewed,
- database security/RLS certification green,
- leaked-password protection enabled and verified,
- live Stripe/webhook lifecycle verified,
- Cloudflare Worker/domain/secrets mapping verified,
- final web + Android E2E green,
- observability and rollback drills green.

Only then may PR #70 be considered for promotion/merge according to the release process.

## Historical data rule

Current evidence does not include a restorable TitanOS production dump or PITR snapshot. Historical audits prove meaningful state existed before the purge, including claimed founding slots. Therefore:

> Missing historical rows are **unknown**, not zero.

No recovery script may recreate founders, customers, jobs, invoices, payments, memory, or other user/business state from assumptions. If an authoritative backup/export is discovered later, it must be handled as a separate evidence-backed data-restoration phase.
