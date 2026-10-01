import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { AppError, sendApiError, sendDbClientError } from "../api/_lib/apiError.js";

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  it("packages Android with the canonical TitanOS API origin and allows Capacitor's secure localhost origin", () => {
    const workflow = readFileSync(new URL("../.github/workflows/android-release.yml", import.meta.url), "utf8");
    const productionEnv = readFileSync(new URL("../.env.production.example", import.meta.url), "utf8");
    const cors = readFileSync(new URL("../api/_lib/cors.js", import.meta.url), "utf8");

    const canonicalOrigin = productionEnv.match(/^VITE_TITANOS_PUBLIC_ORIGIN=(https:\/\/[^\s/]+)$/m)?.[1];
    assert.equal(canonicalOrigin, "https://app.titanfieldos.com");

    const escapedOrigin = escapeRegExp(canonicalOrigin);
    assert.match(workflow, new RegExp(`VITE_API_BASE_URL:\\s*["']${escapedOrigin}["']`));
    assert.match(workflow, new RegExp(`VITE_TITANOS_PUBLIC_ORIGIN:\\s*["']${escapedOrigin}["']`));
    assert.doesNotMatch(workflow, /titanos-web\.vercel\.app/);
    assert.match(cors, /"https:\/\/localhost"/);
  });
});
