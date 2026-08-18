import { api } from "@/api/apiClient";
import { supabase } from "@/api/supabaseClient";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg","image/png","image/webp","application/pdf","text/plain","text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","video/mp4",
]);

function cleanText(value, max = 1000) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function safeFileName(name = "attachment") {
  const cleaned = String(name)
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "attachment";
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function buildSupportDiagnosticEnvelope({ error, route, page, feature, operation, requestId, correlationId } = {}) {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const win = typeof window !== "undefined" ? window : null;
  return {
    timestamp: new Date().toISOString(),
    route: cleanText(route || win?.location?.pathname || "", 500),
    page: cleanText(page || "", 160),
    feature: cleanText(feature || "", 160),
    operation: cleanText(operation || "", 160),
    error_code: cleanText(error?.code || error?.name || "", 160),
    error_description: cleanText(error?.message || "", 1000),
    request_id: cleanText(requestId || error?.requestId || "", 160),
    correlation_id: cleanText(correlationId || error?.correlationId || "", 160),
    app_version: cleanText(import.meta.env.VITE_APP_VERSION || "unknown", 40),
    platform: cleanText(win?.Capacitor ? "android" : "web", 40),
    operating_system: cleanText(nav?.platform || "", 120),
    browser: cleanText(nav?.userAgent || "", 500),
    network_state: nav?.onLine === false ? "offline" : "online",
    online: nav?.onLine !== false,
    retry_count: Number(error?.retryCount || 0) || 0,
  };
}

export async function createSupportCase(input) {
  return api.functions.invoke("supportCreateCase", input);
}

export async function listSupportCases() {
  return api.functions.invoke("supportListCases", {});
}

export async function getSupportCase(caseId) {
  return api.functions.invoke("supportGetCase", { case_id: caseId });
}

export async function postSupportMessage(caseId, message) {
  return api.functions.invoke("supportPostMessage", { case_id: caseId, message });
}

export async function askTitanSupport(caseId, message, options = {}) {
  return api.functions.invoke("supportAI", {
    case_id: caseId,
    message,
    append_customer_message: options.appendCustomerMessage !== false,
    diagnostic_consent: options.diagnosticConsent === true,
    diagnostics: options.diagnostics || undefined,
  });
}

export async function escalateSupportCase(caseId) {
  return api.functions.invoke("supportEscalate", { case_id: caseId });
}

export async function submitSupportCsat(caseId, { solved, rating, comment } = {}) {
  return api.functions.invoke("supportSubmitCsat", {
    case_id: caseId,
    solved,
    rating,
    comment,
  });
}

export async function uploadSupportAttachment({ caseId, userId, file }) {
  if (!caseId || !userId || !file) throw new Error("Case, user, and file are required.");
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) throw new Error("This attachment type is not supported.");
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment must be 10 MB or smaller.");
  }

  const path = `${userId}/${caseId}/${randomId()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("support-attachments")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;

  try {
    const result = await api.functions.invoke("supportRegisterAttachment", {
      case_id: caseId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
    return result.attachment;
  } catch (error) {
    await supabase.storage.from("support-attachments").remove([path]).catch(() => {});
    throw error;
  }
}

export async function getSupportAttachmentUrl(storagePath, expiresIn = 300) {
  const { data, error } = await supabase.storage
    .from("support-attachments")
    .createSignedUrl(storagePath, Math.max(60, Math.min(Number(expiresIn) || 300, 900)));
  if (error) throw error;
  return data?.signedUrl || "";
}
