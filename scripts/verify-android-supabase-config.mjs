import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Play builds must never package an empty or privileged Supabase credential.
 * Public sb_publishable_ keys are expected inside the client application.
 */
export function checkAndroidSupabaseEnv(env = process.env) {
  const errors = [];
  const rawUrl = String(env.VITE_SUPABASE_URL || "").trim();
  const url = rawUrl.replace(/\/$/, "");
  const publishable = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  const anon = String(env.VITE_SUPABASE_ANON_KEY || "").trim();
  const key = publishable || anon;

  if (env.VITE_CAPACITOR_BUILD !== "true") {
    errors.push("VITE_CAPACITOR_BUILD must be true for an Android bundle");
  }
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)) {
    errors.push("VITE_SUPABASE_URL must be a real https://<project-ref>.supabase.co URL");
  }
  if (!key || /^(your-|placeholder|undefined|null)/i.test(key)) {
    errors.push("Missing VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY");
  } else if (key.startsWith("sb_secret_") || key.startsWith("sbp_") || key.startsWith("sk_")) {
    errors.push("Never embed a server secret or service-role key in the Android app");
  } else if (!key.startsWith("sb_publishable_")) {
    // Legacy anon JWT is valid, but only when role is truly 'anon'.
    try {
      const parts = key.split(".");
      if (parts.length !== 3) throw new Error("Not a JWT");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload.role !== "anon") throw new Error("Not an anon key");
    } catch {
      errors.push("Supabase key must be sb_publishable_... or a legacy anon JWT");
    }
  }
  if (publishable && anon && publishable !== anon) {
    errors.push("Conflicting Supabase public keys: specify one or use identical aliases");
  }
  // A Play build must use the designated account database, never silently switch.
  const expected = String(env.TITANOS_ANDROID_PROJECT_REF || "").trim();
  if (expected && url && url !== `https://${expected}.supabase.co`) {
    errors.push("Android Supabase URL differs from TITANOS_ANDROID_PROJECT_REF");
  }
  return { errors, url, key };
}

function listJsFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

export function checkAndroidSupabaseBundle(dist = "dist", env = process.env) {
  const result = checkAndroidSupabaseEnv(env);
  if (result.errors.length) return result.errors;
  const files = listJsFiles(path.join(dist, "assets"));
  if (!files.length || !fs.existsSync(path.join(dist, "index.html"))) {
    return ["Android bundle missing dist/index.html or dist/assets/*.js"];
  }
  let foundUrl = false;
  let foundKey = false;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    if (text.includes(result.url)) foundUrl = true;
    if (text.includes(result.key)) foundKey = true;
  }
  return [
    ...(!foundUrl ? ["Compiled Android JavaScript is missing VITE_SUPABASE_URL"] : []),
    ...(!foundKey ? ["Compiled Android JavaScript is missing the Supabase publishable key"] : []),
  ];
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  const mode = process.argv[2] || "--env";
  const failures = mode === "--bundle"
    ? checkAndroidSupabaseBundle(process.argv[3] || "dist")
    : mode === "--env"
      ? checkAndroidSupabaseEnv().errors
      : ["Usage: node scripts/verify-android-supabase-config.mjs --env|--bundle [dist]"];
  if (failures.length) {
    for (const issue of failures) console.error(`[TitanOS Android config] ${issue}`);
    process.exitCode = 1;
  } else {
    // Never print a key. This step is safe for public CI build logs.
    console.log(`[TitanOS Android config] ${mode} verification passed`);
  }
}
