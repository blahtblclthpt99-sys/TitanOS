import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkAndroidSupabaseEnv, checkAndroidSupabaseBundle } from "./verify-android-supabase-config.mjs";

const base = {
  VITE_CAPACITOR_BUILD: "true",
  VITE_SUPABASE_URL: "https://wbymywwrpbljfbsemung.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_1234567890ABCDEFGHIJ",
  TITANOS_ANDROID_PROJECT_REF: "wbymywwrpbljfbsemung",
};

test("valid Android publishable Supabase build config passes", () => {
  assert.deepEqual(checkAndroidSupabaseEnv(base).errors, []);
});

test("missing key fails release preflight", () => {
  assert.match(checkAndroidSupabaseEnv({ ...base, VITE_SUPABASE_PUBLISHABLE_KEY: "" }).errors.join(";"), /Missing/);
});

test("placeholder URL and wrong project fail closed", () => {
  assert.ok(checkAndroidSupabaseEnv({ ...base, VITE_SUPABASE_URL: "https://YOUR_PROJECT.supabase.co" }).errors.length);
  assert.match(checkAndroidSupabaseEnv({ ...base, VITE_SUPABASE_URL: "https://xcfjpxcmokdfwkarwomy.supabase.co" }).errors.join(";"), /differs/);
});

test("secret keys fail release preflight", () => {
  assert.match(checkAndroidSupabaseEnv({ ...base, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_DONT_EMBED" }).errors.join(";"), /Never embed/);
});

test("conflicting publishable and anon aliases fail preflight", () => {
  assert.match(checkAndroidSupabaseEnv({ ...base, VITE_SUPABASE_ANON_KEY: "another-key" }).errors.join(";"), /Conflicting/);
});

test("missing capacitor build marker fails preflight", () => {
  assert.match(checkAndroidSupabaseEnv({ ...base, VITE_CAPACITOR_BUILD: "false" }).errors.join(";"), /CAPACITOR/);
});

test("compiled bundle must include actual URL and publishable key", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "titanos-android-env-"));
  try {
    fs.mkdirSync(path.join(root, "assets"));
    fs.writeFileSync(path.join(root, "index.html"), "<html></html>");
    fs.writeFileSync(path.join(root, "assets", "index.js"), "console.log('empty')");
    assert.equal(checkAndroidSupabaseBundle(root, base).length, 2);
    fs.writeFileSync(path.join(root, "assets", "index.js"), JSON.stringify([base.VITE_SUPABASE_URL, base.VITE_SUPABASE_PUBLISHABLE_KEY]));
    assert.deepEqual(checkAndroidSupabaseBundle(root, base), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
