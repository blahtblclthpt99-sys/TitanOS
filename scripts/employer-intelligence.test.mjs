import test from "node:test";
import assert from "node:assert/strict";
import { assessOpportunityRisk, buildEmployerSummary, evaluateAlerts, matchesAlert } from "../src/lib/employerIntelligence.js";

test("flags applicant payment requests as high risk", () => {
  const result = assessOpportunityRisk({ title: "Remote assistant", description: "Send a deposit by gift card before training." });
  assert.equal(result.level, "high");
  assert.ok(result.signals.some((signal) => /payment|transfer/i.test(signal)));
});

test("does not call a low-signal listing verified or safe", () => {
  const result = assessOpportunityRisk({ title: "Warehouse associate", company: "Example Co", description: "Apply for warehouse work." });
  assert.equal(result.level, "low");
  assert.match(result.guidance, /Verify the employer/i);
});

test("groups listings by normalized employer and location", () => {
  const rows = buildEmployerSummary([
    { id: "1", company: "Acme", city: "Tulsa", state: "OK", description: "Role one" },
    { id: "2", company_name: "acme", city: "TULSA", state: "ok", description: "Role two" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].openListings, 2);
});

test("job alerts use explicit user filters", () => {
  const job = { title: "Delivery Driver", company: "Acme", city: "Oklahoma City", state: "OK", source: "external", match: { score: 88 } };
  assert.equal(matchesAlert(job, { query: "delivery", location: "oklahoma", minMatch: 80, source: "external" }), true);
  assert.equal(matchesAlert(job, { query: "nurse", location: "", minMatch: 0, source: "all" }), false);
});

test("evaluated alerts return matching listings without altering source data", () => {
  const jobs = [{ id: "x", title: "Courier", company: "A", city: "Norman", state: "OK", match: { score: 91 } }];
  const evaluated = evaluateAlerts(jobs, [{ id: "a", query: "courier", location: "norman", minMatch: 90, source: "all" }]);
  assert.deepEqual(evaluated[0].matches.map((job) => job.id), ["x"]);
  assert.equal(jobs[0].id, "x");
});
