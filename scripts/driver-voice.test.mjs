import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseVoiceCommand,
  spokenNumbersToDigits,
  extractLooseOffer,
  formatDecisionSpeech,
  wordToNumber,
} from "../src/lib/driverActivity/voiceCommands.js";

describe("Driver voice commands", () => {
  it("maps number words", () => {
    assert.equal(wordToNumber("fourteen"), 14);
    assert.equal(wordToNumber("twenty"), 20);
    assert.equal(wordToNumber("twentyone"), 21);
  });

  it("converts spoken money phrases toward digits", () => {
    const s = spokenNumbersToDigits("decide fourteen fifty four miles eighteen minutes");
    assert.match(s, /14\.50|14 50|fourteen/);
    assert.match(s, /4|four/);
  });

  it("parses decide offer intent with miles and minutes", () => {
    const cmd = parseVoiceCommand("decide 14.50 4 miles 18 minutes");
    assert.equal(cmd.intent, "decide_offer");
    assert.ok(cmd.payload.pay >= 14);
    assert.equal(cmd.payload.miles, 4);
    assert.equal(cmd.payload.minutes, 18);
  });

  it("parses slash-style voice offers", () => {
    const cmd = parseVoiceCommand("should I take 12 / 5 / 20");
    assert.equal(cmd.intent, "decide_offer");
    assert.equal(cmd.payload.pay, 12);
    assert.equal(cmd.payload.miles, 5);
    assert.equal(cmd.payload.minutes, 20);
  });

  it("parses driving and profile commands", () => {
    assert.equal(parseVoiceCommand("start driving").intent, "start_driving");
    assert.equal(parseVoiceCommand("end shift").intent, "stop_driving");
    assert.equal(parseVoiceCommand("pause").intent, "pause");
    assert.equal(parseVoiceCommand("max money mode").intent, "set_profile");
    assert.equal(parseVoiceCommand("max money mode").payload.profileId, "balanced");
    assert.equal(parseVoiceCommand("high roller").payload.profileId, "strict");
    assert.equal(parseVoiceCommand("open logbook").intent, "navigate");
    assert.equal(parseVoiceCommand("open logbook").payload.tab, "logbook");
  });

  it("returns help for help requests", () => {
    const cmd = parseVoiceCommand("help what can you do");
    assert.equal(cmd.intent, "help");
    assert.match(cmd.reply, /decide/i);
  });

  it("extracts loose offers from mixed speech", () => {
    const o = extractLooseOffer("offer is 9 dollars for 6 miles in 25 minutes zip 75201");
    assert.equal(o.pay, 9);
    assert.equal(o.miles, 6);
    assert.equal(o.minutes, 25);
    assert.equal(o.zip, "75201");
  });

  it("formats decision speech", () => {
    const line = formatDecisionSpeech({
      verdict: "ACCEPT",
      action: "Take it.",
      breakdown: { hourlyNet: 32.4 },
      money: { delta_per_hour: 5 },
    });
    assert.match(line, /ACCEPT/);
    assert.match(line, /32/);
  });
});
