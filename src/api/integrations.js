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
  const response = await fetch("/api/functions/sendEmail", {
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
}

export function createIntegrationsModule() {
  return {
    Core: {
      UploadFile: uploadFile,
      SendEmail: sendEmail,
    },
  };
}
