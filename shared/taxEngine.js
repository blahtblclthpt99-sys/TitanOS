/**
 * TitanOS Tax Engine — pure calculation (no I/O).
 *
 * PRIMARY RULE: Tax jurisdiction is resolved from JOB LOCATION only.
 * Never use driver home / profile location for sales tax.
 *
 * Rates come exclusively from the configurable rule catalog passed in.
 * This module does not embed jurisdiction rates in business logic.
 *
 * KEEP SHARED: imported by tests and client; mirror via src/lib/taxEngine.js.
 */

export const TAX_ENGINE_VERSION = 1;

/** Round money to 2 decimal places. */
export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Illustrative starter catalog for admin seeding / tests.
 * NOT used unless loaded into the active rule set.
 * Admins must verify rates for their registrations before production use.
 */
export const SEED_TAX_RULES = [
  {
    id: "us-tx-state",
    country: "US",
    state: "TX",
    county: null,
    city: null,
    postalPrefix: null,
    label: "Texas (state)",
    ratePercent: 6.25,
    components: [{ name: "State", ratePercent: 6.25 }],
    taxExemptAllowed: true,
    active: true,
    priority: 10,
  },
  {
    id: "us-tx-dallas",
    country: "US",
    state: "TX",
    county: "Dallas",
    city: "Dallas",
    postalPrefix: "752",
    label: "Texas — Dallas",
    ratePercent: 8.25,
    components: [
      { name: "State", ratePercent: 6.25 },
      { name: "Local", ratePercent: 2.0 },
    ],
    taxExemptAllowed: true,
    active: true,
    priority: 40,
  },
  {
    id: "us-tx-austin",
    country: "US",
    state: "TX",
    county: "Travis",
    city: "Austin",
    postalPrefix: "787",
    label: "Texas — Austin",
    ratePercent: 8.25,
    components: [
      { name: "State", ratePercent: 6.25 },
      { name: "Local", ratePercent: 2.0 },
    ],
    taxExemptAllowed: true,
    active: true,
    priority: 40,
  },
  {
    id: "us-ca-state",
    country: "US",
    state: "CA",
    county: null,
    city: null,
    postalPrefix: null,
    label: "California (state base)",
    ratePercent: 7.25,
    components: [{ name: "State", ratePercent: 7.25 }],
    taxExemptAllowed: true,
    active: true,
    priority: 10,
  },
  {
    id: "us-ca-la",
    country: "US",
    state: "CA",
    county: "Los Angeles",
    city: "Los Angeles",
    postalPrefix: "900",
    label: "California — Los Angeles",
    ratePercent: 9.5,
    components: [
      { name: "State", ratePercent: 7.25 },
      { name: "Local", ratePercent: 2.25 },
    ],
    taxExemptAllowed: true,
    active: true,
    priority: 40,
  },
  {
    id: "us-ny-state",
    country: "US",
    state: "NY",
    county: null,
    city: null,
    postalPrefix: null,
    label: "New York (state)",
    ratePercent: 4.0,
    components: [{ name: "State", ratePercent: 4.0 }],
    taxExemptAllowed: true,
    active: true,
    priority: 10,
  },
  {
    id: "us-ny-nyc",
    country: "US",
    state: "NY",
    county: "New York",
    city: "New York",
    postalPrefix: "100",
    label: "New York — NYC",
    ratePercent: 8.875,
    components: [
      { name: "State", ratePercent: 4.0 },
      { name: "City", ratePercent: 4.5 },
      { name: "MCTD", ratePercent: 0.375 },
    ],
    taxExemptAllowed: true,
    active: true,
    priority: 50,
  },
  {
    id: "us-il-chicago",
    country: "US",
    state: "IL",
    county: "Cook",
    city: "Chicago",
    postalPrefix: "606",
    label: "Illinois — Chicago",
    ratePercent: 10.25,
    components: [
      { name: "State", ratePercent: 6.25 },
      { name: "Local", ratePercent: 4.0 },
    ],
    taxExemptAllowed: true,
    active: true,
    priority: 40,
  },
  {
    id: "us-border-texarkana-tx",
    country: "US",
    state: "TX",
    county: "Bowie",
    city: "Texarkana",
    postalPrefix: "755",
    label: "Texas — Texarkana (border)",
    ratePercent: 8.25,
    components: [
      { name: "State", ratePercent: 6.25 },
      { name: "Local", ratePercent: 2.0 },
    ],
    taxExemptAllowed: true,
    active: true,
    priority: 45,
  },
  {
    id: "us-border-texarkana-ar",
    country: "US",
    state: "AR",
    county: "Miller",
    city: "Texarkana",
    postalPrefix: "718",
    label: "Arkansas — Texarkana (border)",
    ratePercent: 9.5,
    components: [
      { name: "State", ratePercent: 6.5 },
      { name: "Local", ratePercent: 3.0 },
    ],
    taxExemptAllowed: true,
    active: true,
    priority: 45,
  },
];

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normState(s) {
  const t = String(s || "").trim().toUpperCase();
  const map = {
    TEXAS: "TX",
    CALIFORNIA: "CA",
    "NEW YORK": "NY",
    ILLINOIS: "IL",
    ARKANSAS: "AR",
  };
  if (t.length === 2) return t;
  return map[t] || t.slice(0, 2);
}

function postalDigits(zip) {
  return String(zip || "").replace(/\D/g, "");
}

/**
 * Score how specifically a rule matches a job location.
 * Higher = better. -1 = no match.
 */
export function scoreRuleMatch(rule, jobLocation) {
  if (!rule?.active) return -1;
  const loc = jobLocation || {};
  const country = String(loc.country || "US").toUpperCase();
  const state = normState(loc.state);
  const city = norm(loc.city);
  const county = norm(loc.county);
  const zip = postalDigits(loc.zip || loc.postalCode);

  if (rule.country && String(rule.country).toUpperCase() !== country) return -1;
  if (rule.state && normState(rule.state) !== state) return -1;

  let score = Number(rule.priority) || 0;

  if (rule.postalPrefix) {
    const prefix = String(rule.postalPrefix).replace(/\D/g, "");
    if (!zip || !zip.startsWith(prefix)) return -1;
    score += 30 + prefix.length;
  }

  if (rule.city) {
    const ruleCity = norm(rule.city);
    if (city) {
      if (ruleCity !== city) return -1;
      score += 25;
    } else if (!rule.postalPrefix) {
      // City-specific rule without postal fallback needs a city on the job
      return -1;
    }
    // Job missing city but postal matched — keep rule eligible
  }

  if (rule.county) {
    const ruleCounty = norm(rule.county);
    if (county) {
      if (ruleCounty !== county) return -1;
      score += 15;
    }
    // Job missing county — soft match (don't reject city/postal hits)
  }

  // State-only rules still match when more specific fields are empty on the rule
  if (rule.state) score += 5;
  return score;
}

/**
 * Resolve the best tax rule for a Job Location.
 * @returns {{ ok, rule?, ratePercent, components, message }}
 */
export function resolveJurisdiction(jobLocation, rules = []) {
  const list = Array.isArray(rules) ? rules.filter((r) => r && r.active !== false) : [];
  if (!jobLocation || (!jobLocation.state && !jobLocation.zip && !jobLocation.city)) {
    return {
      ok: false,
      rule: null,
      ratePercent: 0,
      components: [],
      message: "Enter a Job Location (city/state or ZIP) to determine sales tax.",
    };
  }

  let best = null;
  let bestScore = -1;
  for (const rule of list) {
    const score = scoreRuleMatch(rule, jobLocation);
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }

  if (!best) {
    return {
      ok: false,
      rule: null,
      ratePercent: 0,
      components: [],
      message:
        "No tax rule matches this Job Location. Add a rule in Tax Rules admin, or verify state/ZIP.",
    };
  }

  const ratePercent = Number(best.ratePercent);
  const components = Array.isArray(best.components)
    ? best.components.map((c) => ({
        name: String(c.name || "Tax"),
        ratePercent: Number(c.ratePercent) || 0,
      }))
    : [{ name: best.label || "Sales tax", ratePercent }];

  return {
    ok: true,
    rule: best,
    ratePercent: Number.isFinite(ratePercent) ? ratePercent : 0,
    components,
    message: `Using ${best.label || best.id} (${ratePercent}%) from Job Location.`,
  };
}

/**
 * Calculate tax for line items from a resolved jurisdiction.
 * Historical snapshots: pass { snapshot } to reuse frozen rates (no re-resolve).
 */
export function calculateSalesTax({
  lineItems = [],
  jobLocation = null,
  rules = [],
  taxExempt = false,
  discountAmount = 0,
  platformFeeAmount = 0,
  snapshot = null,
  recalculate = true,
} = {}) {
  const subtotal = roundMoney(
    (Array.isArray(lineItems) ? lineItems : []).reduce((s, i) => s + (Number(i.total) || 0), 0)
  );
  const discount = roundMoney(Math.max(0, Number(discountAmount) || 0));
  const platformFee = roundMoney(Math.max(0, Number(platformFeeAmount) || 0));
  const taxableBase = roundMoney(Math.max(0, subtotal - discount));

  let jurisdiction;
  if (!recalculate && snapshot && typeof snapshot === "object") {
    jurisdiction = {
      ok: true,
      rule: {
        id: snapshot.jurisdictionId,
        label: snapshot.jurisdictionLabel,
      },
      ratePercent: Number(snapshot.ratePercent) || 0,
      components: Array.isArray(snapshot.components) ? snapshot.components : [],
      message: "Using tax rates locked on this document (historical).",
    };
  } else {
    jurisdiction = resolveJurisdiction(jobLocation, rules);
  }

  const exempt = Boolean(taxExempt);
  if (exempt && jurisdiction.rule && jurisdiction.rule.taxExemptAllowed === false) {
    return {
      ok: false,
      error: "This jurisdiction does not allow tax-exempt customers.",
      subtotal,
      discount,
      platformFee,
      taxableBase,
      taxAmount: 0,
      taxRate: 0,
      total: roundMoney(taxableBase + platformFee),
      taxExempt: false,
      jurisdiction,
      snapshot: null,
    };
  }

  const ratePercent = exempt || !jurisdiction.ok ? 0 : jurisdiction.ratePercent;
  const taxAmount = exempt ? 0 : roundMoney(taxableBase * (ratePercent / 100));
  const total = roundMoney(taxableBase + taxAmount + platformFee);

  const frozen = {
    engineVersion: TAX_ENGINE_VERSION,
    jurisdictionId: jurisdiction.rule?.id || null,
    jurisdictionLabel: jurisdiction.rule?.label || null,
    ratePercent,
    components: jurisdiction.components || [],
    jobLocation: jobLocation
      ? {
          address: jobLocation.address || "",
          city: jobLocation.city || "",
          state: jobLocation.state || "",
          county: jobLocation.county || "",
          zip: jobLocation.zip || "",
          country: jobLocation.country || "US",
          lat: jobLocation.lat ?? null,
          lng: jobLocation.lng ?? null,
        }
      : null,
    taxExempt: exempt,
    calculatedAt: new Date().toISOString(),
    source: "job_location",
  };

  return {
    ok: jurisdiction.ok || exempt,
    error: jurisdiction.ok || exempt ? null : jurisdiction.message,
    subtotal,
    discount,
    platformFee,
    taxableBase,
    taxAmount,
    taxRate: ratePercent,
    total,
    taxExempt: exempt,
    jurisdiction,
    snapshot: frozen,
  };
}

/**
 * Validate a tax rule before saving (admin).
 */
export function validateTaxRule(raw) {
  const errors = [];
  const rule = { ...(raw || {}) };
  if (!String(rule.id || "").trim()) errors.push("Rule id is required.");
  if (!String(rule.country || "").trim()) errors.push("Country is required.");
  if (!String(rule.state || "").trim() && !String(rule.postalPrefix || "").trim()) {
    errors.push("State or postal prefix is required.");
  }
  const rate = Number(rule.ratePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    errors.push("Rate must be between 0 and 100.");
  }
  rule.ratePercent = Math.round(rate * 1000) / 1000;
  rule.active = rule.active !== false;
  rule.taxExemptAllowed = rule.taxExemptAllowed !== false;
  rule.priority = Number(rule.priority) || 0;
  rule.label = String(rule.label || rule.id || "").trim();
  return { ok: errors.length === 0, errors, rule };
}
