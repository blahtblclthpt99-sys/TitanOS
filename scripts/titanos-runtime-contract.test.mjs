import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertSupabaseProjectConsistency } from "../api/_lib/supabase.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("server and browser Supabase canonical project refs must agree", () => {
  assert.equal(
    assertSupabaseProjectConsistency({
      serverUrl: "https://wbymywwrpbljfbsemung.supabase.co",
      clientUrl: "https://wbymywwrpbljfbsemung.supabase.co/auth/v1",
    }),
    true
  );

  assert.throws(
    () => assertSupabaseProjectConsistency({
      serverUrl: "https://xcfjpxcmokdfwkarwomy.supabase.co",
      clientUrl: "https://wbymywwrpbljfbsemung.supabase.co",
    }),
    /Supabase server\/client project mismatch/
  );

  // Custom domains cannot be mapped to a project ref from hostname alone, so
  // they remain an E2E deployment-verification responsibility.
  assert.equal(
    assertSupabaseProjectConsistency({
      serverUrl: "https://db.example.com",
      clientUrl: "https://db.example.com",
    }),
    true
  );
});

test("TitanOS registration requires durable cross-instance throttling", async () => {
  const registration = await read("api/register.js");
  assert.match(registration, /assertRateLimitAsync/);
  assert.match(registration, /key: "register"/);
  assert.match(registration, /requireDurable: true/);
  assert.doesNotMatch(registration, /import \{ assertRateLimit \} from/);
});

test("Product Hunt auth CTAs safely return users to Autopilot", async () => {
  const preview = await read("src/pages/AutopilotPublic.jsx");
  const returnTo = await read("src/lib/returnTo.js");

  assert.match(preview, /const AUTOPILOT_RETURN = encodeURIComponent\("\/autopilot"\)/);
  assert.match(preview, /\/register\?from_url=\$\{AUTOPILOT_RETURN\}/);
  assert.match(preview, /\/login\?from_url=\$\{AUTOPILOT_RETURN\}/);
  assert.match(returnTo, /new URLSearchParams\(location\?\.search \|\| window\.location\.search\)\.get\("from_url"\)/);
  assert.match(returnTo, /sanitizeReturnPath\(fromQuery\)/);
});

test("TitanOS quality and Android workflows select the TitanOS Recovery surface", async () => {
  const quality = await read(".github/workflows/attention-build.yml");
  const android = await read(".github/workflows/android-release.yml");

  for (const workflow of [quality, android]) {
    assert.match(workflow, /VITE_APP_SURFACE: "titanos"/);
    assert.match(workflow, /VITE_SUPABASE_URL: "https:\/\/wbymywwrpbljfbsemung\.supabase\.co"/);
  }
  assert.match(quality, /name: TitanOS Product Quality Gate/);
  assert.match(quality, /TITAN_STRIPE_WEBHOOK_PRODUCT: "autopilot"/);
  assert.match(quality, /npm run gate:ship/);
});
