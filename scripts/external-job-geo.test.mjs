import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeJobCoordinates } from "../src/lib/jobCoordinates.js";
import { applyRadiusToMatch, filterByRadius } from "../src/lib/jobMatchRadius.js";

const apiSource = fs.readFileSync(
  new URL("../api/functions/jobMatchesV2.js", import.meta.url),
  "utf8"
);

test("provider coordinates are normalized before radius filtering", () => {
  assert.match(apiSource, /normalizeJobCoordinates\(\{ lat: row\.latitude, lng: row\.longitude \}\)/);
  assert.match(apiSource, /filterByRadius\(mergeRankedJobMatches/);
});

test("coordinate normalization accepts valid numeric strings and numbers", () => {
  assert.deepEqual(normalizeJobCoordinates({ lat: "35.4676", lng: -97.5164 }), {
    lat: 35.4676,
    lng: -97.5164,
  });
});

test("coordinate normalization rejects missing, non-finite, and out-of-range values", () => {
  assert.deepEqual(normalizeJobCoordinates({ lat: "", lng: null }), { lat: null, lng: null });
  assert.deepEqual(normalizeJobCoordinates({ lat: "not-a-number", lng: Infinity }), { lat: null, lng: null });
  assert.deepEqual(normalizeJobCoordinates({ lat: 91, lng: -181 }), { lat: null, lng: null });
});

test("external coordinates allow radius filtering to exclude distant jobs", () => {
  const profile = { lat: 35.4676, lng: -97.5164, work_radius_miles: 50 };
  const nearby = { id: "near", lat: 35.2226, lng: -97.4395 };
  const distant = { id: "far", lat: 36.154, lng: -95.9928 };
  assert.equal(applyRadiusToMatch(nearby, profile).within_radius, true);
  assert.equal(applyRadiusToMatch(distant, profile).within_radius, false);
  assert.deepEqual(filterByRadius([nearby, distant], profile).map((row) => row.id), ["near"]);
});
