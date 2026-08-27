import test from "node:test";
import assert from "node:assert/strict";
import { annualizePay, buildResumeLink, filterJobSearch, safeExternalJobUrl, sortJobSearch, sourceTrust } from "../src/lib/jobSearchCommand.js";

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

test("resume handoff carries only listing-provided role company and description", () => {
  const link = buildResumeLink(native);
  assert.match(link, /^\/career\/resume\?/);
  const params = new URLSearchParams(link.split("?")[1]);
  assert.equal(params.get("role"), native.title);
  assert.equal(params.get("company"), native.company_name);
  assert.equal(params.get("description"), native.description);
});
