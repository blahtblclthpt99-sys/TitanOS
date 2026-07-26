import assert from "node:assert/strict";
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
});
