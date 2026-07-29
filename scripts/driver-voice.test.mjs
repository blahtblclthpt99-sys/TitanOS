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

  it("parses delivery workflow commands", () => {
    const start = parseVoiceCommand("start delivery double");
    assert.equal(start.intent, "start_delivery");
    assert.equal(start.payload.orderTypeId, "double");

    const add = parseVoiceCommand("add double");
    assert.equal(add.intent, "accept_delivery_addon");
    assert.equal(add.payload.count, 1);

    const acceptTriple = parseVoiceCommand("accept triple stack");
    assert.equal(acceptTriple.intent, "accept_delivery_addon");
    assert.equal(acceptTriple.payload.count, 2);

    assert.equal(parseVoiceCommand("reject order").intent, "reject_delivery_addon");
    assert.equal(parseVoiceCommand("arrived at restaurant").intent, "arrive_restaurant");
    assert.equal(parseVoiceCommand("depart restaurant").intent, "depart_restaurant");
    assert.equal(parseVoiceCommand("arrived customer").intent, "arrive_customer");
    assert.equal(parseVoiceCommand("order delivered").intent, "complete_delivery");
    assert.equal(parseVoiceCommand("cancel delivery").intent, "cancel_delivery");
  });

  it("parses Driver Hub folder and search commands", () => {
    const openHub = parseVoiceCommand("open driver hub");
    assert.equal(openHub.intent, "navigate_hub");

    const analytics = parseVoiceCommand("open analytics");
    assert.equal(analytics.intent, "navigate_hub_folder");
    assert.equal(analytics.payload.folderId, "analytics");

    const tax = parseVoiceCommand("open tax center");
    assert.equal(tax.intent, "navigate_hub_folder");
    assert.equal(tax.payload.folderId, "tax");

    const search = parseVoiceCommand("search hub for order 75201");
    assert.equal(search.intent, "navigate_hub_search");
    assert.equal(search.payload.query, "order 75201");

    const refresh = parseVoiceCommand("refresh driver hub");
    assert.equal(refresh.intent, "refresh_hub");

    const clear = parseVoiceCommand("clear hub search");
    assert.equal(clear.intent, "clear_hub_search");
  });

  it("parses teaching and folder guidance commands", () => {
    const teachDelivery = parseVoiceCommand("teach me delivery");
    assert.equal(teachDelivery.intent, "teach_mode");
    assert.equal(teachDelivery.payload.topic, "delivery");

    const teachHub = parseVoiceCommand("teach me hub navigation");
    assert.equal(teachHub.intent, "teach_mode");
    assert.equal(teachHub.payload.topic, "hub");

    const folderHelp = parseVoiceCommand("what can i do in tax center");
    assert.equal(folderHelp.intent, "hub_folder_help");
    assert.equal(folderHelp.payload.folderId, "tax");

    const next = parseVoiceCommand("what is next");
    assert.equal(next.intent, "what_next");
  });

  it("parses confirmation flow commands", () => {
    assert.equal(parseVoiceCommand("confirm").intent, "confirm_action");
    assert.equal(parseVoiceCommand("go ahead").intent, "confirm_action");
    assert.equal(parseVoiceCommand("never mind").intent, "cancel_action");
    assert.equal(parseVoiceCommand("cancel that").intent, "cancel_action");
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
      breakdown: { hourlyNet: 32.4, perMileGross: 3.1 },
      money: { delta_per_hour: 5 },
      trueCost: { recommended_min_gross_per_mile: 1.85 },
    });
    assert.match(line, /ACCEPT/);
    assert.match(line, /32/);
    assert.match(line, /3\.10|1\.85/);
  });
});
