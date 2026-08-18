/**
 * Persist signup metadata to durable Supabase storage.
 * Never throws — registration must not fail because of telemetry/logging.
 */
export async function recordSignupEmail(admin, { email, fullName = "", source = "register" } = {}) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized || !normalized.includes("@")) return { ok: false };

  if (admin) {
    try {
      const { error } = await admin.from("signup_emails").upsert(
        {
          email: normalized,
          full_name: String(fullName || "").trim() || null,
          source,
        },
        { onConflict: "email", ignoreDuplicates: false }
      );
      if (error) {
        // Compatibility fallback for deployments where signup_emails has not yet
        // been provisioned. This remains durable and does not rely on local disk.
        console.warn("[signup-emails] upsert failed, trying beta_signups:", error.message);
        await admin.from("beta_signups").insert({
          full_name: String(fullName || "").trim() || normalized,
          email: normalized,
          business_type: "account_signup",
          why_join: `Registered via ${source}`,
          status: "registered",
        });
      }
    } catch (err) {
      console.warn("[signup-emails] durable store skipped:", err?.message || err);
    }
  }

  return { ok: true, email: normalized };
}

/** Rebuild plaintext export contents from durable database rows. */
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
