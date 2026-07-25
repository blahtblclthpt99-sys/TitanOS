/**
 * Shared money / line-item validation for invoices & estimates (client-side guard).
 * Sales tax rates should come from the Tax Engine (Job Location) — not manual entry.
 */

export function sanitizeLineItems(items, { maxLines = 100 } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Add at least one line item." };
  }
  if (items.length > maxLines) {
    return { ok: false, error: `Too many line items (max ${maxLines}).` };
  }

  const cleaned = [];
  for (let i = 0; i < items.length; i += 1) {
    const raw = items[i] || {};
    const description = String(raw.description || "").trim();
    const quantity = Number(raw.quantity ?? raw.qty);
    const unitPrice = Number(raw.unit_price);
    if (!description) {
      return { ok: false, error: `Line ${i + 1}: description is required.` };
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
      return { ok: false, error: `Line ${i + 1}: quantity must be greater than 0.` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000) {
      return { ok: false, error: `Line ${i + 1}: unit price must be 0 or greater.` };
    }
    const total = Math.round(quantity * unitPrice * 100) / 100;
    cleaned.push({
      description: description.slice(0, 500),
      quantity: Math.round(quantity * 1000) / 1000,
      unit_price: Math.round(unitPrice * 100) / 100,
      total,
    });
  }
  return { ok: true, items: cleaned };
}

/** @deprecated Prefer Tax Engine via calculateDocumentTax — kept for legacy docs. */
export function sanitizeTaxRate(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, error: "Tax rate must be between 0 and 100." };
  }
  return { ok: true, taxRate: Math.round(n * 1000) / 1000 };
}

export function computeDocumentTotals(lineItems, taxRate, extras = {}) {
  const subtotal = Math.round(lineItems.reduce((s, i) => s + (i.total || 0), 0) * 100) / 100;
  const discount = Math.round(Math.max(0, Number(extras.discountAmount) || 0) * 100) / 100;
  const platformFee = Math.round(Math.max(0, Number(extras.platformFeeAmount) || 0) * 100) / 100;
  const taxable = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const rate = Number(taxRate) || 0;
  const taxAmount = extras.taxExempt
    ? 0
    : Math.round(taxable * (rate / 100) * 100) / 100;
  const total = Math.round((taxable + taxAmount + platformFee) * 100) / 100;
  return { subtotal, discount, platformFee, taxAmount, total };
}

/**
 * Apply a Tax Engine result (Job Location–based) to document totals.
 * Prefer this over manual tax_rate entry.
 */
export function totalsFromTaxResult(taxResult) {
  if (!taxResult) {
    return { subtotal: 0, discount: 0, platformFee: 0, taxAmount: 0, total: 0, taxRate: 0 };
  }
  return {
    subtotal: taxResult.subtotal,
    discount: taxResult.discount || 0,
    platformFee: taxResult.platformFee || 0,
    taxAmount: taxResult.taxAmount,
    total: taxResult.total,
    taxRate: taxResult.taxRate,
    taxExempt: Boolean(taxResult.taxExempt),
    taxSnapshot: taxResult.snapshot || null,
  };
}
