import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { loadOwnedSupportCase, writeSupportAudit } from "../_lib/support.js";

const ALLOWED_MIME = new Set([
  "image/jpeg","image/png","image/webp","application/pdf","text/plain","text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","video/mp4",
]);
const MAX_BYTES = 10 * 1024 * 1024;

function clean(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 20, windowMs: 10 * 60_000, key: "supportRegisterAttachment", requireDurable: true }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const supportCase = await loadOwnedSupportCase(auth.admin, auth.user.id, body.case_id);
    if (!supportCase) return res.status(404).json({ error: "Support case not found." });

    const storagePath = clean(body.storage_path, 1000);
    const fileName = clean(body.file_name, 255);
    const mimeType = clean(body.mime_type, 160).toLowerCase();
    const sizeBytes = Number(body.size_bytes);
    const ownerPrefix = `${auth.user.id}/${supportCase.id}/`;

    if (!storagePath.startsWith(ownerPrefix)) return res.status(403).json({ error: "Attachment path is not authorized for this case." });
    if (!fileName) return res.status(400).json({ error: "Attachment file name is required." });
    if (!ALLOWED_MIME.has(mimeType)) return res.status(400).json({ error: "This attachment type is not supported." });
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_BYTES) {
      return res.status(400).json({ error: "Attachment must be 10 MB or smaller." });
    }

    const { data: objectRow, error: objectError } = await auth.admin
      .schema("storage")
      .from("objects")
      .select("name,bucket_id,metadata")
      .eq("bucket_id", "support-attachments")
      .eq("name", storagePath)
      .maybeSingle();
    if (objectError) throw objectError;
    if (!objectRow) return res.status(404).json({ error: "Uploaded attachment was not found." });

    const actualSize = Number(objectRow.metadata?.size ?? objectRow.metadata?.contentLength ?? 0);
    const actualMime = String(objectRow.metadata?.mimetype || objectRow.metadata?.contentType || "").toLowerCase();
    if (actualSize && actualSize !== sizeBytes) return res.status(409).json({ error: "Attachment size verification failed." });
    if (actualMime && actualMime !== mimeType) return res.status(409).json({ error: "Attachment type verification failed." });

    const { data, error } = await auth.admin
      .from("support_attachments")
      .insert({
        case_id: supportCase.id,
        created_by_id: auth.user.id,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
      })
      .select("id,file_name,mime_type,size_bytes,storage_path,created_at")
      .single();
    if (error?.code === "23505") return res.status(409).json({ error: "This attachment is already registered." });
    if (error) throw error;

    await writeSupportAudit(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: "support_attachment_registered",
      targetType: "support_attachment",
      targetId: data.id,
      metadata: { mime_type: mimeType, size_bytes: sizeBytes },
    });

    return res.status(201).json({ attachment: data });
  } catch (error) {
    logError("supportRegisterAttachment", error);
    captureApiException(error, { tags: { route: "supportRegisterAttachment" } });
    return res.status(500).json({ error: "Attachment could not be registered." });
  }
}
