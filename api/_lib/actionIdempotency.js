import crypto from "node:crypto";

const ACTION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function stableSerialize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
}

export function normalizeActionId(value) {
  const actionId = String(value || "").trim();
  if (!ACTION_ID_RE.test(actionId)) {
    const err = new Error("Action ID is missing or invalid.");
    err.status = 400;
    throw err;
  }
  return actionId;
}

export function actionPayloadHash(intent, params) {
  return crypto.createHash("sha256").update(stableSerialize({ intent: String(intent || ""), params: params || {} })).digest("hex");
}

function replayResult(row) {
  return row?.result_json && typeof row.result_json === "object"
    ? { ...row.result_json, idempotentReplay: true, actionId: row.action_id, correlationId: row.action_id }
    : null;
}

function conflict(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

export async function listActionHistory(admin, userId, limit = 8) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 20));
  const { data, error } = await admin
    .from("titan_ai_action_ledger")
    .select("action_id,intent,status,result_json,error_message,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return (data || []).map((row) => ({
    correlationId: row.action_id,
    intent: row.intent,
    status: row.status,
    message: row.status === "completed"
      ? String(row.result_json?.message || "Action completed.").slice(0, 180)
      : String(row.error_message || "Action did not complete.").slice(0, 180),
    at: row.updated_at || row.created_at,
  }));
}

export async function executeIdempotentAction({ admin, userId, actionId: rawActionId, intent, params, execute }) {
  if (!admin || !userId || typeof execute !== "function") {
    const err = new Error("Idempotency executor is not configured.");
    err.status = 500;
    throw err;
  }

  const actionId = normalizeActionId(rawActionId);
  const payloadHash = actionPayloadHash(intent, params);
  const now = new Date().toISOString();
  const insert = await admin
    .from("titan_ai_action_ledger")
    .insert({
      user_id: userId,
      action_id: actionId,
      intent: String(intent || "").slice(0, 80),
      payload_hash: payloadHash,
      status: "processing",
      created_at: now,
      updated_at: now,
    })
    .select("action_id,payload_hash,status,result_json")
    .single();

  if (insert.error) {
    const existing = await admin
      .from("titan_ai_action_ledger")
      .select("action_id,payload_hash,status,result_json")
      .eq("user_id", userId)
      .eq("action_id", actionId)
      .maybeSingle();

    if (existing.error || !existing.data) {
      const err = new Error("Titan could not establish an idempotent action lock.");
      err.status = 503;
      throw err;
    }
    if (existing.data.payload_hash !== payloadHash) throw conflict("That action ID was already used for a different request.");
    if (existing.data.status === "completed") {
      const replay = replayResult(existing.data);
      if (replay) return replay;
    }
    if (existing.data.status === "failed") {
      const reset = await admin
        .from("titan_ai_action_ledger")
        .update({ status: "processing", error_message: null, updated_at: now })
        .eq("user_id", userId)
        .eq("action_id", actionId)
        .eq("payload_hash", payloadHash)
        .eq("status", "failed")
        .select("action_id")
        .maybeSingle();
      if (reset.error || !reset.data) throw conflict("That action retry was already claimed by another request. Retry the same confirmation in a moment.");
    } else {
      throw conflict("That action is already being processed. Retry the same confirmation in a moment.");
    }
  }

  try {
    const result = await execute();
    const correlatedResult = { ...result, actionId, correlationId: actionId };
    const saved = await admin
      .from("titan_ai_action_ledger")
      .update({ status: "completed", result_json: correlatedResult, error_message: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("action_id", actionId)
      .eq("payload_hash", payloadHash)
      .eq("status", "processing")
      .select("action_id")
      .maybeSingle();
    if (saved.error || !saved.data) {
      const err = new Error("Action completed but Titan could not finalize its idempotency record. Do not resubmit with a new action ID.");
      err.status = 500;
      err.actionCompleted = true;
      throw err;
    }
    return correlatedResult;
  } catch (error) {
    if (!error?.actionCompleted) {
      await admin
        .from("titan_ai_action_ledger")
        .update({
          status: "failed",
          error_message: String(error?.message || "Action failed").slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("action_id", actionId)
        .eq("payload_hash", payloadHash)
        .eq("status", "processing");
    }
    error.correlationId = actionId;
    throw error;
  }
}
