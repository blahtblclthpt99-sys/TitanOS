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

  it("excludes native jobs after their application deadline and rejects malformed deadlines", () => {
    const now = Date.parse("2026-08-27T12:00:00Z");
    const rows = rankInternalJobMatches([
      { ...strongJob, id: "open-deadline", deadline: "2026-08-28T12:00:00Z" },
      { ...strongJob, id: "expired-deadline", deadline: "2026-08-26T12:00:00Z" },
      { ...strongJob, id: "bad-deadline", deadline: "not-a-date" },
    ], worker, { now });
    assert.deepEqual(rows.map((row) => row.id), ["open-deadline"]);
  });
});

describe("external fallback safety", () => {
  const external = normalizeExternalJob({
    id: "ext-1",
    title: "Box truck route driver",
    company_name: "Route Logistics",
    city: "Oklahoma City",
    state: "OK",
    url: "https://jobs.example.test/route-driver",
    required_skills: ["box truck", "delivery"],
    posted_at: "2026-08-16T12:00:00Z",
  }, { name: "Example Jobs" });

  it("requires a parseable HTTPS provenance URL for external jobs", () => {
    assert.throws(() => normalizeExternalJob({ id: "x", title: "Bad", url: "http://jobs.example.test/x" }, { name: "Example" }), /HTTPS/);
    assert.throws(() => normalizeExternalJob({ id: "x", title: "Bad", url: "https://" }, { name: "Example" }), /HTTPS/);
    assert.throws(() => normalizeExternalJob({ id: "x", title: "Bad", url: "javascript:alert(1)" }, { name: "Example" }), /HTTPS/);
  });

  it("requires a stable provider id and non-empty title", () => {
    assert.throws(() => normalizeExternalJob({ title: "Driver", url: "https://jobs.example.test/x" }, { name: "Example" }), /external_id/);
    assert.throws(() => normalizeExternalJob({ id: "x", title: "   ", url: "https://jobs.example.test/x" }, { name: "Example" }), /title/);
  });

  it("bounds untrusted provider payload fields and numeric compensation", () => {
    const row = normalizeExternalJob({
      id: "x".repeat(500),
      title: "T".repeat(500),
      company_name: "C".repeat(500),
      description: "D".repeat(15000),
      url: "https://jobs.example.test/x",
      budget_min: "not-a-number",
      budget_max: 99_999_999,
      minimum_years_experience: 999,
      required_skills: Array.from({ length: 150 }, (_, index) => `skill-${index}`),
    }, { name: "P".repeat(200) });
    assert.equal(row.external_id.length, 300);
    assert.equal(row.title.length, 300);
    assert.equal(row.company_name.length, 200);
    assert.equal(row.description.length, 12000);
    assert.equal(row.source_name.length, 120);
    assert.equal(row.budget_min, null);
    assert.equal(row.budget_max, 10_000_000);
    assert.equal(row.minimum_years_experience, 80);
    assert.equal(row.required_skills.length, 100);
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
    assert.equal(rows[1].company_name, "Route Logistics");
    assert.match(rows[1].source_url, /^https:\/\//);
  });

  it("preserves same-role vacancies from different employers", () => {
    const first = normalizeExternalJob({ ...external, id: "same-role-1", external_id: "same-role-1", company_name: "Company A", source_url: "https://jobs.example.test/opening?id=1" }, { name: "Example Jobs" });
    const second = normalizeExternalJob({ ...external, id: "same-role-2", external_id: "same-role-2", company_name: "Company B", source_url: "https://jobs.example.test/opening?id=2" }, { name: "Example Jobs" });
    const rows = mergeRankedJobMatches({
      internal: [],
      external: [first, second],
      driverProfile: { ...worker, external_job_search_consent: true },
      now: Date.parse("2026-08-17T00:00:00Z"),
    });
    assert.deepEqual(rows.map((row) => row.company_name), ["Company A", "Company B"]);
  });

  it("removes tracking-only URL duplicates without collapsing job-specific query ids", () => {
    const first = normalizeExternalJob({ ...external, id: "query-1", external_id: "query-1", company_name: "Company A", source_url: "https://jobs.example.test/opening?id=1&utm_source=titan" }, { name: "Example Jobs" });
    const trackingDuplicate = normalizeExternalJob({ ...external, id: "query-1-copy", external_id: "query-1-copy", company_name: "Company A", source_url: "https://jobs.example.test/opening?id=1&utm_source=other" }, { name: "Example Jobs" });
    const distinct = normalizeExternalJob({ ...external, id: "query-2", external_id: "query-2", company_name: "Company A", source_url: "https://jobs.example.test/opening?id=2" }, { name: "Example Jobs" });
    const rows = mergeRankedJobMatches({
      internal: [],
      external: [first, trackingDuplicate, distinct],
      driverProfile: { ...worker, external_job_search_consent: true },
      now: Date.parse("2026-08-17T00:00:00Z"),
    });
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.external_id), ["query-1", "query-2"]);
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

  it("filters malformed and implausibly future provider dates", () => {
    const malformed = { ...external, id: "external:example:bad-date", posted_at: "not-a-date" };
    const future = { ...external, id: "external:example:future", posted_at: "2026-08-20T00:00:00Z" };
    const malformedExpiry = { ...external, id: "external:example:bad-expiry", expires_at: "not-a-date" };
    const rows = mergeRankedJobMatches({
      internal: [],
      external: [malformed, future, malformedExpiry],
      driverProfile: { ...worker, external_job_search_consent: true },
      now: Date.parse("2026-08-17T00:00:00Z"),
    });
    assert.equal(rows.length, 0);
  });
});
