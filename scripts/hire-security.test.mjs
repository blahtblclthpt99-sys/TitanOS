/**
 * Hiring security unit tests — client filter + defense-in-depth assumptions.
 * Run: node --test scripts/hire-security.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

function visibleHireMessages(rows, userId, hireJobId) {
  return (rows || []).filter(
    (m) =>
      m.hire_job_id === hireJobId &&
      (m.sender_id === userId || m.recipient_id === userId)
  );
}

function canReadApplication(app, user, job) {
  if (!app || !user) return false;
  if (user.role === "admin") return true;
  if (app.worker_id === user.id || app.created_by_id === user.id) return true;
  if (job && (job.customer_id === user.id || job.created_by_id === user.id)) return true;
  return false;
}

describe("hire message visibility", () => {
  const rows = [
    { id: "1", hire_job_id: "jobA", sender_id: "u1", recipient_id: "u2", body: "hi" },
    { id: "2", hire_job_id: "jobA", sender_id: "u3", recipient_id: "u4", body: "leak" },
    { id: "3", hire_job_id: "jobB", sender_id: "u1", recipient_id: "u2", body: "other" },
  ];

  it("user only sees their own messages on a job", () => {
    const visible = visibleHireMessages(rows, "u1", "jobA");
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, "1");
  });

  it("stranger sees nothing", () => {
    assert.equal(visibleHireMessages(rows, "stranger", "jobA").length, 0);
  });
});

describe("hire application ACL (mirrors migration 016 intent)", () => {
  const job = { id: "j1", customer_id: "owner", created_by_id: "owner" };
  const app = { id: "a1", worker_id: "worker", created_by_id: "worker", hire_job_id: "j1" };

  it("applicant can read", () => {
    assert.equal(canReadApplication(app, { id: "worker" }, job), true);
  });
  it("owner can read", () => {
    assert.equal(canReadApplication(app, { id: "owner" }, job), true);
  });
  it("admin can read", () => {
    assert.equal(canReadApplication(app, { id: "x", role: "admin" }, job), true);
  });
  it("stranger cannot read", () => {
    assert.equal(canReadApplication(app, { id: "stranger" }, job), false);
  });
});
