import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

function hmac(secret, value) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createUnsubscribeToken({ leadId, ownerId, email }, secret) {
  if (!secret || !leadId || !ownerId || !validLeadEmail(email)) throw new Error("Invalid unsubscribe token input");
  const payload = Buffer.from(JSON.stringify({ v: 1, leadId, ownerId, email: email.trim().toLowerCase() })).toString("base64url");
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifyUnsubscribeToken(token, secret) {
  if (!secret || typeof token !== "string" || token.length > 2048) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = hmac(secret, payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (value?.v !== 1 || !value.leadId || !value.ownerId || !validLeadEmail(value.email)) return null;
    return { ...value, email: value.email.trim().toLowerCase() };
  } catch {
    return null;
  }
}

export function outreachIdempotencyKey(leadId, subject) {
  const campaign = createHash("sha256").update(String(subject || "")).digest("hex").slice(0, 20);
  return `titan-outreach/${leadId}/${campaign}`;
}

export function verifyResendWebhook({ id, timestamp, signature, payload }, secret, now = Date.now()) {
  if (!secret || !id || !timestamp || !signature || typeof payload !== "string") return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds * 1000) > 5 * 60_000) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return String(signature).split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const actualBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
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
