import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (name) => fs.readFileSync(new URL("../" + name, import.meta.url), "utf8");
const android = read(".github/workflows/android-release.yml");
const certification = read(".github/workflows/titanos-play-cert.yml");
const gradle = read("android/app/build.gradle");
const expectedSHA = "7A:D5:FE:24:6B:AD:E3:45:6C:FA:83:B0:62:C4:FA:8F:C9:2A:A2:07:2F:46:F6:E1:1D:92:10:EB:3A:BF:D4:5D";

test("Android CI uses matching public Supabase key aliases and designated project", () => {
  for (const src of [android, certification]) {
    assert.match(src, /VITE_SUPABASE_URL: "https:\/\/wbymywwrpbljfbsemung\.supabase\.co"/);
    const publishable = src.match(/VITE_SUPABASE_PUBLISHABLE_KEY: "(sb_publishable_[^"]+)"/)?.[1];
    const anon = src.match(/VITE_SUPABASE_ANON_KEY: "(sb_publishable_[^"]+)"/)?.[1];
    assert.ok(publishable && anon);
    assert.equal(publishable, anon);
    assert.match(src, /node scripts\/verify-android-supabase-config\.mjs --bundle/);
  }
});

test("release workflow requires signed AAB while PR is explicitly test-only", () => {
  assert.match(android, /if \[ "\$GITHUB_EVENT_NAME" != "pull_request" \]; then/);
  assert.match(android, /test "\$PLAY_SIGNING_CONFIGURED" = "true"/);
  assert.match(android, /test "\$AAB_SIGNED" = "true"/);
  assert.match(android, /UNSIGNED-TEST-ONLY/);
  assert.match(android, /SIGNED-RELEASE/);
});

test("certification workflow requires correct Play upload certificate", () => {
  assert.match(certification, /test "\$PLAY_SIGNING_CONFIGURED" = "true"/);
  assert.match(certification, /test "\$AAB_SIGNED" = "true"/);
  assert.ok(certification.includes(expectedSHA));
  assert.ok(android.includes(expectedSHA));
});

test("Play application identity remains constant", () => {
  assert.match(gradle, /applicationId "com\.titanos\.myapp"/);
  assert.match(gradle, /versionCode 38/);
  assert.match(gradle, /versionName "2\.0\.5"/);
});
