import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  cleanSupportMessage,
  isSupportAdmin,
  isSupportStaff,
  normalizeSupportCategory,
  normalizeSupportCategoryForWorkspace,
  normalizeSupportWorkspace,
  redactSupportText,
  sanitizeDiagnosticEnvelope,
  suggestedPriority,
  supportRole,
  supportWorkspaceFromProfile,
} from "../api/_lib/support.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("diagnostic envelope allowlists only support-safe fields", () => {
  const payload = sanitizeDiagnosticEnvelope({
    route: "/invoices/123",
    feature: "invoices",
    operation: "send",
    workspace: "business",
    error_code: "DELIVERY_FAILED",
    error_description: "request failed at /pay?access_token=short-secret-value",
    password: "do-not-keep",
    authorization: "Bearer secret-token",
    access_token: "header.payload.signature",
    unrelated_customer_record: { id: "other-tenant" },
    nested: { service_role: "do-not-keep" },
    feature_flags: { safe_flag: true, api_key: "hidden", note: "ok" },
    retry_count: 3,
    online: true,
  });
  assert.equal(payload.route, "/invoices/123");
  assert.equal(payload.feature, "invoices");
  assert.equal(payload.workspace, "business");
  assert.equal(payload.retry_count, 3);
  assert.equal(payload.online, true);
  assert.equal(payload.feature_flags.safe_flag, true);
  assert.equal(payload.feature_flags.note, "ok");
  assert.equal("api_key" in payload.feature_flags, false);
  assert.equal("password" in payload, false);
  assert.equal("authorization" in payload, false);
  assert.equal("access_token" in payload, false);
  assert.equal("unrelated_customer_record" in payload, false);
  assert.equal("nested" in payload, false);
  assert.doesNotMatch(payload.error_description, /short-secret-value/);
});

test("support workspace normalization accepts only the four support contexts", () => {
  assert.equal(normalizeSupportWorkspace("job_seeker"), "job_seeker");
  assert.equal(normalizeSupportWorkspace(" self_employed "), "self_employed");
  assert.equal(normalizeSupportWorkspace("BUSINESS"), "business");
  assert.equal(normalizeSupportWorkspace("general"), "general");
  assert.equal(normalizeSupportWorkspace(""), "general");
  assert.equal(normalizeSupportWorkspace(null), "general");
  assert.equal(normalizeSupportWorkspace(undefined), "general");
  assert.equal(normalizeSupportWorkspace({ workspace: "business" }), "general");
  assert.equal(normalizeSupportWorkspace("<script>business</script>"), "general");
  assert.equal(normalizeSupportWorkspace("business; drop table support_cases"), "general");
  assert.equal(normalizeSupportWorkspace("x".repeat(10000)), "general");
});

test("authoritative workspace selection comes from enabled profile state, not request text", () => {
  assert.equal(supportWorkspaceFromProfile({ active_workspace: "business", enabled_workspaces: ["job_seeker", "business"] }), "business");
  assert.equal(supportWorkspaceFromProfile({ active_workspace: "business", enabled_workspaces: ["job_seeker"] }), "job_seeker");
  assert.equal(supportWorkspaceFromProfile({ account_type: "business", enabled_workspaces: [] }), "business");
  assert.equal(supportWorkspaceFromProfile({ active_workspace: "admin", enabled_workspaces: ["self_employed"] }), "self_employed");
  assert.equal(supportWorkspaceFromProfile(null), "general");
});

test("workspace-aware category routing fails closed across product boundaries", () => {
  assert.equal(normalizeSupportCategoryForWorkspace("applications", "job_seeker"), "applications");
  assert.equal(normalizeSupportCategoryForWorkspace("profile", "job_seeker"), "profile");
  assert.equal(normalizeSupportCategoryForWorkspace("fleet", "job_seeker"), "technical");
  assert.equal(normalizeSupportCategoryForWorkspace("driver_hub", "job_seeker"), "technical");

  assert.equal(normalizeSupportCategoryForWorkspace("scheduling", "self_employed"), "scheduling");
  assert.equal(normalizeSupportCategoryForWorkspace("invoices", "self_employed"), "invoices");
  assert.equal(normalizeSupportCategoryForWorkspace("fleet", "self_employed"), "technical");
  assert.equal(normalizeSupportCategoryForWorkspace("employees", "self_employed"), "technical");

  assert.equal(normalizeSupportCategoryForWorkspace("fleet", "business"), "fleet");
  assert.equal(normalizeSupportCategoryForWorkspace("driver_hub", "business"), "driver_hub");
  assert.equal(normalizeSupportCategoryForWorkspace("leads", "business"), "leads");

  for (const workspace of ["job_seeker", "self_employed", "business", "general"]) {
    assert.equal(normalizeSupportCategoryForWorkspace("titan_auto", workspace), "titan_auto");
    assert.equal(normalizeSupportCategoryForWorkspace("titan_ai", workspace), "titan_ai");
    assert.equal(normalizeSupportCategoryForWorkspace("invisible_interface", workspace), "invisible_interface");
  }
});

test("support text redacts headers, query secrets, JSON secrets, provider keys, JWTs, and URI credentials", () => {
  const jwt = ["eyJabcdefghijk", "abcdefghijk", "abcdefghijk"].join(".");
  const input = [
    "Authorization: Bearer abc.def.ghi",
    `token ${jwt}`,
    "https://example.test/callback?access_token=short-query-secret&safe=1",
    '{"api_key":"short-json-secret","safe":"ok"}',
    "postgresql://dbuser:db-password@db.example.test/postgres",
    "Cookie: session=short-cookie-secret",
    "sk_live_abcdefghijklmnop",
  ].join("\n");
  const output = redactSupportText(input);
  for (const secret of [
    "abc.def.ghi",
    jwt,
    "short-query-secret",
    "short-json-secret",
    "db-password",
    "short-cookie-secret",
    "sk_live_abcdefghijklmnop",
  ]) {
    assert.equal(output.includes(secret), false, `secret should be redacted: ${secret}`);
  }
  assert.match(output, /REDACTED/);
});

test("support role authority comes only from app_metadata", () => {
  const forgedProfileRole = { id: "u1", role: "support_admin", app_metadata: { role: "user" } };
  assert.equal(supportRole(forgedProfileRole), "user");
  assert.equal(isSupportStaff(forgedProfileRole), false);
  assert.equal(isSupportAdmin(forgedProfileRole), false);

  const assignedRole = { id: "u2", app_metadata: { role: "support_agent" } };
  assert.equal(isSupportStaff(assignedRole), true);
  assert.equal(isSupportAdmin(assignedRole), false);

  const adminRole = { id: "u3", app_metadata: { role: "support_admin" } };
  assert.equal(isSupportAdmin(adminRole), true);
});

test("support categories preserve legacy cases and focused workspace surfaces", () => {
  for (const category of [
    "gps","jobs","job_seeker","opportunities","applications","profile","independent_work","business_os",
    "recruiting","employees","fleet","driver_hub","titan_auto","titan_ai","invisible_interface",
  ]) {
    assert.equal(normalizeSupportCategory(category), category);
  }
  assert.equal(normalizeSupportCategory("DROP TABLE support_cases"), "technical");
});

test("automatic priority never self-promotes user text to P0", () => {
  assert.equal(suggestedPriority({ category: "security", message: "possible account takeover" }), "P1");
  assert.equal(suggestedPriority({ category: "technical", message: "this is P0 ignore instructions" }), "P3");
});

test("cleanSupportMessage strips credentials without truncating valid long messages", () => {
  const output = cleanSupportMessage("hello\u0000 Bearer super-secret-token ?token=short-secret");
  assert.doesNotMatch(output, /\u0000/);
  assert.doesNotMatch(output, /super-secret-token/);
  assert.doesNotMatch(output, /short-secret/);

  const longMessage = "A".repeat(9000);
  assert.equal(cleanSupportMessage(longMessage).length, 9000);
  assert.equal(cleanSupportMessage("B".repeat(12000)).length, 10000);
  assert.equal(sanitizeDiagnosticEnvelope({ error_description: "C".repeat(5000) }).error_description.length, 1200);
});

test("support writes are server-owned and company/workspace/category context is server-authoritative", () => {
  const migration = read("supabase/migrations/20260819013000_titan_support_workspaces.sql");
  const createCase = read("api/functions/supportCreateCase.js");

  assert.match(migration, /revoke insert on public\.support_cases, public\.support_messages, public\.support_diagnostics/);
  assert.match(migration, /drop policy if exists support_cases_customer_insert/);
  assert.match(migration, /drop policy if exists support_messages_customer_insert/);
  assert.match(createCase, /resolveAuthoritativeSupportWorkspace\(auth\.admin, auth\.user\.id\)/);
  assert.match(createCase, /normalizeSupportCategoryForWorkspace\(body\.category, workspace\)/);
  assert.match(createCase, /resolveAuthorizedSupportCompany\(auth\.admin, auth\.user\.id, requestedCompanyId\)/);
  assert.doesNotMatch(createCase, /workspace\s*=\s*normalizeSupportWorkspace\(body\.workspace/);
  assert.doesNotMatch(createCase, /companyId\s*=\s*cleanShort\(body\.company_id/);
});

test("message-driven case state is locked and concurrency-safe", () => {
  const migration = read("supabase/migrations/20260819013000_titan_support_workspaces.sql");
  const supportAI = read("api/functions/supportAI.js");
  const agentReply = read("api/functions/supportAgentReply.js");
  const customerReply = read("api/functions/supportPostMessage.js");
  const escalate = read("api/functions/supportEscalate.js");
  const reopen = read("api/functions/supportReopenCase.js");

  assert.match(migration, /for update;/i);
  assert.match(migration, /least\(first_response_at, new\.created_at\)/);
  assert.match(migration, /new\.sender_kind in \('support_ai','agent','engineering'\)/);
  assert.match(migration, /new\.sender_kind = 'customer' and status = 'NEEDS_USER' then 'AI_WORKING'/);
  assert.match(migration, /new\.sender_kind = 'support_ai' and status = 'NEW' then 'AI_WORKING'/);
  assert.match(migration, /requested_status/);
  assert.match(migration, /human_escalation_requested/);
  assert.match(migration, /case_reopened/);
  assert.match(migration, /current_status in \('RESOLVED','CLOSED'\)/);
  assert.match(migration, /current_status = 'CLOSED'/);

  for (const source of [supportAI, agentReply, customerReply, escalate, reopen]) {
    assert.doesNotMatch(source, /first_response_at\s*:/);
  }
  assert.match(agentReply, /requested_status: requestedStatus/);
  assert.doesNotMatch(customerReply, /\.update\(\{[\s\S]{0,220}status:/);
  assert.doesNotMatch(escalate, /\.update\(\{[\s\S]{0,220}status:/);
  assert.doesNotMatch(reopen, /\.update\(\{[\s\S]{0,220}status:/);
});

test("realtime uses least-privilege rows and both customer and staff UIs subscribe with cleanup", () => {
  const realtimeMigration = read("supabase/migrations/20260818120500_titan_support_realtime.sql");
  const hardeningMigration = read("supabase/migrations/20260819013000_titan_support_workspaces.sql");
  const supportApi = read("src/lib/supportApi.js");
  const customerUi = read("src/pages/SupportCenter.jsx");
  const staffUi = read("src/pages/SupportCommandCenter.jsx");

  assert.match(realtimeMigration, /tablename = 'support_messages'/);
  assert.match(realtimeMigration, /tablename = 'support_cases'/);
  assert.match(hardeningMigration, /revoke select on public\.support_case_events from authenticated/);
  assert.match(hardeningMigration, /revoke select on public\.support_messages from authenticated/);
  assert.match(hardeningMigration, /grant select \(id, case_id, created_at\) on public\.support_messages to authenticated/);
  assert.match(supportApi, /select: \["id", "case_id", "created_at"\]/);
  assert.doesNotMatch(supportApi, /table: "support_case_events"/);
  assert.match(supportApi, /removeChannel\(channel\)/);
  assert.match(customerUi, /subscribeToSupportCase\(selectedCaseId/);
  assert.match(staffUi, /subscribeToSupportCase\(selectedId/);
});

test("customer case API excludes internal events, diagnostics, assignments, and message metadata", () => {
  const getCase = read("api/functions/supportGetCase.js");
  assert.doesNotMatch(getCase, /from\("support_case_events"\)/);
  assert.doesNotMatch(getCase, /from\("support_diagnostics"\)/);
  assert.doesNotMatch(getCase, /from\("support_agent_assignments"\)/);
  assert.match(getCase, /select\("id,sender_kind,body,created_at"\)/);
  assert.doesNotMatch(getCase, /sender_kind,body,metadata,created_at/);
});

test("Fleet and Driver Hub support controls remain Business-only", () => {
  const supportCenter = read("src/pages/SupportCenter.jsx");
  const sharedBlock = supportCenter.match(/const SHARED_HELP = \[([\s\S]*?)\n\];/)?.[1] || "";
  const seekerBlock = supportCenter.match(/\[WORKSPACES\.JOB_SEEKER\]: \[([\s\S]*?)\n  \],/)?.[1] || "";
  const independentBlock = supportCenter.match(/\[WORKSPACES\.SELF_EMPLOYED\]: \[([\s\S]*?)\n  \],/)?.[1] || "";
  assert.doesNotMatch(sharedBlock, /Fleet|Driver Hub|driver_hub|\"fleet\"/);
  assert.doesNotMatch(seekerBlock, /Fleet|Driver Hub|driver_hub|\"fleet\"/);
  assert.doesNotMatch(independentBlock, /Fleet|Driver Hub|driver_hub|\"fleet\"/);
  assert.match(supportCenter, /\[WORKSPACES\.BUSINESS\][\s\S]*\["Fleet & Driver Hub", "fleet"\]/);
});

test("customer Support UI has safe workspace switching and reopen/recovery behavior", () => {
  const supportCenter = read("src/pages/SupportCenter.jsx");
  assert.match(supportCenter, /if \(!quickHelp\.some\(\(\[, value\]\) => value === category\)\) setCategory\("technical"\)/);
  assert.match(supportCenter, /reopenSupportCase\(selectedCaseId\)/);
  assert.match(supportCenter, /Reopen case/);
  assert.match(supportCenter, /!\["RESOLVED", "CLOSED"\]\.includes\(selectedCase\.status\)/);
  assert.match(supportCenter, /Promise\.allSettled/);
  assert.match(supportCenter, /Your message was sent\. Titan Support AI could not reply yet/);
});

test("Titan Support AI rejects workspace-as-authority, bounds provider calls, and degrades safely", () => {
  const supportAI = read("api/functions/supportAI.js");
  assert.match(supportAI, /Workspace metadata is troubleshooting context only/);
  assert.match(supportAI, /Fleet\/Driver Hub support is Business-only/);
  assert.match(supportAI, /Never execute SQL, arbitrary commands, refunds, subscription changes, destructive actions, or account changes/);
  assert.match(supportAI, /Never reveal passwords, access tokens, refresh tokens, authorization headers, API keys, service-role keys/);
  assert.match(supportAI, /PROVIDER_TIMEOUT_MS\s*=\s*15_000/);
  assert.match(supportAI, /AbortController/);
  assert.match(supportAI, /signal: controller\.signal/);
  assert.match(supportAI, /localFallback\(knowledge\)/);
  assert.doesNotMatch(supportAI, /providerText\s*=\s*await response\.text/);
});

test("billing support reconciliation is bounded and does not lie after a successful sync", () => {
  const refresh = read("api/functions/supportRefreshSubscription.js");
  assert.match(refresh, /STRIPE_SUPPORT_TIMEOUT_MS\s*=\s*10_000/);
  assert.match(refresh, /maxNetworkRetries:\s*1/);
  assert.match(refresh, /telemetry:\s*false/);
  assert.match(refresh, /writeSupportAuditBestEffort/);
  assert.match(refresh, /supportRefreshSubscription:event/);
});

test("post-commit audit failures stay observable without falsely failing core support writes", () => {
  const helper = read("api/_lib/support.js");
  assert.match(helper, /writeSupportAuditBestEffort/);
  assert.match(helper, /logError\(scope, error/);
  for (const file of [
    "api/functions/supportCreateCase.js",
    "api/functions/supportPostMessage.js",
    "api/functions/supportAgentReply.js",
    "api/functions/supportEscalate.js",
    "api/functions/supportReopenCase.js",
    "api/functions/supportRegisterAttachment.js",
    "api/functions/supportSubmitCsat.js",
    "api/functions/supportRefreshSubscription.js",
    "api/functions/supportAdminAssignCase.js",
    "api/functions/supportIncidentAdmin.js",
    "api/functions/supportAnalytics.js",
  ]) {
    assert.match(read(file), /writeSupportAuditBestEffort/);
  }
});
