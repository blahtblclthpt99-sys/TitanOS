import test from "node:test";
import assert from "node:assert/strict";
import { normalizeJobMatches } from "../src/lib/jobMatchApi.js";

const now = Date.now();
const isoDaysAgo = (days) => new Date(now - days * 86400000).toISOString();

test("fresh listings are explicitly verified", () => {
  const [job] = normalizeJobMatches([{ id: "fresh", title: "Driver", posted_at: isoDaysAgo(2) }]);
  assert.equal(job.freshness_status, "fresh");
  assert.equal(job.freshness_verified, true);
  assert.ok(job.listing_age_days >= 1 && job.listing_age_days <= 3);
});

test("missing or malformed timestamps remain visible but are never called verified", () => {
  const rows = normalizeJobMatches([
    { id: "missing", title: "Warehouse" },
    { id: "bad", title: "Technician", posted_at: "not-a-date" },
  ]);
  assert.deepEqual(rows.map((job) => job.freshness_status), ["unknown", "unknown"]);
  assert.deepEqual(rows.map((job) => job.freshness_verified), [false, false]);
  assert.deepEqual(rows.map((job) => job.listing_age_days), [null, null]);
});

test("stale and expired listings are removed", () => {
  const rows = normalizeJobMatches([
    { id: "stale", title: "Old role", posted_at: isoDaysAgo(60) },
    { id: "expired", title: "Expired role", posted_at: isoDaysAgo(1), expires_at: isoDaysAgo(0.5) },
    { id: "keep", title: "Current role", posted_at: isoDaysAgo(1) },
  ]);
  assert.deepEqual(rows.map((job) => job.id), ["keep"]);
});

test("implausibly future posted dates are not treated as verified", () => {
  const future = new Date(now + 7 * 86400000).toISOString();
  const [job] = normalizeJobMatches([{ id: "future", title: "Future role", posted_at: future }]);
  assert.equal(job.freshness_status, "unknown");
  assert.equal(job.freshness_verified, false);
  assert.equal(job.listing_age_days, 0);
});

test("dedupes stable source identifiers without collapsing unrelated metadata-poor rows", () => {
  const rows = normalizeJobMatches([
    { id: "same", source: "external", source_name: "Provider", title: "Driver A", posted_at: isoDaysAgo(1) },
    { id: "same", source: "external", source_name: "Provider", title: "Driver B", posted_at: isoDaysAgo(1) },
    { title: "", company_name: "", posted_at: isoDaysAgo(1) },
    { title: "", company_name: "", posted_at: isoDaysAgo(1) },
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows.filter((job) => job.id === "same").length, 1);
});
