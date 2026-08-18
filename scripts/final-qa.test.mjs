/**
 * FINAL QA structural gates — workspace nav↔routes, exports, migrations, GPS, escrow honesty.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

function extractQuotedPaths(src, marker) {
  const idx = src.indexOf(marker);
  if (idx < 0) return [];
  const slice = src.slice(idx, idx + 8000);
  const paths = [];
  const re = /["'](\/[^"']*)["']/g;
  let m;
  while ((m = re.exec(slice))) paths.push(m[1]);
  return [...new Set(paths)];
}

describe("final-qa: three-workspace nav ↔ app routing closure", () => {
  it("every user-facing APP_NAV_ITEMS path is owned by TabStack or the authenticated shell", () => {
    const navSrc = read("src/lib/nav-items.js");
    const tabSrc = read("src/components/layout/TabStack.jsx");
    const layoutSrc = read("src/components/layout/AppLayout.jsx");

    const navBlock = navSrc.slice(
      navSrc.indexOf("export const APP_NAV_ITEMS"),
      navSrc.indexOf("export const INTERNAL_WORKFLOW_ITEMS")
    );
    const navPaths = [...navBlock.matchAll(/path:\s*["'](\/[^"'?]*)["']/g)].map((m) => m[1]);
    const uniqueNavPaths = [...new Set(navPaths)];
    const expectedWorkspacePaths = [
      "/",
      "/jobs",
      "/schedule",
      "/customers",
      "/estimates",
      "/invoices",
      "/payments",
      "/employees",
      "/talent",
      "/fleet",
      "/inventory",
      "/business-documents",
      "/independent",
      "/work-opportunities",
      "/service-profile",
      "/hire/matches",
      "/job-profile",
      "/autopilot",
    ];

    // TitanOS intentionally reuses some business routes inside Independent Work.
    // Compare the unique route set so workspace reuse is allowed while accidental
    // product-surface additions/removals still fail the release gate.
    assert.deepEqual(
      [...uniqueNavPaths].sort(),
      [...expectedWorkspacePaths].sort(),
      "Three-workspace primary navigation must match the approved product surface exactly"
    );

    const tabPaths = extractQuotedPaths(tabSrc, "TAB_COMPONENTS");
    const nonTabPaths = extractQuotedPaths(tabSrc, "NON_TAB_ROUTES");

    const shellRoutes = [];
    if (
      /pathname\s*===\s*["']\/support["']/.test(layoutSrc) &&
      /<SupportCenter\s*\/>/.test(layoutSrc)
    ) {
      shellRoutes.push("/support");
    }
    if (
      /pathname\s*===\s*["']\/admin\/support["']/.test(layoutSrc) &&
      /<SupportCommandCenter\s*\/>/.test(layoutSrc)
    ) {
      shellRoutes.push("/admin/support");
    }

    const routed = new Set([...tabPaths, ...nonTabPaths, ...shellRoutes]);
    const detailHosts = ["/customers", "/invoices"];

    const missing = uniqueNavPaths.filter((p) => {
      if (routed.has(p)) return false;
      if (detailHosts.some((h) => p === h || p.startsWith(`${h}/`))) return false;
      return true;
    });

    assert.deepEqual(missing, [], `unrouted workspace nav paths: ${missing.join(", ")}`);
  });
});

describe("final-qa: export coverage on history/reports money lists", () => {
  const pages = [
    ["src/pages/Estimates.jsx", "estimatesExportSpec"],
    ["src/pages/Leads.jsx", "leadsExportSpec"],
    ["src/pages/Payments.jsx", "paymentsExportSpec"],
    ["src/pages/TaxCenter.jsx", "taxCenterExportSpec"],
    ["src/pages/Contracts.jsx", "contractsExportSpec"],
    ["src/pages/Jobs.jsx", "jobsExportSpec"],
    ["src/pages/Invoices.jsx", "invoicesExportSpec"],
    ["src/pages/Customers.jsx", "customersExportSpec"],
    ["src/pages/Finances.jsx", "financesExportSpec"],
  ];

  for (const [file, spec] of pages) {
    it(`${file} wires ExportMenu + ${spec}`, () => {
      const src = read(file);
      assert.match(src, /ExportMenu/);
      assert.match(src, new RegExp(spec));
    });
  }
});

describe("final-qa: critical migrations 031–038", () => {
  it("migrations 031–038 exist on disk", () => {
    const dir = join(root, "supabase/migrations");
    const files = readdirSync(dir);
    for (const prefix of ["031_", "032_", "033_", "034_", "035_", "036_", "037_", "038_"]) {
      assert.ok(
        files.some((f) => f.startsWith(prefix)),
        `missing migration starting with ${prefix}`
      );
    }
  });

  it("hardening requires 031 and 032", () => {
    const src = read("scripts/production-hardening.test.mjs");
    assert.match(src, /031_/);
    assert.match(src, /032_/);
  });
});

describe("final-qa: launch stack honesty", () => {
  it("referrals stay off nav and behind feature flag", () => {
    assert.doesNotMatch(read("src/lib/nav-items.js"), /path:\s*["']\/referral["']/);
    assert.match(read("src/lib/featureFlags.js"), /referrals:\s*false/);
    assert.match(read("api/functions/featureFlags.js"), /referrals:\s*false/);
    assert.match(read("src/pages/Referral.jsx"), /Referral program is paused|isFeatureEnabled\(["']referrals["']\)/);
    assert.doesNotMatch(read("src/pages/Settings.jsx"), /to=["']\/referral["']/);
  });

  it("marketplace modules are $0.99 pack (all modules)", () => {
    assert.match(read("src/lib/marketplaceCatalog.js"), /MODULE_PRICE\s*=\s*0\.99/);
    const plan = read("src/lib/plan.js");
    assert.match(plan, /STRIPE_CHECKOUT/);
    assert.doesNotMatch(plan, /paypal\.com\/ncp/i);
    assert.match(read("src/lib/plan.js"), /modules:/);
  });
});

describe("final-qa: GPS auto-trip releases watch when DoorDash owns GNSS", () => {
  it("autoTripStart calls stop() when DoorDash active", () => {
    const src = read("src/lib/driverActivity/autoTripStart.js");
    assert.match(src, /isDoorDashGpsActive/);
    assert.match(
      src,
      /if\s*\(\s*isDoorDashGpsActive\([^)]*\)\s*\)\s*\{\s*stop\(\s*\)/s
    );
  });
});

describe("final-qa: escrow honesty + protect", () => {
  it("Escrow page does not claim live money release", () => {
    const src = read("src/pages/Escrow.jsx");
    assert.match(src, /FeatureHonestyBanner/);
    assert.match(src, /Practice hold|do not charge|Real escrow/i);
  });

  it("migration 032 protects escrow release", () => {
    const files = readdirSync(join(root, "supabase/migrations"));
    const m032 = files.find((f) => f.startsWith("032_"));
    assert.ok(m032);
    assert.match(read(`supabase/migrations/${m032}`), /escrow/i);
  });
});

describe("final-qa: docs + rule", () => {
  it("ships FINAL_QA rule and checklist", () => {
    assert.ok(existsSync(join(root, ".cursor/rules/final-qa.mdc")));
    assert.ok(existsSync(join(root, "docs/FINAL_QA.md")));
    assert.match(read("docs/FINAL_QA.md"), /controlled beta/i);
  });

  it("ships FINAL OBJECTIVE rule and guiding principle", () => {
    assert.ok(existsSync(join(root, ".cursor/rules/final-objective.mdc")));
    assert.ok(existsSync(join(root, "docs/FINAL_OBJECTIVE.md")));
    const obj = read("docs/FINAL_OBJECTIVE.md");
    assert.match(obj, /operating system/i);
    assert.match(obj, /No feature ships until/i);
    assert.match(read("docs/TITANIUM_MASTER_PROMPT.md"), /FINAL OBJECTIVE/);
    assert.match(read("AGENTS.md"), /FINAL OBJECTIVE/);
    const moreMenu = read("src/pages/MoreMenu.jsx");
    assert.match(moreMenu, /Business Tools/i);
    assert.match(moreMenu, /running a real business/i);
  });
});
