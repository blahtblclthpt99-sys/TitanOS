#!/usr/bin/env node
/**
 * Guarded launcher for scripts/verify-db-security.mjs.
 *
 * This launcher is the recovery-safe entry point for mutation-based DB security
 * probes. It performs a read-only TitanOS schema preflight first and refuses to
 * run against the canonical production Supabase project unless two independent,
 * per-process production acknowledgements are supplied. The acknowledgements are
 * intentionally not loaded from .env files so they cannot become sticky config.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runRecoveryPreflight } from "./db-recovery-preflight.mjs";
import {
  PRODUCTION_MUTATION_CONFIRMATION,
  classifyDatabaseMutationTarget,
} from "./db-mutation-safety.mjs";

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }

  return out;
}

function loadRecoveryManifest() {
  const manifestUrl = new URL(
    "../supabase/recovery/recovery-manifest.json",
    import.meta.url
  );
  return JSON.parse(readFileSync(manifestUrl, "utf8"));
}

async function main() {
  const env = {
    ...process.env,
    ...loadEnv(".env"),
    ...loadEnv(".env.local"),
  };

  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon || !serviceKey) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: "missing_url_anon_or_service_role",
          mutationGuard: "BLOCKED",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const manifest = loadRecoveryManifest();
  const mutationTarget = classifyDatabaseMutationTarget({
    url,
    productionProjectRef: manifest.productionProjectRef,
    productionConfirmation:
      process.env.TITANOS_ALLOW_PRODUCTION_DB_MUTATION_PROBES,
    approvedProductionProjectRef:
      process.env.TITANOS_APPROVED_PRODUCTION_PROJECT_REF,
  });

  if (!mutationTarget.allowed) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: "database_mutation_target_blocked",
          mutationGuard: "BLOCKED",
          projectRef: mutationTarget.projectRef,
          target: mutationTarget.target,
          reason: mutationTarget.reason,
          productionAuthorizationRequired: {
            source: "process_environment_only",
            TITANOS_ALLOW_PRODUCTION_DB_MUTATION_PROBES:
              PRODUCTION_MUTATION_CONFIRMATION,
            TITANOS_APPROVED_PRODUCTION_PROJECT_REF:
              manifest.productionProjectRef,
          },
        },
        null,
        2
      )
    );
    process.exit(4);
  }

  const preflight = await runRecoveryPreflight({ url, serviceKey });
  if (!preflight.classification.safeForMutationProbes) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: "database_recovery_preflight_not_safe_for_mutation_probes",
          mutationGuard: "BLOCKED",
          projectRef: preflight.projectRef,
          target: mutationTarget.target,
          classification: preflight.classification,
        },
        null,
        2
      )
    );
    process.exit(3);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mutationGuard: "AUTHORIZED",
        projectRef: preflight.projectRef,
        target: mutationTarget.target,
        recoveryState: preflight.classification.state,
        readOnlyPreflight: true,
      },
      null,
      2
    )
  );

  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const verifier = resolve(root, "scripts/verify-db-security.mjs");
  const result = spawnSync(process.execPath, [verifier], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) throw result.error;
  process.exit(Number.isInteger(result.status) ? result.status : 1);
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        ok: false,
        mutationGuard: "ERROR",
        error: String(error?.message || error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
