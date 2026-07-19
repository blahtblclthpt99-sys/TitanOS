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
  const ext = file.name.split(".").pop() || "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("titanos-uploads").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
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
