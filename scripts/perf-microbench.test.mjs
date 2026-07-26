import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { performance } from "node:perf_hooks";
import { toCsv } from "../src/lib/export/csv.js";
import { upsertSearchDocs, querySearchIndex, docsFromJobs, setSearchIndexUser } from "../src/lib/searchIndex.js";
import { runGlobalSearch } from "../src/lib/globalSearch.js";

describe("performance microbench", () => {
  it("CSV export of 2k rows stays under 100ms", () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ id: i, title: `Job ${i}`, amount: i }));
    const columns = [
      { label: "Id", value: (r) => r.id },
      { label: "Title", value: (r) => r.title },
      { label: "Amount", value: (r) => r.amount },
    ];
    const t0 = performance.now();
    const csv = toCsv(rows, columns);
    const ms = performance.now() - t0;
    assert.ok(csv.length > 1000);
    assert.ok(ms < 100, `CSV took ${ms.toFixed(1)}ms`);
  });

  it("search index query of 500 jobs stays under 50ms", () => {
    localStorage.clear();
    const userId = "perf-user";
    setSearchIndexUser(userId);
    const jobs = Array.from({ length: 500 }, (_, i) => ({
      id: `j${i}`,
      title: i === 250 ? "NeedleInHaystack" : `Job ${i}`,
      status: "scheduled",
    }));
    upsertSearchDocs(userId, docsFromJobs(jobs));
    const t0 = performance.now();
    const hits = querySearchIndex(userId, "NeedleInHaystack", { limit: 10 });
    const ms = performance.now() - t0;
    assert.ok(hits.some((h) => /Needle/i.test(h.label)));
    assert.ok(ms < 50, `search took ${ms.toFixed(1)}ms`);
  });

  it("global search empty query is instant", () => {
    const t0 = performance.now();
    const results = runGlobalSearch("", {});
    const ms = performance.now() - t0;
    assert.ok(Array.isArray(results));
    assert.ok(ms < 40, `global search took ${ms.toFixed(1)}ms`);
  });
});
