#!/usr/bin/env node
/**
 * Backup & restore readiness drill for TitanOS (Supabase + Vercel).
 *
 * What this script CAN do automatically:
 *  - Verify Supabase connectivity with service role
 *  - Snapshot row counts for critical tables (read-only)
 *  - Export a logical JSON backup of schema-critical sample rows
 *  - Verify restore-readiness checklist items
 *
 * What requires Dashboard (cannot fully automate without project owner token):
 *  - Point-in-time recovery (PITR) enablement
 *  - Physical backup download / restore into a new project
 *  - Storage bucket dump
 *
 * Usage:
 *   node scripts/backup-restore-drill.mjs
 *   node scripts/backup-restore-drill.mjs --export
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "ops", "backups");
const RESULTS = join(ROOT, "ops", "results");
const DO_EXPORT = process.argv.includes("--export");

function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) throw new Error("Missing .env.local");
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const CRITICAL_TABLES = [
  "profiles",
  "customers",
  "jobs",
  "invoices",
  "estimates",
  "payments",
  "contracts",
  "portal_sessions",
  "marketplace_listings",
  "community_posts",
];

async function countTable(admin, table) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) return { table, ok: false, error: error.message, count: null };
  return { table, ok: true, count: count ?? 0 };
}

async function sampleRows(admin, table, limit = 5) {
  const { data, error } = await admin.from(table).select("*").limit(limit);
  if (error) return { table, ok: false, error: error.message, rows: [] };
  return { table, ok: true, rows: data || [] };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(RESULTS, { recursive: true });
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Backup / restore drill — read-only inventory\n");

  const counts = [];
  for (const table of CRITICAL_TABLES) {
    const row = await countTable(admin, table);
    counts.push(row);
    console.log(
      `${row.ok ? "OK" : "MISS"}  ${table.padEnd(24)} ${row.ok ? `rows=${row.count}` : row.error}`
    );
  }

  // Auth users count via admin API
  let authUsers = null;
  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (!error) {
      // listUsers doesn't always return total; probe second page size
      authUsers = { reachable: true, sample: data?.users?.length ?? 0 };
    } else {
      authUsers = { reachable: false, error: error.message };
    }
  } catch (e) {
    authUsers = { reachable: false, error: e.message };
  }
  console.log(
    `\nAuth admin API: ${authUsers.reachable ? "reachable" : `FAIL ${authUsers.error}`}`
  );

  // Storage buckets
  let buckets = [];
  try {
    const { data, error } = await admin.storage.listBuckets();
    if (error) throw error;
    buckets = data || [];
    console.log(`Storage buckets: ${buckets.map((b) => `${b.name}(public=${b.public})`).join(", ") || "(none)"}`);
  } catch (e) {
    console.log(`Storage list failed: ${e.message}`);
  }

  let exportPath = null;
  if (DO_EXPORT) {
    const payload = { exportedAt: new Date().toISOString(), tables: {} };
    for (const table of CRITICAL_TABLES) {
      const sample = await sampleRows(admin, table, 25);
      payload.tables[table] = sample;
    }
    exportPath = join(OUT_DIR, `logical-sample-${Date.now()}.json`);
    writeFileSync(exportPath, JSON.stringify(payload, null, 2));
    console.log(`\nLogical sample export → ${exportPath}`);
    console.log("(Sample only — not a full disaster-recovery backup.)");
  }

  const missing = counts.filter((c) => !c.ok);
  const checklist = [
    {
      id: "critical_tables_reachable",
      pass: missing.length === 0,
      detail: missing.length ? missing.map((m) => m.table).join(",") : "all listed tables reachable",
    },
    {
      id: "auth_admin_reachable",
      pass: Boolean(authUsers?.reachable),
      detail: JSON.stringify(authUsers),
    },
    {
      id: "storage_inventoried",
      pass: buckets.length > 0,
      detail: buckets.map((b) => b.name).join(",") || "no buckets",
    },
    {
      id: "pitr_manual",
      pass: false,
      detail:
        "MANUAL: Supabase Dashboard → Project Settings → Database → confirm PITR / daily backups enabled for your plan",
    },
    {
      id: "restore_drill_manual",
      pass: false,
      detail:
        "MANUAL: Restore latest backup into a NEW Supabase project, point a Preview Vercel env at it, run smoke-auth + payment scenarios",
    },
    {
      id: "vercel_rollback_manual",
      pass: false,
      detail:
        "MANUAL: Vercel → Deployments → Promote previous production deployment (verify <5 min RTO)",
    },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    supabaseUrlHost: new URL(url).host,
    counts,
    authUsers,
    buckets: buckets.map((b) => ({ name: b.name, public: b.public })),
    exportPath,
    checklist,
    rto_rpo_targets: {
      rpo_minutes: 60,
      rto_minutes: 30,
      note: "Targets for launch; measure during a scheduled restore into a scratch project",
    },
  };

  const outPath = join(RESULTS, `backup-drill-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  // Human restore runbook
  const runbook = `# TitanOS Backup & Restore Runbook

Generated: ${report.generatedAt}

## Automated this run
- Table inventory: ${counts.filter((c) => c.ok).length}/${counts.length} reachable
- Auth admin API: ${authUsers?.reachable ? "ok" : "failed"}
- Storage buckets: ${buckets.map((b) => b.name).join(", ") || "none"}
${exportPath ? `- Sample export: \`${exportPath}\`` : "- Sample export: skipped (pass --export)"}

## Required manual drills (before public launch)

### 1. Confirm backups
1. Open Supabase → Project Settings → Database
2. Confirm daily backups (and PITR if Pro+)
3. Record last backup timestamp in this folder as \`ops/backups/LAST_CONFIRMED.txt\`

### 2. Logical restore drill (quarterly)
1. Create a **new** Supabase project (scratch)
2. Restore from backup / re-apply migrations in \`supabase/migrations\`
3. Import a logical dump or use PITR clone
4. Set Preview Vercel env:
   - \`VITE_SUPABASE_URL\`
   - \`VITE_SUPABASE_ANON_KEY\`
   - \`SUPABASE_SERVICE_ROLE_KEY\`
5. Run:
   \`\`\`bash
   npm run auth:check
   node scripts/payment-failure-scenarios.mjs --base https://<preview>.vercel.app
   \`\`\`
6. Confirm customers/invoices/payments row counts match expectations
7. Tear down scratch project

### 3. Storage restore
1. List \`titanos-uploads\` objects
2. Copy to cold storage (S3/Backblaze) weekly until private+versioned bucket lands
3. Restore sample object and verify public/signed URL

### 4. App rollback (outage)
1. Vercel → Deployments → previous READY → Promote to Production
2. Or: \`git revert\` + push
3. Verify \`/api/functions/health\` and \`/login\`

## RTO / RPO targets
- RPO ≤ 60 minutes (data loss tolerance)
- RTO ≤ 30 minutes (time to serve traffic again)
`;

  writeFileSync(join(OUT_DIR, "RESTORE_RUNBOOK.md"), runbook);
  console.log(`\nWrote ${outPath}`);
  console.log(`Wrote ${join(OUT_DIR, "RESTORE_RUNBOOK.md")}`);

  const autoFail = checklist.filter((c) => c.id.startsWith("critical") || c.id.startsWith("auth")).some((c) => !c.pass);
  process.exit(autoFail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
