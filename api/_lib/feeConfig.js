/**
 * Fee config loader + cache (server). Falls back to FEE_SEED_RULES if tables missing.
 */
import { calculateFees, pickSeedRule } from "../../shared/feeEngine.js";

const CACHE_TTL_MS = 60_000;
let cache = { at: 0, rules: null, categories: null };

export function clearFeeConfigCache() {
  cache = { at: 0, rules: null, categories: null };
}

function isActiveRule(rule, now) {
  if (!rule || rule.enabled === false) return false;
  const from = rule.effective_from ? new Date(rule.effective_from) : null;
  const until = rule.effective_until ? new Date(rule.effective_until) : null;
  if (from && from > now) return false;
  if (until && until <= now) return false;
  return true;
}

export async function loadFeeRules(admin, { force = false } = {}) {
  const now = Date.now();
  if (!force && cache.rules && now - cache.at < CACHE_TTL_MS) {
    return cache.rules;
  }
  try {
    const { data, error } = await admin
      .from("fee_rules")
      .select("*")
      .order("version", { ascending: false });
    if (error) throw error;
    cache = { at: now, rules: data || [], categories: cache.categories };
    return cache.rules;
  } catch {
    cache = { at: now, rules: null, categories: cache.categories };
    return null;
  }
}

export async function loadFeeCategories(admin, { force = false } = {}) {
  const now = Date.now();
  if (!force && cache.categories && now - cache.at < CACHE_TTL_MS) {
    return cache.categories;
  }
  try {
    const { data, error } = await admin.from("fee_categories").select("*").order("sort_order");
    if (error) throw error;
    cache = { ...cache, at: now, categories: data || [] };
    return cache.categories;
  } catch {
    return null;
  }
}

/**
 * Pick best active rule for category + context (exact context, else '*').
 */
export function resolveRule(rules, categoryId, contextKey = "*", now = new Date()) {
  if (!rules?.length) return pickSeedRule(categoryId, contextKey);

  const candidates = rules
    .filter((r) => r.category_id === categoryId && isActiveRule(r, now))
    .filter((r) => r.context_key === contextKey || r.context_key === "*");

  if (!candidates.length) return pickSeedRule(categoryId, contextKey);

  candidates.sort((a, b) => {
    const exactA = a.context_key === contextKey ? 1 : 0;
    const exactB = b.context_key === contextKey ? 1 : 0;
    if (exactB !== exactA) return exactB - exactA;
    return (b.version || 0) - (a.version || 0);
  });
  return candidates[0];
}

export async function calculateCategoryFees(admin, {
  categoryId,
  contextKey = "*",
  grossAmount,
  transactionId = null,
  paymentId = null,
  userId = null,
  currency = "usd",
  context = {},
  persistLog = true,
}) {
  const rules = await loadFeeRules(admin);
  const rule = resolveRule(rules, categoryId, contextKey);
  const breakdown = calculateFees({ grossAmount, rule });

  if (persistLog && admin) {
    try {
      await admin.from("fee_calculation_logs").insert({
        transaction_id: transactionId,
        payment_id: paymentId,
        category_id: categoryId,
        fee_rule_id: typeof rule?.id === "string" && rule.id.startsWith("seed-") ? null : rule?.id || null,
        fee_version: breakdown.feeVersion,
        context_key: contextKey,
        applied_rules: breakdown.appliedRules,
        gross_amount: breakdown.gross,
        platform_fee: breakdown.platformFee,
        processing_fee: breakdown.processingFee,
        tax_amount: breakdown.taxAmount,
        net_amount: breakdown.netAmount,
        final_total: breakdown.finalTotal,
        currency,
        context: { ...context, source: rules ? "database" : "seed" },
        created_by_id: userId,
      });
    } catch {
      /* audit table may not exist yet — never block payment */
    }
  }

  return {
    ...breakdown,
    rule,
    configSource: rules ? "database" : "seed",
  };
}
