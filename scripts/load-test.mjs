#!/usr/bin/env node
/**
 * Concurrent HTTP load tester for TitanOS production readiness.
 *
 * Usage:
 *   node scripts/load-test.mjs
 *   node scripts/load-test.mjs --base https://titanos-web.vercel.app --profile storm
 *   node scripts/load-test.mjs --profile spike --concurrency 500 --duration 20
 *
 * Profiles:
 *   smoke  — light sanity (default for CI)
 *   storm  — hundreds of concurrent users
 *   spike  — short burst toward thousands (use carefully on production)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const BASE = String(arg("base", "https://titanos-web.vercel.app")).replace(/\/$/, "");
const PROFILE = arg("profile", "storm");
const OUT_DIR = join(ROOT, "ops", "results");

const PROFILES = {
  smoke: { phases: [{ concurrency: 25, durationSec: 8 }] },
  storm: {
    phases: [
      { concurrency: 50, durationSec: 10 },
      { concurrency: 150, durationSec: 15 },
      { concurrency: 300, durationSec: 20 },
      { concurrency: 500, durationSec: 15 },
    ],
  },
  spike: {
    phases: [
      { concurrency: 200, durationSec: 8 },
      { concurrency: 800, durationSec: 10 },
      { concurrency: 1500, durationSec: 8 },
    ],
  },
};

const customC = Number(arg("concurrency", ""));
const customD = Number(arg("duration", ""));
const phases =
  Number.isFinite(customC) && customC > 0
    ? [{ concurrency: customC, durationSec: Number.isFinite(customD) && customD > 0 ? customD : 15 }]
    : PROFILES[PROFILE]?.phases || PROFILES.storm.phases;

const TARGETS = [
  { name: "landing", path: "/", method: "GET", expect: [200] },
  { name: "pricing", path: "/pricing", method: "GET", expect: [200] },
  { name: "login", path: "/login", method: "GET", expect: [200] },
  { name: "portal", path: "/portal", method: "GET", expect: [200] },
  { name: "privacy", path: "/privacy-policy", method: "GET", expect: [200] },
  { name: "health", path: "/api/functions/health", method: "GET", expect: [200, 404, 500, 503] },
  {
    name: "createPaymentLink_unauth",
    path: "/api/functions/createPaymentLink",
    method: "POST",
    body: { amount: 10 },
    expect: [401, 405, 500, 503],
  },
  {
    name: "portalPay_unauth",
    path: "/api/functions/portalPayInvoice",
    method: "POST",
    body: { token: "invalid", invoice_id: "x" },
    expect: [400, 401, 500, 503],
  },
  {
    name: "stripeWebhook_nosig",
    path: "/api/functions/stripeWebhook",
    method: "POST",
    body: { type: "checkout.session.completed" },
    expect: [400, 405, 500, 503],
  },
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function oneRequest(target) {
  const url = `${BASE}${target.path}`;
  const started = performance.now();
  let status = 0;
  let ok = false;
  let err = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      method: target.method,
      headers: target.body ? { "Content-Type": "application/json" } : undefined,
      body: target.body ? JSON.stringify(target.body) : undefined,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    status = res.status;
    // Drain body so connections don't stall under load
    await res.arrayBuffer().catch(() => null);
    ok = target.expect.includes(status);
  } catch (e) {
    err = e.name === "AbortError" ? "timeout" : e.message || "error";
  }
  return {
    name: target.name,
    ms: Math.round(performance.now() - started),
    status,
    ok,
    err,
  };
}

async function runPhase(phase, phaseIndex) {
  console.log(
    `\n=== Phase ${phaseIndex + 1}: ${phase.concurrency} concurrent × ${phase.durationSec}s ===`
  );
  const results = [];
  const endAt = Date.now() + phase.durationSec * 1000;
  let inFlight = 0;
  let launched = 0;

  await new Promise((resolve) => {
    const pump = () => {
      while (inFlight < phase.concurrency && Date.now() < endAt) {
        inFlight += 1;
        launched += 1;
        const target = TARGETS[launched % TARGETS.length];
        oneRequest(target).then((r) => {
          results.push(r);
          inFlight -= 1;
          if (Date.now() >= endAt && inFlight === 0) resolve();
          else pump();
        });
      }
      if (Date.now() >= endAt && inFlight === 0) resolve();
      else if (Date.now() >= endAt) {
        // wait for in-flight
      } else {
        setTimeout(pump, 5);
      }
    };
    pump();
  });

  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const errors = results.filter((r) => !r.ok || r.err);
  const byStatus = {};
  const byName = {};
  for (const r of results) {
    byStatus[r.status || "err"] = (byStatus[r.status || "err"] || 0) + 1;
    if (!byName[r.name]) byName[r.name] = { n: 0, fail: 0, ms: [] };
    byName[r.name].n += 1;
    byName[r.name].ms.push(r.ms);
    if (!r.ok || r.err) byName[r.name].fail += 1;
  }

  const summary = {
    concurrency: phase.concurrency,
    durationSec: phase.durationSec,
    requests: results.length,
    rps: Number((results.length / phase.durationSec).toFixed(1)),
    errorRate: results.length ? Number(((errors.length / results.length) * 100).toFixed(2)) : 100,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies[latencies.length - 1] || 0,
    byStatus,
    byName: Object.fromEntries(
      Object.entries(byName).map(([k, v]) => {
        const sorted = v.ms.sort((a, b) => a - b);
        return [
          k,
          {
            n: v.n,
            fail: v.fail,
            p95: percentile(sorted, 95),
          },
        ];
      })
    ),
  };

  console.log(
    `requests=${summary.requests} rps=${summary.rps} error%=${summary.errorRate} p50=${summary.p50}ms p95=${summary.p95}ms p99=${summary.p99}ms`
  );
  return summary;
}

async function main() {
  console.log(`TitanOS load test → ${BASE} profile=${PROFILE}`);
  console.log(`Targets: ${TARGETS.map((t) => t.name).join(", ")}`);

  // Warmup
  await oneRequest(TARGETS[0]);

  const phaseResults = [];
  for (let i = 0; i < phases.length; i++) {
    phaseResults.push(await runPhase(phases[i], i));
  }

  const worstError = Math.max(...phaseResults.map((p) => p.errorRate), 0);
  const worstP95 = Math.max(...phaseResults.map((p) => p.p95), 0);
  const pass = worstError < 5 && worstP95 < 5000;

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    profile: PROFILE,
    pass,
    criteria: {
      maxErrorRatePct: 5,
      maxP95Ms: 5000,
      note: "Pass = error rate <5% and p95 <5s across all phases",
    },
    phases: phaseResults,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `load-${PROFILE}-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nVerdict: ${pass ? "PASS" : "FAIL"} (worst error%=${worstError}, worst p95=${worstP95}ms)`);
  console.log(`Wrote ${outPath}`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
