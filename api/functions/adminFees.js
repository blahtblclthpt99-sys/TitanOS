import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { clearFeeConfigCache, loadFeeCategories, loadFeeRules } from "../_lib/feeConfig.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimit } from "../_lib/rateLimit.js";

async function assertAdmin(admin, user, res) {
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin =
    user.app_metadata?.role === "admin" ||
    profile?.role === "admin" ||
    profile?.is_admin === true;
  if (!isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return false;
  }
  return true;
}

async function nextVersion(admin, categoryId, contextKey) {
  const { data } = await admin
    .from("fee_rules")
    .select("version")
    .eq("category_id", categoryId)
    .eq("context_key", contextKey)
    .order("version", { ascending: false })
    .limit(1);
  return (data?.[0]?.version || 0) + 1;
}

async function writeHistory(admin, feeRuleId, action, snapshot, actorId) {
  await admin.from("fee_rule_history").insert({
    fee_rule_id: feeRuleId,
    action,
    snapshot,
    actor_id: actorId || null,
  });
  try {
    const { writeAuditEvent } = await import("../_lib/auditLog.js");
    await writeAuditEvent(admin, {
      actorId,
      action: `fee_rule.${action}`,
      entityType: "fee_rule",
      entityId: feeRuleId,
      metadata: { version: snapshot?.version },
    });
  } catch {
    /* audit table may not exist yet */
  }
}

/**
 * Admin fee management API.
 * body.action: list | upsert | disable | schedule | history | rollback | setCategory
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 30, windowMs: 60_000, key: "adminFees" })) return;

  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!(await assertAdmin(auth.admin, auth.user, res))) return;

  const body = readJson(req);
  const action = String(body.action || "list");

  try {
    if (action === "list") {
      const [categories, rules] = await Promise.all([
        loadFeeCategories(auth.admin, { force: true }),
        loadFeeRules(auth.admin, { force: true }),
      ]);
      return res.status(200).json({
        categories: categories || [],
        rules: rules || [],
        source: categories && rules ? "database" : "unavailable",
      });
    }

    if (action === "setCategory") {
      const id = String(body.id || "").trim();
      if (!id) return res.status(400).json({ error: "Category id required" });
      const payload = {
        id,
        name: body.name || id,
        description: body.description || "",
        enabled: body.enabled !== false,
        sort_order: Number(body.sort_order) || 100,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await auth.admin
        .from("fee_categories")
        .upsert(payload)
        .select("*")
        .single();
      if (error) { const { sendDbClientError } = await import("../_lib/apiError.js"); return sendDbClientError(res, error, { route: "adminFees", category: "admin", publicMessage: "Fee update failed" }); }
      clearFeeConfigCache();
      return res.status(200).json({ category: data });
    }

    if (action === "upsert") {
      const categoryId = String(body.category_id || body.categoryId || "").trim();
      const contextKey = String(body.context_key || body.contextKey || "*").trim() || "*";
      if (!categoryId) return res.status(400).json({ error: "category_id required" });

      const version = await nextVersion(auth.admin, categoryId, contextKey);
      // Disable previous active rules for this segment when replacing immediately
      if (body.replace_active !== false) {
        await auth.admin
          .from("fee_rules")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("category_id", categoryId)
          .eq("context_key", contextKey)
          .eq("enabled", true);
      }

      const row = {
        category_id: categoryId,
        context_key: contextKey,
        version,
        label: body.label || "",
        enabled: body.enabled !== false,
        effective_from: body.effective_from || new Date().toISOString(),
        effective_until: body.effective_until || null,
        rule_type: body.rule_type || "percentage",
        percentage_rate: Number(body.percentage_rate) || 0,
        flat_amount: Number(body.flat_amount) || 0,
        min_fee: body.min_fee == null || body.min_fee === "" ? null : Number(body.min_fee),
        max_fee: body.max_fee == null || body.max_fee === "" ? null : Number(body.max_fee),
        fee_bearer: body.fee_bearer === "seller" ? "seller" : "buyer",
        processing_fee_rate: Number(body.processing_fee_rate) || 0,
        processing_fee_flat: Number(body.processing_fee_flat) || 0,
        tax_enabled: Boolean(body.tax_enabled),
        tax_rate: Number(body.tax_rate) || 0,
        tiers: Array.isArray(body.tiers) ? body.tiers : [],
        promo: body.promo || null,
        notes: body.notes || "",
        created_by_id: auth.user.id,
      };

      const { data, error } = await auth.admin.from("fee_rules").insert(row).select("*").single();
      if (error) { const { sendDbClientError } = await import("../_lib/apiError.js"); return sendDbClientError(res, error, { route: "adminFees", category: "admin", publicMessage: "Fee update failed" }); }
      await writeHistory(auth.admin, data.id, "create", data, auth.user.id);
      clearFeeConfigCache();
      return res.status(200).json({ rule: data });
    }

    if (action === "disable") {
      const id = body.id || body.fee_rule_id;
      if (!id) return res.status(400).json({ error: "id required" });
      const { data, error } = await auth.admin
        .from("fee_rules")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) { const { sendDbClientError } = await import("../_lib/apiError.js"); return sendDbClientError(res, error, { route: "adminFees", category: "admin", publicMessage: "Fee update failed" }); }
      await writeHistory(auth.admin, data.id, "disable", data, auth.user.id);
      clearFeeConfigCache();
      return res.status(200).json({ rule: data });
    }

    if (action === "schedule") {
      // Same as upsert but requires future effective_from and keeps prior rules enabled until then
      body.replace_active = false;
      body.action = "upsert";
      if (!body.effective_from) {
        return res.status(400).json({ error: "effective_from required for schedule" });
      }
      // fall through by recursive logic — call upsert path inline
      const categoryId = String(body.category_id || "").trim();
      const contextKey = String(body.context_key || "*").trim() || "*";
      const version = await nextVersion(auth.admin, categoryId, contextKey);
      const row = {
        category_id: categoryId,
        context_key: contextKey,
        version,
        label: body.label || "",
        enabled: true,
        effective_from: body.effective_from,
        effective_until: body.effective_until || null,
        rule_type: body.rule_type || "percentage",
        percentage_rate: Number(body.percentage_rate) || 0,
        flat_amount: Number(body.flat_amount) || 0,
        min_fee: body.min_fee == null || body.min_fee === "" ? null : Number(body.min_fee),
        max_fee: body.max_fee == null || body.max_fee === "" ? null : Number(body.max_fee),
        fee_bearer: body.fee_bearer === "seller" ? "seller" : "buyer",
        processing_fee_rate: Number(body.processing_fee_rate) || 0,
        processing_fee_flat: Number(body.processing_fee_flat) || 0,
        tax_enabled: Boolean(body.tax_enabled),
        tax_rate: Number(body.tax_rate) || 0,
        tiers: Array.isArray(body.tiers) ? body.tiers : [],
        promo: body.promo || null,
        notes: body.notes || "Scheduled change",
        created_by_id: auth.user.id,
      };
      const { data, error } = await auth.admin.from("fee_rules").insert(row).select("*").single();
      if (error) { const { sendDbClientError } = await import("../_lib/apiError.js"); return sendDbClientError(res, error, { route: "adminFees", category: "admin", publicMessage: "Fee update failed" }); }
      await writeHistory(auth.admin, data.id, "schedule", data, auth.user.id);
      clearFeeConfigCache();
      return res.status(200).json({ rule: data });
    }

    if (action === "history") {
      const feeRuleId = body.fee_rule_id || body.id;
      let query = auth.admin
        .from("fee_rule_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (feeRuleId) query = query.eq("fee_rule_id", feeRuleId);
      const { data, error } = await query;
      if (error) { const { sendDbClientError } = await import("../_lib/apiError.js"); return sendDbClientError(res, error, { route: "adminFees", category: "admin", publicMessage: "Fee update failed" }); }
      return res.status(200).json({ history: data || [] });
    }

    if (action === "rollback") {
      const historyId = body.history_id;
      if (!historyId) return res.status(400).json({ error: "history_id required" });
      const { data: hist, error: hErr } = await auth.admin
        .from("fee_rule_history")
        .select("*")
        .eq("id", historyId)
        .maybeSingle();
      if (hErr || !hist?.snapshot) return res.status(400).json({ error: "History entry not found" });

      const snap = hist.snapshot;
      const categoryId = snap.category_id;
      const contextKey = snap.context_key || "*";
      await auth.admin
        .from("fee_rules")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("category_id", categoryId)
        .eq("context_key", contextKey)
        .eq("enabled", true);

      const version = await nextVersion(auth.admin, categoryId, contextKey);
      const row = {
        category_id: categoryId,
        context_key: contextKey,
        version,
        label: snap.label || "Rollback",
        enabled: true,
        effective_from: new Date().toISOString(),
        effective_until: null,
        rule_type: snap.rule_type || "percentage",
        percentage_rate: Number(snap.percentage_rate) || 0,
        flat_amount: Number(snap.flat_amount) || 0,
        min_fee: snap.min_fee,
        max_fee: snap.max_fee,
        fee_bearer: snap.fee_bearer || "buyer",
        processing_fee_rate: Number(snap.processing_fee_rate) || 0,
        processing_fee_flat: Number(snap.processing_fee_flat) || 0,
        tax_enabled: Boolean(snap.tax_enabled),
        tax_rate: Number(snap.tax_rate) || 0,
        tiers: snap.tiers || [],
        promo: snap.promo || null,
        notes: `Rollback from history ${historyId}`,
        created_by_id: auth.user.id,
      };
      const { data, error } = await auth.admin.from("fee_rules").insert(row).select("*").single();
      if (error) { const { sendDbClientError } = await import("../_lib/apiError.js"); return sendDbClientError(res, error, { route: "adminFees", category: "admin", publicMessage: "Fee update failed" }); }
      await writeHistory(auth.admin, data.id, "rollback", { ...data, from_history: historyId }, auth.user.id);
      clearFeeConfigCache();
      return res.status(200).json({ rule: data });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js"); return sendApiError(res, error, { route: "adminFees", category: "admin", publicMessage: "Admin fees failed", publicCode: "ADMIN_FEES_FAILED" });
  }
}
