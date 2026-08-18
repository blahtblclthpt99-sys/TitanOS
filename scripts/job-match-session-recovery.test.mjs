import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recovery = readFileSync(new URL("../src/lib/sessionRecovery.js", import.meta.url), "utf8");
const functions = readFileSync(new URL("../src/api/functions.js", import.meta.url), "utf8");
const matchesApi = readFileSync(new URL("../src/lib/jobMatchApi.js", import.meta.url), "utf8");

test("session recovery serializes explicit refreshes", () => {
  assert.match(recovery, /let refreshInFlight = null/);
  assert.match(recovery, /refreshSessionSingleFlight/);
  assert.match(recovery, /if \(!refreshInFlight\)/);
  assert.match(recovery, /supabase\.auth\.refreshSession\(\)/);
});

test("session recovery prevents rapid refresh-token rotation", () => {
  assert.match(recovery, /REFRESH_REUSE_WINDOW_MS/);
  assert.match(recovery, /lastSuccessfulRefreshAt/);
  assert.match(recovery, /Date\.now\(\) - lastSuccessfulRefreshAt < REFRESH_REUSE_WINDOW_MS/);
});

test("session recovery never returns an actually expired access token", () => {
  assert.match(recovery, /sessionNeedsRefresh\(current, 0\)/);
  assert.match(recovery, /if \(!forceRefresh && !sessionNeedsRefresh\(current, 0\)\) return current/);
});

test("Find Jobs preflights a fresh session before matching", () => {
  assert.match(matchesApi, /ensureFreshSession\(\{ minValidityMs: 180_000 \}\)/);
  assert.match(matchesApi, /api\.functions\.invoke\("jobMatchesV2"/);
});

test("function client shares session recovery instead of refreshing independently", () => {
  assert.match(functions, /import \{ getFreshAccessToken \} from "@\/lib\/sessionRecovery"/);
  assert.doesNotMatch(functions, /supabase\.auth\.refreshSession\(\)/);
  assert.match(functions, /let token = await getFreshAccessToken\(\)/);
  assert.match(functions, /getFreshAccessToken\(\{ forceRefresh: true, minValidityMs: 0 \}\)/);
});
