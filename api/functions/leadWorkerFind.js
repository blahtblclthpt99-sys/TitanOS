import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";
import { FEATURES, requireFeature } from "../_lib/entitlements.js";
import {
  extractResponsesText,
  parseWorkerLeads,
  safeLeadText,
  validLeadEmail,
} from "../_lib/leadOutreach.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!(await requireFeature(res, auth.admin, auth.user, FEATURES.leadOutreach))) return;
  if (!(await assertRateLimitAsync(req, res, { key: "lead-worker-find", limit: 6, windowMs: 60_000 }))) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Lead workers are not configured yet." });
  const industry = safeLeadText(req.body?.industry, 100);
  const location = safeLeadText(req.body?.location, 100);
  const count = Math.min(25, Math.max(1, Number(req.body?.count) || 10));
  if (!industry || !location) return res.status(400).json({ error: "Industry and location are required." });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const provider = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_LEAD_MODEL || "gpt-5-mini",
        tools: [{ type: "web_search" }],
        input: `Find up to ${count} legitimate ${industry} in ${location} that could reasonably benefit from TitanOS field operations software. Return only a JSON array. Every item must include company, email, website, and reason. Email must be a publicly listed business contact found on the company's own website. Never guess or derive an address. Exclude personal addresses, scraped directories, duplicates, and unverifiable contacts. Keep reason under 120 characters.`,
      }),
    });
    const payload = await provider.json().catch(() => ({}));
    if (!provider.ok) return res.status(502).json({ error: payload?.error?.message || "Lead search provider failed." });

    const found = parseWorkerLeads(extractResponsesText(payload))
      .map((lead) => ({
        company: safeLeadText(lead.company, 120),
        email: String(lead.email || "").trim().toLowerCase(),
        website: safeLeadText(lead.website, 300),
        reason: safeLeadText(lead.reason, 160),
      }))
      .filter((lead) => lead.company && validLeadEmail(lead.email))
      .slice(0, count);
    const unique = [...new Map(found.map((lead) => [lead.email, lead])).values()];

    const emails = unique.map((lead) => lead.email);
    const { data: existing = [] } = emails.length
      ? await auth.admin.from("leads").select("email").eq("created_by_id", auth.user.id).in("email", emails)
      : { data: [] };
    const existingEmails = new Set(existing.map((lead) => String(lead.email).toLowerCase()));
    const newRows = unique.filter((lead) => !existingEmails.has(lead.email)).map((lead) => ({
      created_by_id: auth.user.id,
      user_id: auth.user.id,
      name: lead.company,
      company: lead.company,
      email: lead.email,
      website: lead.website,
      discovery_reason: lead.reason,
      source: "titan_lead_worker",
      status: "new",
      outreach_status: "ready",
      email_quality_status: "verified",
      email_verified_at: new Date().toISOString(),
      email_source_url: lead.website,
      notes: [lead.website && `Website: ${lead.website}`, lead.reason].filter(Boolean).join(" | "),
    }));
    const { data: inserted = [], error } = newRows.length
      ? await auth.admin.from("leads").insert(newRows).select("*")
      : { data: [], error: null };
    if (error) throw error;

    return res.status(200).json({ leads: inserted, found: unique.length, added: inserted.length, duplicates: unique.length - inserted.length });
  } catch (error) {
    logError("leadWorkerFind", error);
    return res.status(502).json({ error: error?.name === "AbortError" ? "Lead search timed out. Try a smaller batch." : "Lead search failed. Please try again." });
  } finally {
    clearTimeout(timer);
  }
}
