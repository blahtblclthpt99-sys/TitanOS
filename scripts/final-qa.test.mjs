/**
 * FINAL QA structural gates — nav↔routes, exports, migrations, GPS, escrow honesty.
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
  const re = /["'](\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(slice))) {
    // stop at next top-level const after object if we wandered too far
    paths.push(m[1]);
  }
  return [...new Set(paths)];
}

describe("final-qa: nav ↔ TabStack closure", () => {
  it("every APP_NAV_ITEMS path is a tab or NON_TAB_ROUTE (or known detail host)", () => {
    const navSrc = read("src/lib/nav-items.js");
    const tabSrc = read("src/components/layout/TabStack.jsx");

    // Only APP_NAV_ITEMS — ignore QUICK_CREATE_ACTIONS query paths
    const navBlock = navSrc.slice(
      navSrc.indexOf("export const APP_NAV_ITEMS"),
      navSrc.indexOf("export const NAV_GROUP_META")
    );
    const navPaths = [...navBlock.matchAll(/path:\s*["'](\/[^"'?]+)["']/g)].map((m) => m[1]);
    assert.ok(navPaths.length >= 30, "expected full nav catalog");

    const tabPaths = extractQuotedPaths(tabSrc, "TAB_COMPONENTS");
    const nonTabPaths = extractQuotedPaths(tabSrc, "NON_TAB_ROUTES");
    const routed = new Set([...tabPaths, ...nonTabPaths]);

    // Detail hosts covered by startsWith checks in TabStack
    const detailHosts = ["/customers", "/invoices", "/driver"];

    const missing = navPaths.filter((p) => {
      if (routed.has(p)) return false;
      if (detailHosts.some((h) => p === h || p.startsWith(`${h}/`))) return false;
      return true;
    });

    assert.deepEqual(missing, [], `unrouted nav paths: ${missing.join(", ")}`);
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
    assert.match(read("src/pages/MoreMenu.jsx"), /not a feature list/i);
  });
});
