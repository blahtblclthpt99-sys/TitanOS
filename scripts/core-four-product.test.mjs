import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nav = readFileSync(new URL("../src/lib/nav-items.js", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/AuthenticatedShell.jsx", import.meta.url), "utf8");
const tabs = readFileSync(new URL("../src/components/layout/TabStack.jsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/pages/Dashboard.jsx", import.meta.url), "utf8");
const secondMe = readFileSync(new URL("../src/pages/SecondMe.jsx", import.meta.url), "utf8");
const auto = readFileSync(new URL("../src/pages/Autopilot.jsx", import.meta.url), "utf8");
const discovery = readFileSync(new URL("../api/functions/leadDiscovery.js", import.meta.url), "utf8");

test("mobile product navigation exposes exactly the four Titan pillars", () => {
  const mobileBlock = nav.match(/export const MOBILE_TAB_ITEMS = \[([\s\S]*?)\];/);
  assert.ok(mobileBlock, "MOBILE_TAB_ITEMS must exist");
  const block = mobileBlock[1];
  assert.equal((block.match(/path:/g) || []).length, 4);
  assert.match(block, /path: "\/"/);
  assert.match(block, /path: "\/hire\/matches"/);
  assert.match(block, /path: "\/second-me"/);
  assert.match(block, /path: "\/autopilot"/);
  assert.doesNotMatch(block, /\/driver|\/comms|\/more|\/marketplace/);
});

test("primary navigation does not re-promote deprecated product surfaces", () => {
  const appBlock = nav.match(/export const APP_NAV_ITEMS = \[([\s\S]*?)\];/);
  assert.ok(appBlock, "APP_NAV_ITEMS must exist");
  const block = appBlock[1];
  assert.doesNotMatch(block, /path: "\/(driver|comms|more|marketplace|fleet|inventory|employees|reports|tax-center)"/);
  assert.match(block, /label: "Titan Auto \+ Leads"/);
  assert.match(block, /label: "2nd Self"/);
  assert.match(block, /label: "Find Work"/);
});

test("app boot does not restart removed non-core background services", () => {
  assert.doesNotMatch(shell, /DriverSessionKeepAlive|DoorDashKeepAlive|ScheduledExportRunner|warmSearchIndex/);
  assert.match(shell, /refreshFeatureFlagsFromServer/);
});

test("tab cache keeps only the four product roots warm", () => {
  assert.match(tabs, /const TAB_PATHS = \["\/", "\/hire\/matches", "\/second-me", "\/autopilot"\]/);
  assert.doesNotMatch(tabs.match(/const TAB_PATHS = .*?;/)?.[0] || "", /\/driver|\/comms|\/more/);
});

test("retired product routes redirect instead of remaining mounted products", () => {
  const retired = ["driver", "routes", "booking", "employees", "fleet", "inventory", "finances", "reports", "tax-center", "analytics", "marketplace", "comms"];
  for (const route of retired) {
    assert.match(tabs, new RegExp(`"\\/${route}": "\\/`));
  }
  assert.doesNotMatch(tabs, /const DriverHub = lazy|const TitanComms = lazy|const Marketplace = lazy|const Fleet = lazy|const Reports = lazy|const TaxCenter = lazy/);
});

test("Business Home stays focused on core operations", () => {
  assert.match(dashboard, /Titan Business/);
  assert.match(dashboard, /Business operations/);
  assert.doesNotMatch(dashboard, /HomeAdClips|loadLocalWeather|ensureDemoInbox|TitanScoreBadge|BusinessTimeline/);
});

test("2nd Self is the Invisible Interface entry and preserves confirmation language", () => {
  assert.match(secondMe, /Invisible Interface/);
  assert.match(secondMe, /Understand → Propose → Confirm → Act/);
  assert.match(secondMe, /\/assistant\?q=/);
});

test("Titan Auto combines lead discovery and approved automation", () => {
  assert.match(auto, /Lead Finder/);
  assert.match(auto, /Find nearby businesses/);
  assert.match(auto, /Approved automation/);
  assert.match(auto, /discoverNearbyLeads/);
  assert.match(auto, /runAutopilotMembership/);
});

test("lead discovery is authenticated, bounded, privacy-reduced, and attribution-aware", () => {
  assert.match(discovery, /requireUser\(req, res\)/);
  assert.match(discovery, /limit: 4, windowMs: 60_000, key: "leadDiscovery"/);
  assert.match(discovery, /const MAX_RESULTS = 20/);
  assert.match(discovery, /const MAX_RADIUS_M = 40_000/);
  assert.match(discovery, /SEARCH_COORD_DECIMALS = 3/);
  assert.match(discovery, /const searchLat = roundedCoordinate\(lat\)/);
  assert.match(discovery, /safeHttpUrl/);
  assert.match(discovery, /OpenStreetMap contributors/);
  assert.doesNotMatch(discovery, /sendEmail|sendFollowUp|fetch\([^)]*website/);
});
