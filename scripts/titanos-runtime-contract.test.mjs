import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertSupabaseProjectConsistency } from "../api/_lib/supabase.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("server and browser Supabase canonical project refs must agree", () => {
  assert.equal(
    assertSupabaseProjectConsistency({
      serverUrl: "https://wbymywwrpbljfbsemung.supabase.co",
      clientUrl: "https://wbymywwrpbljfbsemung.supabase.co/auth/v1",
    }),
    true
  );

  assert.throws(
    () => assertSupabaseProjectConsistency({
      serverUrl: "https://xcfjpxcmokdfwkarwomy.supabase.co",
      clientUrl: "https://wbymywwrpbljfbsemung.supabase.co",
    }),
    /Supabase server\/client project mismatch/
  );

  // Custom domains cannot be mapped to a project ref from hostname alone, so
  // they remain an E2E deployment-verification responsibility.
  assert.equal(
    assertSupabaseProjectConsistency({
      serverUrl: "https://db.example.com",
      clientUrl: "https://db.example.com",
    }),
    true
  );
});

test("TitanOS registration requires durable cross-instance throttling", async () => {
  const registration = await read("api/register.js");
  assert.match(registration, /assertRateLimitAsync/);
  assert.match(registration, /key: "register"/);
  assert.match(registration, /requireDurable: true/);
  assert.doesNotMatch(registration, /import \{ assertRateLimit \} from/);
});

test("production signup generates and delivers an explicit verification OTP", async () => {
  const registration = await read("api/register.js");
  const confirmation = await read("api/_lib/signupConfirmation.js");
  const registerPage = await read("src/pages/Register.jsx");

  assert.match(registration, /createSignupWithConfirmation/);
  assert.match(registration, /verificationMode: "otp"/);
  assert.match(registration, /startsWith\("SIGNUP_"\)/);
  assert.match(registration, /res\.status\(424\)/);
  assert.match(confirmation, /admin\.auth\.admin\.generateLink/);
  assert.match(confirmation, /type: "signup"/);
  assert.match(confirmation, /properties\?\.email_otp/);
  assert.match(confirmation, /\^\\d\{6\}\$/);
  assert.match(confirmation, /"Idempotency-Key": deliveryKey/);
  assert.match(confirmation, /titan_signup_\$\{user\.id\}/);
  assert.match(confirmation, /if \(!delivery\.accepted\)[\s\S]*await deleteGeneratedUser\(admin, user\.id\)/);
  assert.match(registerPage, /result\?\.verificationMode === "otp"/);
  assert.match(registerPage, /setPendingUserId\(result\.user\.id\)/);
  assert.match(registerPage, /setOtpType\("signup"\)/);
  assert.doesNotMatch(registerPage, /setToken\(result\.access_token\)/);
});

test("signup code resend stays product-owned and bound to the pending user", async () => {
  const endpoint = await read("api/resendSignupOtp.js");
  const client = await read("src/lib/signupOtpClient.js");
  const registerPage = await read("src/pages/Register.jsx");

  assert.match(endpoint, /key: "resendSignupOtp"/);
  assert.match(endpoint, /requireDurable: true/);
  assert.match(endpoint, /getUserById\(userId\)/);
  assert.match(endpoint, /normalizedEmail\(user\.email\) !== email/);
  assert.match(endpoint, /user\.email_confirmed_at/);
  assert.match(endpoint, /type: "magiclink"/);
  assert.match(endpoint, /String\(generatedUser\?\.id \|\| ""\) !== userId/);
  assert.match(endpoint, /properties\?\.email_otp/);
  assert.match(endpoint, /properties\?\.hashed_token/);
  assert.match(endpoint, /titan_signup_resend_\$\{userId\}_\$\{hashed\.slice\(0, 32\)\}/);
  assert.match(endpoint, /verificationType: "magiclink"/);
  assert.match(endpoint, /res\.status\(424\)/);

  assert.match(client, /\/api\/resendSignupOtp/);
  assert.match(client, /body\.verificationType !== "magiclink"/);
  assert.match(client, /verificationType === "magiclink" \? "magiclink" : "signup"/);
  assert.match(client, /if \(!\/\^\\d\{6\}\$\/\.test\(token\)\)/);
  assert.match(client, /supabase\.auth\.verifyOtp/);

  assert.match(registerPage, /resendSignupOtp\(\{ email, userId: pendingUserId \}\)/);
  assert.match(registerPage, /setOtpType\(result\.verificationType\)/);
  assert.match(registerPage, /verifySignupOtp\(\{ email, otpCode, verificationType: otpType \}\)/);
});

test("Product Hunt auth CTAs safely return users to Autopilot", async () => {
  const preview = await read("src/pages/AutopilotPublic.jsx");
  const returnTo = await read("src/lib/returnTo.js");

  assert.match(preview, /const AUTOPILOT_RETURN = encodeURIComponent\("\/autopilot"\)/);
  assert.match(preview, /\/register\?from_url=\$\{AUTOPILOT_RETURN\}/);
  assert.match(preview, /\/login\?from_url=\$\{AUTOPILOT_RETURN\}/);
  assert.match(returnTo, /new URLSearchParams\(location\?\.search \|\| window\.location\.search\)\.get\("from_url"\)/);
  assert.match(returnTo, /sanitizeReturnPath\(fromQuery\)/);
});

test("TitanOS quality and Android workflows select the TitanOS Recovery surface", async () => {
  const quality = await read(".github/workflows/attention-build.yml");
  const android = await read(".github/workflows/android-release.yml");

  for (const workflow of [quality, android]) {
    assert.match(workflow, /VITE_APP_SURFACE: "titanos"/);
    assert.match(workflow, /VITE_SUPABASE_URL: "https:\/\/wbymywwrpbljfbsemung\.supabase\.co"/);
  }
  assert.match(quality, /name: TitanOS Product Quality Gate/);
  assert.match(quality, /TITAN_STRIPE_WEBHOOK_PRODUCT: "autopilot"/);
  assert.match(quality, /npm run gate:ship/);
});
