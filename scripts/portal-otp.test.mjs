import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPortalOtp, portalOtpMatches } from "../api/_lib/portalOtp.js";

describe("portal OTP hashing", () => {
  it("hashes and matches", () => {
    const email = "a@example.com";
    const code = "123456";
    const hashed = hashPortalOtp(email, code);
    assert.notEqual(hashed, code);
    assert.equal(portalOtpMatches(hashed, email, code), true);
    assert.equal(portalOtpMatches(hashed, email, "000000"), false);
  });

  it("accepts legacy plaintext during transition", () => {
    assert.equal(portalOtpMatches("654321", "b@example.com", "654321"), true);
    assert.equal(portalOtpMatches("654321", "b@example.com", "111111"), false);
  });
});
