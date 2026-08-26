import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { AppError, sendApiError, sendDbClientError } from "../api/_lib/apiError.js";
import { deleteEntityWithLocalFallback } from "../src/lib/localStore.js";

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("apiError helpers", () => {
  it("AppError surfaces curated public message and code", () => {
    const res = mockRes();
    sendApiError(res, new AppError("Customer not found", { status: 404, code: "CUSTOMER_MISSING" }), {
      route: "test",
      category: "crm",
    });
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, "Customer not found");
    assert.equal(res.body.code, "CUSTOMER_MISSING");
    assert.ok(res.body.requestId);
  });

  it("unexpected errors never leak raw message", () => {
    const res = mockRes();
    sendApiError(res, new Error("relation \"secret_table\" does not exist"), {
      route: "test",
      category: "crm",
      publicMessage: "Something went wrong. Please try again.",
      publicCode: "INTERNAL_ERROR",
    });
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, "Something went wrong. Please try again.");
    assert.equal(res.body.code, "INTERNAL_ERROR");
    assert.doesNotMatch(res.body.error, /secret_table/);
  });

  it("maps duplicate DB errors to 409 without raw text", () => {
    const res = mockRes();
    sendDbClientError(res, { message: 'duplicate key value violates unique constraint "x"' }, {
      route: "test",
      category: "admin",
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "DUPLICATE");
    assert.doesNotMatch(res.body.error, /duplicate key/i);
  });

  it("packages Android only with an explicit secure Titan API and allows Capacitor's secure localhost origin", () => {
    const workflow = readFileSync(new URL("../.github/workflows/android-release.yml", import.meta.url), "utf8");
    const cors = readFileSync(new URL("../api/_lib/cors.js", import.meta.url), "utf8");

    assert.match(workflow, /VITE_API_BASE_URL:\s*\$\{\{ vars\.TITANOS_API_BASE_URL \}\}/);
    assert.match(workflow, /TITANOS_API_BASE_URL repository variable is required/);
    assert.match(workflow, /TITANOS_API_BASE_URL must use HTTPS/);
    assert.match(workflow, /Refusing to build Android against the disabled legacy TitanOS web deployment/);
    assert.match(cors, /"https:\/\/localhost"/);
  });
});

describe("local fallback delete integrity", () => {
  it("treats a successful remote delete as authoritative and clears a matching fallback copy", async () => {
    let rows = [{ id: "target" }, { id: "keep" }];
    let remoteCalls = 0;

    const result = await deleteEntityWithLocalFallback({
      id: "target",
      remoteDelete: async () => { remoteCalls += 1; },
      readLocalRows: () => rows,
      writeLocalRows: (next) => { rows = next; },
    });

    assert.equal(remoteCalls, 1);
    assert.deepEqual(rows, [{ id: "keep" }]);
    assert.deepEqual(result, { source: "remote", degraded: false });
  });

  it("permits deletion of a known local-only record when the backend is unavailable", async () => {
    let rows = [{ id: "local-target" }, { id: "keep" }];

    const result = await deleteEntityWithLocalFallback({
      id: "local-target",
      remoteDelete: async () => { throw new Error("offline"); },
      readLocalRows: () => rows,
      writeLocalRows: (next) => { rows = next; },
    });

    assert.deepEqual(rows, [{ id: "keep" }]);
    assert.deepEqual(result, { source: "local", degraded: true });
  });

  it("propagates a failed authoritative delete when no matching local record exists", async () => {
    let writes = 0;

    await assert.rejects(
      () => deleteEntityWithLocalFallback({
        id: "remote-target",
        remoteDelete: async () => { throw new Error("permission denied"); },
        readLocalRows: () => [{ id: "other" }],
        writeLocalRows: () => { writes += 1; },
      }),
      /permission denied/
    );

    assert.equal(writes, 0);
  });

  it("does not turn a successful remote delete into failure when stale cache cleanup fails", async () => {
    const result = await deleteEntityWithLocalFallback({
      id: "target",
      remoteDelete: async () => {},
      readLocalRows: () => [{ id: "target" }],
      writeLocalRows: () => { throw new Error("storage quota"); },
    });

    assert.deepEqual(result, { source: "remote", degraded: false });
  });
});
