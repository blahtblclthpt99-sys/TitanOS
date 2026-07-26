import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";
import { DATA_SOURCE, PersistenceError, withSource, getSource } from "@/lib/dataSource";
import { reportError } from "@/lib/reportError";

const PREFIX = "titanos_escrow";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);

/** List holds — remote when available; otherwise device store tagged `_source: local`. */
export async function listEscrowHolds(userId) {
  try {
    return withSource(await api.entities.EscrowHold.filter({ user_id: userId }, "-created_date"), DATA_SOURCE.remote);
  } catch (error) {
    reportError("escrowApi:list", error);
    return withSource(local(userId), DATA_SOURCE.local);
  }
}

export async function createEscrowHold(user, values) {
  const row = {
    status: "held",
    customer_confirmed: false,
    provider_confirmed: false,
    ...values,
    amount: Number(values.amount || 0),
    user_id: user.id,
    created_by_id: user.id,
  };
  try {
    return withSource(await api.entities.EscrowHold.create(row), DATA_SOURCE.remote);
  } catch (error) {
    reportError("escrowApi:create", error);
    const item = { id: `local_${uid()}`, created_at: new Date().toISOString(), ...row };
    save(user.id, [item, ...local(user.id)]);
    return withSource(item, DATA_SOURCE.local);
  }
}

export async function updateEscrowHold(userId, id, values) {
  // 032: status + amount are server-only on remote. Clients may only patch notes/confirms.
  const { status, amount, ...safe } = values || {};
  const localRows = local(userId);
  const isLocalRow = localRows.some((r) => r.id === id) || String(id).startsWith("local_");

  try {
    const saved = withSource(await api.entities.EscrowHold.update(id, safe), DATA_SOURCE.remote);
    if (status != null || amount != null) {
      return withSource(
        { ...saved, ...(status != null ? { status } : {}), ...(amount != null ? { amount } : {}) },
        DATA_SOURCE.remote
      );
    }
    return saved;
  } catch (error) {
    if (!isLocalRow) {
      reportError("escrowApi:update", error);
      throw new PersistenceError("Couldn't update hold. Check your connection and try again.", {
        source: DATA_SOURCE.remote,
        code: "ESCROW_UPDATE_FAILED",
        cause: error,
      });
    }
    reportError("escrowApi:update:local", error);
    const item = { ...localRows.find((r) => r.id === id), ...values };
    save(
      userId,
      localRows.map((r) => (r.id === id ? item : r))
    );
    return withSource(item, DATA_SOURCE.local);
  }
}

export async function confirmEscrowSide(userId, hold, side) {
  const patch =
    side === "customer"
      ? { customer_confirmed: true }
      : { provider_confirmed: true };
  const next = { ...hold, ...patch };
  // Demo-only release badge — real settlement requires service_role / Stripe Connect.
  if (next.customer_confirmed && next.provider_confirmed) {
    patch.status = "released";
  }
  return updateEscrowHold(userId, hold.id, patch);
}

export async function deleteEscrowHold(userId, id) {
  const localRows = local(userId);
  const isLocalRow = localRows.some((r) => r.id === id) || String(id).startsWith("local_");
  try {
    await api.entities.EscrowHold.delete(id);
  } catch (error) {
    if (!isLocalRow) {
      reportError("escrowApi:delete", error);
      throw new PersistenceError("Couldn't delete hold. Check your connection and try again.", {
        source: DATA_SOURCE.remote,
        code: "ESCROW_DELETE_FAILED",
        cause: error,
      });
    }
    reportError("escrowApi:delete:local", error);
    save(
      userId,
      localRows.filter((r) => r.id !== id)
    );
  }
}

export { getSource, DATA_SOURCE };
