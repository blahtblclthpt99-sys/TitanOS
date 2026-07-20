import fs from "node:fs";
import path from "node:path";

const LOCAL_FILE = path.join(process.cwd(), "data", "signup-emails.txt");

/**
 * Persist a signup email to data/signup-emails.txt (local / writable hosts)
 * and to the signup_emails table (durable on Vercel).
 * Never throws — registration must not fail because of logging.
 */
export async function recordSignupEmail(admin, { email, fullName = "", source = "register" } = {}) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized || !normalized.includes("@")) return { ok: false };

  const line = `${new Date().toISOString()}\t${normalized}\t${String(fullName || "").trim()}\t${source}\n`;

  // 1) Local file (works in local/dev; may be read-only on Vercel)
  try {
    fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
    fs.appendFileSync(LOCAL_FILE, line, "utf8");
  } catch (err) {
    console.warn("[signup-emails] local file write skipped:", err?.message || err);
  }

  // 2) Durable store (Supabase) — survives serverless deploys
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
        // Table may not exist yet — fall back to beta_signups so we never lose the email
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

/** Rebuild plaintext file contents from DB rows (for export / sync). */
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

export function getLocalSignupEmailsPath() {
  return LOCAL_FILE;
}
