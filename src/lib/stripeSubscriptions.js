import { createFunctionsModule } from "@/api/functions";

export async function startStripeSubscription(planId) {
  const result = await createFunctionsModule().invoke("createSubscriptionCheckout", { planId });
  if (!result?.url) throw new Error("Stripe Checkout is not available yet.");
  window.location.assign(result.url);
}

export async function openStripeCustomerPortal() {
  const result = await createFunctionsModule().invoke("stripeCustomerPortal", {});
  if (!result?.url) throw new Error("The billing portal is not available yet.");
  window.location.assign(result.url);
}
