import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

const PROFILE_FIELDS = [
  "id",
  "plan_tier",
  "is_pro",
  "paying_subscriber",
  "lifetime_premium",
  "founding_user",
  "founding_number",
  "founding_trial_ends_at",
  "founding_price_lock",
  "founding_locked_plan",
  "app_trial_started_at",
  "app_trial_ends_at",
].join(",");

function isoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await assertRateLimitAsync(req, res, { limit: 30, windowMs: 60_000, key: "subscriptionStatus" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { data: profile, error: profileError } = await auth.admin
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const { data: stripeRows, error: stripeError } = await auth.admin
      .from("stripe_subscriptions")
      .select("stripe_customer_id,stripe_subscription_id,plan_tier,status,cancel_at_period_end,current_period_end,updated_at")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (stripeError) throw stripeError;

    const activeStatuses = new Set(["active", "trialing", "past_due", "unpaid"]);
    const stripeSubscription = (stripeRows || []).find((row) => activeStatuses.has(String(row.status || ""))) || stripeRows?.[0] || null;
    const now = Date.now();
    const appTrialEndsAt = isoOrNull(profile?.app_trial_ends_at);
    const foundingTrialEndsAt = isoOrNull(profile?.founding_trial_ends_at);
    const trialEndsAt = foundingTrialEndsAt || appTrialEndsAt;
    const trialActive = Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > now);
    const lifetime = profile?.lifetime_premium === true;
    const founding = profile?.founding_user === true;
    const paying = profile?.paying_subscriber === true;

    let accessState = "free";
    if (lifetime) accessState = "lifetime";
    else if (founding && trialActive) accessState = "founding_trial";
    else if (founding) accessState = "founding";
    else if (stripeSubscription?.status === "trialing" || trialActive) accessState = "trial";
    else if (stripeSubscription?.status === "past_due" || stripeSubscription?.status === "unpaid") accessState = "payment_issue";
    else if (paying || stripeSubscription?.status === "active") accessState = "paid";
    else if (stripeSubscription?.status === "canceled") accessState = "canceled";

    return res.status(200).json({
      planTier: profile?.plan_tier || "worker_free",
      isPro: profile?.is_pro === true,
      payingSubscriber: paying,
      lifetimePremium: lifetime,
      foundingUser: founding,
      foundingNumber: profile?.founding_number || null,
      foundingPriceLock: profile?.founding_price_lock || null,
      foundingLockedPlan: profile?.founding_locked_plan || null,
      trialEndsAt,
      trialActive,
      accessState,
      stripe: stripeSubscription
        ? {
            status: stripeSubscription.status,
            planTier: stripeSubscription.plan_tier,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end === true,
            currentPeriodEnd: isoOrNull(stripeSubscription.current_period_end),
            manageable: Boolean(stripeSubscription.stripe_customer_id),
          }
        : null,
    });
  } catch (error) {
    logError("subscriptionStatus", error);
    return res.status(500).json({ error: "Could not load subscription status" });
  }
}
