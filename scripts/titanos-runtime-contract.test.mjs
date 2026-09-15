import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertSupabaseProjectConsistency } from "../api/_lib/supabase.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("server and browser Supabase canonical project refs must agree", () => {
  assert.equal(assertSupabaseProjectConsistency({
    serverUrl: "https://wbymywwrpbljfbsemung.supabase.co",
    clientUrl: "https://wbymywwrpbljfbsemung.supabase.co/auth/v1",
  }), true);
  assert.throws(() => assertSupabaseProjectConsistency({
    serverUrl: "https://xcfjpxcmokdfwkarwomy.supabase.co",
    clientUrl: "https://wbymywwrpbljfbsemung.supabase.co",
  }), /Supabase server\/client project mismatch/);
});

test("registration requires two-way project proof before durable persistence", async () => {
  const registration = await read("api/register.js");
  const authClient = await read("src/api/auth.js");
  assert.match(authClient, /clientProjectRef/);
  assert.match(authClient, /body\.projectRef !== clientProjectRef/);
  assert.match(registration, /AUTH_ENVIRONMENT_MISMATCH/);
  assert.match(registration, /projectRef: serverProjectRef \|\| null/);
  const proof = registration.indexOf("const clientProjectRef =");
  const limiter = registration.indexOf("if (!(await assertRateLimitAsync");
  const admin = registration.indexOf("const admin = getSupabaseAdmin()");
  assert.ok(proof >= 0 && limiter > proof);
  assert.ok(admin > limiter);
});

test("Founding claims require verified auth and tolerate optional schema absence", async () => {
  const gate = await read("supabase/migrations/20260915024500_founding_claim_requires_verified_auth.sql");
  const compatibility = await read("supabase/migrations/20260915025000_founding_claim_optional_schema_guard.sql");
  for (const migration of [gate, compatibility]) {
    assert.match(migration, /to_regclass\('public\.platform_launch'\) IS NULL/);
    assert.match(migration, /founding_unavailable/);
    assert.match(migration, /email_confirmed_at IS NOT NULL OR u\.phone_confirmed_at IS NOT NULL/);
    assert.match(migration, /unverified_user/);
  }
  assert.match(gate, /AFTER UPDATE OF email_confirmed_at, phone_confirmed_at ON auth\.users/);
});

test("registration is durably throttled and cannot bypass protection", async () => {
  const registration = await read("api/register.js");
  const rateLimit = await read("api/_lib/rateLimit.js");
  assert.match(registration, /key: "register"/);
  assert.match(registration, /requireDurable: true/);
  assert.match(registration, /durableUnavailableStatus: 424/);
  assert.match(rateLimit, /opts\.durableUnavailableStatus/);
});

test("production signup has one authoritative server path", async () => {
  const authClient = await read("src/api/auth.js");
  const prodGuard = authClient.indexOf("if (!import.meta.env.DEV)");
  const directSignup = authClient.indexOf("supabase.auth.signUp");
  assert.ok(prodGuard >= 0 && directSignup > prodGuard);
  assert.match(authClient, /Signup service is temporarily unavailable/);
  assert.match(authClient, /source: "supabase_fallback_dev"/);
  assert.doesNotMatch(authClient, /source: "supabase_fallback"/);
});

test("registration avoids strong account enumeration and pre-verification claims", async () => {
  const registration = await read("api/register.js");
  assert.match(registration, /ACCOUNT_UNAVAILABLE/);
  assert.doesNotMatch(registration, /An account with this email already exists/);
  assert.match(registration, /if \(createdUser\?\.id && !requireConfirm\)/);
});

test("signup OTP delivery preserves ambiguity instead of invalidating a possibly delivered code", async () => {
  const confirmation = await read("api/_lib/signupConfirmation.js");
  const registration = await read("api/register.js");
  const page = await read("src/pages/Register.jsx");

  assert.match(confirmation, /ambiguousProviderResponse/);
  assert.match(confirmation, /delivery: "accepted"/);
  assert.match(confirmation, /delivery: "uncertain"/);
  assert.match(confirmation, /delivery: "rejected"/);
  assert.match(confirmation, /if \(!delivery\.accepted && delivery\.definitive\)/);
  assert.match(confirmation, /delivery: delivery\.accepted \? "accepted" : "uncertain"/);

  const definitiveBranch = confirmation.indexOf("if (!delivery.accepted && delivery.definitive)");
  const cleanup = confirmation.indexOf("deleteGeneratedUser(admin, user.id)");
  const deliveryReturn = confirmation.indexOf('delivery: delivery.accepted ? "accepted" : "uncertain"');
  assert.ok(definitiveBranch >= 0 && cleanup > definitiveBranch && cleanup < deliveryReturn);

  assert.match(registration, /verificationDelivery/);
  assert.match(page, /setOtpDeliveryStatus/);
  assert.match(page, /couldn't confirm whether the verification email was delivered/i);
  assert.match(page, /If a code arrives, it is still valid/i);
});

test("abandoned unconfirmed signup is recoverable only after password proof", async () => {
  const registration = await read("api/register.js");
  const confirmation = await read("api/_lib/signupConfirmation.js");
  assert.match(registration, /signInWithPassword\(\{ email, password \}\)/);
  assert.match(registration, /if \(!isEmailNotConfirmed\(error\)\) return null/);
  assert.match(registration, /sendExistingSignupOtp/);
  assert.match(confirmation, /type: "magiclink"/);
});

test("signup resend is product-owned, project-bound, and ambiguity-safe", async () => {
  const endpoint = await read("api/resendSignupOtp.js");
  const client = await read("src/lib/signupOtpClient.js");
  const page = await read("src/pages/Register.jsx");
  assert.match(endpoint, /requireDurable: true/);
  assert.match(endpoint, /durableUnavailableStatus: 424/);
  assert.match(endpoint, /AUTH_ENVIRONMENT_MISMATCH/);
  assert.match(endpoint, /expectedUserId: userId/);
  assert.match(endpoint, /delivery: generated\.delivery/);
  assert.match(client, /clientProjectRef && body\.projectRef !== clientProjectRef/);
  assert.match(client, /\["accepted", "uncertain"\]\.includes\(body\.delivery\)/);
  assert.doesNotMatch(client, /for \(const base of/);
  assert.match(page, /setOtpType\(result\.verificationType\)/);
  assert.match(page, /setOtpDeliveryStatus\(result\.deliveryStatus\)/);
  assert.match(page, /setOtpCode\(""\)/);
  assert.match(page, /couldn't confirm provider delivery/i);
});

test("Product Hunt auth CTAs safely return users to Autopilot", async () => {
  const preview = await read("src/pages/AutopilotPublic.jsx");
  const returnTo = await read("src/lib/returnTo.js");
  assert.match(preview, /AUTOPILOT_RETURN = encodeURIComponent\("\/autopilot"\)/);
  assert.match(preview, /\/register\?from_url=\$\{AUTOPILOT_RETURN\}/);
  assert.match(preview, /\/login\?from_url=\$\{AUTOPILOT_RETURN\}/);
  assert.match(returnTo, /sanitizeReturnPath/);
});

test("preview and recognized Titan hosts keep function writes on the current deployment first", async () => {
  const functions = await read("src/api/functions.js");
  assert.match(functions, /isRecognizedSameOriginHost/);
  assert.match(functions, /hostname\.endsWith\("\.vercel\.app"\)/);
  assert.match(functions, /urls\.push\(`\$\{origin\}\$\{path\}`\)/);
  const sameOriginPush = functions.indexOf("urls.push(`${origin}${path}`)");
  const configuredBase = functions.indexOf("const base = functionsBaseUrl()");
  assert.ok(sameOriginPush >= 0 && configuredBase > sameOriginPush);
  assert.match(functions, /if \(isClientRejection\(lastError\)\) break/);
  assert.match(functions, /runAutopilotFree/);
  assert.match(functions, /Nothing was sent/);
});

test("production env template documents every free Autopilot runtime dependency", async () => {
  const env = await read(".env.production.example");
  assert.match(env, /^VITE_APP_SURFACE=titanos$/m);
  assert.match(env, /^VITE_SUPABASE_URL=https:\/\/YOUR_PROJECT\.supabase\.co$/m);
  assert.match(env, /^SUPABASE_URL=https:\/\/YOUR_PROJECT\.supabase\.co$/m);
  assert.match(env, /^SUPABASE_SERVICE_ROLE_KEY=/m);
  assert.match(env, /^RESEND_API_KEY=/m);
  assert.match(env, /^RESEND_FROM=/m);
  assert.match(env, /^REGISTER_REQUIRE_EMAIL_CONFIRM=true$/m);
  assert.match(env, /same canonical project/i);
  assert.match(env, /Autopilot is free/i);
  assert.doesNotMatch(env, /^VITE_AUTOPILOT_.*(?:PRICE|CHECKOUT|PAID)/m);
});

test("Autopilot readiness probe is secret-safe and verifies live schema connectivity", async () => {
  const health = await read("api/functions/autopilotHealth.js");
  assert.match(health, /req\.method !== "GET"/);
  assert.match(health, /assertSupabaseProjectConsistency/);
  assert.match(health, /getSupabaseAdmin/);
  assert.match(health, /async function probeTable/);
  assert.match(health, /"autopilot_runs"/);
  assert.match(health, /"follow_up_queue"/);
  assert.match(health, /"invoices"/);
  assert.match(health, /"autopilot_invoice_delivery_guards"/);
  assert.match(health, /databaseReachable/);
  assert.match(health, /supabaseServiceRole/);
  assert.match(health, /resendApiKey/);
  assert.match(health, /resendFrom/);
  assert.match(health, /Object\.values\(checks\)\.every\(Boolean\)/);
  assert.match(health, /status\(ready \? 200 : 503\)/);
  assert.match(health, /mode: "free"/);
  assert.match(health, /Cache-Control", "no-store"/);
  assert.doesNotMatch(health, /SUPABASE_SERVICE_ROLE_KEY\s*:/);
  assert.doesNotMatch(health, /RESEND_API_KEY\s*:/);
});

test("TitanOS quality and Android workflows select Recovery Staging without Autopilot Stripe scope", async () => {
  const quality = await read(".github/workflows/attention-build.yml");
  const android = await read(".github/workflows/android-release.yml");
  for (const workflow of [quality, android]) {
    assert.match(workflow, /VITE_APP_SURFACE: "titanos"/);
    assert.match(workflow, /wbymywwrpbljfbsemung\.supabase\.co/);
  }
  assert.match(quality, /name: TitanOS Product Quality Gate/);
  assert.match(quality, /npm run gate:ship/);
  assert.doesNotMatch(quality, /TITAN_STRIPE_WEBHOOK_PRODUCT/);
});
