# TitanOS Forward-Only Production Recovery Plan

**Status:** design/review artifact only — **DO NOT APPLY TO PRODUCTION**  
**Target:** `staging-target-2026-09-10.json`  
**Baseline:** `production-baseline-2026-09-10.json`  
**Release state:** **PRODUCTION NO-GO**

This plan defines how the eventual production recovery migration must be generated. It is intentionally not executable SQL.

## 1. Fixed recovery model

The production recovery is a **forward-only additive delta** from the current production state to the verified TitanOS staging target.

It must not:

- replay the historical migration directory,
- reverse or rerun the historical purge,
- repair migration history to force old SQL to run,
- delete or rename existing Attention objects,
- recreate missing historical user/business/payment/founding rows from assumptions,
- overwrite the surviving Auth account,
- make public storage buckets as an intermediate step,
- expose server-only tables to browser roles.

## 2. Baseline-to-target delta

Current production baseline:

- 5 Attention tables,
- 6 policies,
- 12 indexes,
- 4 Attention service functions,
- 0 application triggers,
- 1 Auth user,
- private `titanos-uploads` bucket.

Certified TitanOS target adds a separate application surface consisting of:

- 79 TitanOS public tables,
- private helper schema/functions,
- 142 TitanOS RLS policies,
- 219 TitanOS public indexes,
- 23 TitanOS public/private functions,
- 25 application triggers,
- private `support-attachments` storage bucket and storage policies.

The Attention objects are not part of the target subtraction set; they remain alongside TitanOS.

## 3. Required migration sequencing

The eventual migration set should be split into reviewable forward-only phases. Each phase must fail closed and stop before the next phase when an invariant is not met.

### P0 — Production preflight assertions

Read-only assertions before any DDL:

- expected five Attention tables exist,
- no unexpected non-Attention public application tables have appeared since the baseline capture,
- existing Attention row counts are recorded again,
- existing Auth user count is recorded again,
- `titanos-uploads` exists and remains private,
- the destructive purge migration remains historical only,
- production migration ledger has not diverged from the reviewed baseline in a way that invalidates the plan.

Any unexpected state change is **STOP/REVIEW**, not an instruction to coerce production back to the old snapshot.

### P1 — Foundation and helper boundary

Create only missing TitanOS prerequisites:

- required extension(s) already proven in staging,
- private helper schema,
- `profiles` and core ownership helpers,
- secure Auth profile bootstrap trigger/function,
- helper-function grants with explicit search paths.

Preserve the existing Auth user and allow the bootstrap path to operate for future Auth lifecycle events. Existing users require an explicit, reviewed profile-initialization decision; do not infer historical profile fields.

### P2 — Core operational schema

Create missing structural tables for:

- customers,
- jobs,
- estimates,
- invoices,
- expenses,
- employees,
- mileage,
- equipment/inventory,
- leads/follow-ups,
- contracts/insurance/portal actions,
- companies/members,
- communications and notifications.

This phase creates structure only. No historical business rows are synthesized.

### P3 — Marketplace, hiring, community, support, and communications

Create the remaining verified application structures, including:

- marketplace/hire/community surfaces,
- fee and webhook ledgers,
- Titan communications structures,
- Titan Support structures,
- server-only secret/session tables.

No feature becomes production-enabled merely because its table exists; application feature flags and release gates remain authoritative.

### P4 — Integrity functions and triggers

Install the certified data-integrity protections before opening client write access, including safeguards for:

- profile privilege fields,
- payment authority,
- invoice paid status,
- escrow settlement,
- referral paying/completion flags,
- message-body ownership,
- Titan communications membership identity/admin behavior.

Service-only trigger functions must not be callable by `anon` or `authenticated` unless explicitly required by a reviewed contract.

### P5 — RLS and grants

Enable RLS and install reviewed policies/grants in a fail-closed order.

Rules:

- client grants never precede required RLS policies,
- `portal_sessions` and `titan_comms_channel_secrets` remain server-only,
- no generic browser entity mapping is added for server-only tables,
- SECURITY DEFINER helper execution remains restricted according to the certified staging target,
- public-schema CREATE remains unavailable to untrusted API roles.

The final policy set may not be promoted until the two-account runtime IDOR test is green. Any later policy consolidation for performance must be proven authorization-equivalent first.

### P6 — Storage

Preserve existing `titanos-uploads` as private and install only the certified ownership/path policies.

Create `support-attachments` private with its reviewed file-size and MIME restrictions and customer/assigned-support access policy.

No recovery step may temporarily make either bucket public.

### P7 — Index coverage

Create the target query/index set after table creation and before traffic cutover.

The certified staging target currently has:

- 219 public indexes,
- zero unindexed public foreign keys.

The staging FK-coverage hardening SQL is evidence, not a production migration. The production recovery generator should emit explicit reviewed indexes in dependency-safe order rather than blindly replaying the staging recovery statement.

### P8 — Post-DDL verification

Before application traffic:

- compare table/function/trigger/policy/index inventories to the certified target,
- verify all public tables have intended RLS state,
- verify server-only grants,
- re-run Supabase security and performance advisors,
- verify Auth user count did not change unexpectedly,
- verify Attention tables and service functions remain present,
- verify Attention row counts were not mutated by recovery DDL,
- verify both storage buckets remain private,
- verify no historical business rows were synthesized.

A mismatch is a release blocker.

## 4. Runtime certification after schema recovery

Even after DDL succeeds, traffic remains blocked until runtime tests pass:

1. two-account cross-tenant CRUD denial/allow matrix,
2. owner/admin/company-member boundaries,
3. marketplace/hire/message isolation,
4. Titan Support customer/agent isolation,
5. server-only portal/comms-secret denial from browser roles,
6. storage owner/cross-owner denial tests,
7. payment/invoice/escrow/referral privilege-escalation negative tests,
8. Driver Hub/geofence/check-in persistence,
9. Titan Auto/Second Me action authorization and approval gates.

## 5. Non-database production gates

Schema recovery alone does not authorize production release. These gates remain independent:

- leaked-password protection enabled and verified,
- live Stripe checkout/webhook/refund/reconciliation certification,
- Cloudflare Worker/domain/routes/secrets/bindings/release mapping certification,
- web and Android production E2E,
- observability/alerting verification,
- rollback and outage-recovery drill.

## 6. Rollback/containment model

The preferred recovery containment is **traffic isolation**, not destructive schema rollback.

If recovery validation fails before traffic:

- keep TitanOS traffic disabled,
- leave existing Attention/Auth state untouched,
- diagnose additive objects in place or remove only objects created by the reviewed recovery change when deletion is independently proven safe,
- never rerun the historical purge.

If a fault appears after traffic cutover, route traffic back to the previous immutable application release first. Database destructive rollback requires a separately reviewed data-safety decision.

## 7. Generation gate for executable SQL

Executable production recovery SQL may be generated only after:

- staging certification record is merged,
- two-account runtime IDOR testing is green or the unresolved policy surfaces are explicitly excluded from launch,
- the production baseline is re-captured immediately before generation,
- any production drift is reconciled,
- each generated statement can be mapped to a verified target object and a baseline absence/change requirement.

Until then, **production DDL remains prohibited**.
