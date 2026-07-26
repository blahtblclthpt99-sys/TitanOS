import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimit } from "../_lib/rateLimit.js";

/** Resolve orphan referral rows that still have pending_lookup referrer. */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 10, windowMs: 60_000, key: "attachReferral" })) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const admin = getSupabaseAdmin();
    const body = readJson(req);
    // Never trust client-supplied userId — bind to JWT subject
    const userId = auth.user.id;
    const email = auth.user.email || body.email;
    const { refCode } = body;
    if (!refCode) return res.status(400).json({ error: "refCode required" });
    const code = String(refCode).trim().slice(0, 64);

    const { data: owner } = await admin
      .from("profiles")
      .select("id, email, referral_code")
      .eq("referral_code", code)
      .maybeSingle();

    // Case-insensitive match without scanning hundreds of profiles
    let referrer = owner;
    if (!referrer) {
      const { data: matched } = await admin
        .from("profiles")
        .select("id, email, referral_code")
        .ilike("referral_code", code)
        .limit(1);
      referrer = matched?.[0] || null;
    }

    if (!referrer) {
      return res.status(200).json({ ok: true, matched: false });
    }

    // Fraud: self-referral
    if (referrer.id === userId || (email && referrer.email?.toLowerCase() === email.toLowerCase())) {
      await admin.from("referrals").insert({
        referrer_user_id: referrer.id,
        referrer_email: referrer.email,
        referred_email: email || "",
        referred_user_id: userId,
        referral_code: code,
        status: "pending",
        fraud_flag: true,
        fraud_reason: "self_referral",
        created_by_id: userId,
      });
      return res.status(200).json({ ok: true, matched: true, fraud: true });
    }

    const { data: pending } = await admin
      .from("referrals")
      .select("*")
      .eq("referral_code", code)
      .eq("status", "pending")
      .ilike("referred_email", email || "");

    if (pending?.length) {
      await admin
        .from("referrals")
        .update({
          status: "signed_up",
          referred_user_id: userId,
          referred_email: email,
          referrer_user_id: referrer.id,
          referrer_email: referrer.email,
        })
        .eq("id", pending[0].id);
    } else {
      await admin.from("referrals").insert({
        referrer_user_id: referrer.id,
        referrer_email: referrer.email,
        referred_email: email || "",
        referred_user_id: userId,
        referral_code: code,
        status: "signed_up",
        is_paying: false,
        created_by_id: userId,
      });
    }

    await admin.from("profiles").update({ referred_by_code: code }).eq("id", userId);

    await admin.from("notifications").insert({
      user_id: referrer.id,
      type: "referrals",
      title: "New referral signup",
      body: `${email || "Someone"} signed up with your code.`,
      link: "/referral",
      created_by_id: userId,
    });

    return res.status(200).json({ ok: true, matched: true, referrerId: referrer.id });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "attachReferral",
      category: "referrals",
      publicMessage: "Referral update failed",
      publicCode: "REFERRAL_ATTACH_FAILED",
    });
  }
}
