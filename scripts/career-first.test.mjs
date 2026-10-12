import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function source(path) { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
const landing = source("src/pages/Landing.jsx");
const routes = source("src/components/layout/TabStack.jsx");
const nav = source("src/lib/nav-items.js");
const home = source("src/pages/CareerHome.jsx");
const builder = source("src/pages/ResumeBuilder.jsx");
const entry = source("src/main.jsx");

test("TitanOS opens a jobs-first career home rather than the advertising product", () => {
  assert.match(routes, /pages\/CareerHome/);
  assert.match(home, /Find jobs/);
  assert.match(landing, /Jobs & Careers/);
  assert.doesNotMatch(landing, /Start earning|attention marketplace|sponsor campaign/i);
  assert.doesNotMatch(home, /Earn from campaigns|advertiser dashboard/i);
});

test("job search, matching and résumé builder appear in primary navigation", () => {
  assert.match(nav, /label: "Find Jobs", path: "\/hire"/);
  assert.match(nav, /label: "Job Matches", path: "\/hire\/matches"/);
  assert.match(nav, /label: "Résumé Builder", path: "\/resume"/);
  const publicNav = nav.split("export const APP_NAV_ITEMS = [")[1].split("\n];")[0];
  assert.doesNotMatch(publicNav, /Advertising|Campaigns|Promoted|Sponsored|Driver Hub|Invoices/);
});

test("résumé editor is routed, account-scoped and exportable", () => {
  assert.match(routes, /"\/resume": ResumeBuilder/);
  assert.match(builder, /titanos:resume:v1:/);
  assert.match(builder, /localStorage\.setItem/);
  assert.match(builder, /window\.print\(\)/);
  assert.match(builder, /new Blob/);
  assert.match(builder, /draft\.experience/);
  assert.match(builder, /draft\.education/);
  assert.match(builder, /draft\.certifications/);
});

test("app bootstrap does not purge prior TitanOS storage during a jobs-first rollout", () => {
  assert.doesNotMatch(entry, /removeLegacyStorageKeys|purgeLegacyClientState|titan-attention:legacy-client-state-purged/);
});

test("job matching and application UI remain available", () => {
  const matches = source("src/pages/JobMatches.jsx");
  const hire = source("src/pages/Hire.jsx");
  assert.match(routes, /"\/hire\/matches": JobMatches/);
  assert.match(routes, /"\/hire": Hire/);
  assert.match(hire, /"applications"/);
  assert.match(matches, /getJobMatches/);
});
test("Android candidate is unsigned, jobs-first and does not reuse an advertising account", () => {
  const gradle = source("android/app/build.gradle");
  const workflow = source(".github/workflows/android-release.yml");
  const backendGate = source("scripts/verify-jobs-backend.mjs");
  const packageJson = JSON.parse(source("package.json"));
  assert.match(gradle, /versionCode 41/);
  assert.match(gradle, /versionName "2\.0\.7"/);
  assert.match(workflow, /UNSIGNED-INTERNAL/);
  assert.match(workflow, /verify-jobs-backend\.mjs --internal/);
  assert.doesNotMatch(workflow, /xcfjpxcmokdfwkarwomy|Titan Attention Quality Gate/);
  assert.match(backendGate, /xcfjpxcmokdfwkarwomy/);
  assert.match(backendGate, /TITANOS_AUTH_MIGRATION_VERIFIED/);
  assert.match(packageJson.scripts.prebuild, /verify-jobs-backend\.mjs --auto/);
});

test("mobile job tabs are unambiguous and native callback origin must match", () => {
  const mobile = source("src/components/layout/MobileNav.jsx");
  const nativeAuth = source("src/lib/capacitor-auth.js");
  assert.match(mobile, /pathname === item\.path/);
  assert.doesNotMatch(mobile, /const isActive = isRouteActive\(pathname, item\.path\)/);
  assert.match(nativeAuth, /parsed\.protocol === "com\.titanos\.myapp:"/);
  assert.match(nativeAuth, /parsed\.pathname === "\/callback"/);
});

test("résumé backups preserve account-scoped drafts without a cloud-data claim", () => {
  const resume = source("src/pages/ResumeBuilder.jsx");
  assert.match(resume, /TitanOS-Resume-Backup/);
  assert.match(resume, /normalizeResume/);
  assert.match(resume, /file\.size > 512 \* 1024/);
  assert.match(resume, /Import backup/);
  assert.match(resume, /Export backup/);
  assert.match(resume, /does not sync between devices yet/);
});

test("native-only job fallback uses real authenticated postings and declines fabricated vacancies", () => {
  const matcher = source("src/lib/jobMatchApi.js");
  const page = source("src/pages/JobMatches.jsx");
  assert.match(matcher, /\.from\("hire_jobs"\)/);
  assert.match(matcher, /\.eq\("status", "open"\)/);
  assert.match(matcher, /native_jobs_fallback/);
  assert.match(matcher, /provider_not_configured/);
  assert.doesNotMatch(matcher, /mockJobs|sampleJobs|fakeJobs|fabricated/);
  assert.match(page, /safeJobUrl/);
  assert.match(page, /Live job matching is unavailable/);
  assert.match(page, /Preferences saved on this device/);
  assert.doesNotMatch(page, /Open Driver Hub/);
});
