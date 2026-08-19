import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import {
  cleanSupportMessage,
  normalizeSupportCategory,
  normalizeSupportSource,
  normalizeSupportWorkspace,
  sanitizeDiagnosticEnvelope,
  suggestedPriority,
  writeSupportAudit,
} from "../_lib/support.js";

function cleanShort(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, {
    limit: 10,
    windowMs: 10 * 60_000,
    key: "supportCreateCase",
    requireDurable: true,
  }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const description = cleanSupportMessage(body.description || body.message || "");
    const title = cleanShort(body.title || description.slice(0, 90) || "TitanOS support request", 180);
    const category = normalizeSupportCategory(body.category);
    const source = normalizeSupportSource(body.source);
    const workspace = normalizeSupportWorkspace(body.workspace);
    const platform = cleanShort(body.platform, 80) || null;
    const appVersion = cleanShort(body.app_version || body.appVersion, 40) || null;
    const companyId = cleanShort(body.company_id || body.companyId, 160) || null;

    if (description.length < 3) {
      return res.status(400).json({ error: "Describe the problem in at least 3 characters." });
    }
    if (title.length < 3) {
      return res.status(400).json({ error: "Support case title is too short." });
    }

    const priority = suggestedPriority({ category, message: description });
    const { data: supportCase, error: caseError } = await auth.admin
      .from("support_cases")
      .insert({
        created_by_id: auth.user.id,
        company_id: companyId,
        workspace,
        title,
        description,
        category,
        status: "NEW",
        priority,
        source,
        platform,
        app_version: appVersion,
      })
      .select("id,case_number,workspace,title,category,status,priority,platform,app_version,created_at,updated_at")
      .single();
    if (caseError) throw caseError;

    const { error: messageError } = await auth.admin.from("support_messages").insert({
      case_id: supportCase.id,
      sender_user_id: auth.user.id,
      sender_kind: "customer",
      body: description,
      metadata: { source, workspace },
    });
    if (messageError) throw messageError;

    await auth.admin.from("support_case_events").insert({
      case_id: supportCase.id,
      actor_user_id: auth.user.id,
      event_type: "case_created",
      to_status: "NEW",
      details: { category, priority, source, workspace },
    });

    let diagnosticAttached = false;
    if (body.diagnostic_consent === true || body.diagnosticConsent === true) {
      const payload = sanitizeDiagnosticEnvelope(body.diagnostics || body.diagnostic || {});
      if (Object.keys(payload).length) {
        const { error: diagnosticError } = await auth.admin.from("support_diagnostics").insert({
          case_id: supportCase.id,
          created_by_id: auth.user.id,
          payload,
          redaction_version: 1,
          consented_at: new Date().toISOString(),
        });
        if (diagnosticError) throw diagnosticError;
        diagnosticAttached = true;
        await writeSupportAudit(auth.admin, {
          caseId: supportCase.id,
          actorUserId: auth.user.id,
          action: "diagnostic_context_attached",
          targetType: "support_diagnostic",
          metadata: { redaction_version: 1, workspace },
        });
      }
    }

    await writeSupportAudit(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: "support_case_created",
      targetType: "support_case",
      targetId: supportCase.id,
      metadata: { category, priority, source, workspace },
    });

    return res.status(201).json({
      case: supportCase,
      diagnostic_attached: diagnosticAttached,
    });
  } catch (error) {
    logError("supportCreateCase", error);
    captureApiException(error, { tags: { route: "supportCreateCase" } });
    return res.status(500).json({ error: "Support case could not be created." });
  }
}
