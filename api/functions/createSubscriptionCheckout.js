import Stripe from "stripe";
import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions, resolveAppOrigin } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";
import { stripePlanCatalog, stripeSubscriptionsConfigured } from "../_lib/stripeSubscriptions.js";

const STRIPE_TIMEOUT_MS = 10_000;
const SAFE_IDEMPOTENCY_RETRY_MS = 23 * 60 * 60 * 1000;
const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"]);

function bearer(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
}

function normalizedPlan(value) {
  const requested = String(value || "").trim().toLowerCase();
  return requested === "pro" ? "worker_premium" : requested;
}

async function loadSubscriptionState(admin, userId) {
  const { data, error } = await admin
    .from("stripe_subscriptions")
    .select("stripe_customer_id,stripe_subscription_id,plan_tier,status,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  const rows = data || [];
  const nonterminal = rows.filter(
    (row) => !TERMINAL_SUBSCRIPTION_STATUSES.has(String(row.status || "").toLowerCase())
  );
  const activeCustomerIds = [
    ...new Set(nonterminal.map((row) => String(row.stripe_customer_id || "").trim()).filter(Boolean)),
  ];
  const historicalCustomerId =
    rows.map((row) => String(row.stripe_customer_id || "").trim()).find(Boolean) || null;

  return { rows, nonterminal, activeCustomerIds, historicalCustomerId };
}

async function createBillingPortal(stripe, customerId, origin) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/settings?panel=membership`,
  });
}

async function existingSubscriptionResponse({ stripe, state, origin }) {
  if (!state.nonterminal.length) return null;
  if (state.activeCustomerIds.length !== 1) {
    return {
      status: 409,
      body: {
        error: "Multiple subscription billing identities require review before another subscription can be started.",
        code: "MULTIPLE_SUBSCRIPTIONS_REQUIRES_REVIEW",
      },
    };
  }

  try {
    const portal = await createBillingPortal(stripe, state.activeCustomerIds[0], origin);
    return {
      status: 200,
      body: {
        url: portal.url,
        management: true,
        existingSubscription: true,
        message: "An existing subscription is already attached to this account. Manage it in Stripe Billing.",
      },
    };
  } catch (error) {
    logError("createSubscriptionCheckout:billing_portal", {
      message: error?.message || String(error),
    });
    return {
      status: 409,
      body: {
        error: "An existing subscription was found, but billing management could not be opened safely.",
        code: "SUBSCRIPTION_MANAGEMENT_REQUIRED",
      },
    };
  }
}

async function claimSubscriptionCheckout(admin, userId, planId) {
  const { data, error } = await admin.rpc("claim_subscription_checkout", {
    p_user_id: userId,
    p_plan_tier: planId,
  });
  if (error) return { error };
  const claim = Array.isArray(data) ? data[0] : data;
  if (!claim?.claim_id) return { error: new Error("Subscription checkout claim returned no identity") };
  return { claim };
}

function claimErrorResponse(error) {
  const message = String(error?.message || error || "");
  if (/subscription_checkout_plan_conflict/i.test(message)) {
    return {
      status: 409,
      body: {
        error: "A different subscription Checkout is already pending. Finish or expire it before choosing another plan.",
        code: "SUBSCRIPTION_CHECKOUT_PLAN_CONFLICT",
      },
    };
  }
  if (/subscription_checkout_reconciliation_required/i.test(message)) {
    return {
      status: 409,
      body: {
        error: "A prior subscription Checkout requires reconciliation before another subscription can be started.",
        code: "SUBSCRIPTION_RECONCILIATION_REQUIRED",
      },
    };
  }
  return null;
}

async function updateClaim(admin, claimId, patch) {
  const { error } = await admin
    .from("stripe_subscription_checkout_claims")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", claimId);
  if (error) throw error;
}

function sessionMatchesClaim(session, claim, userId, planId) {
  const metadata = session?.metadata || {};
  return (
    (!metadata.checkout_claim_id || String(metadata.checkout_claim_id) === String(claim.claim_id)) &&
    (!metadata.user_id || String(metadata.user_id) === String(userId)) &&
    (!metadata.plan_tier || String(metadata.plan_tier) === String(planId))
  );
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 8, windowMs: 60_000, key: "subscriptionCheckout" }))) return;

  try {
    if (!stripeSubscriptionsConfigured()) {
      return res.status(503).json({ error: "Subscriptions are not configured yet" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(bearer(req));
    if (error || !data?.user) return res.status(401).json({ error: "Authentication required" });

    const user = data.user;
    const planId = normalizedPlan(readJson(req).planId);
    const priceId = stripePlanCatalog()[planId];
    if (!priceId) return res.status(400).json({ error: "Unknown subscription plan" });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      timeout: STRIPE_TIMEOUT_MS,
      maxNetworkRetries: 1,
    });
    const origin = resolveAppOrigin(req);

    // A non-terminal subscription is authoritative. Never create another
    // billable subscription for the user; route them to billing management.
    let subscriptionState = await loadSubscriptionState(admin, user.id);
    const existing = await existingSubscriptionResponse({ stripe, state: subscriptionState, origin });
    if (existing) return res.status(existing.status).json(existing.body);

    let claimResult = await claimSubscriptionCheckout(admin, user.id, planId);
    if (claimResult.error) {
      const message = String(claimResult.error.message || "");
      if (/subscription_existing_nonterminal/i.test(message)) {
        // A webhook may have created the subscription between preflight and the
        // serialized claim. Re-read state and route to management.
        subscriptionState = await loadSubscriptionState(admin, user.id);
        const racedExisting = await existingSubscriptionResponse({
          stripe,
          state: subscriptionState,
          origin,
        });
        if (racedExisting) return res.status(racedExisting.status).json(racedExisting.body);
      }
      const mapped = claimErrorResponse(claimResult.error);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw claimResult.error;
    }

    let claim = claimResult.claim;

    for (let pass = 0; pass < 3 && claim.reused; pass += 1) {
      if (claim.stripe_session_id) {
        let existingSession;
        try {
          existingSession = await stripe.checkout.sessions.retrieve(claim.stripe_session_id);
        } catch (error) {
          logError("createSubscriptionCheckout:session_lookup", {
            message: error?.message || String(error),
            claimId: claim.claim_id,
            sessionId: claim.stripe_session_id,
          });
          return res.status(409).json({
            error: "The existing subscription Checkout could not be verified. No new subscription was created.",
            code: "SUBSCRIPTION_RECONCILIATION_REQUIRED",
          });
        }

        if (!sessionMatchesClaim(existingSession, claim, user.id, planId)) {
          await updateClaim(admin, claim.claim_id, { state: "requires_review" });
          return res.status(409).json({
            error: "The existing subscription Checkout has inconsistent reconciliation metadata.",
            code: "SUBSCRIPTION_RECONCILIATION_REQUIRED",
          });
        }

        if (existingSession.status === "open" && existingSession.url) {
          await updateClaim(admin, claim.claim_id, {
            state: "open",
            checkout_url: existingSession.url,
          });
          return res.status(200).json({ url: existingSession.url, reused: true });
        }

        if (existingSession.status === "complete") {
          await updateClaim(admin, claim.claim_id, { state: "completed" });
          return res.status(409).json({
            error: "This subscription Checkout already completed and is being reconciled.",
            code: "SUBSCRIPTION_SETTLEMENT_PENDING",
          });
        }

        if (existingSession.status === "expired") {
          await updateClaim(admin, claim.claim_id, { state: "expired" });
          claimResult = await claimSubscriptionCheckout(admin, user.id, planId);
          if (claimResult.error) {
            const mapped = claimErrorResponse(claimResult.error);
            if (mapped) return res.status(mapped.status).json(mapped.body);
            throw claimResult.error;
          }
          claim = claimResult.claim;
          continue;
        }

        await updateClaim(admin, claim.claim_id, { state: "requires_review" });
        return res.status(409).json({
          error: "The existing subscription Checkout is in an unknown state and requires reconciliation.",
          code: "SUBSCRIPTION_RECONCILIATION_REQUIRED",
        });
      }

      const claimedAt = Date.parse(claim.claimed_at || "");
      const ageMs = Number.isFinite(claimedAt) ? Date.now() - claimedAt : Number.POSITIVE_INFINITY;
      if (ageMs < 0 || ageMs >= SAFE_IDEMPOTENCY_RETRY_MS) {
        await updateClaim(admin, claim.claim_id, { state: "requires_review" });
        return res.status(409).json({
          error: "An older unresolved subscription Checkout must be reconciled before another can be created.",
          code: "SUBSCRIPTION_RECONCILIATION_REQUIRED",
        });
      }
      break;
    }

    const checkoutParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      allow_promotion_codes: true,
      success_url: `${origin}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
      metadata: {
        user_id: user.id,
        plan_tier: planId,
        checkout_claim_id: claim.claim_id,
        source: "subscription_checkout",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_tier: planId,
          checkout_claim_id: claim.claim_id,
          source: "subscription_checkout",
        },
      },
    };

    if (claim.stripe_customer_id) checkoutParams.customer = claim.stripe_customer_id;
    else checkoutParams.customer_email = user.email || undefined;

    let session;
    try {
      session = await stripe.checkout.sessions.create(checkoutParams, {
        idempotencyKey: `subscription_checkout_${claim.claim_id}`,
      });
    } catch (error) {
      logError("createSubscriptionCheckout:create_unconfirmed", {
        message: error?.message || String(error),
        claimId: claim.claim_id,
      });
      return res.status(502).json({
        error: "Subscription Checkout could not be confirmed. The pending claim was preserved for safe retry.",
        code: "SUBSCRIPTION_CHECKOUT_UNCONFIRMED",
      });
    }

    try {
      await updateClaim(admin, claim.claim_id, {
        state: "open",
        stripe_session_id: session.id,
        checkout_url: session.url,
        stripe_customer_id:
          typeof session.customer === "string" ? session.customer : claim.stripe_customer_id || null,
      });
    } catch (updateError) {
      // Stripe has the claim ID as an idempotency key and metadata. Keep the
      // successful Session; a retry with the same claim cannot create another.
      logError("createSubscriptionCheckout:claim_link_update", {
        message: updateError?.message || String(updateError),
        claimId: claim.claim_id,
        sessionId: session.id,
      });
    }

    return res.status(200).json({ url: session.url, reused: Boolean(claim.reused) });
  } catch (error) {
    logError("createSubscriptionCheckout", { message: error?.message || String(error) });
    return res.status(500).json({ error: "Could not start subscription checkout" });
  }
}
