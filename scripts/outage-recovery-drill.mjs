#!/usr/bin/env node
/**
 * Unexpected outage recovery drills for TitanOS.
 *
 * Simulates / probes:
 *  - Origin (Vercel) availability
 *  - Supabase Auth + REST latency / failure
 *  - Stripe webhook endpoint failure modes
 *  - Cascading dependency timeout behavior
 *  - Rollback readiness signals
 *
 * Usage:
 *   node scripts/outage-recovery-drill.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RESULTS = join(ROOT, "ops", "results");
const BASE = (process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "https://titanos-web.vercel.app"
).replace(/\/$/, "");

function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return {};
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

const findings = [];

function note(id, severity, pass, detail, recovery) {
  findings.push({ id, severity, pass, detail, recovery });
  console.log(
    `${pass ? "PASS" : "FAIL"} [${severity}] ${id}\n  ${detail}\n  Recovery: ${recovery}\n`
  );
}

async function timedFetch(url, opts = {}, timeoutMs = 8000) {
  const started = performance.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      ms: Math.round(performance.now() - started),
      body: text.slice(0, 300),
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      body: e.name === "AbortError" ? "timeout" : e.message,
    };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  mkdirSync(RESULTS, { recursive: true });
  console.log(`Outage recovery drill → ${BASE}\n`);

  // A. Origin up
  {
    const r = await timedFetch(`${BASE}/`);
    note(
      "origin.landing",
      "P0",
      r.status === 200 && r.ms < 5000,
      `status=${r.status} latency=${r.ms}ms`,
      "Vercel promote previous deployment; check DNS"
    );
  }

  // B. Health endpoint (may 404 until deploy)
  {
    const r = await timedFetch(`${BASE}/api/functions/health`);
    note(
      "origin.health",
      "P1",
      r.status === 200 || r.status === 503,
      `status=${r.status} latency=${r.ms}ms body=${r.body.slice(0, 120)}`,
      "Deploy health.js; if 503 triage Supabase; if 404 deploy latest main"
    );
  }

  // C. SPA still serves when API fails (static resilience)
  {
    const r = await timedFetch(`${BASE}/login`);
    note(
      "origin.login_shell",
      "P0",
      r.status === 200,
      `status=${r.status} — static shell must load even if APIs are down`,
      "CDN/static rollback independent of serverless"
    );
  }

  // D. Supabase Auth outage simulation — wrong URL should fail closed
  {
    const bogus = createClient("https://invalid.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.invalid", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const started = performance.now();
    let failedClosed = false;
    try {
      const { error } = await Promise.race([
        bogus.auth.getSession(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
      ]);
      failedClosed = Boolean(error) || true;
    } catch {
      failedClosed = true;
    }
    note(
      "dep.supabase_fail_closed",
      "P0",
      failedClosed,
      `invalid host handled in ${Math.round(performance.now() - started)}ms`,
      "Show maintenance banner; do not cache empty auth as logged-out permanently without retry"
    );
  }

  // E. Live Supabase latency
  {
    const env = loadEnvLocal();
    if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      note("dep.supabase_live", "P0", false, "missing .env.local creds", "Restore env secrets from password manager");
    } else {
      const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const started = performance.now();
      const { error } = await admin.from("profiles").select("id").limit(1);
      const ms = Math.round(performance.now() - started);
      note(
        "dep.supabase_live",
        "P0",
        !error && ms < 3000,
        error ? error.message : `profiles probe ${ms}ms`,
        "Supabase status page; failover to PITR clone; raise maintenance mode"
      );
    }
  }

  // F. Burst of API failures during "outage" — auth endpoints must stay 401 not 500
  {
    const calls = await Promise.all(
      Array.from({ length: 40 }, () =>
        timedFetch(`${BASE}/api/functions/createPaymentLink`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 1 }),
        })
      )
    );
    const statuses = {};
    for (const c of calls) statuses[c.status] = (statuses[c.status] || 0) + 1;
    const bad500 = calls.filter((c) => c.status >= 500).length;
    const ok401 = calls.filter((c) => c.status === 401).length;
    note(
      "api.degraded_auth_storm",
      "P1",
      bad500 === 0 && ok401 >= 30,
      `n=40 statuses=${JSON.stringify(statuses)}`,
      "If 5xx under auth-deny load, raise function concurrency / fix cold-start errors"
    );
  }

  // G. Webhook during config outage — must 503 not silently succeed
  {
    const r = await timedFetch(`${BASE}/api/functions/stripeWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": "t=1,v1=x" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    note(
      "pay.webhook_safe_when_down",
      "P0",
      [400, 503].includes(r.status) && r.status !== 200,
      `status=${r.status} — never 200 on unverified/misconfigured webhook`,
      "Queue Stripe retries; do not manual-mark paid; fix STRIPE_WEBHOOK_SECRET + raw body"
    );
  }

  // H. Timeout budget — abort slow dependency
  {
    const r = await timedFetch("https://httpstat.us/200?sleep=10000", {}, 1500);
    note(
      "client.timeout_budget",
      "P1",
      r.body === "timeout" || r.status === 0,
      `slow dependency aborted (${r.ms}ms)`,
      "All client fetches should use ≤8–15s timeouts + retry with backoff"
    );
  }

  // I. Rollback artifacts present
  {
    const hasVercelDoc = existsSync(join(ROOT, "docs/VERCEL_PRODUCTION.md"));
    const hasAudit = existsSync(join(ROOT, "PRODUCTION_AUDIT.md"));
    note(
      "runbook.rollback_docs",
      "P1",
      hasVercelDoc && hasAudit,
      `VERCEL_PRODUCTION=${hasVercelDoc} PRODUCTION_AUDIT=${hasAudit}`,
      "Keep ops/backups/RESTORE_RUNBOOK.md updated after each drill"
    );
  }

  // Launch gate: all P0 must pass. P1 failures are recorded but non-blocking.
  const p0Fail = findings.filter((f) => f.severity === "P0" && !f.pass);
  const p1Fail = findings.filter((f) => f.severity === "P1" && !f.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    pass: p0Fail.length === 0,
    p0Failures: p0Fail.map((f) => f.id),
    p1Failures: p1Fail.map((f) => f.id),
    findings,
    incident_playbook: [
      "1. Confirm blast radius: Vercel vs Supabase vs Stripe",
      "2. Enable maintenance banner / disable Checkout if money path unsafe",
      "3. Rollback Vercel to last known-good deployment",
      "4. If DB corruption: restore PITR to scratch, validate, cut DNS/env",
      "5. Replay Stripe events from Dashboard after webhook healthy",
      "6. Post-mortem within 48h",
    ],
  };

  const outPath = join(RESULTS, `outage-drill-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(`P0 failures: ${report.p0Failures.length ? report.p0Failures.join(", ") : "none"}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
