import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

function assertNotContains(text, patterns, label) {
  for (const pattern of patterns) {
    assert.equal(pattern.test(text), false, `${label} must not match ${pattern}`);
  }
}

test("employment recruiting is separated from Driver/Fleet data", async () => {
  const [profileApi, seekerPage, employerApi, jobEndpoint, talentProfile] = await Promise.all([
    source("src/lib/employmentProfilesApi.js"),
    source("src/pages/JobSeekerProfile.jsx"),
    source("src/lib/employerWorkerMatchApi.js"),
    source("api/functions/jobMatchesV2.js"),
    source("src/pages/TalentProfile.jsx"),
  ]);

  assert.match(profileApi, /employment_profiles/);
  assertNotContains(profileApi, [/vehicle/i, /\brating\b/i, /review_count/i, /\blat\b/i, /\blng\b/i, /desired_pay/i], "employmentProfilesApi");
  assertNotContains(seekerPage, [/driverProfilesApi/, /getMyDriverProfile/, /saveMyDriverProfile/], "JobSeekerProfile");
  assert.match(seekerPage, /employmentProfilesApi/);
  assertNotContains(employerApi, [/driverProfilesApi/, /listPublishedDrivers/, /engagementApi/], "employerWorkerMatchApi");
  assert.match(employerApi, /listPublishedEmploymentProfiles/);
  assertNotContains(jobEndpoint, [/from\("driver_profiles"\)/], "jobMatchesV2");
  assert.match(jobEndpoint, /from\("employment_profiles"\)/);
  assert.match(jobEndpoint, /eq\("relationship_type", "employment"\)/);
  assertNotContains(talentProfile, [/driverProfilesApi/, /\brating\b/i, /completedJobs/], "TalentProfile");
});

test("qualification matchers cannot use ratings engagement or identity labels", async () => {
  const [workerMatch, serviceMatch, jobMatch] = await Promise.all([
    source("src/lib/workerMatch.js"),
    source("src/lib/serviceMatch.js"),
    source("src/lib/jobMatch.js"),
  ]);

  assertNotContains(workerMatch, [/\brating\b/i, /review_count/i, /engagement/i, /responsiv/i, /attendance/i], "workerMatch");
  assertNotContains(serviceMatch, [/\brating\b/i, /engagement/i, /responsiv/i, /attendance/i, /a\.name\.localeCompare/], "serviceMatch");
  assertNotContains(jobMatch, [/engagement/i, /responsiv/i, /attendance/i], "jobMatch");
  assert.match(workerMatch, /String\(a\.userId \|\| a\.id/);
  assert.match(serviceMatch, /String\(a\.id \|\| ""\)\.localeCompare/);
});

test("Engagement remains informational and rejects filter-shaped API inputs", async () => {
  const [engagement, snapshot, batch, aiContext, workerMatches] = await Promise.all([
    source("src/lib/engagement.js"),
    source("api/functions/engagementSnapshot.js"),
    source("api/functions/engagementBatch.js"),
    source("api/_lib/aiContext.js"),
    source("src/pages/WorkerMatches.jsx"),
  ]);

  assert.match(engagement, /New to Titan/);
  assert.match(engagement, /candidate_cancelled/);
  assert.match(engagement, /candidate_rescheduled/);
  assert.match(engagement, /technical_issue/);
  assert.match(engagement, /disputed/);
  assert.match(engagement, /may never determine qualification, eligibility, visibility, automatic rejection, candidate ordering, or access/i);

  for (const endpoint of [snapshot, batch]) {
    assert.match(endpoint, /engagement_min/);
    assert.match(endpoint, /responsiveness_min/);
    assert.match(endpoint, /cannot (?:be used as an eligibility or candidate filter|filter, rank, or exclude candidates)/i);
    assert.match(endpoint, /eligibility_input:\s*false/);
    assert.match(endpoint, /ranking_input:\s*false/);
  }

  assert.match(aiContext, /Never filter, hide, exclude, rank, sort, or recommend rejecting candidates because of Engagement/i);
  assert.match(aiContext, /Declining an opportunity, negotiating compensation, saying not interested, or responsibly cancelling\/rescheduling must never be treated as negative Engagement/i);

  const qualificationIndex = workerMatches.indexOf("loadEmployerWorkerMatches");
  const engagementIndex = workerMatches.indexOf("getEngagementBatch", qualificationIndex);
  assert.ok(qualificationIndex >= 0 && engagementIndex > qualificationIndex, "WorkerMatches must load qualification matches before Engagement");
  assertNotContains(workerMatches, [/sort\([^\n]*engagement/i, /filter\([^\n]*engagement/i], "WorkerMatches");
});

test("employment and independent opportunity feeds stay relationship-separated", async () => {
  const [employment, independent] = await Promise.all([
    source("api/functions/jobMatchesV2.js"),
    source("api/functions/workOpportunities.js"),
  ]);

  assert.match(employment, /eq\("relationship_type", "employment"\)/);
  assert.match(employment, /Employee Opportunity/);
  assert.match(independent, /contract/);
  assert.match(independent, /customer_request/);
  assert.doesNotMatch(independent, /eq\("relationship_type", "employment"\)/);
});

test("candidate-facing Talent surfaces do not expose public worker star ratings", async () => {
  const [matches, talent, serviceTalent] = await Promise.all([
    source("src/pages/WorkerMatches.jsx"),
    source("src/pages/TalentProfile.jsx"),
    source("src/pages/ServiceTalentProfile.jsx"),
  ]);
  assertNotContains(matches, [/star rating/i, /\.rating\b/, /reviewCount/], "WorkerMatches");
  assertNotContains(talent, [/star rating/i, /\.rating\b/, /reviewCount/], "TalentProfile");
  assertNotContains(serviceTalent, [/star rating/i, /\.rating\b/, /reviewCount/], "ServiceTalentProfile");
});
