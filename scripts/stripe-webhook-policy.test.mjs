/**
 * Stripe webhook settlement policy unit tests.
 * Run: node --test scripts/stripe-webhook-policy.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkoutSettlementAction } from "../api/_lib/stripeSettlement.js";

function shouldAcceptCheckoutAmount({ amountTotalCents, balanceDue, total }) {
  const paid = Number(amountTotalCents) / 100;
  const due = Number(balanceDue ?? total ?? 0);
  if (!Number.isFinite(paid) || paid <= 0) return false;
  if (!Number.isFinite(due) || due <= 0) return false;
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

describe("checkout settlement state", () => {
  it("settles an immediately paid Checkout session", () => {
    assert.equal(
      checkoutSettlementAction("checkout.session.completed", {
        mode: "payment",
        payment_status: "paid",
      }),
      "settle_payment"
    );
  });

  it("does not settle a completed but unpaid delayed payment", () => {
    assert.equal(
      checkoutSettlementAction("checkout.session.completed", {
        mode: "payment",
        payment_status: "unpaid",
      }),
      "await_payment"
    );
  });

  it("settles delayed payment only after async success", () => {
    assert.equal(
      checkoutSettlementAction("checkout.session.async_payment_succeeded", {
        mode: "payment",
        payment_status: "paid",
      }),
      "settle_payment"
    );
  });

  it("keeps subscription checkout on the subscription sync path", () => {
    assert.equal(
      checkoutSettlementAction("checkout.session.completed", {
        mode: "subscription",
        payment_status: "paid",
      }),
      "sync_subscription"
    );
  });

  it("maps delayed failure and expiry to cancellation", () => {
    assert.equal(
      checkoutSettlementAction("checkout.session.async_payment_failed", { mode: "payment" }),
      "cancel_payment"
    );
    assert.equal(
      checkoutSettlementAction("checkout.session.expired", { mode: "payment" }),
      "cancel_payment"
    );
  });
});

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
