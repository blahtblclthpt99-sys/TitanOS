import test from "node:test";
import assert from "node:assert/strict";
import { cleanedOAuthCallbackUrl } from "../src/lib/oauthReturnUrl.js";

test("keeps Capacitor HashRouter callback while removing PKCE credentials", () => {
  assert.equal(cleanedOAuthCallbackUrl("https://titanos.app/#/auth/callback?code=secret&state=once"), "/#/auth/callback");
});

test("cleans implicit fragment tokens and browser search params", () => {
  assert.equal(cleanedOAuthCallbackUrl("https://titanos.app/auth/callback?code=abc&from_url=%2Fdriver#access_token=secret&refresh_token=secret"), "/?from_url=%2Fdriver");
});

test("preserves unrelated query parameters and route state", () => {
  assert.equal(cleanedOAuthCallbackUrl("https://titanos.app/#/auth/callback?code=secret&from_url=%2Fjobs"), "/#/auth/callback?from_url=%2Fjobs");
});

test("does not disturb normal navigation", () => {
  assert.equal(cleanedOAuthCallbackUrl("https://titanos.app/#/driver?day=today"), "/#/driver?day=today");
});

test("scrubs native callback tokens without rewriting asset root", () => {
  assert.equal(cleanedOAuthCallbackUrl("https://titanos.app/index.html#/auth/callback?access_token=a&refresh_token=b"), "/index.html#/auth/callback");
});
