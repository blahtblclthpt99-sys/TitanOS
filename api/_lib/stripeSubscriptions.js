const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function stripePlanCatalog() {
  return {
    starter: process.env.STRIPE_PRICE_STARTER_MONTHLY || "",
    worker_premium: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
    business: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || "",
  };
}

export function planForStripePrice(priceId) {
  const match = Object.entries(stripePlanCatalog()).find(([, configured]) => configured && configured === priceId);
  return match?.[0] || null;
}

export function stripeSubscriptionsConfigured() {
  const prices = stripePlanCatalog();
  return Boolean(process.env.STRIPE_SECRET_KEY && prices.starter && prices.worker_premium && prices.business);
}

export async function syncStripeSubscription(admin, subscription) {
  const stripeSubscriptionId = String(subscription?.id || "");
  const customerId = String(subscription?.customer || "");
  const userId = String(subscription?.metadata?.user_id || "");
  const priceId = String(subscription?.items?.data?.[0]?.price?.id || "");
  const planTier = planForStripePrice(priceId);
  if (!stripeSubscriptionId || !customerId || !userId || !planTier) {
    return { ok: false, reason: "unrecognized_subscription" };
  }

  const status = String(subscription.status || "unknown");
  const periodEnd = Number(subscription.current_period_end || 0);
  const row = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_price_id: priceId,
    plan_tier: planTier,
    status,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error: subscriptionError } = await admin
    .from("stripe_subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });
  if (subscriptionError) throw subscriptionError;

  const { data: activeRows, error: activeError } = await admin
    .from("stripe_subscriptions")
    .select("plan_tier,status")
    .eq("user_id", userId)
    .in("status", [...ACTIVE_STATUSES]);
  if (activeError) throw activeError;
  const rank = { starter: 1, worker_premium: 2, business: 3 };
  const activePlan = (activeRows || [])
    .map((item) => item.plan_tier)
    .sort((a, b) => (rank[b] || 0) - (rank[a] || 0))[0] || null;
  const entitled = Boolean(activePlan);
  const { data: profile } = await admin.from("profiles")
    .select("lifetime_premium,founding_user")
    .eq("id", userId).maybeSingle();
  const permanentAccess = profile?.lifetime_premium === true || profile?.founding_user === true;
  const { error: profileError } = await admin.from("profiles").update({
    plan_tier: entitled ? activePlan : permanentAccess ? "worker_premium" : "worker_free",
    is_pro: entitled || permanentAccess,
    paying_subscriber: entitled,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
  if (profileError) throw profileError;
  return { ok: true, userId, planTier: activePlan || planTier, status, entitled, permanentAccess };
}
