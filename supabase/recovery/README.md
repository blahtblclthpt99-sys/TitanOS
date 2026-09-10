# TitanOS Supabase recovery evidence

This directory preserves evidence from the isolated **TitanOS Recovery Staging** reconstruction.

## Safety boundary

Files under `staging-applied/` are **evidence snapshots**, not approved production migrations. They were recovered from `supabase_migrations.schema_migrations` after the staging reconstruction and are intentionally stored outside `supabase/migrations/` so normal migration tooling does not replay them.

Do not copy, rename, reorder, or execute this sequence against production as a recovery shortcut. Production currently has a different database state and requires a new, forward-only migration plan derived from the verified staging target and the actual production schema/data.

## Integrity

`staging-applied/manifest.json` records the original staging migration version, name, Unicode character count, and MD5 for each of the 22 reconstruction statements. `scripts/recovery-evidence.test.mjs` verifies that the committed SQL remains byte-for-byte equivalent to the staging ledger and that the evidence files stay outside the executable migration directory.

## Data policy

These files describe schema, policies, functions, and hardening operations only. Missing historical application rows must never be synthesized from this evidence.
