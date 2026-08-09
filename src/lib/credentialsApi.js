import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_credentials";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);
export function daysUntilExpiry(credential) {
  if (!credential?.expires_on) return null;
  return Math.ceil((new Date(`${credential.expires_on}T00:00:00`) - new Date()) / 86400000);
}
export async function listCredentials(userId) {
  try { return await api.entities.Credential.filter({ user_id: userId }, "expires_on"); } catch { return local(userId); }
}
export async function createCredential(user, values) {
  const row = { credential_type: "license", status: "active", reminder_days: 30, ...values, user_id: user.id, created_by_id: user.id };
  try { return await api.entities.Credential.create(row); }
  catch { const item = { id: uid(), created_at: new Date().toISOString(), ...row }; save(user.id, [item, ...local(user.id)]); return item; }
}
export async function updateCredential(userId, id, values) {
  try { return await api.entities.Credential.update(id, values); }
  catch { const item = { ...local(userId).find((row) => row.id === id), ...values }; save(userId, local(userId).map((row) => row.id === id ? item : row)); return item; }
}
export async function deleteCredential(userId, id) {
  try { await api.entities.Credential.delete(id); } catch { save(userId, local(userId).filter((row) => row.id !== id)); }
}
