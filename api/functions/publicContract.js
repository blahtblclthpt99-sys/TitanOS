import { createHash } from "node:crypto";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

const PUBLIC_FIELDS = "id,customer_name,title,body,status,signed_at,owner_signature,customer_signature";

function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function safeContract(row) {
  if (!row) return null;
  return {
    id: row.id,
    customer_name: row.customer_name,
    title: row.title,
    body: row.body,
    status: row.status,
    signed_at: row.signed_at,
    owner_signed: Boolean(row.owner_signature),
    customer_signed: Boolean(row.customer_signature),
  };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 30, windowMs: 60_000, key: "publicContract" }))) return;

  try {
    const admin = getSupabaseAdmin();
    const input = readJson(req);
    const token = String(input.token || "").trim();
    const action = String(input.action || "get");
    if (token.length < 32 || token.length > 256) {
      return res.status(404).json({ error: "Contract unavailable" });
    }
    const tokenHash = hashToken(token);

    if (action === "get") {
      const { data, error } = await admin
        .from("contracts")
        .select(PUBLIC_FIELDS)
        .eq("share_token_hash", tokenHash)
        .in("status", ["sent", "signed"])
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Contract unavailable" });
      return res.status(200).json({ contract: safeContract(data) });
    }

    if (action === "sign") {
      const signature = String(input.signature || "").trim();
      const signatureImage = input.signature_image ? String(input.signature_image) : null;
      if (!signature || signature.length > 200) {
        return res.status(400).json({ error: "Signature is required" });
      }
      if (signatureImage && signatureImage.length > 1_000_000) {
        return res.status(413).json({ error: "Signature image is too large" });
      }

      const { data: existing, error: findError } = await admin
        .from("contracts")
        .select("id,status,owner_signature,customer_signature")
        .eq("share_token_hash", tokenHash)
        .in("status", ["sent", "signed"])
        .maybeSingle();
      if (findError) throw findError;
      if (!existing) return res.status(404).json({ error: "Contract unavailable" });
      if (existing.customer_signature) {
        const { data: already } = await admin.from("contracts").select(PUBLIC_FIELDS).eq("id", existing.id).maybeSingle();
        return res.status(200).json({ contract: safeContract(already), alreadySigned: true });
      }

      const ownerSigned = Boolean(existing.owner_signature);
      const { data: updated, error: updateError } = await admin
        .from("contracts")
        .update({
          customer_signature: signature,
          customer_signature_image: signatureImage || null,
          status: ownerSigned ? "signed" : "sent",
          signed_at: ownerSigned ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("share_token_hash", tokenHash)
        .is("customer_signature", null)
        .select(PUBLIC_FIELDS)
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return res.status(409).json({ error: "Contract was already updated" });
      return res.status(200).json({ contract: safeContract(updated) });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    logError("publicContract", error);
    return res.status(500).json({ error: "Contract request failed" });
  }
}
