/**
 * Auto-classify DoorDash deliveries from stack size + restaurant wait.
 * Manual orderType always wins in UI; this adds classification + can fill gaps.
 * Kept free of doorDashWorkflow imports to avoid circular deps.
 */

const SLOW_WAIT_MS = 12 * 60 * 1000; // 12 minutes at restaurant ⇒ "slow business"

const LABELS = Object.freeze({
  slow_single: "Slow Business Single",
  slow_double: "Slow Business Double",
  slow_triple: "Slow Business Triple",
  single: "Single",
  double: "Double",
  triple: "Triple",
});

function timerElapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;
  const base = Number(timer.accumulatedMs || 0);
  if (timer.runningSince != null) {
    return base + Math.max(0, now - Number(timer.runningSince));
  }
  return base;
}

/**
 * @returns {{ orderTypeId: string, label: string, confidence: number, source: "auto", stack: number, slow: boolean }}
 */
export function classifyDeliveryType(delivery, { now = Date.now() } = {}) {
  if (!delivery) return null;

  const accepted = Number(delivery.acceptedAddons || 0);
  const base = Math.max(1, Number(delivery.activeOrderCount || 1));
  const stack = Math.min(3, Math.max(1, base + (accepted > 0 ? Math.min(accepted, 2) : 0)));

  const waitMs = timerElapsedMs(delivery.secondaryTimer, now);
  const slow = waitMs >= SLOW_WAIT_MS;

  let orderTypeId = "single";
  if (slow) {
    orderTypeId = stack >= 3 ? "slow_triple" : stack === 2 ? "slow_double" : "slow_single";
  } else {
    orderTypeId = stack >= 3 ? "triple" : stack === 2 ? "double" : "single";
  }

  let confidence = 0.55;
  if (waitMs >= SLOW_WAIT_MS * 1.5 || waitMs < 5 * 60 * 1000) confidence += 0.15;
  if (delivery.orderTypeId && delivery.orderTypeId === orderTypeId) confidence = 0.92;
  else if (delivery.orderTypeId && delivery.orderTypeId !== orderTypeId) confidence = 0.48;

  return {
    orderTypeId,
    label: LABELS[orderTypeId] || orderTypeId,
    confidence: Math.round(Math.min(0.95, confidence) * 100) / 100,
    source: "auto",
    stack,
    slow,
    restaurantWaitSec: Math.round(waitMs / 1000),
  };
}

/** Attach classification onto a finished delivery (non-destructive). */
export function withDeliveryClassification(delivery, { now = Date.now() } = {}) {
  if (!delivery) return delivery;
  const classification = classifyDeliveryType(delivery, { now });
  if (!classification) return delivery;
  return {
    ...delivery,
    classification,
    suggestedOrderTypeId: classification.orderTypeId,
  };
}
