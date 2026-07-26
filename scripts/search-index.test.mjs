import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  upsertSearchDocs,
  querySearchIndex,
  docsFromJobs,
  docsFromCustomers,
  setSearchIndexUser,
  SETTINGS_SEARCH_CATALOG,
  ANALYTICS_SEARCH_CATALOG,
} from "../src/lib/searchIndex.js";
import { runGlobalSearch } from "../src/lib/globalSearch.js";

const USER = "user-search-test";

beforeEach(() => {
  localStorage.clear();
  setSearchIndexUser(USER);
});

describe("search index", () => {
  it("indexes jobs and finds by title", () => {
    upsertSearchDocs(USER, docsFromJobs([{ id: "j1", title: "Roof repair", customer_name: "Ada", status: "scheduled" }]));
    const hits = querySearchIndex(USER, "roof", { limit: 10 });
    assert.ok(hits.some((h) => h.group === "Jobs" && /Roof/i.test(h.label)));
  });

  it("indexes customers by name", () => {
    upsertSearchDocs(
      USER,
      docsFromCustomers([{ id: "c1", first_name: "Grace", last_name: "Hopper", email: "g@example.com" }])
    );
    const hits = querySearchIndex(USER, "hopper", { limit: 10 });
    assert.ok(hits.some((h) => h.group === "Customers"));
  });

  it("always includes settings and analytics catalogs", () => {
    assert.ok(SETTINGS_SEARCH_CATALOG.length >= 8);
    assert.ok(ANALYTICS_SEARCH_CATALOG.length >= 3);
    const hits = querySearchIndex(USER, "appearance", { limit: 20 });
    assert.ok(hits.some((h) => h.group === "Settings"));
  });
});

describe("global search", () => {
  it("returns nav pages without userId", () => {
    const results = runGlobalSearch("invoices", {});
    assert.ok(results.some((r) => /invoice/i.test(r.label) || r.path.includes("invoice")));
  });

  it("merges entity index when userId present", () => {
    upsertSearchDocs(USER, docsFromJobs([{ id: "j9", title: "UniqueZebraJob", status: "open" }]));
    const results = runGlobalSearch("UniqueZebraJob", { userId: USER });
    assert.ok(results.some((r) => /UniqueZebraJob/i.test(r.label)));
  });
});
