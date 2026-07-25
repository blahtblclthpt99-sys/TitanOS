/**
 * Stripe webhook settlement policy unit tests (pure logic mirrors).
 * Run: node --test scripts/stripe-webhook-policy.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

function shouldAcceptCheckoutAmount({ amountTotalCents, balanceDue, total }) {
  const paid = Number(amountTotalCents) / 100;
  const due = Number(balanceDue ?? total ?? 0);
  if (!Number.isFinite(paid) || paid <= 0) return false;
  if (!Number.isFinite(due) || due <= 0) return false;
  // Allow 1 cent rounding tolerance
  return paid + 0.01 >= due;
}

function idempotencyDecision({ claimInserted, alreadyProcessed }) {
  if (alreadyProcessed) return "ack_duplicate";
  if (!claimInserted) return "fail_closed_503";
  return "process";
}

function ownerMismatchAction({ expectedUserId, invoiceOwnerId }) {
  if (expectedUserId && invoiceOwnerId && expectedUserId !== invoiceOwnerId) {
    return "skip_mark_paid";
  }
  return "continue";
}

describe("checkout amount settlement", () => {
  it("accepts full payment", () => {
    assert.equal(shouldAcceptCheckoutAmount({ amountTotalCents: 5000, balanceDue: 50 }), true);
  });
  it("rejects underpayment", () => {
    assert.equal(shouldAcceptCheckoutAmount({ amountTotalCents: 1000, balanceDue: 50 }), false);
  });
  it("rejects zero", () => {
    assert.equal(shouldAcceptCheckoutAmount({ amountTotalCents: 0, balanceDue: 50 }), false);
  });
});

describe("webhook idempotency", () => {
  it("acks duplicates", () => {
    assert.equal(idempotencyDecision({ claimInserted: false, alreadyProcessed: true }), "ack_duplicate");
  });
  it("fails closed without claim table success", () => {
    assert.equal(idempotencyDecision({ claimInserted: false, alreadyProcessed: false }), "fail_closed_503");
  });
  it("processes new events", () => {
    assert.equal(idempotencyDecision({ claimInserted: true, alreadyProcessed: false }), "process");
  });
});

describe("invoice ownership", () => {
  it("skips mark paid on mismatch", () => {
    assert.equal(
      ownerMismatchAction({ expectedUserId: "a", invoiceOwnerId: "b" }),
      "skip_mark_paid"
    );
  });
  it("continues when owner matches", () => {
    assert.equal(
      ownerMismatchAction({ expectedUserId: "a", invoiceOwnerId: "a" }),
      "continue"
    );
  });
});
