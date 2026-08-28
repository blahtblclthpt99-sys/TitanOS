import { supabase } from "./supabaseClient";
import { apiCandidateUrls } from "./apiOrigin";

const UPLOAD_BUCKET = "titanos-uploads";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function throwIfError(error) {
  if (!error) return;
  throw apiError(error.message || "Request failed");
}

function uploadObjectPath(value) {
  if (!value || typeof value !== "string") return "";

  if (value.startsWith(`storage://${UPLOAD_BUCKET}/`)) {
    return value.slice(`storage://${UPLOAD_BUCKET}/`.length).replace(/^\/+/, "");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }

  const markers = [
    `/storage/v1/object/public/${UPLOAD_BUCKET}/`,
    `/storage/v1/object/sign/${UPLOAD_BUCKET}/`,
    `/storage/v1/object/authenticated/${UPLOAD_BUCKET}/`,
  ];
  for (const marker of markers) {
    const index = parsed.pathname.indexOf(marker);
    if (index >= 0) {
      return decodeURIComponent(parsed.pathname.slice(index + marker.length)).replace(/^\/+/, "");
    }
  }
  return "";
}

async function signUploadPath(path, expiresIn = SIGNED_URL_TTL_SECONDS) {
  if (!path) return "";
  const ttl = Number.isFinite(Number(expiresIn))
    ? Math.max(60, Math.min(Number(expiresIn), 60 * 60 * 24 * 30))
    : SIGNED_URL_TTL_SECONDS;
  const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUrl(path, ttl);
  if (error) return "";
  return data?.signedUrl || "";
}

/**
 * Convert durable/legacy TitanOS Storage references into a fresh signed URL.
 * External URLs are returned untouched. Known TitanOS Storage URLs fail closed
 * to an empty string when the caller is not allowed to read the object.
 */
export async function resolveStoredUploadUrl(value, expiresIn = SIGNED_URL_TTL_SECONDS) {
  if (!value || typeof value !== "string") return "";
  const path = uploadObjectPath(value);
  if (!path) return value;
  return signUploadPath(path, expiresIn);
}

export async function resolveStoredUploadUrls(values, expiresIn = SIGNED_URL_TTL_SECONDS) {
  if (!Array.isArray(values) || values.length === 0) return [];
  return Promise.all(values.map((value) => resolveStoredUploadUrl(value, expiresIn)));
}

async function uploadFile({ file, visibility = "private" }) {
  if (!file) throw apiError("No file provided");
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ]);
  const type = file.type || "";
  const extGuess = (file.name.split(".").pop() || "").toLowerCase();
  const extOk = ["jpg", "jpeg", "png", "webp", "gif", "pdf"].includes(extGuess);
  if (!allowed.has(type) && !(type === "" && extOk)) {
    throw apiError("Only JPEG, PNG, WebP, GIF, or PDF uploads are allowed");
  }
  if (type === "" && !extOk) {
    throw apiError("File type could not be verified");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw apiError("File must be 12MB or smaller");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw apiError("Sign in required to upload", 401);

  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const isPublic = visibility === "public";
  // The bucket itself stays private. Public-facing objects live under public/{uid}/…
  // and are readable by the dedicated storage policy; clients still use signed URLs.
  const path = isPublic
    ? `public/${user.id}/${crypto.randomUUID()}.${ext}`
    : `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(path, file, {
    cacheControl: isPublic ? "86400" : "3600",
    upsert: false,
    contentType: type || undefined,
  });
  throwIfError(error);

  const signedUrl = await signUploadPath(path, SIGNED_URL_TTL_SECONDS);
  if (!signedUrl) {
    // Do not persist a known-broken /object/public URL for a private bucket.
    throw apiError("Upload completed but the file could not be opened", 500);
  }

  return {
    file_url: signedUrl,
    file_path: path,
    visibility: isPublic ? "public" : "private",
    expires_in: SIGNED_URL_TTL_SECONDS,
  };
}

async function sendEmail(payload) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const path = "/api/functions/sendEmail";
  let lastError;

  for (const url of apiCandidateUrls(path)) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw apiError(body.error || "Failed to send email", response.status);
      }
      // Preserve stub flag so callers never toast “email sent” on provider-less hosts
      return body?.stub ? { ...body, success: true, stub: true } : body;
    } catch (err) {
      lastError = err;
    }
  }

  // Fail closed for delivery — do not invent a silent success
  throw lastError || apiError("Failed to send email", 503);
}

export function createIntegrationsModule() {
  return {
    Core: {
      UploadFile: uploadFile,
      ResolveFileUrl: resolveStoredUploadUrl,
      ResolveFileUrls: resolveStoredUploadUrls,
      SendEmail: sendEmail,
    },
  };
}
