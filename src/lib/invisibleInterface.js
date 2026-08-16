const MAX_TITLE = 120;
const MAX_TEXT = 500;
const MAX_ITEMS = 12;
const MAX_ACTIONS = 4;
const MAX_FIELDS = 10;
const MAX_OPTIONS = 12;

const TYPES = new Set(["summary", "metrics", "comparison", "checklist", "decision", "form"]);
const ACTION_KINDS = new Set(["navigate", "prompt", "submit_prompt"]);
const FIELD_TYPES = new Set(["text", "textarea", "number", "date", "select", "boolean"]);

function cleanText(value, max = MAX_TEXT) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanPath(value) {
  const path = cleanText(value, 240);
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function cleanFieldName(value) {
  const name = cleanText(value, 50);
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) ? name : null;
}

function cleanOption(option) {
  if (typeof option === "string" || typeof option === "number") {
    const value = cleanText(option, 120);
    return value ? { label: value, value } : null;
  }
  if (!option || typeof option !== "object") return null;
  const label = cleanText(option.label, 120);
  const value = cleanText(option.value ?? option.label, 120);
  return label && value ? { label, value } : null;
}

function cleanField(field) {
  if (!field || typeof field !== "object") return null;
  const name = cleanFieldName(field.name);
  const label = cleanText(field.label, 120);
  const type = cleanText(field.type || "text", 30);
  if (!name || !label || !FIELD_TYPES.has(type)) return null;

  const options = type === "select" && Array.isArray(field.options)
    ? field.options.slice(0, MAX_OPTIONS).map(cleanOption).filter(Boolean)
    : [];
  if (type === "select" && !options.length) return null;

  return {
    name,
    label,
    type,
    required: field.required === true,
    placeholder: cleanText(field.placeholder, 160),
    help: cleanText(field.help, 240),
    defaultValue:
      type === "boolean"
        ? field.defaultValue === true
        : cleanText(field.defaultValue, type === "textarea" ? 500 : 160),
    options,
  };
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

  if (kind === "submit_prompt") {
    const promptTemplate = cleanText(action.promptTemplate || action.prompt, 700);
    return promptTemplate ? { kind, label, promptTemplate } : null;
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
 * fetch URLs, mutation instructions, or direct execution commands. Form
 * submissions are converted into a follow-up Titan AI prompt so the existing
 * intent, confirmation, permission and server-side guardrail path stays in
 * control of any write action.
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
  const fields = type === "form" && Array.isArray(raw.fields)
    ? raw.fields.slice(0, MAX_FIELDS).map(cleanField).filter(Boolean)
    : [];

  if (type === "form" && !fields.length) return null;

  return {
    version: 2,
    type,
    title,
    subtitle: cleanText(raw.subtitle, 240),
    items,
    fields,
    actions,
    provenance: raw.provenance === "server_snapshot" ? "server_snapshot" : "general",
    generatedAt: cleanText(raw.generatedAt, 40) || new Date().toISOString(),
  };
}

export function buildInvisibleInterfacePrompt(action, fields, values) {
  if (!action || action.kind !== "submit_prompt") return null;
  const template = cleanText(action.promptTemplate, 700);
  if (!template) return null;

  const fieldMap = new Map((fields || []).map((field) => [field.name, field]));
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_match, name) => {
    const field = fieldMap.get(name);
    if (!field) return "";
    const rawValue = values?.[name];
    if (field.type === "boolean") return rawValue ? "yes" : "no";
    return cleanText(rawValue, field.type === "textarea" ? 500 : 160);
  });
}

export function validateInvisibleInterfaceForm(fields, values) {
  const errors = {};
  for (const field of fields || []) {
    if (!field.required) continue;
    const value = values?.[field.name];
    const missing = field.type === "boolean" ? value !== true : !cleanText(value, 500);
    if (missing) errors[field.name] = `${field.label} is required.`;
  }
  return errors;
}

export function isInvisibleInterface(value) {
  return Boolean(sanitizeInvisibleInterface(value));
}
