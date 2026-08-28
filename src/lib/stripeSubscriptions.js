import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { createFunctionsModule } from "@/api/functions";
import { isMembershipCheckoutLive } from "@/lib/launchStatus";

const PAID_STRIPE_PLANS = new Set(["starter", "worker_premium", "business"]);

function isAndroidPlayBuild() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function normalizePlanId(planId) {
  const requested = String(planId || "").trim().toLowerCase();
  return requested === "pro" ? "worker_premium" : requested;
}

function assertStripeCheckoutUrl(value) {
  if (typeof value !== "string" || !value) {
    throw new Error("Stripe Checkout is not available yet.");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Stripe Checkout returned an invalid redirect.");
  }
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
    throw new Error("Stripe Checkout returned an untrusted redirect.");
  }
  return url.toString();
}

export async function startStripeSubscription(planId) {
  if (isAndroidPlayBuild()) {
    throw new Error("Subscriptions in the Android app are handled securely by Google Play.");
  }

  const normalizedPlanId = normalizePlanId(planId);
  if (!PAID_STRIPE_PLANS.has(normalizedPlanId)) {
    throw new Error("Unknown TitanOS subscription plan.");
  }

  if (!isMembershipCheckoutLive()) {
    throw new Error("Membership checkout is temporarily unavailable while payment readiness is being verified.");
  }

  const result = await createFunctionsModule().invoke("createSubscriptionCheckout", {
    planId: normalizedPlanId,
  });
  window.location.assign(assertStripeCheckoutUrl(result?.url));
}

export async function openStripeCustomerPortal() {
  if (isAndroidPlayBuild()) {
    await Browser.open({ url: "https://play.google.com/store/account/subscriptions" });
    return;
  }
  const result = await createFunctionsModule().invoke("stripeCustomerPortal", {});
  if (!result?.url) throw new Error("The billing portal is not available yet.");
  window.location.assign(result.url);
}
