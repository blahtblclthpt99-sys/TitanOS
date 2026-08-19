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

test("business mobile navigation prioritizes daily business work", () => {
  const mobileBlock = nav.match(/const BUSINESS_MOBILE = \[([\s\S]*?)\];/);
  assert.ok(mobileBlock, "BUSINESS_MOBILE must exist");
  const block = mobileBlock[1];
  const paths = [...block.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(paths, ["/", "/jobs", "/customers", "/invoices", "/more"]);
  assert.doesNotMatch(block, /\/hire\/matches|\/second-me|\/autopilot|\/driver/);
});

test("primary navigation isolates Business, Independent Work, Job Seeker, and shared TitanAUTO", () => {
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

  for (const required of ["Opportunities", "Service Profile", "Available Jobs", "Job Profile", "TitanAUTO"]) {
    assert.match(block, new RegExp(`label: "${required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }

  assert.match(block, /audience: "business"/);
  assert.match(block, /audience: "self_employed"/);
  assert.match(block, /audience: "job_seeker"/);
  assert.match(block, /label: "TitanAUTO", path: "\/autopilot", group: "shared", audience: "shared"/);

  const businessAt = block.indexOf('label: "Business Home"');
  const independentAt = block.indexOf('label: "Home", path: "/independent"');
  const seekerAt = block.indexOf('label: "Available Jobs"');
  const sharedAt = block.indexOf('label: "TitanAUTO"');
  assert.ok(businessAt >= 0 && independentAt > businessAt && seekerAt > independentAt && sharedAt > seekerAt);

  // 2nd Self stays available as an internal intelligence workflow rather than a primary workspace tab.
  assert.doesNotMatch(block, /label: "2nd Self"/);
  assert.match(nav, /label: "2nd Self", path: "\/second-me"[\s\S]*hidden: true/);
  assert.doesNotMatch(block, /path: "\/(driver|comms|marketplace|reports|tax-center)"/);
});

test("workspace-specific mobile tabs exist for Independent Work and Job Seeker", () => {
  const independent = nav.match(/const INDEPENDENT_MOBILE = \[([\s\S]*?)\];/);
  const seeker = nav.match(/const SEEKER_MOBILE = \[([\s\S]*?)\];/);
  assert.ok(independent, "INDEPENDENT_MOBILE must exist");
  assert.ok(seeker, "SEEKER_MOBILE must exist");
  assert.match(independent[1], /path: "\/independent"/);
  assert.match(independent[1], /path: "\/work-opportunities"/);
  assert.match(independent[1], /path: "\/autopilot"/);
  assert.match(seeker[1], /path: "\/hire\/matches"/);
  assert.match(seeker[1], /path: "\/job-profile"/);
  assert.match(seeker[1], /path: "\/autopilot"/);
  assert.match(nav, /mobileTabItemsForUser/);
  assert.match(nav, /WORKSPACES\.BUSINESS/);
  assert.match(nav, /WORKSPACES\.SELF_EMPLOYED/);
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

test("Business Home presents operations and management before shared TitanAUTO", () => {
  assert.match(dashboard, /Business Operating System/);
  assert.match(dashboard, /Daily business operations/);
  assert.match(dashboard, /People, talent, fleet, inventory, and records/);
  assert.match(dashboard, /TitanAUTO/);
  assert.match(dashboard, /Automate repetitive business work after approval/);
  assert.doesNotMatch(dashboard, /HomeAdClips|loadLocalWeather|ensureDemoInbox|TitanScoreBadge|BusinessTimeline/);

  const operationsAt = dashboard.indexOf("Daily business operations");
  const managementAt = dashboard.indexOf("People, talent, fleet, inventory, and records");
  const titanAutoAt = dashboard.indexOf("Automate repetitive business work after approval");
  assert.ok(operationsAt >= 0 && managementAt > operationsAt && titanAutoAt > managementAt);
});

test("2nd Self remains an optional intelligence layer with confirmation language", () => {
  assert.match(secondMe, /Invisible Interface/);
  assert.match(secondMe, /Understand → Propose → Confirm → Act/);
  assert.match(secondMe, /\/assistant\?q=/);
});

test("TitanAUTO remains a shared leads and approved-automation surface", () => {
  assert.match(auto, /Titan Auto \+ Leads/);
  assert.match(auto, /Lead Finder/);
  assert.match(auto, /Find nearby businesses/);
  assert.match(auto, /approved automations|Approved automation/i);
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
