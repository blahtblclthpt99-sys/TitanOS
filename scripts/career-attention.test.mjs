import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { attentionCounts, buildCareerAttention } from "../src/lib/careerAttention.js";

const NOW = Date.parse("2026-08-27T04:00:00Z");
const profile = {
  headline: "Delivery professional",
  bio: "Experienced delivery professional focused on reliable service and safe operations.",
  skills: ["delivery", "box truck", "customer service"],
  work_history: [{ role: "Courier", company: "Example Logistics" }],
  city: "Oklahoma City",
  state: "OK",
};

describe("career attention engine", () => {
  it("prioritizes interviews within 24 hours", () => {
    const items = buildCareerAttention({
      profile,
      interactions: [{ id: "a1", source_job_id: "j1", source_name: "Acme", state: "interview", interview_at: "2026-08-27T16:00:00Z", updated_at: "2026-08-26T00:00:00Z" }],
    }, NOW);
    assert.equal(items[0].kind, "interview");
    assert.equal(items[0].priority, "urgent");
  });

  it("surfaces overdue follow-ups without sending anything", () => {
    const items = buildCareerAttention({
      profile,
      interactions: [{ id: "a2", source_job_id: "j2", source_name: "Beta", state: "applied", follow_up_at: "2026-08-26T16:00:00Z", updated_at: "2026-08-20T00:00:00Z" }],
    }, NOW);
    const followUp = items.find((item) => item.kind === "follow_up");
    assert.equal(followUp.priority, "urgent");
    assert.match(followUp.body, /Review it before contacting anyone/);
  });

  it("creates unseen saved-search match items and respects reviewed keys", () => {
    const job = { id: "j3", title: "Courier", city: "Oklahoma City", state: "OK", match: { score: 90 } };
    const alert = { id: "alert1", query: "courier", location: "Oklahoma", minMatch: 80, source: "all" };
    const first = buildCareerAttention({ profile, jobs: [job], alerts: [alert] }, NOW);
    assert.equal(first.some((item) => item.kind === "new_match"), true);
    const key = first.find((item) => item.kind === "new_match").alert_key;
    const reviewed = buildCareerAttention({ profile, jobs: [job], alerts: [alert], seenAlertKeys: [key] }, NOW);
    assert.equal(reviewed.some((item) => item.kind === "new_match"), false);
  });

  it("warns when a listing deadline is within 72 hours", () => {
    const items = buildCareerAttention({
      profile,
      jobs: [{ id: "j4", title: "Warehouse Associate", expires_at: "2026-08-29T04:00:00Z" }],
    }, NOW);
    assert.equal(items.some((item) => item.kind === "expiring_listing"), true);
  });

  it("uses profile completeness as a private readiness reminder", () => {
    const items = buildCareerAttention({ profile: { headline: "Worker" } }, NOW);
    const reminder = items.find((item) => item.kind === "profile");
    assert.ok(reminder);
    assert.match(reminder.body, /Profile completeness/);
  });

  it("summarizes attention counts", () => {
    const counts = attentionCounts([
      { kind: "interview", priority: "urgent" },
      { kind: "follow_up", priority: "high" },
      { kind: "new_match", priority: "normal" },
    ]);
    assert.deepEqual(counts, { total: 3, urgent: 1, interviews: 1, followUps: 1, newMatches: 1 });
  });
});
