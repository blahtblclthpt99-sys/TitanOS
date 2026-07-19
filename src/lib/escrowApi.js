import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_escrow";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);

export async function listEscrowHolds(userId) {
  try {
    return await api.entities.EscrowHold.filter({ user_id: userId }, "-created_date");
  } catch {
    return local(userId);
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
    return await api.entities.EscrowHold.create(row);
  } catch {
    const item = { id: uid(), created_at: new Date().toISOString(), ...row };
    save(user.id, [item, ...local(user.id)]);
    return item;
  }
}

export async function updateEscrowHold(userId, id, values) {
  try {
    return await api.entities.EscrowHold.update(id, values);
  } catch {
    const item = { ...local(userId).find((r) => r.id === id), ...values };
    save(userId, local(userId).map((r) => (r.id === id ? item : r)));
    return item;
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
