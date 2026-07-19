import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";

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
  // Prefer server checkout when Stripe key present
  try {
    const result = await api.functions.invoke("createPaymentLink", {
      amount: Number(amount),
      customer_name,
      invoice_id,
      provider,
      note,
    });
    const data = result?.data || result;
    if (data?.payment) return data.payment;
  } catch {
    /* fall through to local pending payment */
  }

  const payload = {
    user_id: user.id,
    invoice_id: invoice_id || null,
    customer_name: customer_name || "",
    amount: Number(amount) || 0,
    provider,
    status: "pending",
    checkout_url: "",
    note: note || "Connect Stripe in Payments to enable live checkout links.",
    created_by_id: user.id,
  };

  try {
    return await api.entities.Payment.create(payload);
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    const all = readLocal(PREFIX, user.id, "payments", []);
    all.unshift(row);
    writeLocal(PREFIX, user.id, "payments", all);
    return row;
  }
}

export async function markPaymentStatus(id, status) {
  try {
    return await api.entities.Payment.update(id, { status });
  } catch {
    return { id, status };
  }
}
