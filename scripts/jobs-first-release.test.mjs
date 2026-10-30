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
  assert.match(gradle, /versionCode 42/);
  assert.match(gradle, /versionName "2\.0\.7"/);
  assert.equal(pkg.version, '2.0.8');
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

test('Vite Android entry resolves into the React app', () => {
  const html = read('index.html');
  const main = read('src/main.jsx');
  const app = read('src/App.jsx');
  const capacitor = JSON.parse(read('capacitor.config.json'));
  assert.match(html, /<script type="module" src="\/src\/main\.jsx"><\/script>/);
  assert.match(html, /<div id="root">/);
  assert.match(main, /ReactDOM\.createRoot\(document\.getElementById\('root'\)\)/);
  assert.match(main, /<App \/>/);
  assert.match(app, /HashRouter/);
  assert.equal(capacitor.webDir, 'dist');
  assert.equal(capacitor.appId, 'com.titanos.myapp');
});

test('jobs-first Android permissions do not request legacy microphone access', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.doesNotMatch(manifest, /android\.permission\.RECORD_AUDIO"/);
  assert.doesNotMatch(manifest, /android\.permission\.MODIFY_AUDIO_SETTINGS"/);
  assert.match(manifest, /android\.permission\.INTERNET"/);
});

test('stale Android auth cache recovers to Login instead of infinite splash', () => {
  const app = read('src/App.jsx');
  assert.match(app, /authChecked && !isLoadingAuth && !isAuthenticated/);
  assert.match(app, /<Navigate to="\/login" replace state=\{\{ from: location \}\} \/>/);
});

test('authenticated career shell does not wait on public settings', () => {
  const app = read('src/App.jsx');
  assert.match(app, /if \(!isAuthenticated \|\| isLoadingAuth \|\| !authChecked\)/);
  assert.doesNotMatch(app, /!isAuthenticated \|\| isLoadingAuth \|\| isLoadingPublicSettings \|\| !authChecked/);
});

test('login returns to Career Home instead of legacy Driver Hub', () => {
  const authReturn = read('src/lib/returnTo.js');
  assert.match(authReturn, /consumeReturnTo\(fallback = "\/"\)/);
  assert.doesNotMatch(authReturn, /consumeReturnTo\(fallback = "\/driver"\)/);
  assert.match(authReturn, /return "\/hire"/);
});

test('Google OAuth callback defaults to Career Home', () => {
  const callback = read('src/pages/AuthCallback.jsx');
  assert.match(callback, /consumeReturnTo\("\/"\)/);
  assert.doesNotMatch(callback, /consumeReturnTo\("\/driver"\)/);
});

test('legacy stored Driver Hub destination migrates to job search', () => {
  const returns = read('src/lib/returnTo.js');
  assert.match(returns, /pathnameOnly === "\/driver"/);
  assert.match(returns, /pathnameOnly\.startsWith\("\/driver\/"\)/);
  assert.match(returns, /return "\/hire"/);
});

test('release rejects an incorrect upload key before Gradle compilation', () => {
  const workflow = read('.github/workflows/jobs-first-code41-aab.yml');
  const preflight = workflow.indexOf('name: Verify upload keystore before Android compilation');
  const gradle = workflow.indexOf('name: Build Android AAB');
  assert.ok(preflight > 0 && gradle > preflight);
  assert.match(workflow, /keytool -list -v -keystore android\/titanos-upload\.jks/);
  assert.match(workflow, /Signing key does not match the expected Google Play upload certificate/);
});

test('signed-out deep links reach Login without waiting for public settings', () => {
  const app = read('src/App.jsx');
  assert.match(app, /if \(!authChecked \|\| isLoadingAuth\)/);
  assert.doesNotMatch(app, /if \(!authChecked \|\| isLoadingAuth \|\| isLoadingPublicSettings\)/);
});

test('failed Android builds preserve diagnostics without copying signing files', () => {
  const workflow = read('.github/workflows/jobs-first-code41-aab.yml');
  assert.match(workflow, /name: Collect Android build diagnostics on failure/);
  assert.match(workflow, /name: Upload safe build diagnostics/);
  assert.match(workflow, /name: TitanOS-code41-build-diagnostics/);
  assert.match(workflow, /path: release-diagnostics\//);
});

test('Android SDK 36 is explicitly provisioned for code-41 builds', () => {
  const workflow = read('.github/workflows/jobs-first-code41-aab.yml');
  assert.match(workflow, /android-actions\/setup-android@v3/);
  assert.match(workflow, /platforms;android-36/);
  assert.match(workflow, /build-tools;36\.0\.0/);
});

test('release verifies AAB entry signatures and uploads verification evidence', () => {
  const workflow = read('.github/workflows/jobs-first-code41-aab.yml');
  assert.match(workflow, /jarsigner -verify -certs "\$AAB"/);
  assert.match(workflow, /grep -q "jar verified" TitanOS-code41-signature-verification\.txt/);
  assert.match(workflow, /TitanOS-code41-signature-verification\.txt/);
});

test('career home gives job seekers a four-step launch path', () => {
  const home = read('src/pages/CareerHome.jsx');
  assert.match(home, /Your job-search launch plan/);
  assert.match(home, /careerSteps\.map/);
  assert.match(home, /path: "\/profile"/);
  assert.match(home, /path: "\/resume"/);
  assert.match(home, /path: "\/hire\/matches"/);
  assert.match(home, /path: "\/hire\?tab=applications"/);
});

test('career UI avoids retired Driver Hub and employer navigation', () => {
  const matches = read('src/pages/JobMatches.jsx');
  const support = read('src/pages/SupportCenter.jsx');
  const hire = read('src/pages/Hire.jsx');
  assert.doesNotMatch(matches, /actionLabel="Open Driver Hub"/);
  assert.doesNotMatch(matches, /Post a match-ready job/);
  assert.match(matches, /navigate\("\/profile"\)/);
  assert.doesNotMatch(support, /\["Driver Hub", "driver_hub"\]/);
  assert.match(support, /\["Applications", "applications"\]/);
  assert.doesNotMatch(hire, /\["post", "Post a job"\]/);
  assert.match(hire, /Application NOT submitted/);
});

test('job match preferences do not require a driver profile', () => {
  const profile = read('src/lib/jobMatchProfileApi.js');
  assert.doesNotMatch(profile, /if \(!profile\) return null/);
  assert.doesNotMatch(profile, /Create your Driver Profile before enabling job matching/);
  assert.match(profile, /value === null \|\| value === undefined \|\| value === ""/);
});

test('job match qualifications use career profile instead of driver enrollment UI', () => {
  const screen = read('src/pages/JobMatches.jsx');
  assert.match(screen, /getMyProfessionalProfile\(user\)/);
  assert.match(screen, /saveProfessionalProfile\(user,/);
  assert.doesNotMatch(screen, /getMyDriverProfile|saveMyDriverProfile/);
});
