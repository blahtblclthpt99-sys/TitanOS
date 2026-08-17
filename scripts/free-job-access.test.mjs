import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function exportedFunction(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

const paidGuardPattern = /canAccessFeature|isPaidPlan|paying_subscriber|subscription_required|requirePaid|upgradeRequired/i;

describe("free job-seeker access contract", () => {
  const matchesPage = read("src/pages/JobMatches.jsx");
  const matchesApi = read("api/functions/jobMatchesV2.js");
  const hirePage = read("src/pages/Hire.jsx");
  const hireApi = read("src/lib/hireApi.js");
  const driverProfiles = read("src/lib/driverProfilesApi.js");
  const plan = read("src/lib/plan.js");

  it("keeps the worker Free plan at $0 and does not classify job matching as a paid feature", () => {
    assert.match(plan, /worker_free:\s*Object\.freeze\([\s\S]*?priceMonthly:\s*0/);
    assert.match(plan, /worker_free:\s*Object\.freeze\([\s\S]*?maxActiveHirePosts:\s*2/);
    assert.doesNotMatch(plan, /PRO_FEATURES\.[A-Za-z0-9_]*(?:jobMatch|jobSearch|hireBrowse|hireApply)/i);
  });

  it("does not put the Job Matches UI or server endpoint behind a paid-plan guard", () => {
    assert.doesNotMatch(matchesPage, paidGuardPattern);
    assert.doesNotMatch(matchesApi, paidGuardPattern);
    assert.match(matchesApi, /if \(!token\) return res\.status\(401\)/);
  });

  it("keeps browsing Hire work free of subscription gating", () => {
    assert.doesNotMatch(hirePage, paidGuardPattern);
    assert.match(hirePage, /Apply/);
  });

  it("keeps applying and saving jobs free while allowing employer posting limits", () => {
    const apply = exportedFunction(hireApi, "applyToHireJob");
    const save = exportedFunction(hireApi, "toggleSaveJob");
    const create = exportedFunction(hireApi, "createHireJob");

    assert.doesNotMatch(apply, /assertWithinFreeLimit|canAccessFeature|isPaidPlan/);
    assert.doesNotMatch(save, /assertWithinFreeLimit|canAccessFeature|isPaidPlan/);
    assert.match(create, /assertWithinFreeLimit\(user,\s*"hirePosts"/);
  });

  it("keeps skills and certifications editable without a subscription guard", () => {
    assert.doesNotMatch(driverProfiles, paidGuardPattern);
    assert.match(driverProfiles, /skills:/);
    assert.match(driverProfiles, /certifications:/);
  });
});
