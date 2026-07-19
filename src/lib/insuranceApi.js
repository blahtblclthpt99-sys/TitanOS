import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_insurance";
const local = (userId) => readLocal(PREFIX, userId, "docs", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "docs", rows);

function migrateLegacyLocal(userId) {
  try {
    const legacy = JSON.parse(localStorage.getItem("insurance_docs") || "[]");
    if (!Array.isArray(legacy) || !legacy.length) return;
    const existing = local(userId);
    const ids = new Set(existing.map((d) => d.id));
    const merged = [
      ...legacy
        .filter((d) => d?.url && !ids.has(d.id))
        .map((d) => ({
          id: d.id || uid(),
          user_id: userId,
          name: d.name || "Insurance document",
          url: d.url,
          size_label: d.size || "",
          created_at: new Date().toISOString(),
          doc_type: "liability",
        })),
      ...existing,
    ];
    save(userId, merged);
    localStorage.removeItem("insurance_docs");
  } catch {
    /* ignore */
  }
}

export async function listInsuranceDocs(userId) {
  migrateLegacyLocal(userId);
  try {
    return await api.entities.InsuranceDoc.filter({ user_id: userId }, "-created_date");
  } catch {
    return local(userId);
  }
}

export async function createInsuranceDoc(user, values) {
  const row = {
    doc_type: "liability",
    ...values,
    user_id: user.id,
    created_by_id: user.id,
  };
  try {
    return await api.entities.InsuranceDoc.create(row);
  } catch {
    const item = { id: uid(), created_at: new Date().toISOString(), ...row };
    save(user.id, [item, ...local(user.id)]);
    return item;
  }
}

export async function deleteInsuranceDoc(userId, id) {
  try {
    await api.entities.InsuranceDoc.delete(id);
  } catch {
    save(userId, local(userId).filter((d) => d.id !== id));
  }
}
