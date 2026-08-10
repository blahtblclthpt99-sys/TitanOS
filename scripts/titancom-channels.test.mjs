/**
 * TitanCom channel rule unit tests.
 * Run: node --test scripts/titancom-channels.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  endOfLocalDayIso,
  isChannelExpired,
  isChannelAdmin,
} from "../src/lib/titanComRules.js";
import { microphoneErrorMessage } from "../src/lib/titanCommsPtt.js";

describe("TitanCom expiry", () => {
  it("endOfLocalDayIso is later today", () => {
    const iso = endOfLocalDayIso(new Date("2026-07-26T10:00:00"));
    const t = Date.parse(iso);
    assert.ok(Number.isFinite(t));
    assert.ok(t > Date.parse("2026-07-26T10:00:00"));
  });

  it("detects expired channels", () => {
    assert.equal(isChannelExpired({ expires_at: "2020-01-01T00:00:00.000Z" }), true);
    assert.equal(isChannelExpired({ expires_at: null }), false);
    assert.equal(isChannelExpired({}), false);
  });

  it("sole admin is creator only", () => {
    const ch = { created_by_id: "u1", admin_id: "u1", custom: true };
    assert.equal(isChannelAdmin(ch, "u1"), true);
    assert.equal(isChannelAdmin(ch, "u2"), false);
  });
});

describe("TitanCom microphone recovery", () => {
  it("turns browser microphone failures into actionable messages", () => {
    assert.match(microphoneErrorMessage({ name: "NotAllowedError" }), /allow microphone access/i);
    assert.match(microphoneErrorMessage({ name: "NotReadableError" }), /busy in another app/i);
    assert.match(microphoneErrorMessage({ name: "NotFoundError" }), /No microphone/i);
  });
});
