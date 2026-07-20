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
  const row = {
    name: values.name,
    category: values.category || "tool",
    status: values.status || "active",
    brand: values.brand || values.make || "",
    model: values.model || "",
    year: values.year != null && values.year !== "" ? Number(values.year) : null,
    serial_number: values.serial_number || "",
    purchase_date: values.purchase_date || null,
    purchase_price: values.purchase_price ?? 0,
    warranty_expires: values.warranty_expires || null,
    next_service_date: values.next_service_date || null,
    notes: values.notes || "",
    photo_url: values.photo_url || "",
    assigned_to: values.assigned_to || "",
    mileage: values.mileage ?? 0,
    user_id: user.id,
    created_by_id: user.id,
  };
  // Drop null year if column missing on older DBs — retry without it
  try {
    return await api.entities.Equipment.create(row);
  } catch (err) {
    if (row.year != null && /year/i.test(err?.message || "")) {
      try {
        const { year, ...withoutYear } = row;
        const created = await api.entities.Equipment.create(withoutYear);
        return { ...created, year: row.year, make: values.make || values.brand };
      } catch {
        /* fall through to local */
      }
    }
    const item = {
      id: uid(),
      created_at: new Date().toISOString(),
      ...row,
      make: values.make || values.brand || row.brand,
    };
    save(user.id, [item, ...local(user.id)]);
    return item;
  }
}
export async function updateEquipment(userId, id, values) {
  try { return await api.entities.Equipment.update(id, values); }
  catch { const item = { ...local(userId).find((row) => row.id === id), ...values }; save(userId, local(userId).map((row) => row.id === id ? item : row)); return item; }
}
export async function deleteEquipment(userId, id) {
  try { await api.entities.Equipment.delete(id); }
  catch { save(userId, local(userId).filter((row) => row.id !== id)); }
}
