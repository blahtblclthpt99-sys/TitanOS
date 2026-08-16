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
    ? { ...row.result_json, idempotentReplay: true, actionId: row.action_id }
    : null;
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
    if (existing.data.payload_hash !== payloadHash) {
      const err = new Error("That action ID was already used for a different request.");
      err.status = 409;
      throw err;
    }
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
        .eq("status", "failed");
      if (reset.error) {
        const err = new Error("Titan could not safely retry that action.");
        err.status = 409;
        throw err;
      }
    } else {
      const err = new Error("That action is already being processed. Retry the same confirmation in a moment.");
      err.status = 409;
      throw err;
    }
  }

  try {
    const result = await execute();
    const saved = await admin
      .from("titan_ai_action_ledger")
      .update({ status: "completed", result_json: result, error_message: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("action_id", actionId)
      .eq("payload_hash", payloadHash);
    if (saved.error) {
      const err = new Error("Action completed but Titan could not finalize its idempotency record. Do not resubmit with a new action ID.");
      err.status = 500;
      err.actionCompleted = true;
      throw err;
    }
    return { ...result, actionId };
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
    throw error;
  }
}
