const MAX_TITLE = 120;
const MAX_TEXT = 500;
const MAX_ITEMS = 12;
const MAX_ACTIONS = 4;

const TYPES = new Set(["summary", "metrics", "comparison", "checklist", "decision"]);
const ACTION_KINDS = new Set(["navigate", "prompt"]);

function cleanText(value, max = MAX_TEXT) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanPath(value) {
  const path = cleanText(value, 240);
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function cleanAction(action) {
  if (!action || typeof action !== "object") return null;
  const kind = cleanText(action.kind, 30);
  if (!ACTION_KINDS.has(kind)) return null;
  const label = cleanText(action.label, 80);
  if (!label) return null;

  if (kind === "navigate") {
    const path = cleanPath(action.path);
    return path ? { kind, label, path } : null;
  }

  const prompt = cleanText(action.prompt, 500);
  return prompt ? { kind, label, prompt } : null;
}

function cleanItem(item) {
  if (!item || typeof item !== "object") return null;
  const label = cleanText(item.label, 120);
  if (!label) return null;
  return {
    label,
    value: cleanText(item.value, 200),
    detail: cleanText(item.detail, 300),
    status: ["info", "success", "warning", "danger"].includes(item.status) ? item.status : "info",
  };
}

/**
 * Invisible Interface is intentionally data-only. It cannot carry HTML, code,
 * fetch URLs, mutation instructions, or direct execution commands.
 */
export function sanitizeInvisibleInterface(raw) {
  if (!raw || typeof raw !== "object") return null;
  const type = cleanText(raw.type, 30);
  if (!TYPES.has(type)) return null;

  const title = cleanText(raw.title, MAX_TITLE);
  if (!title) return null;

  const items = Array.isArray(raw.items)
    ? raw.items.slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean)
    : [];
  const actions = Array.isArray(raw.actions)
    ? raw.actions.slice(0, MAX_ACTIONS).map(cleanAction).filter(Boolean)
    : [];

  return {
    version: 1,
    type,
    title,
    subtitle: cleanText(raw.subtitle, 240),
    items,
    actions,
    provenance: raw.provenance === "server_snapshot" ? "server_snapshot" : "general",
    generatedAt: cleanText(raw.generatedAt, 40) || new Date().toISOString(),
  };
}

export function isInvisibleInterface(value) {
  return Boolean(sanitizeInvisibleInterface(value));
}
