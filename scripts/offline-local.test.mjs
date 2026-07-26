import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { readLocal, writeLocal, storageKey } from "../src/lib/localStore.js";
import { upsertSearchDocs, querySearchIndex, docsFromJobs, setSearchIndexUser } from "../src/lib/searchIndex.js";

const USER = "offline-user";

beforeEach(() => {
  localStorage.clear();
});

describe("offline / local-first", () => {
  it("localStore survives without network", () => {
    writeLocal("titanos_test", USER, "prefs", { offline: true });
    assert.deepEqual(readLocal("titanos_test", USER, "prefs", null), { offline: true });
    assert.equal(storageKey("titanos_test", USER, "prefs"), `titanos_test_prefs_${USER}`);
  });

  it("search snapshot remains queryable offline after warm", () => {
    setSearchIndexUser(USER);
    upsertSearchDocs(USER, docsFromJobs([{ id: "1", title: "Offline Job Alpha", status: "scheduled" }]));
    // Simulate "offline" — no network calls; query is sync
    const hits = querySearchIndex(USER, "Alpha", { limit: 5 });
    assert.ok(hits.some((h) => /Offline Job Alpha/i.test(h.label)));
  });

  it("readLocal returns fallback when missing", () => {
    assert.deepEqual(readLocal("missing", USER, "x", { ok: 1 }), { ok: 1 });
  });
});
