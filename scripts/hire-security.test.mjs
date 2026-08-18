/**
 * Hardened work ecosystem security + product wiring regression tests.
 * Run: node --test scripts/hire-security.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  mergeRankedJobMatches,
  normalizeExternalJob,
  rankInternalJobMatches,
  scoreJobMatch,
} from "../src/lib/jobMatch.js";
import { filterByRadius, haversineMiles } from "../src/lib/jobMatchRadius.js";
import { rankPublishedWorkerMatches, scoreWorkerMatch } from "../src/lib/workerMatch.js";

function visibleHireMessages(rows, userId, hireJobId) {
  return (rows || []).filter(
    (m) => m.hire_job_id === hireJobId && (m.sender_id === userId || m.recipient_id === userId)
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

  it("applicant can read", () => assert.equal(canReadApplication(app, { id: "worker" }, job), true));
  it("owner can read", () => assert.equal(canReadApplication(app, { id: "owner" }, job), true));
  it("admin can read", () => assert.equal(canReadApplication(app, { id: "x", role: "admin" }, job), true));
  it("stranger cannot read", () => assert.equal(canReadApplication(app, { id: "stranger" }, job), false));
});

describe("skills-driven job matching safety", () => {
  const worker = {
    user_id: "worker-1",
    skills: ["delivery", "box truck", "forklift"],
    certifications: ["dot medical card"],
    years_experience: 4,
    city: "Oklahoma City",
    state: "OK",
    desired_pay_min: 20,
    desired_pay_type: "hourly",
    preferred_schedule: ["weekday", "day"],
    job_interests: ["delivery"],
  };
  const native = {
    id: "native-1",
    title: "Box truck delivery driver",
    category: "Delivery",
    city: "Oklahoma City",
    state: "OK",
    budget_min: 22,
    budget_max: 26,
    pay_type: "hourly",
    required_skills: ["delivery", "box truck"],
    required_certifications: ["dot medical card"],
    minimum_years_experience: 2,
    schedule_tags: ["weekday", "day"],
    status: "open",
  };

  it("produces an explainable high score for a strong native match", () => {
    const match = scoreJobMatch(worker, native);
    assert.ok(match.score >= 90);
    assert.ok(match.reasons.some((reason) => reason.startsWith("Skills:")));
  });

  it("treats missing required credentials as a hard eligibility filter", () => {
    assert.equal(rankInternalJobMatches([native], { ...worker, certifications: [] }).length, 0);
  });

  it("does not compare incompatible pay periods as raw numbers", () => {
    const match = scoreJobMatch(worker, {
      ...native,
      pay_type: "salary",
      budget_min: 40000,
      budget_max: 50000,
    });
    assert.equal(match.reasons.includes("Meets pay preference"), false);
  });

  it("does not return external jobs without explicit consent", () => {
    const external = normalizeExternalJob(
      {
        id: "ext-1",
        title: "Route driver",
        city: "Oklahoma City",
        state: "OK",
        url: "https://jobs.example.test/route-driver",
        required_skills: ["delivery"],
        posted_at: "2026-08-16T12:00:00Z",
      },
      { name: "Example Jobs" }
    );
    const rows = mergeRankedJobMatches({
      internal: [native],
      external: [external],
      driverProfile: { ...worker, external_job_search_consent: false },
      now: Date.parse("2026-08-17T00:00:00Z"),
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "native-1");
  });

  it("deduplicates an outside copy of an existing native vacancy", () => {
    const external = normalizeExternalJob(
      {
        id: "duplicate",
        title: native.title,
        city: native.city,
        state: native.state,
        url: "https://jobs.example.test/duplicate",
        posted_at: "2026-08-16T12:00:00Z",
      },
      { name: "Example Jobs" }
    );
    const rows = mergeRankedJobMatches({
      internal: [native],
      external: [external],
      driverProfile: { ...worker, external_job_search_consent: true },
      now: Date.parse("2026-08-17T00:00:00Z"),
    });
    assert.equal(rows.filter((row) => row.title === native.title).length, 1);
  });

  it("rejects insecure external source links", () => {
    assert.throws(
      () => normalizeExternalJob(
        { id: "bad", title: "Bad", url: "http://example.test/job" },
        { name: "Example" }
      ),
      /HTTPS/
    );
  });
});

describe("employer-side published worker matching", () => {
  const job = {
    title: "Box truck delivery driver",
    category: "Delivery",
    city: "Oklahoma City",
    state: "OK",
    required_skills: ["delivery", "box truck"],
    required_certifications: ["dot medical card"],
    minimum_years_experience: 3,
  };
  const strong = {
    id: "strong",
    userId: "worker-strong",
    published: true,
    name: "Strong Worker",
    city: "Oklahoma City, OK",
    skills: ["delivery", "box truck", "forklift"],
    certifications: ["dot medical card"],
    yearsExperience: 5,
    availability: "available",
  };

  it("ranks a strong published candidate with explainable reasons", () => {
    const match = scoreWorkerMatch(job, strong);
    assert.ok(match.score >= 85);
    assert.ok(match.reasons.some((reason) => reason.startsWith("Skills:")));
    assert.ok(match.reasons.includes("Meets experience requirement"));
  });

  it("hard-filters candidates missing a required credential", () => {
    assert.equal(rankPublishedWorkerMatches(job, [{ ...strong, id: "missing", certifications: [] }]).length, 0);
  });

  it("never includes unpublished profiles or the job owner's own profile", () => {
    const rows = rankPublishedWorkerMatches(
      job,
      [
        strong,
        { ...strong, id: "hidden", userId: "hidden-user", published: false },
        { ...strong, id: "owner", userId: "owner" },
      ],
      { ownerUserId: "owner" }
    );
    assert.deepEqual(rows.map((row) => row.id), ["strong"]);
  });

  it("keeps lower experience visible as an explainable ranking factor instead of a hidden hard filter", () => {
    const rows = rankPublishedWorkerMatches(job, [{ ...strong, id: "junior", yearsExperience: 1 }]);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].match.blockers.some((reason) => /3\+ years/.test(reason)));
  });

  it("uses neutral published profiles and keeps private preferences and Driver data out of recruiting", () => {
    const source = fs.readFileSync(new URL("../src/lib/employerWorkerMatchApi.js", import.meta.url), "utf8");
    assert.match(source, /listPublishedEmploymentProfiles/);
    assert.match(source, /listPublishedServiceProfiles/);
    assert.match(source, /Only the opportunity owner can view ranked matches/);
    assert.doesNotMatch(source, /listPublishedDrivers/);
    assert.doesNotMatch(source, /job_match_preferences|privacy_prefs|search_lat|search_lng/);
  });
});

describe("job match radius enforcement", () => {
  const okc = { lat: 35.4676, lng: -97.5164, work_radius_miles: 50 };

  it("computes plausible Haversine distance", () => {
    const miles = haversineMiles(35.4676, -97.5164, 35.2226, -97.4395);
    assert.ok(miles > 15 && miles < 25);
  });

  it("excludes precise-coordinate jobs beyond the worker radius", () => {
    const rows = filterByRadius(
      [
        { id: "near", lat: 35.2226, lng: -97.4395 },
        { id: "far", lat: 36.154, lng: -95.9928 },
      ],
      okc
    );
    assert.deepEqual(rows.map((row) => row.id), ["near"]);
    assert.equal(rows[0].within_radius, true);
    assert.ok(rows[0].distance_mi > 0);
  });

  it("does not fabricate a distance when coordinates are unavailable", () => {
    const rows = filterByRadius([{ id: "unknown", city: "Oklahoma City", state: "OK" }], okc);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].distance_mi, null);
    assert.equal(rows[0].within_radius, null);
  });
});

describe("job match server trust boundaries", () => {
  const endpoint = fs.readFileSync(new URL("../api/functions/jobMatches.js", import.meta.url), "utf8");
  const endpointV2 = fs.readFileSync(new URL("../api/functions/jobMatchesV2.js", import.meta.url), "utf8");
  const privacyMigration = fs.readFileSync(
    new URL("../supabase/migrations/20260817004000_private_job_match_preferences.sql", import.meta.url),
    "utf8"
  );
  const phase2Migration = fs.readFileSync(
    new URL("../supabase/migrations/20260817083000_job_match_radius_and_interactions.sql", import.meta.url),
    "utf8"
  );
  const originMigration = fs.readFileSync(
    new URL("../supabase/migrations/20260817084000_private_job_match_origin.sql", import.meta.url),
    "utf8"
  );

  it("derives worker identity from the verified auth user and scopes both profile sources to it", () => {
    assert.match(endpoint, /const userId = userData\.user\.id/);
    assert.match(endpoint, /driver_profiles[\s\S]*?\.eq\("user_id", userId\)/);
    assert.match(endpoint, /job_match_preferences[\s\S]*?\.eq\("user_id", userId\)/);
  });

  it("filters jobs posted by the same authenticated account", () => {
    assert.match(endpointV2, /\.neq\("created_by_id", userId\)/);
  });

  it("uses a fixed HTTPS external-provider host rather than a caller supplied URL", () => {
    assert.match(endpointV2, /https:\/\/api\.adzuna\.com\/v1\/api\/jobs\/us\/search\/1/);
    assert.doesNotMatch(endpointV2, /fetch\(body\.(url|endpoint|provider)/);
  });

  it("keeps provider credentials server-only", () => {
    assert.match(endpointV2, /process\.env\.ADZUNA_APP_ID/);
    assert.match(endpointV2, /process\.env\.ADZUNA_APP_KEY/);
    assert.doesNotMatch(endpointV2, /VITE_ADZUNA/);
  });

  it("keeps private matching preferences behind owner-only RLS", () => {
    assert.match(privacyMigration, /enable row level security/i);
    assert.match(privacyMigration, /revoke all on public\.job_match_preferences from anon/i);
    assert.match(privacyMigration, /using \(user_id = auth\.uid\(\) and created_by_id = auth\.uid\(\)\)/i);
  });

  it("keeps precise search origin in owner-only preferences, not the public driver profile", () => {
    assert.match(originMigration, /alter table public\.job_match_preferences/i);
    assert.match(originMigration, /search_lat double precision/i);
    assert.match(originMigration, /search_lng double precision/i);
    assert.match(endpointV2, /job_match_preferences[\s\S]*search_lat,search_lng/);
    assert.match(endpointV2, /worker\.lat = privatePrefs\.search_lat/);
    assert.match(endpointV2, /worker\.lng = privatePrefs\.search_lng/);
    assert.doesNotMatch(endpointV2, /driver_profiles[^\n]*search_lat/);
  });

  it("keeps match interactions owner-only and does not persist external listing bodies", () => {
    assert.match(phase2Migration, /alter table public\.job_match_interactions enable row level security/i);
    assert.match(phase2Migration, /revoke all on public\.job_match_interactions from anon/i);
    assert.match(phase2Migration, /using \(user_id = auth\.uid\(\) and created_by_id = auth\.uid\(\)\)/i);
    assert.doesNotMatch(phase2Migration, /description\s+text/i);
    assert.doesNotMatch(phase2Migration, /payload\s+jsonb/i);
  });

  it("merges existing native saves and applications instead of replacing them", () => {
    assert.match(endpointV2, /from\("hire_saves"\)/);
    assert.match(endpointV2, /from\("hire_applications"\)/);
    assert.match(endpointV2, /nativeAppliedIds/);
    assert.match(endpointV2, /nativeSavedIds/);
  });
});

describe("three-workspace work ecosystem wiring", () => {
  const nav = fs.readFileSync(new URL("../src/lib/nav-items.js", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../src/pages/JobMatches.jsx", import.meta.url), "utf8");
  const stack = fs.readFileSync(new URL("../src/components/layout/TabStack.jsx", import.meta.url), "utf8");
  const post = fs.readFileSync(new URL("../src/pages/MatchReadyJobPost.jsx", import.meta.url), "utf8");

  it("keeps Job Seeker, Independent Work, and Business recruiting as separate workspace surfaces", () => {
    assert.match(nav, /label: "Available Jobs", path: "\/hire\/matches", group: "seeker", audience: "job_seeker"/);
    assert.match(nav, /label: "Opportunities", path: "\/work-opportunities", group: "independent", audience: "self_employed"/);
    assert.match(nav, /label: "Talent", path: "\/talent", group: "management", audience: "business"/);
    assert.match(nav, /label: "Match-ready opportunity", path: "\/hire\/post-match-ready", group: "management", hidden: true/);
    assert.match(nav, /NAV_GROUP_ORDER = \["operations", "money", "management", "independent", "independent_money", "seeker", "shared"\]/);
  });

  it("routes employment, independent work, and recruiting to different parents", () => {
    assert.match(
      nav,
      /if \(path\.startsWith\("\/hire\/matches"\) \|\| path\.startsWith\("\/job-profile"\)\) return \{ label: "Available Jobs", path: "\/hire\/matches" \}/
    );
    assert.match(
      nav,
      /if \(path\.startsWith\("\/talent"\) \|\| path\.startsWith\("\/hire\/candidates"\)[\s\S]*?return \{ label: "Talent", path: "\/talent" \}/
    );
    assert.match(
      nav,
      /if \(path\.startsWith\("\/work-opportunities"\) \|\| path\.startsWith\("\/service-profile"\)\) return \{ label: "Independent Work", path: "\/independent" \}/
    );
  });

  it("provides all, saved, and interested employment views while removing ignored jobs", () => {
    assert.match(page, /const \[view, setView\] = useState\("all"\)/);
    assert.match(page, /saved: matches\.filter\(\(job\) => job\.interaction_state === "saved"\)/);
    assert.match(page, /applied: matches\.filter\(\(job\) => job\.interaction_state === "applied"\)/);
    assert.match(page, /\[\["all", "All"\], \["saved", "Saved"\], \["applied", "Interested"\]\]/);
    assert.match(page, /Employment opportunities/);
    assert.match(page, /setMatches\(\(rows\) => rows\.filter\(\(row\) => row\.id !== job\.id\)\)/);
  });

  it("retains owner-scoped employer candidate ranking as a compatibility workflow", () => {
    assert.match(stack, /"\/hire\/candidates": WorkerMatches/);
    assert.match(post, /navigate\(`\/hire\/candidates\?job=\$\{encodeURIComponent\(job\.id\)\}`\)/);
  });
});
