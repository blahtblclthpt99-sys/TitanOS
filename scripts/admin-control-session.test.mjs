import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/pages/AdminControlCenter.jsx", import.meta.url), "utf8");

test("Control Center validates or refreshes admin session before privileged calls", () => {
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /supabase\.auth\.refreshSession\(\)/);
  assert.match(page, /await ensureValidAdminSession\(\)/);
});

test("Control Center does not make summary and feedback requests in one Promise.all", () => {
  assert.doesNotMatch(page, /Promise\.all\s*\(\s*\[\s*api\.functions\.invoke\("adminControl"/s);
  assert.match(page, /const summary = await api\.functions\.invoke\("adminControl", \{ action: "summary" \}\)/);
  assert.match(page, /const inbox = await api\.functions\.invoke\("adminControl", \{ action: "feedback" \}\)/);
});

test("feedback-only failure cannot take the whole Control Center offline", () => {
  assert.match(page, /setFeedbackWarning\(true\)/);
  assert.match(page, /Feedback could not load, but the rest of Control Center is available/);
});
