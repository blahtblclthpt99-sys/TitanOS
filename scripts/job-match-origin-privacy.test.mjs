import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

describe("precise job match origin privacy", () => {
  const endpoint = fs.readFileSync(new URL("../api/functions/jobMatchesV2.js", import.meta.url), "utf8");
  const migration = fs.readFileSync(new URL("../supabase/migrations/20260817084000_private_job_match_origin.sql", import.meta.url), "utf8");

  it("stores precise search coordinates on owner-only preferences, not the public driver profile", () => {
    assert.match(migration, /alter table public\.job_match_preferences/i);
    assert.match(migration, /search_lat double precision/i);
    assert.match(migration, /search_lng double precision/i);
    assert.match(endpoint, /job_match_preferences[\s\S]*search_lat,search_lng/);
    assert.doesNotMatch(endpoint, /driver_profiles[^\n]*search_lat/);
  });

  it("uses private search coordinates as the radius origin", () => {
    assert.match(endpoint, /worker\.lat = privatePrefs\.search_lat/);
    assert.match(endpoint, /worker\.lng = privatePrefs\.search_lng/);
  });
});
