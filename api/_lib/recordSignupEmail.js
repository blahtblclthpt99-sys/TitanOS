/**
 * Persist a signup email to TitanOS durable database storage.
 *
 * The previous implementation also appended to a local text file. Ephemeral
 * Worker/serverless filesystems are not an audit store, so registration now
 * relies exclusively on Supabase. This helper remains best-effort: account
 * creation must not be rolled back merely because secondary signup analytics
 * could not be recorded.
 */
export async function recordSignupEmail(admin, { email, fullName = "", source = "register" } = {}) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized || !normalized.includes("@")) return { ok: false, stored: false };

  if (!admin) return { ok: false, stored: false, email: normalized };

  const cleanName = String(fullName || "").trim() || null;
  try {
    const { error } = await admin.from("signup_emails").upsert(
      {
        email: normalized,
        full_name: cleanName,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email", ignoreDuplicates: false }
    );

    if (!error) return { ok: true, stored: true, email: normalized };

    // Older installations may not have signup_emails yet. Preserve a durable
    // fallback in beta_signups rather than silently writing ephemeral disk.
    const { error: fallbackError } = await admin.from("beta_signups").insert({
      full_name: cleanName || normalized,
      email: normalized,
      business_type: "account_signup",
      why_join: `Registered via ${source}`,
      status: "registered",
    });

    if (fallbackError) {
      console.warn("[signup-emails] durable stores unavailable");
      return { ok: false, stored: false, email: normalized };
    }

    return { ok: true, stored: true, email: normalized, fallback: "beta_signups" };
  } catch {
    console.warn("[signup-emails] durable store unavailable");
    return { ok: false, stored: false, email: normalized };
  }
}

/** Build a plaintext export from authorized database rows. */
export function formatSignupEmailFile(rows = []) {
  const header = "# TitanOS signup emails — one per line: ISO_DATE\\tEMAIL\\tFULL_NAME\\tSOURCE\n";
  const body = rows
    .map((r) => {
      const at = r.created_at || r.updated_at || new Date().toISOString();
      return `${at}\t${r.email}\t${r.full_name || ""}\t${r.source || "register"}`;
    })
    .join("\n");
  return body ? `${header}${body}\n` : header;
}
