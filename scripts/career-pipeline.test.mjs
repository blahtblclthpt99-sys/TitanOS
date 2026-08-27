import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../src/lib/jobMatchInteractionsApi.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/pages/CareerPipeline.jsx", import.meta.url), "utf8");
const detailsMigration = fs.readFileSync(new URL("../supabase/migrations/20260827001500_career_pipeline_details.sql", import.meta.url), "utf8");
const statesMigration = fs.readFileSync(new URL("../supabase/migrations/20260827073000_career_pipeline_states.sql", import.meta.url), "utf8");

const PIPELINE_STATES = ["saved", "ignored", "applied", "screening", "interview", "offer", "hired", "closed"];

describe("career pipeline privacy and persistence", () => {
  it("supports the full seeker-managed application lifecycle in the client", () => {
    for (const state of PIPELINE_STATES) {
      assert.match(api, new RegExp(`\\"${state}\\"`));
    }
  });

  it("keeps the database state constraint aligned with the client lifecycle", () => {
    assert.match(statesMigration, /drop constraint if exists job_match_interactions_state_check/i);
    assert.match(statesMigration, /add constraint job_match_interactions_state_check/i);
    for (const state of PIPELINE_STATES) {
      assert.match(statesMigration, new RegExp(`'${state}'`));
    }
    assert.match(statesMigration, /not employer ranking or automated employment decisions/i);
  });

  it("scopes career detail updates to the signed-in owner", () => {
    assert.match(api, /\.eq\("id", interactionId\)/);
    assert.match(api, /\.eq\("user_id", userId\)/);
  });

  it("persists only private applicant workflow details", () => {
    assert.match(detailsMigration, /interview_at timestamptz/i);
    assert.match(detailsMigration, /follow_up_at timestamptz/i);
    assert.match(detailsMigration, /private_notes text/i);
    assert.match(detailsMigration, /never used for employer ranking or automated employment decisions/i);
  });

  it("exposes interview prep without employer-side decision language", () => {
    assert.match(page, /Interview prep/);
    assert.match(page, /You control every status change/);
    assert.match(page, /not used to rank you for employers or make employment decisions/);
  });
});
