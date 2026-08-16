const MEMORY_TYPES = new Set([
  "fact",
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
]);

function cleanText(value, max = 2000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeMemoryType(value) {
  const type = cleanText(value, 40).toLowerCase();
  return MEMORY_TYPES.has(type) ? type : "fact";
}

export function detectSecondMeMemoryIntent(question) {
  const raw = cleanText(question, 4000);
  const q = raw.toLowerCase();

  const remember = raw.match(/^remember\s+this\s+as\s+a\s+([a-z_]+)\s*:\s*(.+?)[.]?$/i);
  if (remember) {
    const type = normalizeMemoryType(remember[1]);
    const label = cleanText(remember[2], 500);
    if (!label) return null;
    return {
      type: "confirm",
      intent: "remember_memory",
      confirmationSummary: `Remember this ${type}?`,
      confirmationDetails: [`Type: ${type}`, `Memory: ${label}`],
      params: { type, label, source: "second_me_user" },
    };
  }

  const directRemember = raw.match(/^remember\s+(?:this|that)\s*[:,-]?\s*(.+)$/i);
  if (directRemember && !/remember something/i.test(q)) {
    const label = cleanText(directRemember[1], 500);
    if (!label) return null;
    return {
      type: "confirm",
      intent: "remember_memory",
      confirmationSummary: "Save this to 2nd Me memory?",
      confirmationDetails: [`Memory: ${label}`],
      params: { type: "fact", label, source: "second_me_user" },
    };
  }

  const rule = raw.match(/^from\s+now\s+on\s*,?\s*(.+)$/i);
  if (rule) {
    const label = cleanText(rule[1], 800);
    if (!label) return null;
    return {
      type: "confirm",
      intent: "create_memory_rule",
      confirmationSummary: "Save this From now on rule?",
      confirmationDetails: [`Rule: ${label}`, "Stored as a persistent 2nd Me workflow rule"],
      params: { type: "workflow", label, source: "second_me_rule" },
    };
  }

  return null;
}

export async function executeSecondMeMemoryAction(admin, user, intent, params = {}) {
  if (intent !== "remember_memory" && intent !== "create_memory_rule") return null;

  const label = cleanText(params.label || params.memory || params.rule, 1000);
  if (!label) {
    const err = new Error("Memory content is required.");
    err.status = 400;
    throw err;
  }

  const type = intent === "create_memory_rule" ? "workflow" : normalizeMemoryType(params.type);
  const source = intent === "create_memory_rule" ? "second_me_rule" : "second_me_user";
  const row = {
    user_id: user.id,
    created_by_id: user.id,
    type,
    label,
    data: {
      text: label,
      intent,
      origin: source,
      active: true,
    },
    source,
    confidence: 1,
    archived: false,
  };

  const { data, error } = await admin
    .from("titan_memory_nodes")
    .insert(row)
    .select("id,type,label")
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    const err = new Error("Memory write did not return a saved record.");
    err.status = 500;
    throw err;
  }

  return {
    type: "done",
    message:
      intent === "create_memory_rule"
        ? `Saved From now on rule: **${data.label}**.`
        : `Saved to 2nd Me memory: **${data.label}**.`,
    entity: "Memory",
    id: data.id,
    path: "/assistant",
    rollback: { kind: "delete", entity: "Memory", id: data.id },
  };
}

export async function rollbackSecondMeMemoryAction(admin, user, rollbackAction = {}) {
  const id = cleanText(rollbackAction.id, 80);
  if (rollbackAction.kind !== "delete" || rollbackAction.entity !== "Memory" || !id) {
    const err = new Error("Memory rollback payload is invalid.");
    err.status = 400;
    throw err;
  }

  const { data: found, error: readError } = await admin
    .from("titan_memory_nodes")
    .select("id,created_by_id")
    .eq("id", id)
    .eq("created_by_id", user.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!found) {
    const err = new Error("Memory not found or not owned by you.");
    err.status = 403;
    throw err;
  }

  const { error: deleteError } = await admin
    .from("titan_memory_nodes")
    .delete()
    .eq("id", id)
    .eq("created_by_id", user.id);
  if (deleteError) throw deleteError;

  return {
    type: "done",
    message: "Removed that item from 2nd Me memory.",
    entity: "Memory",
    id,
  };
}
