import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../api/functions/jobMatchesV2.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export default async function handler", "async function handler");

test("new job seekers see real unranked jobs, without Driver Hub enrollment", async () => {
  const queries = [];
  const fixtures = {
    job_match_preferences: null,
    hire_jobs: [
      { id: "job-live", title: "Warehouse associate", status: "open", deadline: null },
      { id: "job-expired", title: "Expired opening", status: "open", deadline: "2025-01-01" },
      { id: "job-untitled", title: "", status: "open" },
    ],
    job_match_interactions: [],
    hire_saves: [{ hire_job_id: "job-live" }],
    hire_applications: [],
  };
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: "test-user" } }, error: null }) },
    from(table) {
      queries.push(table);
      return {
        select() { return this; },
        eq() { return this; },
        neq() { return this; },
        order() { return this; },
        limit() { return this; },
        maybeSingle() { return this; },
        then(resolve, reject) {
          const data = Object.hasOwn(fixtures, table) ? fixtures[table] : [];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
    },
  };
  const res = {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  const handler = runInNewContext(source + "\nhandler;", {
    getSupabaseAdmin: () => admin,
    readJson: () => ({}),
    applyCors: () => {},
    handleOptions: () => {},
    assertRateLimitAsync: async () => true,
    captureApiException: () => {},
    logError: () => {},
    buildWorkerMatchProfile: (profile) => ({
      ...profile, skills: profile.skills || [], job_interests: profile.job_interests || [],
    }),
    mergeRankedJobMatches: () => [],
    normalizeExternalJob: () => ({}),
    rankInternalJobMatches: () => [],
    filterByRadius: (jobs) => jobs,
    process: { env: {} },
    URLSearchParams, AbortController, setTimeout, clearTimeout,
  });
  await handler({ method: "POST", headers: { authorization: "Bearer test" } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(queries.includes("driver_profiles"), false);
  assert.equal(res.body.data.matches.length, 1);
  assert.equal(res.body.data.matches[0].id, "job-live");
  assert.equal(res.body.data.matches[0].match.score, null);
  assert.equal(res.body.data.matches[0].interaction_state, "saved");
  assert.equal(res.body.data.needsSkills, true);
});
