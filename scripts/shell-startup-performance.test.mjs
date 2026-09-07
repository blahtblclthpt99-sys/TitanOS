import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("authenticated shell startup performance contract", () => {
  it("defers non-critical shell warmup but keeps driver telemetry immediate", async () => {
    const shell = await source("src/AuthenticatedShell.jsx");

    assert.match(shell, /scheduleIdleWork/);
    assert.match(shell, /import\("@\/lib\/searchIndex"\)/);
    assert.match(shell, /import\("@\/lib\/productAnalytics"\)/);
    assert.match(shell, /import\("@\/lib\/featureFlags"\)/);
    assert.doesNotMatch(shell, /from\s+["']@\/lib\/searchIndex["']/);
    assert.doesNotMatch(shell, /from\s+["']@\/lib\/productAnalytics["']/);
    assert.doesNotMatch(shell, /from\s+["']@\/lib\/featureFlags["']/);

    assert.match(shell, /lazy\(\(\)\s*=>\s*import\("@\/components\/shared\/ScheduledExportRunner"\)\)/);
    assert.match(shell, /<DriverSessionKeepAlive\s*\/>/);
    assert.match(shell, /<DoorDashKeepAlive\s*\/>/);
  });

  it("does not invisibly mount Dashboard on unrelated deep links", async () => {
    const tabs = await source("src/components/layout/TabStack.jsx");

    assert.match(tabs, /const recentTabs = useRef\(\[\]\);/);
    assert.match(tabs, /const mountedTabs = new Set\(recentTabs\.current\);/);
    assert.doesNotMatch(tabs, /new Set\(\[\s*["']\/["']/);
  });

  it("loads support pages only when a support route is visited", async () => {
    const layout = await source("src/components/layout/AppLayout.jsx");

    assert.match(layout, /lazy\(\(\)\s*=>\s*import\("@\/pages\/SupportCenter"\)\)/);
    assert.match(layout, /lazy\(\(\)\s*=>\s*import\("@\/pages\/SupportCommandCenter"\)\)/);
    assert.doesNotMatch(layout, /import\s+SupportCenter\s+from/);
    assert.doesNotMatch(layout, /import\s+SupportCommandCenter\s+from/);
  });

  it("schedules Dashboard warming away from first paint", async () => {
    const prefetch = await source("src/hooks/usePrefetchDashboard.js");

    assert.match(prefetch, /scheduleIdleWork/);
    assert.match(prefetch, /delay:\s*500/);
    assert.match(prefetch, /timeout:\s*2500/);
  });
});
