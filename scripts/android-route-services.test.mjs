import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/AuthenticatedShell.jsx", import.meta.url), "utf8");

test("business prefetch is only enabled on the classic business dashboard", () => {
  assert.match(source, /const isDashboard = pathname === "\/business-dashboard";/);
  assert.match(source, /usePrefetchDashboard\(isDashboard\)/);
});
test("driver keep-alive services only mount on driver routes", () => {
  assert.match(source, /const isDriver = pathname === "\/driver" \|\| pathname\.startsWith\("\/driver\/"\)/);
  assert.match(source, /isDriver && <DriverSessionKeepAlive\s*\/>/);
  assert.match(source, /isDriver && <DoorDashKeepAlive\s*\/>/);
});
test("scheduled exports are isolated from job-search screens", () => {
  assert.match(source, /isExport && <ScheduledExportRunner\s*\/>/);
});
