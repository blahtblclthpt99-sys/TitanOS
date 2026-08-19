const MAX_DIAGNOSTIC_STRING = 1200;
const MAX_FLAG_COUNT = 40;
const SUPPORT_STAFF_ROLES = new Set([
  "support_agent",
  "senior_support",
  "support_engineering",
  "billing_support",
  "support_admin",
  "admin",
]);
const SUPPORT_ADMIN_ROLES = new Set(["support_admin", "admin"]);
const SUPPORT_WORKSPACES = new Set(["general", "job_seeker", "self_employed", "business"]);
const USER_WORKSPACES = new Set(["job_seeker", "self_employed", "business"]);

const DIAGNOSTIC_KEYS = new Set([
  "timestamp",
  "route",
  "page",
  "feature",
  "operation",
  "workspace",
  "error_code",
  "error_description",
  "request_id",
  "correlation_id",
  "app_version",
  "platform",
  "operating_system",
  "browser",
  "network_state",
  "online",
  "feature_flags",
  "sentry_event_id",
  "sentry_issue_id",
  "sentry_release",
  "retry_count",
]);

const SECRET_KEY_PATTERN = /(?:password|passwd|secret|token|authorization|cookie|service[_-]?role|api[_-]?key|private[_-]?key|refresh[_-]?token|access[_-]?token|stripe[_-]?secret|webhook[_-]?secret)/i;
const SECRET_ASSIGNMENT_PATTERN = /(["']?(?:password|passwd|secret|token|authorization|cookie|service[_-]?role|api[_-]?key|private[_-]?key|refresh[_-]?token|access[_-]?token|stripe[_-]?secret|webhook[_-]?secret)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi;
const QUERY_SECRET_PATTERN = /([?&](?:password|passwd|secret|token|authorization|cookie|service[_-]?role|api[_-]?key|private[_-]?key|refresh[_-]?token|access[_-]?token|stripe[_-]?secret|webhook[_-]?secret)=)[^&#\s]*/gi;
const URI_CREDENTIAL_PATTERN = /([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s/]+@/gi;
const BEARER_PATTERN = /bearer\s+[a-z0-9._~+\/-]+=*/gi;
const JWT_PATTERN = /eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}/g;
const SK_PATTERN = /\b(?:sk|rk|pk)_(?:live|test|proj)_[a-zA-Z0-9_-]{8,}\b/g;
const LONG_SECRET_PATTERN = /\b[a-zA-Z0-9_\-]{48,}\b/g;

function text(value, max = MAX_DIAGNOSTIC_STRING) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

export function redactSupportText(value, max = MAX_DIAGNOSTIC_STRING) {
  return text(value, max)
    .replace(URI_CREDENTIAL_PATTERN, "$1[REDACTED]@")
    .replace(QUERY_SECRET_PATTERN, "$1[REDACTED]")
    .replace(BEARER_PATTERN, "[REDACTED_BEARER]")
    .replace(JWT_PATTERN, "[REDACTED_JWT]")
    .replace(SK_PATTERN, "[REDACTED_KEY]")
    .replace(LONG_SECRET_PATTERN, "[REDACTED_SECRET]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1[REDACTED]");
}

function sanitizeFlags(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value).slice(0, MAX_FLAG_COUNT)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    const cleanKey = text(key, 80);
    if (!cleanKey) continue;
    if (typeof raw === "boolean" || typeof raw === "number") out[cleanKey] = raw;
    else if (typeof raw === "string") out[cleanKey] = redactSupportText(raw).slice(0, 160);
  }
  return out;
}

export function sanitizeDiagnosticEnvelope(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!DIAGNOSTIC_KEYS.has(key) || SECRET_KEY_PATTERN.test(key)) continue;
    if (key === "feature_flags") {
      out.feature_flags = sanitizeFlags(raw);
      continue;
    }
    if (key === "online") {
      if (typeof raw === "boolean") out.online = raw;
      continue;
    }
    if (key === "retry_count") {
      const n = Number(raw);
      if (Number.isFinite(n)) out.retry_count = Math.max(0, Math.min(100, Math.trunc(n)));
      continue;
    }
    if (key === "workspace") {
      out.workspace = normalizeSupportWorkspace(raw);
      continue;
    }
    const clean = redactSupportText(raw);
    if (clean) out[key] = clean;
  }
  return out;
}

export function supportRole(user) {
  return String(user?.app_metadata?.role || "user").trim().toLowerCase();
}

export function isSupportStaff(user) {
  return SUPPORT_STAFF_ROLES.has(supportRole(user));
}

export function isSupportAdmin(user) {
  return SUPPORT_ADMIN_ROLES.has(supportRole(user));
}

export function normalizeSupportWorkspace(value) {
  const workspace = String(value || "general").trim().toLowerCase();
  return SUPPORT_WORKSPACES.has(workspace) ? workspace : "general";
}

export function supportWorkspaceFromProfile(profile) {
  if (!profile || typeof profile !== "object") return "general";
  const enabled = Array.isArray(profile.enabled_workspaces)
    ? profile.enabled_workspaces
        .map((value) => normalizeSupportWorkspace(value))
        .filter((value) => USER_WORKSPACES.has(value))
    : [];
  const active = normalizeSupportWorkspace(profile.active_workspace || profile.account_type);
  if (USER_WORKSPACES.has(active) && (!enabled.length || enabled.includes(active))) return active;

  const legacy = normalizeSupportWorkspace(profile.account_type);
  if (USER_WORKSPACES.has(legacy) && (!enabled.length || enabled.includes(legacy))) return legacy;
  return enabled[0] || "general";
}

export async function resolveAuthoritativeSupportWorkspace(admin, userId) {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("active_workspace,enabled_workspaces,account_type")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return supportWorkspaceFromProfile(profile);
}

export function normalizeSupportCategory(value) {
  const allowed = new Set([
    "account","billing","jobs","job_seeker","opportunities","applications","profile",
    "customers","scheduling","estimates","invoices","money","independent_work","business_os",
    "recruiting","employees","fleet","inventory","business_documents","titan_auto","leads",
    "driver_hub","gps","mileage","titan_ai","invisible_interface","android","pwa",
    "notifications","communications","files","import_export","technical","security","other",
  ]);
  const category = String(value || "technical").trim().toLowerCase();
  return allowed.has(category) ? category : "technical";
}

export function normalizeSupportSource(value) {
  const source = String(value || "support_center").trim().toLowerCase();
  return new Set(["support_center","contextual_error","feedback","agent","system"]).has(source)
    ? source
    : "support_center";
}

export function suggestedPriority({ category, message }) {
  const body = String(message || "").toLowerCase();
  if (category === "security" || /data leak|account takeover|charged twice|duplicate charge|production down|cannot log in|can't log in/.test(body)) {
    return "P1";
  }
  if (/crash|won't open|cannot open|not sending|gps|mileage|payment failed|subscription/.test(body)) return "P2";
  return "P3";
}

export async function resolveAuthorizedSupportCompany(admin, userId, requestedCompanyId = null) {
  let candidate = text(requestedCompanyId, 160) || null;
  if (!candidate) {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("active_company_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    candidate = text(profile?.active_company_id, 160) || null;
  }
  if (!candidate) return null;

  const { data: memberships, error } = await admin
    .from("company_members")
    .select("company_id")
    .eq("company_id", candidate)
    .eq("user_id", String(userId))
    .eq("status", "active")
    .limit(1);
  if (error) throw error;
  return memberships?.length ? candidate : null;
}

export async function loadOwnedSupportCase(admin, userId, caseId) {
  if (!caseId) return null;
  const { data, error } = await admin
    .from("support_cases")
    .select("id,case_number,created_by_id,company_id,workspace,title,description,category,status,priority,source,platform,app_version,first_response_at,created_at,updated_at,last_message_at")
    .eq("id", caseId)
    .eq("created_by_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function loadAssignedSupportCase(admin, user, caseId) {
  if (!caseId || !isSupportStaff(user)) return null;
  if (isSupportAdmin(user)) {
    const { data, error } = await admin.from("support_cases").select("*").eq("id", caseId).maybeSingle();
    if (error) throw error;
    return data || null;
  }
  const { data: assignment, error: assignmentError } = await admin
    .from("support_agent_assignments")
    .select("case_id")
    .eq("case_id", caseId)
    .eq("agent_user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) return null;
  const { data, error } = await admin.from("support_cases").select("*").eq("id", caseId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function writeSupportAudit(admin, {
  caseId = null,
  actorUserId = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
}) {
  if (!action) return;
  const safeMetadata = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    if (typeof value === "string") safeMetadata[key] = redactSupportText(value).slice(0, 500);
    else if (typeof value === "boolean" || typeof value === "number" || value == null) safeMetadata[key] = value;
  }
  const { error } = await admin.from("support_audit_logs").insert({
    case_id: caseId,
    actor_user_id: actorUserId,
    action: text(action, 120),
    target_type: targetType ? text(targetType, 80) : null,
    target_id: targetId ? text(targetId, 160) : null,
    metadata: safeMetadata,
  });
  if (error) throw error;
}

export function cleanSupportMessage(value, max = 10000) {
  return redactSupportText(value, max).slice(0, max);
}
