import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROFILE_FIELDS = "user_id,role,display_name,balance_cents,pending_cents,lifetime_earned_cents";
const CAMPAIGN_FIELDS = "id,title,description,media_url,destination_url,reward_cents,duration_seconds,total_budget_cents,spent_cents,status,created_at";
const CAMPAIGN_SESSION_FIELDS = "id,reward_cents,platform_fee_cents,duration_seconds,total_budget_cents,spent_cents,status,funded_cents";
const VIEW_SESSION_FIELDS = "id,session_token,status";
const MAX_BODY_CHARS = 32_768;

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

function httpsUrl(value: unknown) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin) return json({ error: "service_unavailable" }, 503);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice(7).trim();
  if (!token) return json({ error: "unauthorized" }, 401);

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    const raw = await req.text();
    if (!raw || raw.length > MAX_BODY_CHARS) return json({ error: "invalid_request_size" }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_json_shape");
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = String(body.action || "");

  try {
    if (action === "ensure_profile") {
      const role = body.role === "advertiser" ? "advertiser" : "viewer";
      const displayName = String(
        body.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Member",
      ).trim().slice(0, 80);

      const { data: existing, error: existingError } = await admin
        .from("attention_profiles")
        .select(PROFILE_FIELDS)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ profile: existing });

      const { data, error } = await admin
        .from("attention_profiles")
        .insert({ user_id: user.id, role, display_name: displayName || "Member" })
        .select(PROFILE_FIELDS)
        .single();
      if (error) throw error;
      return json({ profile: data });
    }

    const { data: profile, error: profileError } = await admin
      .from("attention_profiles")
      .select(PROFILE_FIELDS)
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: "profile_required" }, 409);

    if (action === "create_campaign") {
      if (profile.role !== "advertiser" && profile.role !== "admin") {
        return json({ error: "advertiser_required" }, 403);
      }

      const title = String(body.title || "").trim().slice(0, 120);
      const description = String(body.description || "").trim().slice(0, 1000);
      const reward = Math.floor(Number(body.reward_cents));
      const duration = Math.floor(Number(body.duration_seconds));
      const targetBudget = Math.floor(Number(body.total_budget_cents));
      if (title.length < 3) return json({ error: "title_too_short" }, 400);
      if (description.length < 3) return json({ error: "description_too_short" }, 400);
      if (!Number.isFinite(reward) || reward < 1 || reward > 10_000) return json({ error: "invalid_reward" }, 400);
      if (!Number.isFinite(duration) || duration < 5 || duration > 600) return json({ error: "invalid_duration" }, 400);
      if (!Number.isFinite(targetBudget) || targetBudget < 500 || targetBudget > 10_000_000) {
        return json({ error: "invalid_budget" }, 400);
      }

      const fee = Math.max(1, Math.ceil(reward * 0.25));
      if (reward + fee > targetBudget) return json({ error: "budget_below_one_completion" }, 400);

      const mediaUrl = body.media_url ? httpsUrl(body.media_url) : null;
      const destinationUrl = body.destination_url ? httpsUrl(body.destination_url) : null;
      if (body.media_url && !mediaUrl) return json({ error: "invalid_media_url" }, 400);
      if (body.destination_url && !destinationUrl) return json({ error: "invalid_destination_url" }, 400);

      const { data, error } = await admin
        .from("attention_campaigns")
        .insert({
          advertiser_id: user.id,
          title,
          description,
          reward_cents: reward,
          platform_fee_cents: fee,
          duration_seconds: duration,
          total_budget_cents: targetBudget,
          spent_cents: 0,
          media_url: mediaUrl,
          destination_url: destinationUrl,
          status: "draft",
        })
        .select(CAMPAIGN_FIELDS)
        .single();
      if (error) throw error;
      return json({ campaign: data, funding_required: true });
    }

    if (action === "start_view") {
      if (profile.role !== "viewer" && profile.role !== "admin") {
        return json({ error: "viewer_required" }, 403);
      }

      const campaignId = String(body.campaign_id || "");
      const { data: campaign, error: campaignError } = await admin
        .from("attention_campaigns")
        .select(CAMPAIGN_SESSION_FIELDS)
        .eq("id", campaignId)
        .single();
      if (campaignError || !campaign || campaign.status !== "active") {
        return json({ error: "campaign_unavailable" }, 404);
      }

      const totalCost = Number(campaign.reward_cents) + Number(campaign.platform_fee_cents);
      if (Number(campaign.funded_cents) < Number(campaign.total_budget_cents)) {
        return json({ error: "campaign_not_funded" }, 409);
      }
      if (Number(campaign.spent_cents) + totalCost > Number(campaign.total_budget_cents)) {
        return json({ error: "campaign_budget_exhausted" }, 409);
      }

      const { data: existing, error: existingError } = await admin
        .from("attention_views")
        .select("id,status")
        .eq("campaign_id", campaignId)
        .eq("viewer_id", user.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing?.status === "completed") return json({ error: "already_completed" }, 409);

      if (existing) {
        const sessionToken = crypto.randomUUID();
        const { data, error } = await admin
          .from("attention_views")
          .update({
            session_token: sessionToken,
            status: "started",
            started_at: new Date().toISOString(),
            completed_at: null,
            reward_cents: 0,
            active_seconds: 0,
            heartbeat_count: 0,
            last_heartbeat_at: null,
            risk_flags: {},
          })
          .eq("id", existing.id)
          .select(VIEW_SESSION_FIELDS)
          .single();
        if (error) throw error;
        return json({ view: data, duration_seconds: campaign.duration_seconds });
      }

      const { data, error } = await admin
        .from("attention_views")
        .insert({ campaign_id: campaignId, viewer_id: user.id })
        .select(VIEW_SESSION_FIELDS)
        .single();
      if (error) throw error;
      return json({ view: data, duration_seconds: campaign.duration_seconds });
    }

    if (action === "heartbeat") {
      const { data, error } = await admin.rpc("attention_view_heartbeat_service", {
        p_view_id: String(body.view_id || ""),
        p_viewer_id: user.id,
        p_session_token: String(body.session_token || ""),
      });
      if (error) throw error;
      return json({ active_seconds: Number(data || 0) });
    }

    if (action === "complete_view") {
      const { data, error } = await admin.rpc("complete_attention_view_service", {
        p_view_id: String(body.view_id || ""),
        p_viewer_id: user.id,
        p_session_token: String(body.session_token || ""),
      });
      if (error) {
        const message = String(error.message || "completion_failed");
        if (message.includes("insufficient_active_time")) return json({ error: "insufficient_active_time" }, 409);
        if (message.includes("campaign_budget_exhausted")) return json({ error: "campaign_budget_exhausted" }, 409);
        throw error;
      }
      return json({ result: data?.[0] || null });
    }

    if (action === "request_withdrawal") {
      if (profile.role !== "viewer" && profile.role !== "admin") {
        return json({ error: "viewer_required" }, 403);
      }
      const amount = Math.floor(Number(body.amount_cents));
      if (!Number.isFinite(amount) || amount < 500) return json({ error: "minimum_withdrawal_500" }, 400);
      const { data, error } = await admin.rpc("request_attention_withdrawal_service", {
        p_user_id: user.id,
        p_amount_cents: amount,
      });
      if (error) throw error;
      return json({ withdrawal_id: data, status: "pending" });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("attention-api", action, error);
    return json({ error: "request_failed" }, 500);
  }
});
