#!/usr/bin/env node
/**
 * RETIRED historical migration helper.
 *
 * TitanOS production migration history contains a destructive cutover migration
 * that intentionally removed the legacy TitanOS public schema. The current
 * recovery tree does not contain that destructive SQL, so generic historical
 * replay or `supabase db push` is unsafe and is prohibited by the recovery
 * manifest.
 *
 * This compatibility shim intentionally performs NO network request and NO SQL.
 */
console.error([
  "BLOCKED: direct historical TitanOS migration replay is disabled.",
  "Do not run generic db push against production during recovery.",
  "Validate supabase/recovery/recovery-manifest.json and reconstruct only in an isolated staging environment.",
  "Production mutation requires a separately reviewed and certified recovery plan.",
].join("\n"));
process.exit(2);
