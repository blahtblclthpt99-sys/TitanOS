import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_leads";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);
export async function listLeads(userId) {
  try { return await api.entities.Lead.filter({ user_id: userId }, "-created_date"); } catch { return local(userId); }
}
export async function createLead(user, values) {
  const row = { status: "new", source: "manual", ...values, user_id: user.id, created_by_id: user.id };
  try { return await api.entities.Lead.create(row); }
  catch { const item = { id: uid(), created_at: new Date().toISOString(), ...row }; save(user.id, [item, ...local(user.id)]); return item; }
}
export async function updateLead(userId, id, values) {
  try { return await api.entities.Lead.update(id, values); }
  catch { const item = { ...local(userId).find((row) => row.id === id), ...values }; save(userId, local(userId).map((row) => row.id === id ? item : row)); return item; }
}
export const updateStatus = (userId, id, status) => updateLead(userId, id, { status });
export async function deleteLead(userId, id) {
  try { await api.entities.Lead.delete(id); } catch { save(userId, local(userId).filter((row) => row.id !== id)); }
}
