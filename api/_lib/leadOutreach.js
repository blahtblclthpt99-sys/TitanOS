const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function validLeadEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

export function safeLeadText(value, max = 500) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
}

export function escapeEmailHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

export function personalizeOutreach(template, lead) {
  return String(template || "")
    .replaceAll("{{company}}", lead.company || lead.name || "there")
    .replaceAll("{{email}}", lead.email || "");
}

export function extractMailbox(value) {
  const raw = String(value || "").trim();
  const bracketed = raw.match(/<([^>]+)>/);
  return (bracketed?.[1] || raw).trim();
}

export function extractResponsesText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  return (payload?.output || [])
    .flatMap((item) => item?.content || [])
    .filter((item) => item?.type === "output_text")
    .map((item) => item.text || "")
    .join("\n");
}

export function parseWorkerLeads(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end < start) return [];
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
}
