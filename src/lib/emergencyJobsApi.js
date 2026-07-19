import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_emergency";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);

export async function listEmergencyJobs(userId) {
  try {
    return await api.entities.EmergencyJob.filter({ user_id: userId }, "-created_date");
  } catch {
    return local(userId);
  }
}

export async function createEmergencyJob(user, values) {
  const row = {
    status: "open",
    urgency: "same_day",
    category: "general",
    ...values,
    user_id: user.id,
    created_by_id: user.id,
  };
  try {
    return await api.entities.EmergencyJob.create(row);
  } catch {
    const item = { id: uid(), created_at: new Date().toISOString(), ...row };
    save(user.id, [item, ...local(user.id)]);
    return item;
  }
}

export async function updateEmergencyJob(userId, id, values) {
  try {
    return await api.entities.EmergencyJob.update(id, values);
  } catch {
    const item = { ...local(userId).find((r) => r.id === id), ...values };
    save(userId, local(userId).map((r) => (r.id === id ? item : r)));
    return item;
  }
}

export async function deleteEmergencyJob(userId, id) {
  try {
    await api.entities.EmergencyJob.delete(id);
  } catch {
    save(userId, local(userId).filter((r) => r.id !== id));
  }
}
