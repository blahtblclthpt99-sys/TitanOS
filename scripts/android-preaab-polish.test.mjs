import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../src/pages/CareerHub.jsx");
const more = read("../src/pages/MoreMenu.jsx");
const brand = read("../src/components/brand/TitanWordmark.jsx");

test("career home reflects free job-seeker focus without inventing job availability", () => {
  assert.ok(home.includes("one free workspace"));
  assert.ok(home.includes("when the live jobs service is connected"));
  assert.ok(home.includes('to="/more"'));
});
test("More menu avoids duplicate matching CTA and keeps deletion below tool groups", () => {
  assert.ok(!more.includes('to="/hire/matches"'));
  assert.ok(more.indexOf('className="space-y-8"') < more.indexOf('to="/delete-account"'));
});
test("brand tagline matches approved employment focus", () => {
  assert.ok(brand.includes("Work Builds Tomorrow"));
  assert.ok(!brand.includes("Platform for Modern Business"));
});

test("in-app brand mark uses the metallic shield instead of old orbit/star motif", () => {
  const mark = read("../src/components/brand/TitanMark.jsx");
  assert.ok(mark.includes("Metallic Titan shield"));
  assert.ok(mark.includes("#FFBD43"));
  assert.ok(!mark.includes("titan-mark-disc-light"));
});

test("mobile navigation chooses one active tab and routes career subpages home", () => {
  const nav = read("../src/components/layout/MobileNav.jsx");
  const header = read("../src/components/layout/MobileHeader.jsx");
  assert.ok(nav.includes("const primaryActive = MOBILE_TAB_ITEMS.some"));
  assert.ok(nav.includes("!primaryActive &&"));
  assert.ok(header.includes('pathname === "/resume"'));
  assert.ok(header.includes('pathname === "/applications"'));
  assert.ok(header.includes('return "/career"'));
});

test("resume export omits empty placeholder sections", () => {
  const resume = read("../src/pages/ResumeStudio.jsx");
  assert.ok(resume.includes('.filter(([, value]) => Boolean(value?.trim()))'));
  assert.ok(!resume.includes('Add information above to complete this section.'));
});
test("application backups can be restored with validation and confirmation", () => {
  const tracker = read("../src/pages/ApplicationTracker.jsx");
  assert.ok(tracker.includes("async function importRecords"));
  assert.ok(tracker.includes("file.size > 2 * 1024 * 1024"));
  assert.ok(tracker.includes("window.confirm("));
  assert.ok(tracker.includes("Import backup"));
});

test("resume draft is saved on page exit and stored fields are validated", () => {
  const resume = read("../src/pages/ResumeStudio.jsx");
  assert.ok(resume.includes('window.addEventListener("pagehide", saveBeforeExit)'));
  assert.ok(resume.includes('latestDraft.current = form'));
  assert.ok(resume.includes('typeof data?.[field] === "string"'));
});

test("application tracker saves current records when Android view closes", () => {
  const tracker = read("../src/pages/ApplicationTracker.jsx");
  assert.ok(tracker.includes('latestItems.current = items'));
  assert.ok(tracker.includes('window.addEventListener("pagehide", saveOnExit)'));
});
test("AAB signing check tolerates legitimate self-signed upload certificates", () => {
  const yaml = read("../codemagic.yaml");
  assert.ok(yaml.includes("jarsigner -verify app/build/outputs/bundle/release/app-release.aab"));
  assert.ok(yaml.includes("grep -q 'jar verified'"));
  assert.ok(!yaml.includes("jarsigner -verify -strict"));
});
