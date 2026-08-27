import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
const variablesPath = path.join(root, "android", "variables.gradle");
const capacitorPath = path.join(root, "capacitor.config.json");

function readRequired(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Required release file is missing: ${path.relative(root, file)}`);
  }
  return fs.readFileSync(file, "utf8");
}

const manifest = readRequired(manifestPath);
const variables = readRequired(variablesPath);
const capacitor = JSON.parse(readRequired(capacitorPath));

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

// Career-core Android intentionally keeps the source manifest at minimum scope.
// Any expansion must be explicitly reviewed against Play policy before it can ship.
const allowedSourcePermissions = new Set([
  "android.permission.INTERNET",
  "android.permission.ACCESS_COARSE_LOCATION",
]);

for (const permission of declaredPermissions) {
  if (!allowedSourcePermissions.has(permission)) {
    failures.push(`Unreviewed Android permission in career-core manifest: ${permission}`);
  }
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

if (manifest.includes("android:allowBackup=\"true\"") || manifest.includes("android:allowBackup='true'")) {
  failures.push("android:allowBackup must remain false for the TitanOS career-core release.");
}

if (capacitor.appId !== "com.titanos.myapp") failures.push(`Unexpected Capacitor appId: ${capacitor.appId || "missing"}`);
if (capacitor.appName !== "TitanOS") failures.push(`Unexpected Capacitor appName: ${capacitor.appName || "missing"}`);
if (capacitor.server?.androidScheme !== "https") failures.push("Capacitor Android scheme must remain HTTPS.");

if (!declaredPermissions.has("android.permission.INTERNET")) failures.push("INTERNET permission is required for TitanOS network functionality.");
if (declaredPermissions.has("android.permission.ACCESS_COARSE_LOCATION")) {
  notes.push("Approximate foreground location is declared for user-initiated nearby-work/location features.");
} else {
  notes.push("No Android location permission is declared.");
}

console.log("TitanOS Google Play career-core policy gate");
console.log(`targetSdk=${Number.isFinite(targetSdk) ? targetSdk : "unknown"}, compileSdk=${Number.isFinite(compileSdk) ? compileSdk : "unknown"}`);
console.log(`source permissions=${[...declaredPermissions].join(", ") || "none"}`);
for (const note of notes) console.log(`NOTE: ${note}`);

if (failures.length) {
  console.error("\nPOLICY GATE: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("\nDo not bypass this gate. Review the capability, product-core justification, user disclosure, Data Safety entry, and Play declaration before changing the allowlist.");
  process.exit(1);
}

console.log("POLICY GATE: PASS");
