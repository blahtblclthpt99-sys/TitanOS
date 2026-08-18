import { api } from "@/api/apiClient";

function requireUserId(userId) {
  const id = String(userId || "").trim();
  if (!id) throw new Error("Sign in again to manage leads.");
  return id;
}

export async function listLeads(userId) {
  const id = requireUserId(userId);
  // Match the database authorization source exactly: leads_own is bound to
  // created_by_id = auth.uid(). `user_id` remains legacy display/data metadata.
  return api.entities.Lead.filter({ created_by_id: id }, "-created_date");
}

export async function createLead(user, values) {
  const userId = requireUserId(user?.id);
  const row = {
    status: "new",
    source: "manual",
    ...values,
    user_id: userId,
    created_by_id: userId,
  };
  return api.entities.Lead.create(row);
}

export async function updateLead(userId, id, values) {
  requireUserId(userId);
  if (!id) throw new Error("Lead id is required.");
  return api.entities.Lead.update(id, values);
}

export const updateStatus = (userId, id, status) => updateLead(userId, id, { status });

export async function deleteLead(userId, id) {
  requireUserId(userId);
  if (!id) throw new Error("Lead id is required.");
  return api.entities.Lead.delete(id);
}
