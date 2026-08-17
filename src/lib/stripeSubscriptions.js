import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { createFunctionsModule } from "@/api/functions";

function isAndroidPlayBuild() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function startStripeSubscription(planId) {
  if (isAndroidPlayBuild()) {
    throw new Error("Subscriptions in the Android app are handled securely by Google Play.");
  }
  const result = await createFunctionsModule().invoke("createSubscriptionCheckout", { planId });
  if (!result?.url) throw new Error("Stripe Checkout is not available yet.");
  window.location.assign(result.url);
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
