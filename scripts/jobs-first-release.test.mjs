import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('jobs-first routes never mount driver hub', () => {
  const routing = read('src/components/layout/TabStack.jsx');
  assert.match(routing, /"\/driver": "\/hire"/);
  assert.match(routing, /"\/resume": ResumeBuilder/);
  assert.match(routing, /"\/support": SupportCenter/);
  assert.doesNotMatch(routing, /import\([^)]*pages\/DriverHub/);
});
test('jobs-first tabs and links are coherent', () => {
  const nav = read('src/lib/nav-items.js');
  assert.match(nav, /label: "Find Jobs", path: "\/hire"/);
  assert.match(nav, /label: "Résumé", path: "\/resume"/);
  assert.doesNotMatch(nav, /label: "Driver"/);
});
test('Hire query deep links track saved and applications tabs', () => {
  const hire = read('src/pages/Hire.jsx');
  assert.match(hire, /searchParams\.get\("tab"\)/);
  assert.match(hire, /setTab\(\(current\) => current === next \? current : next\)/);
  assert.match(hire, /"applications"/);
  assert.match(hire, /"saved"/);
});
test('release bundle is a strictly newer Play candidate', () => {
  const gradle = read('android/app/build.gradle');
  const pkg = JSON.parse(read('package.json'));
  assert.match(gradle, /applicationId "com\.titanos\.myapp"/);
  assert.match(gradle, /versionCode 41/);
  assert.match(gradle, /versionName "2\.0\.7"/);
  assert.equal(pkg.version, '2.0.7');
  assert.equal(JSON.parse(read('package-lock.json')).version, pkg.version);
  assert.equal(JSON.parse(read('package-lock.json')).packages[''].version, pkg.version);
});

test('job match deep links resolve their selected listing in Hire', () => {
  const hire = read('src/pages/Hire.jsx');
  assert.match(hire, /searchParams\.get\("job"\)/);
  assert.match(hire, /setSelectedJob\(target\)/);
  assert.match(hire, /listHireJobsByIds\(\[requestedId\]\)/);
  assert.match(hire, /next\.delete\("job"\)/);
});

test('Play workflow refuses to publish an unsigned or wrongly signed AAB', () => {
  const workflow = read('.github/workflows/jobs-first-code41-aab.yml');
  assert.match(workflow, /PLAY_SIGNING_CONFIGURED" != "true"/);
  assert.match(workflow, /CERT_SHA256" != "\$EXPECTED_SHA256"/);
  assert.match(workflow, /exit 1/);
});

test('mobile navigation selects the most specific careers tab', () => {
  const mobile = read('src/components/layout/MobileNav.jsx');
  assert.match(mobile, /item\.path\.length > TABS\[best\]\.path\.length/);
  assert.match(mobile, /activeIndex === TABS\.findIndex/);
  assert.match(mobile, /currentDestination === path/);
  assert.match(mobile, /location\.search/);
  assert.match(mobile, /pathname === path && !location\.search/);
});
