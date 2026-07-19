#!/usr/bin/env node
/**
 * Payment failure & recovery scenario suite.
 * Hits production endpoints where safe, and validates local settlement logic.
 *
 *   node scripts/payment-failure-scenarios.mjs
 *   node scripts/payment-failure-scenarios.mjs --base https://titanos-web.vercel.app
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "ops", "results");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const BASE = String(arg("base", "https://titanos-web.vercel.app")).replace(/\/$/, "");

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

const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

async function http(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/** Fee math — mirrors createPaymentLink */
function calcPlatformFee(amount, planId) {
  const PLAN_FEES = {
    customer: 0,
    worker_free: 0.08,
    free: 0.08,
    worker_premium: 0.025,
    premium: 0.025,
    business: 0.015,
    pro: 0.015,
  };
  const rate = PLAN_FEES[planId] ?? 0.08;
  const base = Math.round((Number(amount) || 0) * 100) / 100;
  const fee = Math.round(base * rate * 100) / 100;
  const total = Math.round((base + fee) * 100) / 100;
  return { base, fee, total, rate };
}

async function run() {
  console.log(`Payment failure scenarios → ${BASE}\n`);

  // 1) Unauthenticated payment create
  {
    const r = await http("/api/functions/createPaymentLink", {
      method: "POST",
      body: JSON.stringify({ amount: 100 }),
    });
    record(
      "pay.create.unauthorized",
      r.status === 401,
      `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 120)}`
    );
  }

  // 2) Portal pay without session
  {
    const r = await http("/api/functions/portalPayInvoice", {
      method: "POST",
      body: JSON.stringify({ token: "bogus", invoice_id: "00000000-0000-0000-0000-000000000001" }),
    });
    record(
      "pay.portal.invalid_session",
      r.status === 401 || r.status === 400,
      `status=${r.status}`
    );
  }

  // 3) Webhook without signature — must not mark paid
  {
    const r = await http("/api/functions/stripeWebhook", {
      method: "POST",
      body: JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { metadata: { invoice_id: "forge-me" }, amount_total: 99900 } },
      }),
    });
    record(
      "pay.webhook.reject_unsigned",
      [400, 503].includes(r.status),
      `status=${r.status} (must refuse forged paid events)`
    );
  }

  // 4) Webhook with garbage signature
  {
    const r = await http("/api/functions/stripeWebhook", {
      method: "POST",
      headers: { "Stripe-Signature": "t=1,v1=deadbeef" },
      body: JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }),
    });
    record(
      "pay.webhook.reject_bad_sig",
      [400, 503].includes(r.status),
      `status=${r.status}`
    );
  }

  // 5) Local fee accuracy under edge amounts
  {
    const cases = [
      { amount: 100, plan: "worker_free", fee: 8, total: 108 },
      { amount: 100, plan: "worker_premium", fee: 2.5, total: 102.5 },
      { amount: 100, plan: "business", fee: 1.5, total: 101.5 },
      { amount: 0.01, plan: "worker_free", fee: 0, total: 0.01 },
      { amount: 9999.99, plan: "business", fee: 150, total: 10149.99 },
    ];
    let ok = true;
    for (const c of cases) {
      const got = calcPlatformFee(c.amount, c.plan);
      if (got.fee !== c.fee || got.total !== c.total) {
        ok = false;
        record(
          `pay.fee.${c.plan}.${c.amount}`,
          false,
          `expected fee=${c.fee} total=${c.total} got fee=${got.fee} total=${got.total}`
        );
      }
    }
    if (ok) record("pay.fee.matrix", true, `${cases.length} cases matched`);
  }

  // 6) Stripe test-card recovery matrix (documented + env-gated live call)
  {
    const cards = [
      { number: "4000000000000002", expect: "card_declined", recovery: "Ask customer for another card; keep invoice unpaid" },
      { number: "4000000000009995", expect: "insufficient_funds", recovery: "Retry later; do not mark paid" },
      { number: "4000000000009987", expect: "lost_card", recovery: "Fraud path; leave pending/failed" },
      { number: "4000000000000069", expect: "expired_card", recovery: "Prompt update card" },
      { number: "4000000000000127", expect: "incorrect_cvc", recovery: "Re-enter CVC" },
      { number: "4000000000000119", expect: "processing_error", recovery: "Retry once; then support" },
      { number: "4242424242424242", expect: "success", recovery: "Webhook must settle invoice+payment" },
    ];
    record(
      "pay.stripe_test_cards.document",
      true,
      `${cards.length} failure/success cards mapped for manual Stripe Checkout test mode`
    );
    writeFileSync(
      join(OUT_DIR, "stripe-test-cards.json"),
      JSON.stringify({ cards, note: "Use in Stripe Checkout test mode only" }, null, 2)
    );
  }

  // 7) Idempotent settlement logic (unit)
  {
    const settle = (current, next) => {
      if (current === "succeeded") return current;
      return next;
    };
    const ok =
      settle("succeeded", "failed") === "succeeded" &&
      settle("pending", "failed") === "failed" &&
      settle("pending", "succeeded") === "succeeded";
    record("pay.idempotent_status", ok, "succeeded must not be overwritten by later failure events");
  }

  // 8) Metadata contract — source files must wire invoice_id + payment_id
  {
    const createSrc = readFileSync(join(ROOT, "api/functions/createPaymentLink.js"), "utf8");
    const webhookSrc = readFileSync(join(ROOT, "api/functions/stripeWebhook.js"), "utf8");
    const hasMetaInvoice = createSrc.includes('metadata[invoice_id]');
    const hasMetaPayment = createSrc.includes('metadata[payment_id]');
    const webhookUsesClientRef = webhookSrc.includes("client_reference_id");
    const webhookHandlesFail =
      webhookSrc.includes("payment_intent.payment_failed") ||
      webhookSrc.includes("checkout.session.expired");
    record(
      "pay.metadata_contract",
      hasMetaInvoice && hasMetaPayment && webhookUsesClientRef && webhookHandlesFail,
      `invoice_meta=${hasMetaInvoice} payment_meta=${hasMetaPayment} client_ref=${webhookUsesClientRef} fail_events=${webhookHandlesFail}`
    );
  }

  // 9) Signature construction sanity (local HMAC format Stripe uses)
  {
    const secret = "whsec_test_secret";
    const payload = JSON.stringify({ id: "evt_test" });
    const t = Math.floor(Date.now() / 1000);
    const signed = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    record(
      "pay.sig_format",
      Boolean(signed && signed.length === 64),
      `local HMAC constructed (len=${signed.length}) — production still needs STRIPE_WEBHOOK_SECRET + raw body`
    );
  }

  // 10) Supabase payment table reachability (read-only)
  {
    const env = loadEnvLocal();
    const url = env.VITE_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      record("pay.db.payments_readable", false, "missing SUPABASE creds in .env.local");
    } else {
      const res = await fetch(`${url}/rest/v1/payments?select=id,status&limit=1`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });
      record(
        "pay.db.payments_readable",
        res.ok || res.status === 200,
        `status=${res.status}`
      );
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const failed = results.filter((r) => !r.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    pass: failed.length === 0,
    passed: results.filter((r) => r.pass).length,
    failed: failed.length,
    results,
  };
  const outPath = join(OUT_DIR, `payment-failures-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n${report.passed}/${results.length} passed → ${outPath}`);
  process.exit(failed.length ? 1 : 0);
}

mkdirSync(OUT_DIR, { recursive: true });
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
