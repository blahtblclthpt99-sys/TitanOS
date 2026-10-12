import test from "node:test";
import assert from "node:assert/strict";
import { nativeAuthCallbackRoute } from "../src/lib/nativeAuthCallback.js";

test("accepts PKCE query code", () => {
  assert.equal(nativeAuthCallbackRoute("com.titanos.myapp://auth/callback?code=PKCE-1&state=S1"), "/auth/callback?code=PKCE-1&state=S1");
});

test("preserves implicit token fragment on Android deep links", () => {
  assert.equal(nativeAuthCallbackRoute("com.titanos.myapp://auth/callback#access_token=one&refresh_token=two&token_type=bearer"), "/auth/callback?access_token=one&refresh_token=two&token_type=bearer");
});

test("rejects wrong scheme, host, malformed callback, or suffix path", () => {
  for (const bad of [
    "https://auth/callback?code=A",
    "com.titanos.myapp://evil/callback?code=A",
    "com.titanos.myapp://auth/callback-evil?code=A",
    "not url",
  ]) assert.equal(nativeAuthCallbackRoute(bad), null);
});

test("drops extraneous untrusted callback parameters", () => {
  assert.equal(nativeAuthCallbackRoute("com.titanos.myapp://auth/callback?code=abc&redirect_to=https://example.com"), "/auth/callback?code=abc");
});

test("keeps error codes for accessible login messaging", () => {
  assert.equal(nativeAuthCallbackRoute("com.titanos.myapp://auth/callback?error=access_denied&error_description=Not+approved"), "/auth/callback?error=access_denied&error_description=Not+approved");
});

test("query parameters take precedence over duplicate hash parameters", () => {
  assert.equal(nativeAuthCallbackRoute("com.titanos.myapp://auth/callback?code=right#code=wrong"), "/auth/callback?code=right");
});
