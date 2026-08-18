import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { syncStripeSubscription } from "../_lib/stripeSubscriptions.js";
import { loadOwnedSupportCase, writeSupportAudit } from "../_lib/support.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 4, windowMs: 10 * 60_000, key: "supportRefreshSubscription", requireDurable: true }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const supportCase = await loadOwnedSupportCase(auth.admin, auth.user.id, body.case_id);
    if (!supportCase) return res.status(404).json({ error: "Support case not found." });
    if (supportCase.category !== "billing") {
      return res.status(409).json({ error: "Subscription reconciliation is available only on billing support cases." });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(503).json({ error: "Subscription service is not configured." });

    const { data: rows, error: rowError } = await auth.admin
      .from("stripe_subscriptions")
      .select("stripe_subscription_id,status,updated_at")
      .eq("user_id", auth.user.id)
      .not("stripe_subscription_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (rowError) throw rowError;
    if (!rows?.length) {
      await writeSupportAudit(auth.admin, {
        caseId: supportCase.id,
        actorUserId: auth.user.id,
        action: "subscription_refresh_no_mapping",
        targetType: "support_action",
        metadata: { result: "no_subscription_mapping" },
      });
      return res.status(404).json({ error: "No TitanOS subscription mapping was found for this account." });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);
    let synced = null;
    let lastStatus = null;
    for (const row of rows) {
      try {
        const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id, {
          expand: ["items.data.price"],
        });
        if (String(subscription?.metadata?.user_id || "") !== String(auth.user.id)) {
          continue;
        }
        synced = await syncStripeSubscription(auth.admin, subscription);
        lastStatus = subscription.status || null;
        if (synced?.ok) break;
      } catch (error) {
        if (error?.statusCode === 404) continue;
        throw error;
      }
    }

    if (!synced?.ok) {
      await writeSupportAudit(auth.admin, {
        caseId: supportCase.id,
        actorUserId: auth.user.id,
        action: "subscription_refresh_unrecognized",
        targetType: "support_action",
        metadata: { result: synced?.reason || "no_verified_subscription" },
      });
      return res.status(409).json({ error: "A verified Stripe subscription could not be reconciled to this TitanOS account." });
    }

    await auth.admin.from("support_case_events").insert({
      case_id: supportCase.id,
      actor_user_id: auth.user.id,
      event_type: "support_action_executed",
      details: { action: "refresh_subscription_status", result: "success", status: lastStatus },
    });
    await writeSupportAudit(auth.admin, {
      caseId: supportCase.id,
      actorUserId: auth.user.id,
      action: "subscription_status_refreshed",
      targetType: "support_action",
      metadata: { status: lastStatus || "unknown", entitled: synced.entitled === true },
    });

    return res.status(200).json({
      success: true,
      status: lastStatus,
      plan_tier: synced.planTier,
      entitled: synced.entitled,
      permanent_access: synced.permanentAccess,
    });
  } catch (error) {
    logError("supportRefreshSubscription", error);
    captureApiException(error, { tags: { route: "supportRefreshSubscription" } });
    return res.status(500).json({ error: "Subscription status could not be refreshed." });
  }
}
