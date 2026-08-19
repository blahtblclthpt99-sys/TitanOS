import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { cleanSupportMessage, redactSupportText } from "../api/_lib/support.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const createCaseSource = readFileSync(join(root, "api/functions/supportCreateCase.js"), "utf8");
const agentReplySource = readFileSync(join(root, "api/functions/supportAgentReply.js"), "utf8");

test("case creation does not return false failure when initial-message rollback also fails", () => {
  assert.match(createCaseSource, /if \(messageError\)/);
  assert.match(createCaseSource, /if \(!cleanupError\) throw messageError/);
  assert.match(createCaseSource, /support_case_created_degraded/);
  assert.match(createCaseSource, /initial_message_not_created/);
  assert.match(createCaseSource, /case_cleanup_failed/);
  assert.match(createCaseSource, /return res\.status\(201\)\.json/);
});

test("successful rollback still reports the original initial-message failure", () => {
  assert.match(createCaseSource, /\.delete\(\)[\s\S]*\.eq\("id", supportCase\.id\)[\s\S]*\.eq\("created_by_id", auth\.user\.id\)/);
  assert.match(createCaseSource, /if \(!cleanupError\) throw messageError/);
});

test("support message sender identity comes from authenticated role, not requested workflow status", () => {
  assert.match(agentReplySource, /const role = supportRole\(auth\.user\)/);
  assert.match(agentReplySource, /const senderKind = role === "support_engineering" \? "engineering" : "agent"/);
  assert.doesNotMatch(agentReplySource, /requestedStatus === "ENGINEERING" \|\| role === "support_engineering"/);
  assert.match(agentReplySource, /requested_status: requestedStatus/);
});

test("long plain support text is preserved while opaque token-like material is redacted", () => {
  assert.equal(cleanSupportMessage("A".repeat(9000)).length, 9000);
  const opaque = "aB3_defG7hIj9KlM2nOp5QrS8tUv1WxY4zAb6CdE0fGh2IjK5LmN8OpQ";
  const output = redactSupportText(`diagnostic ${opaque}`, 10000);
  assert.equal(output.includes(opaque), false);
  assert.match(output, /\[REDACTED_SECRET\]/);
});
