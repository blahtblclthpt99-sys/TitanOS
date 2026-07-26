/**
 * Voice workflow tests — app router + driver parse.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchVoiceCommand, speechSupported } from "../src/lib/voiceCommands.js";
import { parseVoiceCommand } from "../src/lib/driverActivity/voiceCommands.js";

describe("app voice command router", () => {
  it("speechSupported is boolean (false without SpeechRecognition)", () => {
    assert.equal(typeof speechSupported(), "boolean");
    assert.equal(speechSupported(), false);
  });

  it("routes open invoices and settings", () => {
    assert.equal(matchVoiceCommand("open invoices").path, "/invoices");
    assert.equal(matchVoiceCommand("go to settings").path, "/settings");
    assert.equal(matchVoiceCommand(""), null);
  });

  it("unknown phrases fall through to AI assistant", () => {
    const hit = matchVoiceCommand("what is my zeta quotient");
    assert.equal(hit.path, "/assistant");
    assert.equal(hit.askAi, true);
  });
});

describe("driver voice workflows", () => {
  it("parses decide offer intent", () => {
    const cmd = parseVoiceCommand("decide 14.50 4 miles 18 minutes");
    assert.equal(cmd.intent, "decide_offer");
  });
});
