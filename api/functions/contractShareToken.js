import { createHash, randomBytes } from "node:crypto";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { readJson } from "../_lib/supabase.js";
import { logError } from "../_lib/safeLog.js";

function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 20, windowMs: 60_000, key: "contractShareToken" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { contract_id: contractId } = readJson(req);
    if (!contractId) return res.status(400).json({ error: "contract_id is required" });

    const { data: contract, error: findError } = await auth.admin
      .from("contracts")
      .select("id,created_by_id,status")
      .eq("id", contractId)
      .eq("created_by_id", auth.user.id)
      .maybeSingle();
    if (findError) throw findError;
    if (!contract) return res.status(404).json({ error: "Contract not found" });
    if (!["draft", "sent", "signed"].includes(String(contract.status || ""))) {
      return res.status(409).json({ error: "Contract cannot be shared in its current state" });
    }

    const token = randomBytes(32).toString("hex");
    const { error: updateError } = await auth.admin
      .from("contracts")
      .update({
        share_token: null,
        share_token_hash: hashToken(token),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .eq("created_by_id", auth.user.id);
    if (updateError) throw updateError;

    return res.status(200).json({ token });
  } catch (error) {
    logError("contractShareToken", error);
    return res.status(500).json({ error: "Could not create signing link" });
  }
}
