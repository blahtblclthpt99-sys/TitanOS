import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { calculateCategoryFees } from "../_lib/feeConfig.js";
import { readJson } from "../_lib/supabase.js";

/**
 * Server-side fee quote. Client amounts are never trusted for charging —
 * createPaymentLink recalculates independently.
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const categoryId = String(body.categoryId || body.category_id || "service_requests");
    const contextKey = String(body.contextKey || body.context_key || body.planId || "*");
    const grossAmount = Number(body.grossAmount ?? body.amount);
    if (!Number.isFinite(grossAmount) || grossAmount < 0) {
      return res.status(400).json({ error: "Valid grossAmount required" });
    }

    const result = await calculateCategoryFees(auth.admin, {
      categoryId,
      contextKey,
      grossAmount,
      transactionId: body.transactionId || null,
      userId: auth.user.id,
      currency: (body.currency || "usd").toLowerCase(),
      context: body.context || {},
      persistLog: Boolean(body.persistLog),
    });

    return res.status(200).json({
      fee: {
        categoryId,
        contextKey,
        gross: result.gross,
        platform_fee: result.platformFee,
        processing_fee: result.processingFee,
        tax_amount: result.taxAmount,
        net_amount: result.netAmount,
        final_total: result.finalTotal,
        rate: result.rate,
        label: result.label,
        fee_bearer: result.feeBearer,
        fee_version: result.feeVersion,
        fee_rule_id: result.feeRuleId,
        applied_rules: result.appliedRules,
        config_source: result.configSource,
      },
    });
  } catch (error) {
    const { logError } = await import("../_lib/safeLog.js");
    logError("calculateFee", error);
    return res.status(500).json({ error: "Fee calculation failed" });
  }
}
