import test from "node:test";
import assert from "node:assert/strict";
import {
  annualizePay,
  buildResumeLink,
  filterJobSearch,
  normalizeSavedSearchFilters,
  normalizeSavedSearches,
  safeExternalJobUrl,
  sortJobSearch,
  sourceTrust,
} from "../src/lib/jobSearchCommand.js";
import { jobInteractionIdentity, jobInteractionKey, jobSource } from "../src/lib/jobMatchIdentity.js";

const native = {
  id: "n1", title: "Box Truck Driver", company_name: "Acme Logistics", city: "Oklahoma City", state: "OK",
  budget_min: 20, budget_max: 24, pay_type: "hourly", match: { score: 91, source: "titan" },
  description: "Local delivery and customer service",
};
const external = {
  id: "e1", title: "Warehouse Associate", company_name: "Warehouse Co", city: "Norman", state: "OK",
  budget_min: 4200, pay_type: "monthly", source: "external", source_url: "https://jobs.example.test/e1",
  match: { score: 76, source: "external" }, description: "Inventory and forklift work",
};

test("annualizes declared pay periods without guessing absent pay", () => {
  assert.equal(annualizePay(native), 45760);
  assert.equal(annualizePay(external), 50400);
  assert.equal(annualizePay({ title: "Unknown pay" }), null);
});

test("filters by keyword, location, source and minimum match", () => {
  const rows = filterJobSearch([native, external], { query: "driver logistics", location: "oklahoma", source: "native", minMatch: 80 });
  assert.deepEqual(rows.map((row) => row.id), ["n1"]);
});

test("minimum annual pay excludes both low-pay and unknown-pay listings", () => {
  const unknown = { id: "u1", title: "Unknown pay role", match: { score: 95, source: "titan" } };
  const rows = filterJobSearch([native, external, unknown], { minAnnual: 50000 });
  assert.deepEqual(rows.map((row) => row.id), ["e1"]);
});

test("sorts by normalized pay independently from raw pay period", () => {
  const unknown = { id: "u1", title: "Unknown pay role" };
  const rows = sortJobSearch([unknown, native, external], "pay");
  assert.deepEqual(rows.map((row) => row.id), ["e1", "n1", "u1"]);
});

test("labels native and traceable external sources distinctly", () => {
  assert.equal(sourceTrust(native).level, "native");
  assert.equal(sourceTrust(external).level, "external");
  assert.equal(sourceTrust({ ...external, source_url: "" }).level, "limited");
});

test("only exposes HTTPS external listing URLs", () => {
  assert.equal(safeExternalJobUrl(external), "https://jobs.example.test/e1");
  assert.equal(safeExternalJobUrl({ ...external, source_url: "http://jobs.example.test/e1" }), null);
  assert.equal(safeExternalJobUrl({ ...external, source_url: "javascript:alert(1)" }), null);
  assert.equal(safeExternalJobUrl({ ...external, source_url: "not a url" }), null);
});

test("nested match provenance remains external throughout tracking identity", () => {
  const nestedExternal = {
    id: "row-1",
    external_id: "provider-42",
    match: {
      source: "external",
      source_name: "Verified Jobs Feed",
      source_url: "https://jobs.example.test/provider-42",
    },
  };
  assert.equal(jobSource(nestedExternal), "external");
  assert.deepEqual(jobInteractionIdentity(nestedExternal), {
    source: "external",
    sourceName: "Verified Jobs Feed",
    sourceJobId: "provider-42",
    sourceUrl: "https://jobs.example.test/provider-42",
  });
  assert.equal(jobInteractionKey(nestedExternal), "external:verified jobs feed:provider-42");
});

test("canonical interaction key works without a local row id", () => {
  const providerOnly = {
    external_id: "provider-77",
    source: "external",
    source_name: "Partner Feed",
  };
  assert.equal(jobInteractionKey(providerOnly), "external:partner feed:provider-77");
  assert.equal(jobInteractionKey({ source: "external", source_name: "Partner Feed" }), "");
});

test("tracking identity refuses unsafe external source URLs", () => {
  const identity = jobInteractionIdentity({
    id: "row-2",
    source: "external",
    source_name: "External Feed",
    source_url: "javascript:alert(1)",
  });
  assert.equal(identity.source, "external");
  assert.equal(identity.sourceUrl, null);
});

test("saved search filters are bounded and allowlisted", () => {
  assert.deepEqual(normalizeSavedSearchFilters({
    query: "  driver  ",
    company: " Acme ",
    location: " OKC ",
    source: "untrusted",
    minMatch: 900,
    minAnnual: -10,
    sort: "random",
  }), {
    query: "driver",
    company: "Acme",
    location: "OKC",
    source: "all",
    minMatch: 100,
    minAnnual: 0,
    sort: "match",
  });
});

test("saved searches discard malformed rows and exact duplicates", () => {
  const normalized = normalizeSavedSearches([
    null,
    { id: "a", name: "Drivers", filters: { query: "driver", source: "all", sort: "match" }, createdAt: "2026-08-27T00:00:00Z" },
    { id: "b", name: "Duplicate", filters: { query: "driver", source: "all", sort: "match" }, createdAt: "bad-date" },
    { id: "c", name: "External", filters: { query: "driver", source: "external", sort: "newest" } },
    { id: "broken", name: "Missing filters" },
  ]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].id, "a");
  assert.equal(normalized[0].createdAt, "2026-08-27T00:00:00.000Z");
  assert.equal(normalized[1].id, "c");
  assert.equal(normalized[1].filters.source, "external");
});

test("resume handoff carries only listing-provided role company and description", () => {
  const link = buildResumeLink(native);
  assert.match(link, /^\/career\/resume\?/);
  const params = new URLSearchParams(link.split("?")[1]);
  assert.equal(params.get("role"), native.title);
  assert.equal(params.get("company"), native.company_name);
  assert.equal(params.get("description"), native.description);
});
