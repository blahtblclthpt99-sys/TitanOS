import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const hire = read("../src/pages/Hire.jsx");
const more = read("../src/pages/MoreMenu.jsx");
const matches = read("../src/pages/JobMatches.jsx");
const support = read("../src/pages/SupportCenter.jsx");
const layout = read("../src/components/layout/AppLayout.jsx");
test("obsolete founding offer no longer clutters jobs and More screens", () => {
  assert.ok(!hire.includes("betaBadgeLabel"));
  assert.ok(!more.includes("betaBadgeLabel"));
});
test("optional driver data cannot independently disable match search", () => {
  assert.match(matches, /getMyDriverProfile\(user\.id\)\.catch\(\(\) => null\)/);
});
test("support load failure has actionable plain-language explanation", () => {
  assert.ok(support.includes("Support is temporarily unavailable"));
});
test("floating elements are hidden on full-screen hiring and editing forms", () => {
  assert.match(layout, /const isFocusedWorkflow/);
  assert.match(layout, /!isFocusedWorkflow && <MobileActionDock/);
  assert.match(layout, /!isFocusedWorkflow && <TitanSupportButton/);
});
test("job matching outages preserve editing of user preferences", () => {
  assert.match(matches, /const \[driver, prefs, matchResult\] = await Promise\.all/);
  assert.match(matches, /if \(matchResult\.error\)/);
  assert.match(matches, /setForm\(\{/);
});
