/**
 * Stripe webhook settlement + refund policy unit tests.
 * Run: node --test scripts/stripe-webhook-policy.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkoutPaymentIsSettled,
  deriveRefundReconciliation,
} from "../api/functions/stripeWebhook.js";

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

describe("checkout settlement authority", () => {
  it("accepts immediate completed checkout only when Stripe reports paid", () => {
    assert.equal(
      checkoutPaymentIsSettled("checkout.session.completed", { payment_status: "paid" }),
      true
    );
    assert.equal(
      checkoutPaymentIsSettled("checkout.session.completed", { payment_status: "unpaid" }),
      false
    );
  });

  it("accepts asynchronous success only when Stripe reports paid", () => {
    assert.equal(
      checkoutPaymentIsSettled("checkout.session.async_payment_succeeded", { payment_status: "paid" }),
      true
    );
    assert.equal(
      checkoutPaymentIsSettled("checkout.session.async_payment_succeeded", { payment_status: "unpaid" }),
      false
    );
  });

  it("rejects unrelated or failed events as settlement authority", () => {
    assert.equal(
      checkoutPaymentIsSettled("checkout.session.async_payment_failed", { payment_status: "paid" }),
      false
    );
    assert.equal(
      checkoutPaymentIsSettled("payment_intent.payment_failed", { payment_status: "paid" }),
      false
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

describe("refund reconciliation math", () => {
  it("allocates a partial zero-fee portal refund exactly to invoice principal", () => {
    const result = deriveRefundReconciliation({
      chargeAmountCents: 10000,
      amountRefundedCents: 2500,
      previousRefundedAmount: 0,
      baseAmount: 100,
      platformFee: 0,
    });
    assert.deepEqual(result, {
      chargeAmount: 100,
      cumulativeRefunded: 25,
      refundDelta: 25,
      fullRefund: false,
      refundedBaseAmount: 25,
      requiresPrincipalAllocation: false,
    });
  });

  it("uses cumulative amount to make duplicate and out-of-order events monotonic", () => {
    const duplicate = deriveRefundReconciliation({
      chargeAmountCents: 10000,
      amountRefundedCents: 2500,
      previousRefundedAmount: 25,
      baseAmount: 100,
      platformFee: 0,
    });
    assert.equal(duplicate.cumulativeRefunded, 25);
    assert.equal(duplicate.refundDelta, 0);

    const olderEvent = deriveRefundReconciliation({
      chargeAmountCents: 10000,
      amountRefundedCents: 1000,
      previousRefundedAmount: 25,
      baseAmount: 100,
      platformFee: 0,
    });
    assert.equal(olderEvent.cumulativeRefunded, 25);
    assert.equal(olderEvent.refundDelta, 0);
    assert.equal(olderEvent.refundedBaseAmount, 25);
  });

  it("marks a full fee-bearing refund as exact because all principal was returned", () => {
    const result = deriveRefundReconciliation({
      chargeAmountCents: 10800,
      amountRefundedCents: 10800,
      previousRefundedAmount: 0,
      baseAmount: 100,
      platformFee: 8,
    });
    assert.equal(result.fullRefund, true);
    assert.equal(result.refundedBaseAmount, 100);
    assert.equal(result.requiresPrincipalAllocation, false);
  });

  it("fails closed on partial fee-bearing refund allocation", () => {
    const result = deriveRefundReconciliation({
      chargeAmountCents: 10800,
      amountRefundedCents: 1000,
      previousRefundedAmount: 0,
      baseAmount: 100,
      platformFee: 8,
    });
    assert.equal(result.fullRefund, false);
    assert.equal(result.refundedBaseAmount, null);
    assert.equal(result.requiresPrincipalAllocation, true);
  });

  it("rejects impossible refund totals", () => {
    assert.throws(
      () =>
        deriveRefundReconciliation({
          chargeAmountCents: 10000,
          amountRefundedCents: 12000,
          previousRefundedAmount: 0,
          baseAmount: 100,
          platformFee: 0,
        }),
      /Invalid Stripe refunded amount/
    );
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
