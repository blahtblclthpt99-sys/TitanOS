import test from "node:test";
import assert from "node:assert/strict";
import { normalizeJobMatches } from "../src/lib/jobMatchApi.js";

const recent = new Date(Date.now() - 2 * 86400000).toISOString();
const old = new Date(Date.now() - 90 * 86400000).toISOString();
const expired = new Date(Date.now() - 86400000).toISOString();

test("career matcher removes stale and expired listings", () => {
  const rows = normalizeJobMatches([
    { id: "fresh", title: "Courier", company_name: "Acme", city: "OKC", state: "OK", posted_at: recent },
    { id: "stale", title: "Warehouse", company_name: "Old Co", city: "OKC", state: "OK", posted_at: old },
    { id: "expired", title: "Driver", company_name: "Past Co", city: "OKC", state: "OK", posted_at: recent, expires_at: expired },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "fresh");
  assert.equal(rows[0].freshness_verified, true);
});

test("career matcher collapses semantic duplicates", () => {
  const rows = normalizeJobMatches([
    { id: "a", title: "Delivery Driver", company_name: "Acme Logistics", city: "Oklahoma City", state: "OK", posted_at: recent },
    { id: "b", title: " delivery   driver ", company_name: "ACME LOGISTICS", city: "Oklahoma City", state: "ok", posted_at: recent },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "a");
});

test("provider job ids dedupe before fuzzy title identity", () => {
  const rows = normalizeJobMatches([
    { id: "x", source: "external", source_name: "Provider", source_job_id: "123", title: "Courier I", posted_at: recent },
    { id: "y", source: "external", source_name: "Provider", source_job_id: "123", title: "Courier II", posted_at: recent },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "x");
});
