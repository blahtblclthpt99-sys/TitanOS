import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("authenticated shell startup performance contract", () => {
  it("idle-defers heavy warmup requests", async () => {
    const shell = await source("src/AuthenticatedShell.jsx");

    assert.match(shell, /scheduleIdleWork/);
    assert.match(shell, /import\("@\/lib\/searchIndex"\)/);
    assert.match(shell, /import\("@\/lib\/productAnalytics"\)/);
    assert.match(shell, /import\("@\/lib\/featureFlags"\)/);
    assert.doesNotMatch(shell, /from\s+["']@\/lib\/searchIndex["']/);
    assert.doesNotMatch(shell, /from\s+["']@\/lib\/productAnalytics["']/);
    assert.doesNotMatch(shell, /from\s+["']@\/lib\/featureFlags["']/);
    assert.match(shell, /DeferredScheduledExports/);
  });

  it("code-splits driver telemetry without idle-deferring its mount", async () => {
    const shell = await source("src/AuthenticatedShell.jsx");

    assert.match(shell, /lazy\(\(\)\s*=>\s*import\("@\/components\/driver\/activity\/DriverSessionKeepAlive"\)\)/);
    assert.match(shell, /lazy\(\(\)\s*=>\s*import\("@\/components\/driver\/activity\/DoorDashKeepAlive"\)\)/);
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

  it("keeps Dashboard prefetch away from first paint", async () => {
    const prefetch = await source("src/hooks/usePrefetchDashboard.js");

    assert.match(prefetch, /scheduleIdleWork/);
    assert.match(prefetch, /delay:\s*350/);
    assert.match(prefetch, /timeout:\s*2000/);
  });

  it("keeps search indexing off entity-response and voice-control critical paths", async () => {
    const entityQuery = await source("src/lib/entity-query.js");
    const mobileDock = await source("src/components/layout/MobileActionDock.jsx");
    const floatingAi = await source("src/components/shared/FloatingAIButton.jsx");

    for (const code of [entityQuery, mobileDock, floatingAi]) {
      assert.doesNotMatch(code, /from\s+["']@\/lib\/searchIndex["']/);
      assert.match(code, /import\("@\/lib\/searchIndex"\)/);
    }
    assert.match(entityQuery, /requestIdleCallback/);
  });

  it("demand-loads global search from always-mounted desktop and mobile chrome", async () => {
    const desktop = await source("src/components/layout/DesktopTopBar.jsx");
    const mobileHeader = await source("src/components/layout/MobileHeader.jsx");

    assert.doesNotMatch(desktop, /from\s+["']@\/lib\/globalSearch["']/);
    assert.match(desktop, /import\("@\/lib\/globalSearch"\)/);
    assert.match(desktop, /onPointerEnter=\{primeSearch\}/);
    assert.match(desktop, /searchOpen\s*&&\s*searchTools/);

    assert.doesNotMatch(mobileHeader, /import\s+MobileGlobalSearch\s+from/);
    assert.match(mobileHeader, /lazy\(\(\)\s*=>\s*import\("@\/components\/layout\/MobileGlobalSearch"\)\)/);
    assert.match(mobileHeader, /searchOpen\s*\?/);
  });
});
