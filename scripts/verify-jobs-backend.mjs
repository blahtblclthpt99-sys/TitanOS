/**
 * Hard blocker against accidentally configuring the TitanOS career app
 * against the unrelated Titan Attention database or unverified recovery data.
 *
 * --auto: check configured backends and enforce release rules on Vercel production
 * --internal: require the isolated recovery staging project; never publish
 * --production: require a separately confirmed real-user backend and migration gate
 */
const ATTENTION_PROJECT = "xcfjpxcmokdfwkarwomy";
const RECOVERY_STAGING_PROJECT = "wbymywwrpbljfbsemung";
const mode = process.argv.includes("--internal") ? "internal" :
  process.argv.includes("--production") ? "production" :
  process.env.VERCEL_ENV === "production" ? "production" : "auto";
const rawUrl = String(process.env.VITE_SUPABASE_URL || "").trim();

function reject(reason) {
  console.error(`[TitanOS Jobs backend gate] BLOCKED: ${reason}`);
  process.exitCode = 1;
}

if (!rawUrl) {
  if (mode !== "auto") reject("VITE_SUPABASE_URL is required for Android and production builds.");
  else console.log("[TitanOS Jobs backend gate] No backend configured in this non-production build. Runtime login remains unverified.");
} else {
  let projectRef = "";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" || !/^[a-z0-9]+\.supabase\.co$/.test(parsed.hostname)) {
      throw new Error("expected an HTTPS Supabase project URL");
    }
    projectRef = parsed.hostname.split(".")[0];
  } catch {
    reject("VITE_SUPABASE_URL must be a valid HTTPS Supabase project URL.");
  }

  if (projectRef === ATTENTION_PROJECT) {
    reject("The connected project contains the advertising product, not TitanOS Jobs. Login is unsafe here.");
  }
  if (mode === "internal" && projectRef !== RECOVERY_STAGING_PROJECT) {
    reject("Internal builds must target explicitly identified TitanOS Recovery Staging only.");
  }
  if (mode === "production") {
    if (projectRef === RECOVERY_STAGING_PROJECT) reject("Recovery Staging has no original user accounts and cannot serve as production.");
    if (process.env.TITANOS_AUTH_MIGRATION_VERIFIED !== "true") {
      reject("Set TITANOS_AUTH_MIGRATION_VERIFIED=true only after confirming existing-user account continuity and authorization.");
    }
  }
  if (!process.env.VITE_SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    if (mode === "auto") console.warn("[TitanOS Jobs backend gate] Supabase key missing: login will not work in this build.");
    else reject("A public Supabase publishable/anon key is required.");
  }
}
