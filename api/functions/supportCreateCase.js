import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import {
  cleanSupportMessage,
  normalizeSupportCategoryForWorkspace,
  normalizeSupportSource,
  resolveAuthoritativeSupportWorkspace,
  resolveAuthorizedSupportCompany,
  sanitizeDiagnosticEnvelope,
  suggestedPriority,
  writeSupportAuditBestEffort,
} from "../_lib/support.js";

const CUSTOMER_SOURCES = new Set(["support_center", "contextual_error", "feedback"]);

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
    const requestedSource = normalizeSupportSource(body.source);
    const source = CUSTOMER_SOURCES.has(requestedSource) ? requestedSource : "support_center";
    const workspace = await resolveAuthoritativeSupportWorkspace(auth.admin, auth.user.id);
    const category = normalizeSupportCategoryForWorkspace(body.category, workspace);
    const platform = cleanShort(body.platform, 80) || null;
    const appVersion = cleanShort(body.app_version || body.appVersion, 40) || null;
    const requestedCompanyId = cleanShort(body.company_id || body.companyId, 160) || null;
    const companyId = workspace === "business"
      ? await resolveAuthorizedSupportCompany(auth.admin, auth.user.id, requestedCompanyId)
      : null;

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
    if (messageError) {
      const { error: cleanupError } = await auth.admin
        .from("support_cases")
        .delete()
        .eq("id", supportCase.id)
        .eq("created_by_id", auth.user.id);
      if (!cleanupError) throw messageError;

      // The case row is already committed and could not be rolled back. Returning
      // a false 500 would encourage retries that create duplicate support cases.
      // Preserve the case as the authoritative result and surface the degraded
      // initial-message state explicitly so the client can recover in place.
      logError("supportCreateCase:rollback", cleanupError, { caseId: supportCase.id });
      logError("supportCreateCase:initialMessage", messageError, { caseId: supportCase.id });
      await writeSupportAuditBestEffort(auth.admin, {
        caseId: supportCase.id,
        actorUserId: auth.user.id,
        action: "support_case_created_degraded",
        targetType: "support_case",
        targetId: supportCase.id,
        metadata: { reason: "initial_message_failed_and_case_rollback_failed", workspace },
      }, "supportCreateCase:degradedAudit");
      return res.status(201).json({
        case: supportCase,
        diagnostic_attached: false,
        warnings: ["initial_message_not_created", "case_cleanup_failed"],
      });
    }

    const warnings = [];
    const { error: eventError } = await auth.admin.from("support_case_events").insert({
      case_id: supportCase.id,
      actor_user_id: auth.user.id,
      event_type: "case_created",
      to_status: "NEW",
      details: { category, priority, source, workspace },
    });
    if (eventError) {
      warnings.push("event_log_deferred");
      logError("supportCreateCase:event", eventError, { caseId: supportCase.id });
    }

    let diagnosticAttached = false;
    if (body.diagnostic_consent === true || body.diagnosticConsent === true) {
      const payload = sanitizeDiagnosticEnvelope(body.diagnostics || body.diagnostic || {});
      payload.workspace = workspace;
      if (Object.keys(payload).length) {
        const { error: diagnosticError } = await auth.admin.from("support_diagnostics").insert({
          case_id: supportCase.id,
          created_by_id: auth.user.id,
          payload,
          redaction_version: 1,
          consented_at: new Date().toISOString(),
        });
        if (diagnosticError) {
          warnings.push("diagnostics_not_attached");
          logError("supportCreateCase:diagnostic", diagnosticError, { caseId: supportCase.id });
        } else {
          diagnosticAttached = true;
          const auditOk = await writeSupportAuditBestEffort(auth.admin, {
            caseId: supportCase.id,
            actorUserId: auth.user.id,
            action: "diagnostic_context_attached",
            targetType: "support_diagnostic",
            metadata: { redaction_version: 1, workspace },
          }, "supportCreateCase:diagnosticAudit");
          if (!auditOk) warnings.push("diagnostic_audit_deferred");
        }
      }
    }

    const auditOk = await writeSupportAuditBestEffort(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: "support_case_created",
      targetType: "support_case",
      targetId: supportCase.id,
      metadata: { category, priority, source, workspace, company_context: Boolean(companyId) },
    }, "supportCreateCase:audit");
    if (!auditOk) warnings.push("case_audit_deferred");

    return res.status(201).json({
      case: supportCase,
      diagnostic_attached: diagnosticAttached,
      warnings,
    });
  } catch (error) {
    logError("supportCreateCase", error);
    captureApiException(error, { tags: { route: "supportCreateCase" } });
    return res.status(500).json({ error: "Support case could not be created." });
  }
}
