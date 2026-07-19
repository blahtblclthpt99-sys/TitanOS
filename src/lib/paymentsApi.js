import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { calcPlatformFee, PLATFORM_FEE_RATE } from "@/lib/platformFee";

const PREFIX = "titanos_pay";

export async function listPaymentAccounts(userId) {
  try {
    return await api.entities.PaymentAccount.filter({ user_id: userId });
  } catch {
    return readLocal(PREFIX, userId, "accounts", []);
  }
}

export async function upsertPaymentAccount(user, { provider, account_label, external_account_id, is_connected }) {
  const payload = {
    user_id: user.id,
    provider,
    account_label: account_label || provider,
    external_account_id: external_account_id || null,
    is_connected: Boolean(is_connected),
    created_by_id: user.id,
  };
  try {
    const existing = await api.entities.PaymentAccount.filter({ user_id: user.id, provider });
    if (existing[0]) return api.entities.PaymentAccount.update(existing[0].id, payload);
    return api.entities.PaymentAccount.create(payload);
  } catch {
    const rows = readLocal(PREFIX, user.id, "accounts", []);
    const idx = rows.findIndex((r) => r.provider === provider);
    const row = { id: idx >= 0 ? rows[idx].id : uid(), ...payload, created_at: new Date().toISOString() };
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    writeLocal(PREFIX, user.id, "accounts", rows);
    return row;
  }
}

export async function listPayments(userId) {
  try {
    return await api.entities.Payment.filter({ user_id: userId });
  } catch {
    return readLocal(PREFIX, userId, "payments", []);
  }
}

export async function createPaymentLink(user, { amount, customer_name, invoice_id, provider = "stripe", note }) {
  const { base, fee, total } = calcPlatformFee(amount);

  try {
    const result = await api.functions.invoke("createPaymentLink", {
      amount: base,
      customer_name,
      invoice_id,
      provider,
      note,
    });
    const data = result?.data || result;
    if (data?.payment) {
      return {
        ...data.payment,
        base_amount: data.payment.base_amount ?? base,
        platform_fee: data.payment.platform_fee ?? fee,
        amount_total: data.payment.amount_total ?? data.payment.amount ?? total,
      };
    }
  } catch {
    /* fall through to local pending payment */
  }

  const payload = {
    user_id: user.id,
    invoice_id: invoice_id || null,
    customer_name: customer_name || "",
    amount: total,
    base_amount: base,
    platform_fee: fee,
    platform_fee_rate: PLATFORM_FEE_RATE,
    amount_total: total,
    provider,
    status: "pending",
    checkout_url: "",
    note: note || `Includes TitanOS platform fee 0.76% ($${fee.toFixed(2)}). Total $${total.toFixed(2)}.`,
    created_by_id: user.id,
  };

  try {
    return await api.entities.Payment.create(payload);
  } catch {
    try {
      const { base_amount, platform_fee, platform_fee_rate, amount_total, ...legacy } = payload;
      const row = await api.entities.Payment.create({
        ...legacy,
        note: `${legacy.note} base=$${base_amount} fee=$${platform_fee}`,
      });
      return { ...row, base_amount, platform_fee, platform_fee_rate, amount_total };
    } catch {
      const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
      const all = readLocal(PREFIX, user.id, "payments", []);
      all.unshift(row);
      writeLocal(PREFIX, user.id, "payments", all);
      return row;
    }
  }
}

export async function markPaymentStatus(id, status) {
  try {
    return await api.entities.Payment.update(id, { status });
  } catch {
    return { id, status };
  }
}
