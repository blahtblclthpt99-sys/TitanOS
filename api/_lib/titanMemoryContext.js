import { containsSensitiveMemoryText } from "./memorySafety.js";

const ALLOWED_TYPES = new Set([
  "preference",
  "instruction",
  "project",
  "decision",
  "person",
  "context",
  "vehicle",
  "business",
  "recurring_task",
  "important_date",
  "workflow",
  "learned_preference",
  "fact",
]);

function words(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g) || []
  );
}

function safeData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output = {};
  for (const [key, raw] of Object.entries(value).slice(0, 12)) {
    const name = String(key || "").slice(0, 60);
    if (!name || /password|secret|token|key|credential/i.test(name)) continue;
    if (["string", "number", "boolean"].includes(typeof raw)) {
      if (typeof raw === "string" && containsSensitiveMemoryText(raw)) continue;
      output[name] = typeof raw === "string" ? raw.slice(0, 500) : raw;
    }
  }
  return output;
}

function relevance(memory, queryTerms) {
  const haystack = words(`${memory.type} ${memory.label} ${JSON.stringify(memory.data || {})}`);
  let overlap = 0;
  for (const term of queryTerms) if (haystack.has(term)) overlap += 1;
  const confidence = Math.max(0, Math.min(1, Number(memory.confidence ?? 0.5)));
  const freshness = memory.updated_at ? Math.max(0, 1 - (Date.now() - Date.parse(memory.updated_at)) / 31536000000) : 0;
  return overlap * 10 + confidence * 2 + freshness;
}

/**
 * Load a bounded, user-owned durable memory context.
 * Service-role reads are explicitly scoped by BOTH user_id and created_by_id
 * because service-role access bypasses RLS.
 */
export async function loadTitanMemoryContext(admin, userId, question = "") {
  if (!admin || !userId) return [];

  const { data, error } = await admin
    .from("titan_memory_nodes")
    .select("id,type,label,data,source,confidence,created_at,updated_at")
    .eq("user_id", userId)
    .eq("created_by_id", userId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error || !Array.isArray(data)) return [];

  const queryTerms = words(question);
  return data
    .filter((row) => ALLOWED_TYPES.has(String(row.type || "").toLowerCase()))
    // Defense in depth for legacy/imported records: obvious secrets never enter
    // model context even if they predate current write-time validation.
    .filter((row) => !containsSensitiveMemoryText(row.label))
    .map((row) => ({
      id: String(row.id || ""),
      type: String(row.type || "fact").toLowerCase(),
      label: String(row.label || "").slice(0, 240),
      data: safeData(row.data),
      source: String(row.source || "user_memory").slice(0, 120),
      confidence: Math.max(0, Math.min(1, Number(row.confidence ?? 0.5))),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      classification: "KNOWN",
    }))
    .map((row) => ({ ...row, _score: relevance(row, queryTerms) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 8)
    .map(({ _score, ...row }) => row);
}

export function formatTitanMemoryForPrompt(memories = []) {
  if (!Array.isArray(memories) || memories.length === 0) return "(no relevant durable memories)";
  return memories
    .map((memory, index) => {
      const detail = Object.keys(memory.data || {}).length ? ` data=${JSON.stringify(memory.data)}` : "";
      return `${index + 1}. [${memory.classification}] ${memory.type}: ${memory.label}${detail} | source=${memory.source} | confidence=${memory.confidence} | updated=${memory.updatedAt || "unknown"}`;
    })
    .join("\n");
}
