import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkerMatchProfile,
  mergeRankedJobMatches,
  normalizeExternalJob,
  rankInternalJobMatches,
  scoreJobMatch,
} from "../src/lib/jobMatch.js";

const worker = {
  user_id: "worker-1",
  skills: ["delivery", "box truck", "forklift"],
  certifications: ["dot medical card", "forklift"],
  years_experience: 4,
  city: "Oklahoma City",
  state: "OK",
  desired_pay_min: 20,
  preferred_schedule: ["weekday", "day"],
  external_job_search_consent: false,
};

const strongJob = {
  id: "j1",
  title: "Box truck delivery driver",
  category: "Delivery",
  city: "Oklahoma City",
  state: "OK",
  budget_min: 22,
  budget_max: 26,
  required_skills: ["delivery", "box truck"],
  required_certifications: ["dot medical card"],
  minimum_years_experience: 2,
  schedule_tags: ["weekday", "day"],
  status: "open",
};

describe("worker match profile", () => {
  it("normalizes and bounds matching preferences", () => {
    const profile = buildWorkerMatchProfile({ ...worker, work_radius_miles: 9999, skills: [" Delivery ", "delivery"] });
    assert.deepEqual(profile.skills, ["delivery"]);
    assert.equal(profile.work_radius_miles, 500);
    assert.equal(profile.desired_pay_min, 20);
  });
});

describe("native Titan job scoring", () => {
  it("scores strong skill, credential, experience, location and pay matches highly", () => {
    const result = scoreJobMatch(worker, strongJob);
    assert.ok(result.score >= 90, `expected >=90, received ${result.score}`);
    assert.ok(result.reasons.some((reason) => reason.startsWith("Skills:")));
    assert.equal(result.source, "titan");
  });

  it("surfaces required credential blockers instead of hiding them", () => {
    const result = scoreJobMatch({ ...worker, certifications: [] }, strongJob);
    assert.ok(result.blockers.some((item) => item.includes("dot medical card")));
    assert.deepEqual(result.missing_certifications, ["dot medical card"]);
    assert.equal(result.requirements_advisory, true);
  });

  it("does not silently disqualify a seeker from an open job for a missing credential", () => {
    const rows = rankInternalJobMatches([strongJob], { ...worker, certifications: [] });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "j1");
    assert.equal(rows[0].match.requirements_advisory, true);
    assert.ok(rows[0].match.blockers.length > 0);
  });

  it("ranks native open jobs and excludes closed jobs", () => {
    const rows = rankInternalJobMatches([
      { ...strongJob, id: "best" },
      { ...strongJob, id: "closed", status: "hired" },
      { id: "weak", title: "Painter", category: "Painting", city: "Tulsa", state: "OK", status: "open" },
    ], worker);
    assert.equal(rows[0].id, "best");
    assert.equal(rows.some((row) => row.id === "closed"), false);
  });
});

describe("external fallback safety", () => {
  const external = normalizeExternalJob({
    id: "ext-1",
    title: "Box truck route driver",
    city: "Oklahoma City",
    state: "OK",
    url: "https://jobs.example.test/route-driver",
    required_skills: ["box truck", "delivery"],
    posted_at: "2026-08-16T12:00:00Z",
  }, { name: "Example Jobs" });

  it("requires HTTPS provenance for external jobs", () => {
    assert.throws(() => normalizeExternalJob({ id: "x", title: "Bad", url: "http://jobs.example.test/x" }, { name: "Example" }), /HTTPS/);
  });

  it("does not include external jobs without explicit user consent", () => {
    const rows = mergeRankedJobMatches({ internal: [strongJob], external: [external], driverProfile: worker, now: Date.parse("2026-08-17T00:00:00Z") });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].source || rows[0].match.source, "titan");
  });

  it("uses external fallback after native results when consent is granted", () => {
    const rows = mergeRankedJobMatches({
      internal: [strongJob],
      external: [external],
      driverProfile: { ...worker, external_job_search_consent: true },
      now: Date.parse("2026-08-17T00:00:00Z"),
    });
    assert.equal(rows[0].id, "j1");
    assert.equal(rows[1].source, "external");
    assert.equal(rows[1].source_name, "Example Jobs");
    assert.match(rows[1].source_url, /^https:\/\//);
  });

  it("filters stale external listings", () => {
    const stale = { ...external, id: "external:example:stale", posted_at: "2026-01-01T00:00:00Z" };
    const rows = mergeRankedJobMatches({
      internal: [],
      external: [stale],
      driverProfile: { ...worker, external_job_search_consent: true },
      now: Date.parse("2026-08-17T00:00:00Z"),
    });
    assert.equal(rows.length, 0);
  });
});
