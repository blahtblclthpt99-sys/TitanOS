import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_equipment";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);

export async function listEquipment(userId) {
  try { return await api.entities.Equipment.filter({ user_id: userId }, "-created_date"); }
  catch { return local(userId); }
}
export async function createEquipment(user, values) {
  const row = { ...values, user_id: user.id, created_by_id: user.id };
  try { return await api.entities.Equipment.create(row); }
  catch { const item = { id: uid(), created_at: new Date().toISOString(), ...row }; save(user.id, [item, ...local(user.id)]); return item; }
}
export async function updateEquipment(userId, id, values) {
  try { return await api.entities.Equipment.update(id, values); }
  catch { const item = { ...local(userId).find((row) => row.id === id), ...values }; save(userId, local(userId).map((row) => row.id === id ? item : row)); return item; }
}
export async function deleteEquipment(userId, id) {
  try { await api.entities.Equipment.delete(id); }
  catch { save(userId, local(userId).filter((row) => row.id !== id)); }
}
