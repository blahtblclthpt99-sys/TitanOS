import { api } from "@/api/apiClient";
import { readLocal, writeLocal } from "@/lib/localStore";
import { calcPlatformFee } from "@/lib/platformFee";
import { DATA_SOURCE, PersistenceError, withSource, getSource } from "@/lib/dataSource";
import { reportError } from "@/lib/reportError";

const PREFIX = "titanos_pay";

export async function listPaymentAccounts(userId) {
  try {
    return withSource(await api.entities.PaymentAccount.filter({ user_id: userId }), DATA_SOURCE.remote);
  } catch (error) {
    reportError("paymentsApi:listAccounts", error);
    return withSource(readLocal(PREFIX, userId, "accounts", []), DATA_SOURCE.local);
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
    const row = existing[0]
      ? await api.entities.PaymentAccount.update(existing[0].id, payload)
      : await api.entities.PaymentAccount.create(payload);
    return withSource(row, DATA_SOURCE.remote);
  } catch (error) {
    reportError("paymentsApi:upsertAccount", error);
    throw new PersistenceError("Couldn't save payment account. Check your connection and try again.", {
      source: DATA_SOURCE.remote,
      code: "PAYMENT_ACCOUNT_SAVE_FAILED",
      cause: error,
    });
  }
}

export async function listPayments(userId) {
  try {
    return withSource(await api.entities.Payment.filter({ user_id: userId }), DATA_SOURCE.remote);
  } catch (error) {
    reportError("paymentsApi:list", error);
    return withSource(readLocal(PREFIX, userId, "payments", []), DATA_SOURCE.local);
  }
}

/**
 * Fail closed: only succeed when a live checkout URL exists.
 * Never invent a local “payment link created” success for money.
 */
export async function createPaymentLink(user, { amount, customer_name, invoice_id, provider = "stripe", note, purpose }) {
  const useModuleFee = purpose === "module";
  const preview = useModuleFee
    ? { base: Number(amount), fee: 0, total: Number(amount), rate: 0, percentLabel: "0%", planId: "module" }
    : calcPlatformFee(amount, user);
  const { base, fee, total, rate, percentLabel, planId } = preview;

  let invokeError = null;
  try {
    const result = await api.functions.invoke("createPaymentLink", {
      amount: base,
      customer_name,
      invoice_id,
      provider,
      note,
      purpose: purpose || undefined,
    });
    const data = result?.data || result;

    if (data?.stub || data?.setupRequired) {
      throw new PersistenceError(
        data?.message ||
          "Checkout isn't available yet. No payment link was created.",
        { source: DATA_SOURCE.stub, code: "PAYMENT_STUB" }
      );
    }

    if (data?.payment?.checkout_url) {
      return withSource(
        {
          ...data.payment,
          base_amount: data.payment.base_amount ?? base,
          platform_fee: data.payment.platform_fee ?? fee,
          platform_fee_rate: data.payment.platform_fee_rate ?? rate,
          amount_total: data.payment.amount_total ?? data.payment.amount ?? total,
          plan: data.payment.plan ?? planId,
          fee_label: data.fee?.label ?? percentLabel,
        },
        DATA_SOURCE.remote
      );
    }

    if (data?.payment && !data.payment.checkout_url) {
      throw new PersistenceError("Payment provider did not return a checkout URL. No live link was created.", {
        source: DATA_SOURCE.stub,
        code: "PAYMENT_NO_CHECKOUT",
      });
    }
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
    invokeError = err;
  }

  throw new PersistenceError(
    invokeError?.message ||
      "Could not create a live payment link. TitanOS will not save a fake checkout or toast success.",
    { source: DATA_SOURCE.stub, code: "PAYMENT_FAIL_CLOSED", cause: invokeError }
  );
}

/** Fail closed: remote money statuses are webhook-only. Local device rows may still update. */
const CLIENT_ALLOWED_STATUSES = new Set(["pending", "canceled", "failed", "cancelled"]);
const WEBHOOK_ONLY_STATUSES = new Set(["succeeded", "refunded", "paid"]);

export async function markPaymentStatus(id, status) {
  const normalized = String(status || "").toLowerCase();
  if (WEBHOOK_ONLY_STATUSES.has(normalized)) {
    throw new PersistenceError(
      "Paid / refunded status is set only by the payment provider webhook. TitanOS will not mark this paid from the browser.",
      { source: DATA_SOURCE.remote, code: "PAYMENT_STATUS_WEBHOOK_ONLY" }
    );
  }
  if (!CLIENT_ALLOWED_STATUSES.has(normalized)) {
    throw new PersistenceError("Unsupported payment status.", {
      source: DATA_SOURCE.remote,
      code: "PAYMENT_STATUS_INVALID",
    });
  }

  try {
    return withSource(await api.entities.Payment.update(id, { status: normalized === "cancelled" ? "canceled" : normalized }), DATA_SOURCE.remote);
  } catch (err) {
    const localId = String(id || "");
    const looksLocal = localId.startsWith("local_") || !/^[0-9a-f-]{36}$/i.test(localId);
    if (!looksLocal) {
      throw new PersistenceError("Could not update payment status on the server. No status change was saved.", {
        source: DATA_SOURCE.remote,
        code: "PAYMENT_STATUS_FAIL",
        cause: err,
      });
    }

    // Device-only rows from older builds — surface, don't pretend remote.
    const userKeys = Object.keys(localStorage || {}).filter((k) => k.startsWith(`${PREFIX}_payments_`));
    for (const key of userKeys) {
      try {
        const rows = JSON.parse(localStorage.getItem(key) || "[]");
        const idx = rows.findIndex((r) => r.id === id);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], status: normalized };
          localStorage.setItem(key, JSON.stringify(rows));
          return withSource({ ...rows[idx] }, DATA_SOURCE.local);
        }
      } catch {
        /* continue */
      }
    }
    throw new PersistenceError("Could not update payment status.", {
      source: DATA_SOURCE.local,
      code: "PAYMENT_STATUS_MISSING",
      cause: err,
    });
  }
}

export async function deletePayment(userId, id) {
  try {
    await api.entities.Payment.delete(id);
  } catch {
    writeLocal(
      PREFIX,
      userId,
      "payments",
      readLocal(PREFIX, userId, "payments", []).filter((row) => row.id !== id)
    );
  }
}

export { getSource, DATA_SOURCE };
