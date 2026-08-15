import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPortalOtp, portalOtpMatches } from "../api/_lib/portalOtp.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("portal OTP hashing", () => {
  it("hashes and matches", () => {
    const email = "a@example.com";
    const code = "123456";
    const hashed = hashPortalOtp(email, code);
    assert.notEqual(hashed, code);
    assert.equal(portalOtpMatches(hashed, email, code), true);
    assert.equal(portalOtpMatches(hashed, email, "000000"), false);
  });

  it("rejects legacy plaintext by default", () => {
    delete process.env.PORTAL_OTP_ALLOW_LEGACY;
    assert.equal(portalOtpMatches("654321", "b@example.com", "654321"), false);
  });

  it("accepts legacy plaintext when PORTAL_OTP_ALLOW_LEGACY=1", () => {
    process.env.PORTAL_OTP_ALLOW_LEGACY = "1";
    assert.equal(portalOtpMatches("654321", "b@example.com", "654321"), true);
    assert.equal(portalOtpMatches("654321", "b@example.com", "111111"), false);
    delete process.env.PORTAL_OTP_ALLOW_LEGACY;
  });
});

describe("portal token legacy default — secure (Stage-1 hardening C)", () => {
  it("PORTAL_TOKEN_ALLOW_LEGACY source default is '0' (disabled)", () => {
    const src = readFileSync(join(root, "api/_lib/portalToken.js"), "utf8");
    // The old default was || '1' which silently enabled legacy plaintext lookup.
    // Stage-1 hardening changed it to || '0' so the safe path is the default.
    assert.doesNotMatch(src, /PORTAL_TOKEN_ALLOW_LEGACY[^"']*["']1["']/);
    assert.match(src, /PORTAL_TOKEN_ALLOW_LEGACY[^"']*["']0["']/);
  });
});
