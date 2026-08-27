import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../src/lib/jobMatchInteractionsApi.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/pages/CareerPipeline.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260827001500_career_pipeline_details.sql", import.meta.url), "utf8");

describe("career pipeline privacy and persistence", () => {
  it("supports the full seeker-managed application lifecycle", () => {
    for (const state of ["saved", "applied", "screening", "interview", "offer", "hired", "closed"]) {
      assert.match(api, new RegExp(`\\"${state}\\"`));
    }
  });

  it("scopes career detail updates to the signed-in owner", () => {
    assert.match(api, /\.eq\("id", interactionId\)/);
    assert.match(api, /\.eq\("user_id", userId\)/);
  });

  it("persists only private applicant workflow details", () => {
    assert.match(migration, /interview_at timestamptz/i);
    assert.match(migration, /follow_up_at timestamptz/i);
    assert.match(migration, /private_notes text/i);
    assert.match(migration, /never used for employer ranking or automated employment decisions/i);
  });

  it("exposes interview prep without employer-side decision language", () => {
    assert.match(page, /Interview prep/);
    assert.match(page, /You control every status change/);
    assert.match(page, /not used to rank you for employers or make employment decisions/);
  });
});
