import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_inventory";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);
export const isLowStock = (item) => Number(item.quantity) <= Number(item.reorder_at);

export async function listInventory(userId) {
  try { return await api.entities.InventoryItem.filter({ user_id: userId }, "-created_date"); }
  catch { return local(userId); }
}
export async function createInventoryItem(user, values) {
  const row = { ...values, quantity: Number(values.quantity || 0), reorder_at: Number(values.reorder_at || 0), user_id: user.id, created_by_id: user.id };
  try { return await api.entities.InventoryItem.create(row); }
  catch { const item = { id: uid(), created_at: new Date().toISOString(), ...row }; save(user.id, [item, ...local(user.id)]); return item; }
}
export async function updateInventoryItem(userId, id, values) {
  const row = { ...values, ...(values.quantity !== undefined ? { quantity: Number(values.quantity) } : {}) };
  try { return await api.entities.InventoryItem.update(id, row); }
  catch { const updated = { ...local(userId).find((item) => item.id === id), ...row }; save(userId, local(userId).map((item) => item.id === id ? updated : item)); return updated; }
}
