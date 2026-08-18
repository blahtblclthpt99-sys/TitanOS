import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKSPACES,
  activeWorkspace,
  accountHomePath,
  enabledWorkspaces,
} from "../src/lib/accountExperience.js";
import {
  classifyEngagementEvent,
  deriveEngagementSnapshot,
  ENGAGEMENT_POLICY,
} from "../src/lib/engagement.js";
import { rankPublishedServiceMatches } from "../src/lib/serviceMatch.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

function filesUnder(rel, predicate = () => true) {
  const base = join(root, rel);
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (predicate(full)) out.push(full);
    }
  };
  walk(base);
  return out;
}

function event(status, attribution = "candidate", daysAgo = 0, extra = {}) {
  const now = Date.UTC(2026, 7, 18, 12, 0, 0);
  return {
    subject_kind: "worker",
    status,
    attribution,
    occurred_at: new Date(now - daysAgo * 86_400_000).toISOString(),
    ...extra,
  };
}

const fixedNow = Date.UTC(2026, 7, 18, 12, 0, 0);

describe("Titan three-sided workspace isolation", () => {
  it("supports multiple enabled workspaces but one active workspace", () => {
    const user = {
      enabled_workspaces: [WORKSPACES.JOB_SEEKER, WORKSPACES.SELF_EMPLOYED, WORKSPACES.BUSINESS],
      active_workspace: WORKSPACES.SELF_EMPLOYED,
    };
    assert.deepEqual(enabledWorkspaces(user), ["job_seeker", "self_employed", "business"]);
    assert.equal(activeWorkspace(user), "self_employed");
    assert.equal(accountHomePath(user), "/independent");
  });

  it("falls back safely when active workspace is not enabled", () => {
    const user = {
      enabled_workspaces: [WORKSPACES.JOB_SEEKER, WORKSPACES.SELF_EMPLOYED],
      active_workspace: WORKSPACES.BUSINESS,
    };
    assert.equal(activeWorkspace(user), WORKSPACES.JOB_SEEKER);
    assert.equal(accountHomePath(user), "/hire/matches");
  });

  it("workspace identity is never a paid plan fallback", () => {
    const plan = read("src/lib/plan.js");
    assert.match(plan, /const raw = String\(user\.plan_tier \|\| ""\)/);
    assert.doesNotMatch(plan, /plan_tier\s*\|\|\s*user\.account_type/);
    assert.doesNotMatch(plan, /plan_tier\s*\|\|\s*user\.active_workspace/);
    assert.match(plan, /Never fall back to account_type \/ active_workspace \/ enabled_workspaces/);
  });

  it("server workspace setter pins blank legacy plans to worker_free", () => {
    const setter = read("api/functions/setWorkspaces.js");
    assert.match(setter, /updates\.plan_tier = "worker_free"/);
    assert.match(setter, /plan_changed: false/);
    assert.doesNotMatch(setter, /updates\.plan_tier = active/);
  });
});

describe("opportunity relationship separation", () => {
  it("Job Seeker backend reads employment only", () => {
    const src = read("api/functions/jobMatchesV2.js");
    assert.match(src, /\.eq\("relationship_type", "employment"\)/);
    assert.match(src, /active_workspace/);
    assert.match(src, /Employee Opportunity/);
  });

  it("Independent Work backend reads contract and customer_request only", () => {
    const src = read("api/functions/workOpportunities.js");
    assert.match(src, /\.in\("relationship_type", \["contract", "customer_request"\]\)/);
    assert.match(src, /Independent Work workspace/);
  });

  it("Business post UI makes employee vs independent relationship explicit", () => {
    const src = read("src/pages/MatchReadyJobPost.jsx");
    assert.match(src, /Hire an Employee/);
    assert.match(src, /Hire Independent Help/);
    assert.match(src, /relationship_type/);
    assert.match(src, /Engagement never enters this calculation/);
  });

  it("business-side matching never crosses profile pools and never imports Engagement", () => {
    const src = read("src/lib/employerWorkerMatchApi.js");
    assert.match(src, /relationship === "employment"/);
    assert.match(src, /listPublishedEmploymentProfiles/);
    assert.doesNotMatch(src, /listPublishedDrivers/);
    assert.match(src, /relationship === "contract" \|\| relationship === "customer_request"/);
    assert.match(src, /listPublishedServiceProfiles/);
    assert.doesNotMatch(src, /from ["'][^"']*engagement/i);
  });

  it("service matcher rejects employment opportunities", () => {
    const profile = {
      userId: "worker-a",
      published: true,
      availability: "available",
      services: ["delivery"],
      skills: ["box truck"],
      certifications: [],
      licenses: [],
      serviceCity: "Oklahoma City",
      serviceState: "OK",
    };
    const employment = {
      relationship_type: "employment",
      title: "Delivery Driver",
      required_skills: ["delivery"],
      status: "open",
    };
    assert.deepEqual(rankPublishedServiceMatches(employment, [profile]), []);
  });
});

describe("Engagement fairness and explainability", () => {
  it("new users never receive 0% from insufficient history", () => {
    const snapshot = deriveEngagementSnapshot([
      event("responded"),
      event("confirmed"),
    ], { now: fixedNow });
    assert.equal(snapshot.probability, null);
    assert.equal(snapshot.probabilityLabel, "New to Titan");
    assert.equal(snapshot.confidence.key, "new");
  });

  it("responsible decline and not-interested responses are positive communication", () => {
    assert.equal(classifyEngagementEvent(event("declined")), "positive");
    assert.equal(classifyEngagementEvent(event("not_interested")), "positive");
    assert.equal(classifyEngagementEvent(event("candidate_cancelled")), "positive");
    assert.equal(classifyEngagementEvent(event("candidate_rescheduled")), "positive");
  });

  it("technical, disputed, mutual/counterparty-caused negatives are neutral", () => {
    assert.equal(classifyEngagementEvent(event("technical_issue")), "neutral");
    assert.equal(classifyEngagementEvent(event("no_show", "candidate", 0, { disputed: true })), "neutral");
    assert.equal(classifyEngagementEvent(event("employer_cancelled", "business")), "neutral");
    assert.equal(classifyEngagementEvent(event("no_show", "unknown")), "neutral");
  });

  it("no-response/no-show only count negative with clear subject attribution", () => {
    assert.equal(classifyEngagementEvent(event("no_response", "candidate")), "negative");
    assert.equal(classifyEngagementEvent(event("no_show", "candidate")), "negative");
    assert.equal(classifyEngagementEvent(event("no_show", "system")), "neutral");
  });

  it("very old behavior expires and recent behavior dominates", () => {
    const expired = deriveEngagementSnapshot([
      event("no_show", "candidate", 400),
      event("no_show", "candidate", 500),
      event("no_show", "candidate", 600),
    ], { now: fixedNow });
    assert.equal(expired.sampleSize, 0);
    assert.equal(expired.probability, null);

    const current = deriveEngagementSnapshot([
      event("responded", "candidate", 1),
      event("responded", "candidate", 2),
      event("responded", "candidate", 3),
      event("no_show", "candidate", 300),
    ], { now: fixedNow });
    assert.ok(current.probability > 80);
  });

  it("mandatory policy explicitly forbids hiring eligibility and disqualification", () => {
    assert.match(ENGAGEMENT_POLICY.warning, /does not measure ability, qualifications, job performance, or hiring suitability/i);
    assert.match(ENGAGEMENT_POLICY.warning, /must not be used to disqualify/i);
    assert.match(ENGAGEMENT_POLICY.immutableRule, /never determine qualification, eligibility, visibility, automatic rejection, candidate ordering/i);
  });
});

describe("Engagement architecture separation", () => {
  it("qualification matchers do not import Engagement", () => {
    for (const file of [
      "src/lib/jobMatch.js",
      "src/lib/workerMatch.js",
      "src/lib/serviceMatch.js",
      "src/lib/employerWorkerMatchApi.js",
    ]) {
      assert.doesNotMatch(read(file), /from ["'][^"']*engagement/i, `${file} must not import Engagement`);
    }
  });

  it("candidate UI attaches Engagement only after qualification ordering", () => {
    const src = read("src/pages/WorkerMatches.jsx");
    assert.match(src, /Qualification ordering is complete before Engagement is requested/);
    assert.match(src, /getEngagementBatch/);
    assert.doesNotMatch(src, /sort\([^\n]*engagement/i);
    assert.doesNotMatch(src, /filter\([^\n]*engagement/i);
  });

  it("candidate APIs reject Engagement thresholds and expose no filtering implementation", () => {
    const batch = read("api/functions/engagementBatch.js");
    assert.match(batch, /forbiddenFilterKeys/);
    assert.match(batch, /"engagement_min"/);
    assert.match(batch, /"responsiveness_min"/);
    assert.match(batch, /"attendance_min"/);
    assert.match(batch, /Engagement is informational and cannot filter, rank, or exclude candidates/);
    assert.match(batch, /ordering_unchanged: true/);

    const functionFiles = filesUnder(
      "api/functions",
      (full) => /\.(js|mjs|ts)$/.test(full) && !full.endsWith("/engagementBatch.js")
    );
    for (const full of functionFiles) {
      const src = readFileSync(full, "utf8");
      assert.doesNotMatch(src, /engagement_min|responsiveness_min|attendance_min/i, full);
    }
  });

  it("AI doctrine refuses Engagement-based exclusion", () => {
    const context = read("api/_lib/aiContext.js");
    const live = read("api/functions/titanAILive.js");
    for (const src of [context, live]) {
      assert.match(src, /Never use Engagement|Never use it to qualify|Never use Engagement, responsiveness/i);
      assert.match(src, /filter, hide, exclude|qualify, filter, hide, exclude/i);
      assert.match(src, /(?:keeps all|all) otherwise-qualified candidates (?:remain )?visible/i);
    }
  });

  it("raw Engagement events cannot be client-inserted", () => {
    const srcFiles = filesUnder("src", (full) => /\.(js|jsx|ts|tsx)$/.test(full));
    for (const full of srcFiles) {
      const src = readFileSync(full, "utf8");
      assert.doesNotMatch(src, /from\(["']engagement_interaction_events["']\)[\s\S]{0,200}\.insert\(/i, full);
    }
    const migration = read("supabase/migrations/20260818173000_three_sided_work_ecosystem.sql");
    assert.match(migration, /No INSERT\/UPDATE\/DELETE client policy by design/);
  });

  it("verified application state drives core Engagement event creation", () => {
    const trigger = read("supabase/migrations/20260818184500_engagement_event_triggers.sql");
    assert.match(trigger, /AFTER INSERT ON public\.hire_applications/);
    assert.match(trigger, /verified_from', 'hire_applications_insert/);
    assert.match(trigger, /NEW\.status IN \('accepted', 'rejected'\)/);
    assert.match(trigger, /NEW\.status = 'withdrawn'/);
  });
});

describe("public worker trust surface", () => {
  it("public worker card and legacy profile do not show star ratings or review forms", () => {
    for (const file of ["src/components/driver/DriverCard.jsx", "src/pages/DriverProfile.jsx", "src/pages/TalentProfile.jsx"]) {
      const src = read(file);
      assert.doesNotMatch(src, /driver\.rating|reviewCount|ReviewForm|Stars\s*\(/, file);
    }
  });

  it("Service Profile stores only a general service area", () => {
    const migration = read("supabase/migrations/20260818173000_three_sided_work_ecosystem.sql");
    assert.match(migration, /service_city text/);
    assert.match(migration, /service_state text/);
    assert.match(migration, /service_radius_miles integer/);
    assert.doesNotMatch(migration, /home_address\s+text|street_address\s+text|service_address\s+text/i);
  });

  it("Engagement component owns its mandatory hiring-suitability warning", () => {
    const component = read("src/components/trust/EngagementSignal.jsx");
    assert.match(component, /does not measure ability|warning/);
    assert.match(component, /Engagement is informational|hiring suitability/i);
  });
});
