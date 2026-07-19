import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

/**
 * Marks a referred user as paying and grants lifetime premium when eligible.
 * Body: { referredUserId } OR { referralId }
 * Auth: Bearer user JWT (admin) or internal secret header x-titanos-hook
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const admin = getSupabaseAdmin();
    const body = readJson(req);
    const hookSecret = process.env.TITANOS_BILLING_HOOK_SECRET;
    const authHeader = req.headers.authorization || "";
    const isHook =
      hookSecret &&
      (req.headers["x-titanos-hook"] === hookSecret ||
        authHeader === `Bearer ${hookSecret}`);

    if (!isHook) {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData?.user) return res.status(401).json({ error: "Unauthorized" });
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profile?.role !== "admin") {
        return res.status(403).json({ error: "Admin or billing hook required" });
      }
    }

    const referredUserId = body.referredUserId || body.referred_user_id;
    const referralId = body.referralId || body.referral_id;

    let rows = [];
    if (referralId) {
      const { data } = await admin.from("referrals").select("*").eq("id", referralId);
      rows = data || [];
    } else if (referredUserId) {
      const { data } = await admin
        .from("referrals")
        .select("*")
        .eq("referred_user_id", referredUserId);
      rows = data || [];
    } else {
      return res.status(400).json({ error: "referredUserId or referralId required" });
    }

    const updated = [];
    for (const row of rows) {
      if (row.fraud_flag) continue;
      const { data: next } = await admin
        .from("referrals")
        .update({
          status: "completed",
          is_paying: true,
          verified_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();
      updated.push(next || row);

      let referrerId = row.referrer_user_id;
      if (!referrerId || referrerId === "pending_lookup") {
        const { data: owner } = await admin
          .from("profiles")
          .select("id, email")
          .eq("referral_code", row.referral_code)
          .maybeSingle();
        if (owner?.id) {
          referrerId = owner.id;
          await admin
            .from("referrals")
            .update({
              referrer_user_id: owner.id,
              referrer_email: owner.email || row.referrer_email,
            })
            .eq("id", row.id);
        }
      }

      if (referrerId && referrerId !== "pending_lookup") {
        const { data: granted } = await admin.rpc("grant_lifetime_premium_if_eligible", {
          p_referrer_id: referrerId,
        });
        if (granted) {
          await admin.from("notifications").insert({
            user_id: referrerId,
            type: "referrals",
            title: "Lifetime Premium unlocked!",
            body: "You referred 3 paying subscribers. Lifetime TitanOS Premium is yours.",
            link: "/referral",
            created_by_id: referrerId,
          });
        }
      }
    }

    return res.status(200).json({ ok: true, updated: updated.length });
  } catch (error) {
    console.error("[markReferralPaying]", error);
    return res.status(500).json({ error: error.message || "Failed" });
  }
}
