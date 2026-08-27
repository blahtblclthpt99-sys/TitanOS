import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
const variablesPath = path.join(root, "android", "variables.gradle");
const capacitorPath = path.join(root, "capacitor.config.json");

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error(`Required release file is missing: ${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

const manifest = readRequired(manifestPath);
const variables = readRequired(variablesPath);
const capacitor = JSON.parse(readRequired(capacitorPath));
const billingPlugin = readRequired(path.join(root, "android", "app", "src", "main", "java", "com", "titanos", "myapp", "TitanBillingPlugin.java"));
const mainActivity = readRequired(path.join(root, "android", "app", "src", "main", "java", "com", "titanos", "myapp", "MainActivity.java"));
const appGradle = readRequired(path.join(root, "android", "app", "build.gradle"));
const playBilling = readRequired(path.join(root, "src", "lib", "playBilling.js"));
const playVerifier = readRequired(path.join(root, "api", "functions", "googlePlayVerifySubscription.js"));
const playMigration = readRequired(path.join(root, "supabase", "migrations", "041_google_play_subscriptions.sql"));
const pricing = readRequired(path.join(root, "src", "pages", "Pricing.jsx"));
const privacy = readRequired(path.join(root, "src", "pages", "PrivacyPolicy.jsx"));
const terms = readRequired(path.join(root, "src", "pages", "TermsOfService.jsx"));

const failures = [];
const notes = [];

const targetMatch = variables.match(/targetSdkVersion\s*=\s*(\d+)/);
const compileMatch = variables.match(/compileSdkVersion\s*=\s*(\d+)/);
const targetSdk = targetMatch ? Number(targetMatch[1]) : NaN;
const compileSdk = compileMatch ? Number(compileMatch[1]) : NaN;

if (!Number.isFinite(targetSdk)) failures.push("Could not determine targetSdkVersion from android/variables.gradle.");
if (!Number.isFinite(compileSdk)) failures.push("Could not determine compileSdkVersion from android/variables.gradle.");
if (Number.isFinite(targetSdk) && targetSdk < 36) failures.push(`targetSdkVersion ${targetSdk} is below TitanOS career-core release baseline 36.`);
if (Number.isFinite(compileSdk) && compileSdk < 36) failures.push(`compileSdkVersion ${compileSdk} is below TitanOS career-core release baseline 36.`);

const permissionMatches = [...manifest.matchAll(/<uses-permission\s+android:name=["']([^"']+)["'][^>]*\/?\s*>/g)].map((match) => match[1]);
const declaredPermissions = new Set(permissionMatches);
const allowedSourcePermissions = new Set([
  "android.permission.INTERNET",
  "android.permission.ACCESS_COARSE_LOCATION",
]);

for (const permission of declaredPermissions) {
  if (!allowedSourcePermissions.has(permission)) failures.push(`Unreviewed Android permission in career-core manifest: ${permission}`);
}

const forbiddenTokens = [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.READ_CONTACTS",
  "android.permission.WRITE_CONTACTS",
  "android.permission.GET_ACCOUNTS",
  "android.permission.READ_CALL_LOG",
  "android.permission.WRITE_CALL_LOG",
  "android.permission.PROCESS_OUTGOING_CALLS",
  "android.permission.READ_SMS",
  "android.permission.RECEIVE_SMS",
  "android.permission.SEND_SMS",
  "android.permission.QUERY_ALL_PACKAGES",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.REQUEST_INSTALL_PACKAGES",
  "android.permission.MANAGE_EXTERNAL_STORAGE",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.USE_EXACT_ALARM",
  "android.permission.PACKAGE_USAGE_STATS",
  "android.permission.BIND_ACCESSIBILITY_SERVICE",
  "android.accessibilityservice.AccessibilityService",
];
for (const token of forbiddenTokens) {
  if (manifest.includes(token)) failures.push(`Blocked Google Play policy-sensitive capability found: ${token}`);
}

if (manifest.includes("android:allowBackup=\"true\"") || manifest.includes("android:allowBackup='true'")) failures.push("android:allowBackup must remain false for the TitanOS career-core release.");
if (capacitor.appId !== "com.titanos.myapp") failures.push(`Unexpected Capacitor appId: ${capacitor.appId || "missing"}`);
if (capacitor.appName !== "TitanOS") failures.push(`Unexpected Capacitor appName: ${capacitor.appName || "missing"}`);
if (capacitor.server?.androidScheme !== "https") failures.push("Capacitor Android scheme must remain HTTPS.");
if (!declaredPermissions.has("android.permission.INTERNET")) failures.push("INTERNET permission is required for TitanOS network functionality.");

// Google Play Billing must remain native on Android and server-authoritative.
const productIds = ["titanos_starter_monthly", "titanos_pro_monthly", "titanos_business_monthly"];
if (!billingPlugin.includes('@CapacitorPlugin(name = "TitanBilling")')) failures.push("Native TitanBilling Capacitor plugin is missing.");
if (!mainActivity.includes("registerPlugin(TitanBillingPlugin.class)")) failures.push("MainActivity does not register TitanBillingPlugin.");
if (!/com\.android\.billingclient:billing:\d+/.test(appGradle)) failures.push("Google Play BillingClient dependency is missing.");
if (!playBilling.includes('invoke("googlePlayVerifySubscription"')) failures.push("Android purchase flow does not call the server-side Google Play verifier.");
if (!playVerifier.includes("purchases/subscriptionsv2/tokens/")) failures.push("Google Play verifier is not checking subscriptions against the Google Play Developer API.");
if (!playVerifier.includes(":acknowledge")) failures.push("Google Play verifier does not acknowledge new subscription purchases.");
if (!pricing.includes("isAndroidPlayBuild()") || !pricing.includes("startPlaySubscription") || !pricing.includes("startStripeSubscription")) failures.push("Pricing page no longer preserves Android Play Billing / web billing separation.");
for (const productId of productIds) {
  for (const [label, source] of [["client catalog", playBilling], ["server verifier", playVerifier], ["receipt schema", playMigration]]) {
    if (!source.includes(productId)) failures.push(`${label} is missing Play product ${productId}.`);
  }
}

// Public disclosures must match the actual career-core build.
if (!privacy.includes("jobs, careers, work-opportunity")) failures.push("Privacy Policy is not centered on the TitanOS career-core product identity.");
if (!privacy.includes("does not request precise or background location permission")) failures.push("Privacy Policy does not disclose the career-core minimum-scope location model.");
if (/requests? coarse and fine location/i.test(privacy)) failures.push("Privacy Policy still claims broad coarse + fine location access.");
if (!privacy.includes("external job search")) failures.push("Privacy Policy does not disclose optional external job search processing.");
if (!privacy.includes("Google Play") || !privacy.includes("Stripe")) failures.push("Privacy Policy does not disclose both Android and web payment processors.");
if (/driver-first/i.test(terms) || /driver operating platform/i.test(terms)) failures.push("Terms still use legacy driver-first product positioning.");
if (/profit improvement/i.test(terms)) failures.push("Terms still contain the retired profit-improvement guarantee.");
if (!terms.includes("Match scores") || !terms.includes("not promises of eligibility")) failures.push("Terms do not preserve advisory-only employment matching language.");
if (!terms.includes("Google Play Billing") || !terms.includes("Stripe")) failures.push("Terms do not disclose Android/web billing channels.");
if (!terms.includes("does not guarantee that a paid plan will produce employment")) failures.push("Terms do not disclaim employment/income outcome guarantees.");

if (declaredPermissions.has("android.permission.ACCESS_COARSE_LOCATION")) notes.push("Approximate foreground location is declared for user-initiated nearby-work/location features.");
else notes.push("No Android location permission is declared.");
notes.push("Android digital subscriptions are gated on native Play Billing plus server-side verification.");
notes.push("Privacy and Terms are checked for career-core, billing, and employment-decision alignment.");

console.log("TitanOS Google Play career-core policy gate");
console.log(`targetSdk=${Number.isFinite(targetSdk) ? targetSdk : "unknown"}, compileSdk=${Number.isFinite(compileSdk) ? compileSdk : "unknown"}`);
console.log(`source permissions=${[...declaredPermissions].join(", ") || "none"}`);
for (const note of notes) console.log(`NOTE: ${note}`);

if (failures.length) {
  console.error("\nPOLICY GATE: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("\nDo not bypass this gate. Review product-core justification, user disclosure, Data Safety, billing integrity, and Play declarations before changing the release contract.");
  process.exit(1);
}

console.log("POLICY GATE: PASS");
