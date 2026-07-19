import { supabase } from "./supabaseClient";

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function throwIfError(error) {
  if (!error) return;
  throw apiError(error.message || "Request failed");
}

function apiCandidates(path) {
  const urls = [];
  const configured = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configured) urls.push(`${configured}${path}`);

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".vercel.app") ||
      hostname.endsWith("titanfieldos.com")
    ) {
      urls.push(`${origin}${path}`);
      urls.push(path);
    }
    // Capacitor / static hosts: always allow production API
    urls.push(`https://titanos-web.vercel.app${path}`);
  }

  return [...new Set(urls)];
}

async function uploadFile({ file }) {
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
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("titanos-uploads").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: type || undefined,
  });
  throwIfError(error);
  const { data } = supabase.storage.from("titanos-uploads").getPublicUrl(path);
  return { file_url: data.publicUrl };
}

async function sendEmail(payload) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const path = "/api/functions/sendEmail";
  let lastError;

  for (const url of apiCandidates(path)) {
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
      return body;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || apiError("Failed to send email", 503);
}

export function createIntegrationsModule() {
  return {
    Core: {
      UploadFile: uploadFile,
      SendEmail: sendEmail,
    },
  };
}
