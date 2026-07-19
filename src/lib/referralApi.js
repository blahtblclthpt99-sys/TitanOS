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
        body: `You're invited to TitanOS — Free During Beta.\n\nSign up: ${getReferralLink(code)}\n\nAfter paid launch, 3 paying referrals unlock Lifetime Premium.`,
      });
    } catch {
      /* optional */
    }
    return row;
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    writeLocal(PREFIX, user.id, "rows", [row, ...existing]);
    return row;
  }
}

/** Call on register when ?ref=CODE is present — uses server for correct attribution. */
export async function attachReferralOnSignup({ userId, email, refCode }) {
  if (!refCode || !userId) return null;
  try {
    const result = await api.functions.invoke("attachReferral", {
      userId,
      email,
      refCode,
    });
    return result?.data || result;
  } catch {
    // Client fallback
    try {
      const all = await api.entities.Referral.list("-created_date", 500);
      const match = all.find(
        (r) =>
          (r.referral_code || "").toUpperCase() === refCode.toUpperCase() &&
          r.status === "pending" &&
          (!r.referred_email || r.referred_email.toLowerCase() === (email || "").toLowerCase())
      );
      if (match) {
        return api.entities.Referral.update(match.id, {
          status: "signed_up",
          referred_user_id: userId,
          referred_email: email,
        });
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * Mark referred user as paying (admin / billing hook).
 * Grants lifetime premium at 3 verified paying referrals.
 */
export async function markReferralPaying(referredUserId) {
  try {
    return await api.functions.invoke("markReferralPaying", { referredUserId });
  } catch (error) {
    // Local/dev fallback: mark rows only (cannot set another user's lifetime_premium)
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
      }
    } catch {
      /* ignore */
    }
    throw error;
  }
}
