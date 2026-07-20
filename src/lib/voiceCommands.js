/**
 * Map spoken phrases to TitanOS routes / quick actions.
 * Returns { path, label } or null.
 */
const RULES = [
  { re: /command center|dashboard|home/i, path: "/", label: "Open Command Center" },
  { re: /new job|create job|schedule (a )?job/i, path: "/jobs?new=1", label: "Create job" },
  { re: /\bjobs?\b/i, path: "/jobs", label: "Open Jobs" },
  { re: /invoice|who owes|unpaid/i, path: "/invoices", label: "Open Invoices" },
  { re: /estimate|quote/i, path: "/estimates?new=1", label: "Create estimate" },
  { re: /customer|client/i, path: "/customers", label: "Open Customers" },
  { re: /schedule|calendar/i, path: "/schedule", label: "Open Schedule" },
  { re: /payment|get paid|stripe/i, path: "/payments", label: "Open Payments" },
  { re: /marketplace|market/i, path: "/marketplace", label: "Open Marketplace" },
  { re: /assistant|titan ai|ask ai/i, path: "/assistant", label: "Open AI Assistant" },
  { re: /titan score|credit score|score/i, path: "/titan-score", label: "Open Titan Score" },
  { re: /marketing|facebook|instagram/i, path: "/marketing", label: "Open Marketing Studio" },
  { re: /driver|uber|doordash|delivery|rideshare/i, path: "/driver", label: "Open Driver Hub" },
  { re: /emergency|same.?day/i, path: "/emergency", label: "Open Emergency Jobs" },
  { re: /escrow|job hold|payment protection/i, path: "/escrow", label: "Open Job Holds" },
  { re: /route|directions/i, path: "/routes", label: "Open Route Planner" },
  { re: /tax|1099|mileage/i, path: "/tax-center", label: "Open Tax Center" },
  { re: /settings|profile/i, path: "/settings", label: "Open Settings" },
];

export function matchVoiceCommand(transcript) {
  const text = String(transcript || "").trim();
  if (!text) return null;
  for (const rule of RULES) {
    if (rule.re.test(text)) return { path: rule.path, label: rule.label, transcript: text };
  }
  return { path: "/assistant", label: `Ask AI: “${text}”`, transcript: text, askAi: true };
}

export function speechSupported() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
