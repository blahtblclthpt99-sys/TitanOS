import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const textExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".html"]);
const scanRoots = ["api", "cloudflare", "src"];
const rootFiles = ["index.html", "vite.config.js", "wrangler.jsonc", "package.json"];
const forbiddenMarkers = [
  "attention_payment_events",
  "attention_campaigns",
  "activate_attention_campaign_funding_service",
  "/api/attention",
  "Titan Attention",
  "attention_campaign_funding",
];

function extension(path) {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function collectTextFiles(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return textExtensions.has(extension(path)) ? [path] : [];
  const files = [];
  for (const entry of readdirSync(path)) {
    const child = join(path, entry);
    if (statSync(child).isDirectory()) files.push(...collectTextFiles(child));
    else if (textExtensions.has(extension(child))) files.push(child);
  }
  return files;
}

test("active TitanOS runtime contains no Titan Attention commerce residue", () => {
  assert.equal(existsSync(join(ROOT, "api", "attention")), false, "api/attention must remain retired");
  assert.equal(existsSync(join(ROOT, "vercel.json")), false, "Vercel runtime config must remain retired on the Cloudflare migration branch");

  const files = [
    ...scanRoots.flatMap((path) => collectTextFiles(join(ROOT, path))),
    ...rootFiles.map((path) => join(ROOT, path)).filter(existsSync),
  ];

  const violations = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const marker of forbiddenMarkers) {
      if (content.includes(marker)) violations.push(`${relative(ROOT, file)} contains ${marker}`);
    }
  }

  assert.deepEqual(violations, [], `Attention commerce residue found:\n${violations.join("\n")}`);
});

test("Stripe webhook retains canonical TitanOS financial safety invariants", () => {
  const webhookPath = join(ROOT, "api", "functions", "stripeWebhook.js");
  assert.equal(existsSync(webhookPath), true, "canonical TitanOS Stripe webhook must exist");
  const webhook = readFileSync(webhookPath, "utf8");

  for (const required of [
    "bodyParser: false",
    "stripe.webhooks.constructEvent",
    "stripe_webhook_events",
    ".from(\"payments\")",
    ".from(\"invoices\")",
    "syncStripeSubscription",
    "underpayment",
    "invoice_owner_mismatch",
    "payment_invoice_mismatch",
    "idempotencyClaimed",
  ]) {
    assert.ok(webhook.includes(required), `Stripe webhook safety invariant missing: ${required}`);
  }

  assert.ok(
    webhook.includes('.from("stripe_webhook_events").delete().eq("event_id", event.id)'),
    "failed webhook processing must release its idempotency claim so Stripe can retry",
  );
});
