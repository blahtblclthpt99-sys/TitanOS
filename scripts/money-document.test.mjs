/**
 * Money document + portal OTP helpers unit tests.
 * Run: node --test scripts/money-document.test.mjs scripts/portal-otp.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeLineItems,
  sanitizeTaxRate,
  computeDocumentTotals,
} from "../src/lib/moneyDocument.js";

describe("sanitizeLineItems", () => {
  it("rejects empty and negative values", () => {
    assert.equal(sanitizeLineItems([]).ok, false);
    assert.equal(
      sanitizeLineItems([{ description: "X", quantity: -1, unit_price: 10 }]).ok,
      false
    );
    assert.equal(
      sanitizeLineItems([{ description: "X", quantity: 1, unit_price: -5 }]).ok,
      false
    );
  });

  it("accepts valid lines and totals", () => {
    const r = sanitizeLineItems([
      { description: "Labor", quantity: 2, unit_price: 50 },
      { description: "Parts", quantity: 1, unit_price: 25.5 },
    ]);
    assert.equal(r.ok, true);
    assert.equal(r.items[0].total, 100);
    assert.equal(r.items[1].total, 25.5);
  });
});

describe("tax + totals", () => {
  it("rejects bad tax and computes totals", () => {
    assert.equal(sanitizeTaxRate(-1).ok, false);
    assert.equal(sanitizeTaxRate(101).ok, false);
    const lines = sanitizeLineItems([{ description: "A", quantity: 1, unit_price: 100 }]).items;
    const t = computeDocumentTotals(lines, 8.25);
    assert.equal(t.subtotal, 100);
    assert.equal(t.taxAmount, 8.25);
    assert.equal(t.total, 108.25);
  });
});
