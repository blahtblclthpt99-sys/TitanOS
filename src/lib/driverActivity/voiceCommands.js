/**
 * Driver voice commands — hands-free ACCEPT/DENY and Titan Hub actions.
 * Uses Web Speech API in the browser; parsing is pure/testable.
 * Cannot auto-tap Uber/DoorDash (ToS); speaks the decision so you tap.
 */

import { parseOfferQuickText } from "./autopilot.js";

const ONES = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/** Convert spoken money/number phrases → digits where possible. */
export function spokenNumbersToDigits(text = "") {
  let s = ` ${String(text || "").toLowerCase()} `;
  s = s.replace(/(\d)\s+point\s+(\d+)/g, "$1.$2");
  s = s.replace(/\bdollars?\b/g, " dollars ");
  s = s.replace(/\bbucks?\b/g, " dollars ");

  // "fourteen fifty" / "fourteen dollar fifty" → 14.50
  s = s.replace(
    /\b(fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|[a-z]+)\s+(?:dollars?\s+)?(fifty|twenty|thirty|forty|sixty|seventy|eighty|ninety|[0-9]{1,2})\b/gi,
    (full, a, b) => {
      const whole = wordToNumber(a);
      const frac = wordToNumber(b);
      if (whole == null) return full;
      if (frac != null && frac < 100) {
        const cents = frac < 10 ? frac * 10 : frac;
        return ` ${whole}.${String(cents).padStart(2, "0")} `;
      }
      return full;
    }
  );

  // Replace remaining number words (simple)
  const tokens = s.split(/(\s+)/);
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\s+$/.test(t)) {
      out.push(t);
      continue;
    }
    const n = wordToNumber(t);
    out.push(n != null ? String(n) : t);
  }
  return out.join("").replace(/\s+/g, " ").trim();
}

export function wordToNumber(word = "") {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return null;
  if (ONES[w] != null) return ONES[w];
  if (TENS[w] != null) return TENS[w];
  // twenty-one style already split; handle "twentyone"
  for (const [t, tv] of Object.entries(TENS)) {
    if (w.startsWith(t)) {
      const rest = w.slice(t.length);
      if (!rest) return tv;
      if (ONES[rest] != null) return tv + ONES[rest];
    }
  }
  return null;
}

function normalizeUtterance(raw = "") {
  return spokenNumbersToDigits(
    String(raw || "")
      .toLowerCase()
      .replace(/[^\w\s.$%/]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Parse a voice utterance into a command intent.
 * @returns {{ intent: string, payload?: object, reply?: string }}
 */
export function parseVoiceCommand(utterance = "") {
  const text = normalizeUtterance(utterance);
  if (!text) return { intent: "empty", reply: "I didn’t catch that. Try again." };

  // Help
  if (/\b(help|what can you|commands|what do you)\b/.test(text)) {
    return {
      intent: "help",
      reply:
        "Say: decide fourteen fifty, four miles, eighteen minutes. Or: start driving, pause, resume, end shift, max money mode, keep busy, high roller, open logbook, open intelligence, read timers, repeat decision.",
    };
  }

  // Autopilot on/off
  if (/\b(turn on|enable|start)\b.*\b(autopilot|voice|money mode|set and forget)\b/.test(text) ||
      /\b(autopilot|money mode|set and forget)\b.*\b(on)\b/.test(text)) {
    return { intent: "autopilot_on", reply: "Money autopilot on. Say an offer when you’re ready." };
  }
  if (/\b(turn off|disable|stop)\b.*\b(autopilot|voice|money mode|set and forget)\b/.test(text) ||
      /\b(autopilot|money mode)\b.*\b(off)\b/.test(text)) {
    return { intent: "autopilot_off", reply: "Money autopilot off." };
  }

  // Profiles
  if (/\b(max money|maximum money|balanced)\b/.test(text)) {
    return { intent: "set_profile", payload: { profileId: "balanced" }, reply: "Max money mode. Protecting your hourly." };
  }
  if (/\b(high roller|strict|peak only)\b/.test(text)) {
    return { intent: "set_profile", payload: { profileId: "strict" }, reply: "High roller mode. Only clear winners." };
  }
  if (/\b(keep busy|chill|volume)\b/.test(text)) {
    return { intent: "set_profile", payload: { profileId: "chill" }, reply: "Keep busy mode. Still skipping money losers." };
  }

  // Driving session
  if (/\b(start|begin)\b.*\b(driv|shift|session|tracking)\b/.test(text) || /\bstart driving\b/.test(text)) {
    return { intent: "start_driving", reply: "Starting your drive session." };
  }
  if (/\b(end|stop|finish)\b.*\b(driv|shift|session|tracking)\b/.test(text) || /\bend shift\b/.test(text)) {
    return { intent: "stop_driving", reply: "Ending your drive session." };
  }
  if (/\bpause\b/.test(text)) {
    return { intent: "pause", reply: "Pausing tracking." };
  }
  if (/\bresume\b/.test(text)) {
    return { intent: "resume", reply: "Resuming tracking." };
  }

  // Navigation
  if (/\b(open|go to|show)\b.*\blogbook\b/.test(text) || /\blogbook\b/.test(text) && /\bopen\b/.test(text)) {
    return { intent: "navigate", payload: { tab: "logbook" }, reply: "Opening logbook." };
  }
  if (/\b(open|go to|show)\b.*\b(intel|intelligence|coach)\b/.test(text)) {
    return { intent: "navigate", payload: { tab: "intel" }, reply: "Opening intelligence." };
  }
  if (/\b(open|go to|show)\b.*\b(shift|driving)\b/.test(text)) {
    return { intent: "navigate", payload: { tab: "shift" }, reply: "Opening shift." };
  }
  if (/\b(open|go to|show)\b.*\b(find|directory|drivers)\b/.test(text)) {
    return { intent: "navigate", payload: { tab: "directory" }, reply: "Opening find drivers." };
  }
  if (/\b(open|go to)\b.*\bcomms\b/.test(text) || /\btitan ?comms\b/.test(text)) {
    return { intent: "navigate_path", payload: { path: "/comms" }, reply: "Opening TitanComms." };
  }

  // Status / timers
  if (/\b(read|say|what('?s| is)|how long)\b.*\b(timer|time|status|idle|drive)\b/.test(text) ||
      /\b(status|timers?)\b/.test(text)) {
    return { intent: "read_status", reply: null };
  }

  // Repeat
  if (/\b(repeat|say again|what was|last decision)\b/.test(text)) {
    return { intent: "repeat_decision", reply: null };
  }

  // Export
  if (/\b(export|download)\b.*\b(excel|spreadsheet|report|csv)\b/.test(text)) {
    return { intent: "export_report", reply: "Open logbook and download your Excel report — I can’t force the download from voice alone." };
  }

  // Decide offer — explicit verbs or offer-shaped utterances
  const wantsDecide =
    /\b(decide|should i (take|accept)|accept or deny|run (the )?formula|check (this )?offer|analyze|score)\b/.test(
      text
    ) ||
    (/\b(mile|miles|min|minute|minutes|dollar|dollars|bucks)\b/.test(text) &&
      /\d/.test(text));

  if (wantsDecide) {
    // Normalize "4 miles" style already; also "for miles" mishears → try digits
    let offerText = text
      .replace(/\b(decide|should i take|should i accept|accept or deny|check offer|analyze|score)\b/g, " ")
      .replace(/\bstack(?:ed)?(?: of)? (\d+)\b/g, " stack $1 ")
      .replace(/\bsame restaurant\b/g, " ")
      .trim();

    // "14 50" or "14.50" ; ensure miles/minutes keywords survive
    const parsed = parseOfferQuickText(offerText) || extractLooseOffer(offerText);
    if (parsed && (parsed.pay > 0 || (parsed.miles > 0 && parsed.minutes > 0))) {
      const same = /\bsame restaurant\b/.test(text);
      return {
        intent: "decide_offer",
        payload: { ...parsed, same_restaurant: same },
        reply: null, // filled after decision
      };
    }
    return {
      intent: "clarify_offer",
      reply:
        "Say pay, miles, and minutes — like: decide twelve dollars, five miles, twenty minutes.",
    };
  }

  // Freeform "do anything" — try offer parse anyway
  const loose = extractLooseOffer(text);
  if (loose && loose.pay > 0 && loose.miles > 0) {
    return { intent: "decide_offer", payload: loose, reply: null };
  }

  return {
    intent: "unknown",
    reply:
      "I can decide offers, start or end driving, pause, change money mode, open logbook or intelligence, and read timers. Say help for examples.",
  };
}

/** Pull pay / miles / minutes from mixed speech when keywords are messy. */
export function extractLooseOffer(text = "") {
  const s = normalizeUtterance(text);
  const nums = [...s.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (!nums.length) return null;

  const milesM = s.match(/(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/);
  const minM = s.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)\b/);
  const zipM = s.match(/\b(\d{5})\b/);
  const stackM = s.match(/(?:stack|orders?)\s*(\d)/);

  let pay = nums[0];
  let miles = milesM ? Number(milesM[1]) : nums[1] ?? 0;
  let minutes = minM ? Number(minM[1]) : nums[2] ?? 0;

  // If only three bare numbers: pay / miles / minutes
  if (!milesM && !minM && nums.length >= 3) {
    pay = nums[0];
    miles = nums[1];
    minutes = nums[2];
  }

  return {
    pay,
    tip: 0,
    miles,
    minutes,
    zip: zipM?.[1] || "",
    stack_count: stackM ? Number(stackM[1]) : 1,
  };
}

/** Speak text via Web Speech Synthesis. */
export function speakText(text, { cancel = true } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return false;
  if (cancel) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text));
  u.rate = 1.05;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
  return true;
}

export function formatDecisionSpeech(decision) {
  if (!decision) return "No decision yet.";
  const v = decision.verdict;
  const money = decision.money;
  const net = decision.breakdown?.hourlyNet;
  let line = `${v}. ${decision.action || ""}`;
  if (net != null) line += ` About ${Math.round(net)} dollars per hour net.`;
  if (money?.delta_per_hour != null && money.delta_per_hour !== 0) {
    line +=
      money.delta_per_hour > 0
        ? ` That's ${Math.abs(Math.round(money.delta_per_hour))} above your usual.`
        : ` That's ${Math.abs(Math.round(money.delta_per_hour))} below your usual.`;
  }
  return line.replace(/\s+/g, " ").trim();
}

export function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isVoiceSupported() {
  return Boolean(getSpeechRecognitionCtor()) && typeof window !== "undefined" && !!window.speechSynthesis;
}
