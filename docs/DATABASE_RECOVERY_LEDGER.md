# TitanOS Pre-Purge Migration Ledger Manifest

Purpose: preserve the **non-secret forensic metadata** required to reconstruct TitanOS after the public schema purge.

Source: read-only query of `supabase_migrations.schema_migrations` in the affected TitanOS Supabase project on 2026-08-26.

## Safety classification

- This file intentionally contains **no migration SQL statement bodies**.
- Every entry below reported `statement_count = 1` and `rollback_count = 0` in the migration ledger.
- `20260814221704 add_server_runtime_secrets` is explicitly classified **SENSITIVE**. Its historical SQL body must not be copied into Git. Rebuild required runtime secrets from current secret-manager/environment values.
- The final legitimate TitanOS migration before unrelated Attention migrations is **`20260818203624 engagement_event_triggers`**.
- Never replay `20260818220148 purge_legacy_titanos_public_schema`.

## Legitimate TitanOS ledger through recovery cutoff

| Version | Migration | Statement chars | Classification |
|---|---|---:|---|
| 20260802012204 | google_play_subscriptions | 1380 | TitanOS |
| 20260802075447 | credential_renewal_and_feedback_workflow | 1018 | TitanOS |
| 20260802075530 | secure_feedback_insert_policy | 476 | TitanOS |
| 20260802092438 | titan_autopilot | 333 | TitanOS |
| 20260802094450 | autopilot_membership_claims | 954 | TitanOS |
| 20260809035141 | harden_lead_outreach | 3268 | TitanOS |
| 20260809054335 | driver_performance_benchmarks | 4125 | TitanOS |
| 20260813182732 | titan_memory_and_rules | 4056 | TitanOS |
| 20260813182734 | context_threads | 2195 | TitanOS |
| 20260813182735 | production_action_runs | 2260 | TitanOS |
| 20260813223541 | founding_25_lifetime_and_three_day_trial | 7310 | TitanOS |
| 20260813223639 | reconcile_founding_25_backfill | 2134 | TitanOS |
| 20260814011440 | rerun_017_fee_engine_20260813 | 6853 | TitanOS |
| 20260814020146 | harden_internal_security_definer_rpcs | 324 | TitanOS |
| 20260814020156 | harden_authorization_helper_rpc_visibility | 277 | TitanOS |
| 20260814020454 | remove_duplicate_notifications_index | 59 | TitanOS |
| 20260814115934 | harden_public_contract_share_rpc | 2632 | TitanOS |
| 20260814120002 | restore_contract_signature_metadata_columns | 244 | TitanOS |
| 20260814120204 | archive_and_remove_legacy_demo_fixture_records | 1664 | TitanOS/data-cleanup |
| 20260814120817 | restore_jobs_site_geofence_columns | 1107 | TitanOS |
| 20260814120831 | persist_public_contract_signature_image | 1652 | TitanOS |
| 20260814120854 | archive_and_remove_explicit_test_auth_accounts | 1076 | TitanOS/data-cleanup |
| 20260814153621 | harden_public_contract_capability | 2762 | TitanOS |
| 20260814155025 | lock_profile_privileges_unconditionally | 1171 | TitanOS/security |
| 20260814155717 | index_core_titan_foreign_keys | 1775 | TitanOS/performance |
| 20260814221704 | add_server_runtime_secrets | 535 | **SENSITIVE — reconstruct, do not copy body** |
| 20260814222720 | harden_security_definer_execution | 1203 | TitanOS/security |
| 20260814222744 | revoke_client_grants_on_service_only_tables | 395 | TitanOS/security |
| 20260814222819 | sync_profiles_marketing_professional_columns | 465 | TitanOS |
| 20260814222911 | tighten_profiles_rls_roles_and_checks | 633 | TitanOS/security |
| 20260814223007 | tighten_core_business_rls_to_authenticated | 710 | TitanOS/security |
| 20260814223042 | add_missing_update_with_checks | 1291 | TitanOS/security |
| 20260814223200 | harden_authorization_helper_search_paths | 304 | TitanOS/security |
| 20260815203704 | invoice_payment_settlement_integrity | 336 | TitanOS/financial integrity |
| 20260815203714 | payment_authority_lockdown | 1530 | TitanOS/financial security |
| 20260815203721 | core_tenant_ownership_lockdown | 1247 | TitanOS/security |
| 20260815203730 | contract_share_token_hashing | 1106 | TitanOS/security |
| 20260815204146 | revoke_5000x_trigger_function_execution | 195 | TitanOS/security |
| 20260816221930 | second_me_action_idempotency | 854 | TitanOS/Second Self |
| 20260816230641 | lock_profile_privileged_columns | 857 | TitanOS/security |
| 20260816232320 | durable_rate_limits | 2558 | TitanOS/security |
| 20260817033425 | job_match_profiles_and_requirements | 3160 | TitanOS/jobs |
| 20260817033826 | private_job_match_preferences | 3118 | TitanOS/jobs/privacy |
| 20260817133543 | job_match_radius_and_interactions | 2733 | TitanOS/jobs |
| 20260817134320 | private_job_match_origin | 630 | TitanOS/jobs/privacy |
| 20260817211956 | account_deletion_requests | 1009 | TitanOS/Google Play |
| 20260817215246 | play_ugc_safety | 4831 | TitanOS/Google Play safety |
| 20260818075156 | titan_ai_knowledge | 6236 | TitanOS/Titan AI |
| 20260818080634 | align_admin_authority_and_revoke_trigger_rpc | 618 | TitanOS/security |
| 20260818080843 | harden_is_admin_security_invoker | 608 | TitanOS/security |
| 20260818082531 | optimize_core_rls_initplans | 5379 | TitanOS/RLS performance |
| 20260818083244 | optimize_hot_secondary_rls | 5581 | TitanOS/RLS performance |
| 20260818084626 | harden_marketplace_table_privileges | 3350 | TitanOS/marketplace security |
| 20260818085628 | split_marketplace_catalog_admin_policies | 575 | TitanOS/marketplace security |
| 20260818113540 | titan_support_core | 21461 | TitanOS/Support |
| 20260818114844 | titan_support_realtime | 700 | TitanOS/Support |
| 20260818135831 | fix_company_rls_recursion | 3552 | TitanOS/RLS |
| 20260818195936 | three_sided_work_ecosystem | 8348 | TitanOS/work ecosystem |
| 20260818201919 | employment_profiles | 3304 | TitanOS/employment |
| 20260818203624 | engagement_event_triggers | 5151 | **TitanOS recovery cutoff** |

## Excluded post-cutoff migrations

These are intentionally **not** part of the TitanOS recovery chain:

| Version | Migration | Recovery treatment |
|---|---|---|
| 20260818215755 | create_attention_marketplace_core | EXCLUDE — unrelated Attention schema |
| 20260818215820 | add_attention_atomic_reward_functions | EXCLUDE — unrelated Attention schema |
| 20260818215916 | add_attention_active_view_heartbeats | EXCLUDE — unrelated Attention schema |
| 20260818220148 | purge_legacy_titanos_public_schema | **NEVER REPLAY — destructive incident boundary** |

Later Attention migrations are likewise excluded from the TitanOS reconstruction unless a separate product migration plan explicitly decides otherwise.

## Reconstruction rules

1. Compare this ledger against repository migration files before replay.
2. Recover missing legitimate TitanOS SQL only from the forensic ledger or another verified source.
3. Hash and review recovered statements before execution in an isolated environment.
4. Redact/reconstruct any secret-bearing migration rather than persisting historical secret values.
5. Do not mark a migration reconstructed merely because its ledger row exists; the purge left historical rows intact while deleting schema objects.
6. Apply the pending post-incident TitanOS Support workspace migration only **after** the pre-purge TitanOS schema is fully reconstructed and certified.
