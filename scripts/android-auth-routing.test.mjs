import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const authCallbackSource = read("src/pages/AuthCallback.jsx");
const resetPasswordSource = read("src/pages/ResetPassword.jsx");
const capacitorAuthSource = read("src/lib/capacitor-auth.js");
const authRedirectSource = read("src/lib/auth-redirect.js");
const oauthBootstrapSource = read("src/lib/oauthBootstrap.js");
const authSource = read("src/api/auth.js");
const manifestSource = read("android/app/src/main/AndroidManifest.xml");

test("Android OAuth callback keeps HashRouter routing intact", () => {
  assert.match(authCallbackSource, /shouldUseHashRouter/);
  assert.match(authCallbackSource, /#\/auth\/callback/);
  assert.match(
    authCallbackSource,
    /if \(shouldUseHashRouter\(\)\)[\s\S]*replaceState\([\s\S]*#\/auth\/callback[\s\S]*return;[\s\S]*replaceState\([\s\S]*\/auth\/callback/
  );
});

test("Capacitor deep links route login and password recovery separately", () => {
  assert.match(capacitorAuthSource, /pathname\.startsWith\("\/callback"\).*return "\/auth\/callback"/);
  assert.match(capacitorAuthSource, /pathname\.startsWith\("\/reset-password"\).*return "\/reset-password"/);
  assert.match(capacitorAuthSource, /const query = authParamsFromDeepLink\(parsed\)/);
  assert.match(capacitorAuthSource, /window\.location\.hash = `\$\{route\}\$\{query\}`/);
});

test("Native password recovery uses a dedicated reset deep link", () => {
  assert.match(authRedirectSource, /NATIVE_AUTH_CALLBACK = "com\.titanos\.myapp:\/\/auth\/callback"/);
  assert.match(authRedirectSource, /NATIVE_PASSWORD_RESET = "com\.titanos\.myapp:\/\/auth\/reset-password"/);
  assert.match(authRedirectSource, /normalized === "\/reset-password" \? NATIVE_PASSWORD_RESET : NATIVE_AUTH_CALLBACK/);
  assert.match(authRedirectSource, /NATIVE_AUTH_CALLBACK, NATIVE_PASSWORD_RESET/);
});

test("Reset password exchanges the native PKCE code before enabling the form", () => {
  assert.match(resetPasswordSource, /hasPendingOAuthParams\(\)/);
  assert.match(resetPasswordSource, /await completeOAuthFromUrl\(\)/);
  assert.match(resetPasswordSource, /if \(result\.session && !cancelled\)/);
});

test("Consumed native auth credentials are scrubbed from HashRouter history", () => {
  assert.match(oauthBootstrapSource, /const AUTH_PARAM_KEYS = \[/);
  assert.match(oauthBootstrapSource, /const rawHash = \(url\.hash \|\| ""\)\.replace/);
  assert.match(oauthBootstrapSource, /deleteAuthParams\(hashParams\)/);
  assert.match(oauthBootstrapSource, /url\.hash = `#\$\{route\}\$\{remaining \? `\?\$\{remaining\}` : ""\}`/);
});

test("Android registration is not hardwired to the disabled website host", () => {
  assert.doesNotMatch(authSource, /titanos-web\.vercel\.app/);
  assert.match(authSource, /function serverApiBases\(\)/);
  assert.match(authSource, /SERVER_UNAVAILABLE_STATUSES = new Set\(\[402, 404, 408, 502, 503, 504\]\)/);
  assert.match(authSource, /throw apiError\("Registration service unavailable", 503\)/);
  assert.match(authSource, /supabase\.auth\.signUp/);
});

test("Android registration bounds a dead API request before Supabase fallback", () => {
  assert.match(authSource, /SERVER_REGISTER_TIMEOUT_MS = 10_000/);
  assert.match(authSource, /new AbortController\(\)/);
  assert.match(authSource, /controller\.abort\(\)/);
  assert.match(authSource, /Registration service timed out/);
});

test("Android manifest accepts only the TitanOS login and recovery auth paths", () => {
  assert.match(manifestSource, /android:scheme="com\.titanos\.myapp"/);
  assert.match(manifestSource, /android:host="auth"/);
  assert.match(manifestSource, /android:pathPrefix="\/callback"/);
  assert.match(manifestSource, /android:pathPrefix="\/reset-password"/);
});
