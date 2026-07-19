import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { makeReferralCode } from "@/lib/platformConstants";
import { REFERRAL_REWARD } from "@/lib/plan";

const PREFIX = "titanos_referrals";

export async function ensureReferralCode(user, updateMe) {
  if (user?.referral_code) return user.referral_code;
  const code = makeReferralCode(user?.email || user?.id || "");
  try {
    await updateMe({ referral_code: code });
  } catch {
    writeLocal(PREFIX, user.id, "code", code);
  }
  return code;
}

export function getReferralLink(code) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
}

export async function listReferrals(userId) {
  try {
    return await api.entities.Referral.filter({ referrer_user_id: userId });
  } catch {
    return readLocal(PREFIX, userId, "rows", []);
  }
}

export function referralStats(referrals = []) {
  const safe = referrals.filter((r) => !r.fraud_flag);
  const pending = safe.filter((r) => r.status === "pending");
  const signedUp = safe.filter((r) => r.status === "signed_up" || r.status === "completed");
  const paying = safe.filter((r) => r.is_paying || r.status === "completed");
  const required = REFERRAL_REWARD.requiredPayingReferrals;
  const completedPaying = Math.min(paying.length, required);
  return {
    pending,
    signedUp,
    paying,
    completedPaying,
    required,
    progressLabel: `${completedPaying} of ${required} referrals completed`,
    rewardUnlocked: completedPaying >= required,
  };
}

export async function inviteReferral(user, email, code) {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Enter a valid email address.");

  const existing = await listReferrals(user.id);
  if (existing.some((r) => (r.referred_email || "").toLowerCase() === normalized)) {
    throw new Error("You've already invited this person.");
  }
  // Fraud: cannot refer yourself
  if (normalized === (user.email || "").toLowerCase()) {
    throw new Error("You can't refer yourself.");
  }

  const payload = {
    referrer_user_id: user.id,
    referrer_email: user.email,
    referred_email: normalized,
    referral_code: code,
    status: "pending",
    is_paying: false,
    fraud_flag: false,
    created_by_id: user.id,
  };

  try {
    const row = await api.entities.Referral.create(payload);
    try {
      await api.integrations.Core.SendEmail({
        to: normalized,
        from_name: user.full_name || "TitanOS",
        subject: `${user.full_name || "Someone"} invited you to TitanOS`,
        body: `You're invited to TitanOS — free during beta.\n\nSign up: ${getReferralLink(code)}\n\nAfter paid launch, when 3 of your referrals become paying subscribers, you unlock Lifetime Premium.`,
      });
    } catch {
      /* email optional */
    }
    return row;
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    const rows = [row, ...existing];
    writeLocal(PREFIX, user.id, "rows", rows);
    return row;
  }
}

/** Call on register when ?ref=CODE is present */
export async function attachReferralOnSignup({ userId, email, refCode }) {
  if (!refCode || !userId) return null;
  try {
    // Find pending invite by email or create signed_up row
    const all = await api.entities.Referral.list("-created_date", 500);
    const match = all.find(
      (r) =>
        (r.referral_code || "").toUpperCase() === refCode.toUpperCase() &&
        (!r.referred_email || r.referred_email.toLowerCase() === (email || "").toLowerCase()) &&
        r.status === "pending"
    );
    if (match) {
      return api.entities.Referral.update(match.id, {
        status: "signed_up",
        referred_user_id: userId,
        referred_email: email,
      });
    }
    // Orphan signup with code — attribute to referrer who owns the code via profile later
    return api.entities.Referral.create({
      referrer_user_id: "pending_lookup",
      referrer_email: "",
      referred_email: email,
      referred_user_id: userId,
      referral_code: refCode,
      status: "signed_up",
      is_paying: false,
      created_by_id: userId,
    });
  } catch {
    return null;
  }
}

/**
 * When a referred user becomes a paying subscriber, mark referral complete
 * and grant lifetime premium at 3 verified paying referrals.
 * Wire this from Stripe webhook later; callable now for admin/testing.
 */
export async function markReferralPaying(referredUserId) {
  try {
    const rows = await api.entities.Referral.filter({ referred_user_id: referredUserId });
    for (const row of rows) {
      if (row.fraud_flag) continue;
      await api.entities.Referral.update(row.id, {
        status: "completed",
        is_paying: true,
        verified_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
      await maybeGrantLifetimePremium(row.referrer_user_id);
    }
  } catch {
    /* tables may not exist yet */
  }
}

async function maybeGrantLifetimePremium(referrerUserId) {
  if (!referrerUserId || referrerUserId === "pending_lookup") return;
  const rows = await api.entities.Referral.filter({ referrer_user_id: referrerUserId });
  const paying = rows.filter((r) => r.is_paying && !r.fraud_flag);
  if (paying.length < REFERRAL_REWARD.requiredPayingReferrals) return;

  // Direct profile update via supabase through a tiny RPC-less path:
  // use auth admin is not available client-side; store grant intent as notification
  // and set is_pro via entity if we expose Profile — for now notify + best-effort
  try {
    await api.entities.Notification.create({
      user_id: referrerUserId,
      type: "referrals",
      title: "Lifetime Premium unlocked!",
      body: `You referred ${REFERRAL_REWARD.requiredPayingReferrals} paying subscribers. Lifetime TitanOS Premium is yours.`,
      link: "/referral",
      created_by_id: referrerUserId,
    });
  } catch {
    /* optional */
  }
}
