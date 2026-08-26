import { api } from "@/api/apiClient";
import { deleteEntityWithLocalFallback, readLocal, uid, updateEntityWithLocalFallback, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_credentials";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);
export function daysUntilExpiry(credential) {
  if (!credential?.expires_on) return null;
  return Math.ceil((new Date(`${credential.expires_on}T00:00:00`) - new Date()) / 86400000);
}
export function credentialStatus(credential, soonDays = credential?.reminder_days ?? 30) {
  const days = daysUntilExpiry(credential);
  if (credential?.status === "archived") return { id: "archived", label: "Archived", days };
  if (days === null) return { id: "current", label: "No expiration", days };
  if (days < 0) return { id: "expired", label: "Expired", days };
  if (days <= Number(soonDays || 30)) return { id: "soon", label: "Expires soon", days };
  return { id: "current", label: "Current", days };
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
  return updateEntityWithLocalFallback({
    id,
    values,
    remoteUpdate: () => api.entities.Credential.update(id, values),
    readLocalRows: () => local(userId),
    writeLocalRows: (rows) => save(userId, rows),
  });
}
export async function renewCredential(user, credential, values) {
  const archived = {
    title: credential.title,
    credential_type: credential.credential_type || "license",
    issuer: credential.issuer || "",
    state: credential.state || "",
    number: credential.number || "",
    issued_on: credential.issued_on || null,
    expires_on: credential.expires_on || null,
    reminder_days: credential.reminder_days ?? 30,
    document_url: credential.document_url || "",
    notes: credential.notes || "",
    status: "archived",
    archived_from_id: credential.id,
  };
  await createCredential(user, archived);
  return updateCredential(user.id, credential.id, {
    ...values,
    status: "active",
    renewed_at: new Date().toISOString(),
  });
}
export async function deleteCredential(userId, id) {
  return deleteEntityWithLocalFallback({
    id,
    remoteDelete: () => api.entities.Credential.delete(id),
    readLocalRows: () => local(userId),
    writeLocalRows: (rows) => save(userId, rows),
  });
}
