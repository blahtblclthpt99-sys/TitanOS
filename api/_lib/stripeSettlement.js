export function checkoutSettlementAction(eventType, session = {}) {
  const type = String(eventType || "");
  const mode = String(session?.mode || "");
  const paymentStatus = String(session?.payment_status || "").toLowerCase();

  if (type === "checkout.session.completed" && mode === "subscription") {
    return "sync_subscription";
  }

  if (type === "checkout.session.async_payment_succeeded") {
    return "settle_payment";
  }

  if (type === "checkout.session.completed") {
    // Checkout can be complete while a delayed payment method is still unpaid.
    // TitanOS must not mark an invoice/payment settled until Stripe reports paid.
    return paymentStatus === "paid" ? "settle_payment" : "await_payment";
  }

  if (type === "checkout.session.expired" || type === "checkout.session.async_payment_failed") {
    return "cancel_payment";
  }

  if (type === "payment_intent.payment_failed" || type === "charge.failed") {
    return "fail_payment";
  }

  if (type === "charge.refunded") {
    return "refund_payment";
  }

  return "ignore";
}
