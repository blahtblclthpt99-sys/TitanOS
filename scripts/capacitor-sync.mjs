/**
 * Always compile verified, self-contained Android assets before Capacitor sync.
 * Never copy a stale web dist/ into an APK or AAB.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { loadEnv } from "vite";
import { checkAndroidSupabaseEnv, checkAndroidSupabaseBundle } from "./verify-android-supabase-config.mjs";

const env = {
  ...loadEnv("production", process.cwd(), "VITE_"),
  ...process.env,
  VITE_CAPACITOR_BUILD: "true",
};
function fail(errors) {
  for (const error of errors) console.error("[TitanOS Android]", error);
  process.exit(1);
}
const preflight = checkAndroidSupabaseEnv(env);
if (preflight.errors.length) fail(preflight.errors);

function run(command, args) {
  const result = spawnSync(command, args, {
    env,
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) fail([result.error.message]);
  if (result.status !== 0) process.exit(result.status || 1);
}
run("npm", ["run", "build"]);
const bundleErrors = checkAndroidSupabaseBundle("dist", env);
if (bundleErrors.length) fail(bundleErrors);
run("npx", ["cap", "sync", "android"]);
console.log("[TitanOS Android] Validated Supabase credentials are embedded in the synchronized app.");
