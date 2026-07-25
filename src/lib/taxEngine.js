/**
 * Client Tax Engine — wraps shared pure engine + configurable rule store.
 * Rules: localStorage (admin-editable) with seed catalog as default.
 * Never resolves tax from Driver Location.
 */
export {
  TAX_ENGINE_VERSION,
  SEED_TAX_RULES,
  roundMoney,
  scoreRuleMatch,
  resolveJurisdiction,
  calculateSalesTax,
  validateTaxRule,
} from "../../shared/taxEngine.js";

import {
  SEED_TAX_RULES,
  calculateSalesTax,
  validateTaxRule,
} from "../../shared/taxEngine.js";

const RULES_KEY = "titanos_tax_rules_v1";

export function loadTaxRules() {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return SEED_TAX_RULES.map((r) => ({ ...r }));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return SEED_TAX_RULES.map((r) => ({ ...r }));
    }
    return parsed;
  } catch {
    return SEED_TAX_RULES.map((r) => ({ ...r }));
  }
}

export function saveTaxRules(rules) {
  const list = Array.isArray(rules) ? rules : [];
  localStorage.setItem(RULES_KEY, JSON.stringify(list));
  return list;
}

export function resetTaxRulesToSeed() {
  return saveTaxRules(SEED_TAX_RULES.map((r) => ({ ...r })));
}

export function upsertTaxRule(rule) {
  const { ok, errors, rule: cleaned } = validateTaxRule(rule);
  if (!ok) return { ok: false, errors };
  const list = loadTaxRules();
  const idx = list.findIndex((r) => r.id === cleaned.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...cleaned };
  else list.push(cleaned);
  saveTaxRules(list);
  return { ok: true, rule: cleaned, rules: list };
}

export function deleteTaxRule(id) {
  const list = loadTaxRules().filter((r) => r.id !== id);
  saveTaxRules(list);
  return list;
}

/**
 * Calculate document tax from Job Location using the active rule catalog.
 */
export function calculateDocumentTax({
  lineItems,
  jobLocation,
  taxExempt = false,
  discountAmount = 0,
  platformFeeAmount = 0,
  snapshot = null,
  recalculate = true,
  rules = null,
} = {}) {
  return calculateSalesTax({
    lineItems,
    jobLocation,
    rules: rules || loadTaxRules(),
    taxExempt,
    discountAmount,
    platformFeeAmount,
    snapshot,
    recalculate,
  });
}
