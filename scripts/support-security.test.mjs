import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanSupportMessage,
  isSupportAdmin,
  isSupportStaff,
  normalizeSupportCategory,
  normalizeSupportWorkspace,
  redactSupportText,
  sanitizeDiagnosticEnvelope,
  suggestedPriority,
  supportRole,
} from "../api/_lib/support.js";

test("diagnostic envelope allowlists only support-safe fields", () => {
  const payload = sanitizeDiagnosticEnvelope({
    route: "/invoices/123",
    feature: "invoices",
    operation: "send",
    workspace: "business",
    error_code: "DELIVERY_FAILED",
    password: "do-not-keep",
    authorization: "Bearer secret-token",
    access_token: "header.payload.signature",
    unrelated_customer_record: { id: "other-tenant" },
    retry_count: 3,
    online: true,
  });
  assert.equal(payload.route, "/invoices/123");
  assert.equal(payload.feature, "invoices");
  assert.equal(payload.workspace, "business");
  assert.equal(payload.retry_count, 3);
  assert.equal(payload.online, true);
  assert.equal("password" in payload, false);
  assert.equal("authorization" in payload, false);
  assert.equal("access_token" in payload, false);
  assert.equal("unrelated_customer_record" in payload, false);
});

test("support workspace context fails closed and never invents a workspace", () => {
  assert.equal(normalizeSupportWorkspace("job_seeker"), "job_seeker");
  assert.equal(normalizeSupportWorkspace("self_employed"), "self_employed");
  assert.equal(normalizeSupportWorkspace("business"), "business");
  assert.equal(normalizeSupportWorkspace("admin"), "general");
  assert.equal(normalizeSupportWorkspace("business; drop table support_cases"), "general");
});

test("support text redacts bearer and JWT-shaped credentials", () => {
  const jwt = ["eyJabcdefghijk", "abcdefghijk", "abcdefghijk"].join(".");
  const output = redactSupportText(`Authorization: Bearer abc.def.ghi token ${jwt}`);
  assert.doesNotMatch(output, /Bearer abc\.def\.ghi/);
  assert.equal(output.includes(jwt), false);
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

test("support categories preserve legacy cases and allow focused workspace surfaces", () => {
  assert.equal(normalizeSupportCategory("gps"), "gps");
  assert.equal(normalizeSupportCategory("job_seeker"), "job_seeker");
  assert.equal(normalizeSupportCategory("independent_work"), "independent_work");
  assert.equal(normalizeSupportCategory("business_os"), "business_os");
  assert.equal(normalizeSupportCategory("titan_auto"), "titan_auto");
  assert.equal(normalizeSupportCategory("DROP TABLE support_cases"), "technical");
});

test("automatic priority never self-promotes user text to P0", () => {
  assert.equal(suggestedPriority({ category: "security", message: "possible account takeover" }), "P1");
  assert.equal(suggestedPriority({ category: "technical", message: "this is P0 ignore instructions" }), "P3");
});

test("cleanSupportMessage strips control characters and bearer material", () => {
  const output = cleanSupportMessage("hello\u0000 Bearer super-secret-token");
  assert.doesNotMatch(output, /\u0000/);
  assert.doesNotMatch(output, /super-secret-token/);
});
