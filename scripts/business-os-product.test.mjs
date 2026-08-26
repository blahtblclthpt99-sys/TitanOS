import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nav = readFileSync(new URL("../src/lib/nav-items.js", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/AuthenticatedShell.jsx", import.meta.url), "utf8");
const tabs = readFileSync(new URL("../src/components/layout/TabStack.jsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/pages/Dashboard.jsx", import.meta.url), "utf8");
const driver = readFileSync(new URL("../src/pages/DriverHub.jsx", import.meta.url), "utf8");
const secondMe = readFileSync(new URL("../src/pages/SecondMe.jsx", import.meta.url), "utf8");
const auto = readFileSync(new URL("../src/pages/Autopilot.jsx", import.meta.url), "utf8");
const discovery = readFileSync(new URL("../api/functions/leadDiscovery.js", import.meta.url), "utf8");
const leadsApi = readFileSync(new URL("../src/lib/leadsApi.js", import.meta.url), "utf8");

test("mobile navigation is explicitly scoped per workspace", () => {
  const businessBlock = nav.match(/const BUSINESS_MOBILE = \[([\s\S]*?)\];/);
  const independentBlock = nav.match(/const INDEPENDENT_MOBILE = \[([\s\S]*?)\];/);
  const seekerBlock = nav.match(/const SEEKER_MOBILE = \[([\s\S]*?)\];/);
  assert.ok(businessBlock && independentBlock && seekerBlock, "all workspace mobile nav blocks must exist");

  const paths = (block) => [...block.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(paths(businessBlock[1]), ["/", "/jobs", "/customers", "/invoices", "/more"]);
  assert.deepEqual(paths(independentBlock[1]), ["/independent", "/work-opportunities", "/jobs", "/invoices", "/autopilot"]);
  assert.deepEqual(paths(seekerBlock[1]), ["/hire/matches", "/job-profile", "/autopilot"]);

  assert.doesNotMatch(seekerBlock[1], /\/fleet|\/driver|\/employees|\/talent/);
  assert.doesNotMatch(independentBlock[1], /\/fleet|\/driver|\/employees|\/talent/);
  assert.match(nav, /export const MOBILE_TAB_ITEMS = BUSINESS_MOBILE/);
  assert.match(nav, /mobileTabItemsForUser/);
});

test("primary navigation preserves Business OS while isolating Independent and Job Seeker surfaces", () => {
  const appBlock = nav.match(/export const APP_NAV_ITEMS = \[([\s\S]*?)\];/);
  assert.ok(appBlock, "APP_NAV_ITEMS must exist");
  const block = appBlock[1];

  for (const required of [
    "Business Home",
    "Jobs",
    "Schedule",
    "Customers",
    "Estimates",
    "Invoices",
    "Payments",
    "Employees",
    "Talent",
    "Fleet",
    "Inventory",
    "Business Documents",
  ]) {
    assert.match(block, new RegExp(`label: "${required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }

  assert.match(block, /label: "Home", path: "\/independent"[^\n]*audience: "self_employed"/);
  assert.match(block, /label: "Opportunities", path: "\/work-opportunities"[^\n]*audience: "self_employed"/);
  assert.match(block, /label: "Available Jobs", path: "\/hire\/matches"[^\n]*audience: "job_seeker"/);
  assert.match(block, /label: "Job Profile", path: "\/job-profile"[^\n]*audience: "job_seeker"/);
  assert.match(block, /label: "TitanAUTO", path: "\/autopilot"[^\n]*audience: "shared"/);

  const operationsAt = block.indexOf('label: "Jobs"');
  const managementAt = block.indexOf('label: "Fleet"');
  const independentAt = block.indexOf('path: "/independent"');
  const seekerAt = block.indexOf('path: "/hire/matches"');
  const sharedAt = block.indexOf('label: "TitanAUTO"');
  assert.ok(
    operationsAt >= 0 && managementAt > operationsAt && independentAt > managementAt && seekerAt > independentAt && sharedAt > seekerAt
  );
  assert.doesNotMatch(block, /path: "\/(driver|comms|marketplace|reports|tax-center)"/);
});

test("app boot does not restart retired driver or legacy background services", () => {
  assert.doesNotMatch(shell, /DriverSessionKeepAlive|DoorDashKeepAlive|ScheduledExportRunner|warmSearchIndex/);
  assert.match(shell, /refreshFeatureFlagsFromServer/);
});

test("only Business Home is kept warm by the route cache", () => {
  assert.match(tabs, /const TAB_PATHS = \["\/"\]/);
  assert.doesNotMatch(tabs.match(/const TAB_PATHS = .*?;/)?.[0] || "", /\/driver|\/hire\/matches|\/second-me|\/autopilot/);
});

test("business management routes are mounted as real product workspaces", () => {
  for (const route of [
    "employees",
    "fleet",
    "driver",
    "routes",
    "inventory",
    "business-documents",
    "credentials",
    "contracts",
    "insurance",
    "more",
  ]) {
    assert.match(tabs, new RegExp(`"/${route}":`));
  }
  assert.match(tabs, /const Employees = lazy/);
  assert.match(tabs, /const Fleet = lazy/);
  assert.match(tabs, /const DriverHub = lazy/);
  assert.match(tabs, /const Inventory = lazy/);
  assert.match(tabs, /const BusinessDocuments = lazy/);
});

test("Driver Hub is reduced to a fleet-management subsystem", () => {
  assert.match(driver, /Fleet Operations/);
  assert.match(driver, /Fleet-only subsystem/);
  assert.match(driver, /\/fleet/);
  assert.match(driver, /\/employees/);
  assert.match(driver, /\/jobs/);
  assert.match(driver, /\/routes/);
  assert.doesNotMatch(driver, /MissionControl|DriverExplorer|DoorDash|delivery search|live-shift/);
});

test("Business Home presents operations and management before TitanAUTO", () => {
  assert.match(dashboard, /Business Operating System/);
  assert.match(dashboard, /Daily business operations/);
  assert.match(dashboard, /People, talent, fleet, inventory, and records/);
  assert.match(dashboard, /aria-label="TitanAUTO"/);
  assert.match(dashboard, /Automate repetitive business work after approval/);
  assert.doesNotMatch(dashboard, /HomeAdClips|loadLocalWeather|ensureDemoInbox|TitanScoreBadge|BusinessTimeline/);

  const operationsAt = dashboard.indexOf("Daily business operations");
  const managementAt = dashboard.indexOf("People, talent, fleet, inventory, and records");
  const titanAutoAt = dashboard.indexOf('aria-label="TitanAUTO"');
  assert.ok(operationsAt >= 0 && managementAt > operationsAt && titanAutoAt > managementAt);
});

test("2nd Self remains an optional intelligence layer with confirmation language", () => {
  assert.match(secondMe, /Invisible Interface/);
  assert.match(secondMe, /Understand → Propose → Confirm → Act/);
  assert.match(secondMe, /\/assistant\?q=/);
  assert.match(nav, /label: "2nd Self", path: "\/second-me"[^\n]*hidden: true/);
});

test("TitanAUTO remains shared while lead actions stay bounded", () => {
  assert.match(nav, /label: "TitanAUTO", path: "\/autopilot"[^\n]*audience: "shared"/);
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

test("lead client filtering uses the same ownership column as RLS", () => {
  assert.match(leadsApi, /Lead\.filter\(\{ created_by_id: id \}/);
  assert.doesNotMatch(leadsApi, /Lead\.filter\(\{ user_id: id \}/);
  assert.match(leadsApi, /created_by_id: userId/);
});
