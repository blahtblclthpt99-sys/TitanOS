import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";
import { DATA_SOURCE, withSource, getSource } from "@/lib/dataSource";

const PREFIX = "titanos_escrow";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);

/** List holds — remote when available; otherwise device store tagged `_source: local`. */
export async function listEscrowHolds(userId) {
  try {
    return withSource(await api.entities.EscrowHold.filter({ user_id: userId }, "-created_date"), DATA_SOURCE.remote);
  } catch {
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
  } catch {
    const item = { id: uid(), created_at: new Date().toISOString(), ...row };
    save(user.id, [item, ...local(user.id)]);
    return withSource(item, DATA_SOURCE.local);
  }
}

export async function updateEscrowHold(userId, id, values) {
  try {
    return withSource(await api.entities.EscrowHold.update(id, values), DATA_SOURCE.remote);
  } catch {
    const item = { ...local(userId).find((r) => r.id === id), ...values };
    save(
      userId,
      local(userId).map((r) => (r.id === id ? item : r))
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
  if (next.customer_confirmed && next.provider_confirmed) {
    patch.status = "released";
    next.status = "released";
  }
  return updateEscrowHold(userId, hold.id, patch);
}

export async function deleteEscrowHold(userId, id) {
  try {
    await api.entities.EscrowHold.delete(id);
  } catch {
    save(
      userId,
      local(userId).filter((r) => r.id !== id)
    );
  }
}

export { getSource, DATA_SOURCE };
