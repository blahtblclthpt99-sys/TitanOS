import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_followups";
const defaults = [
  { name: "Thanks", delay_days: 0, message_template: "Thanks for choosing us, {customer_name}!" },
  { name: "Need another service?", delay_days: 30, message_template: "Hi {customer_name}, need help with another project?" },
  { name: "Time for maintenance", delay_days: 180, message_template: "Hi {customer_name}, it may be time for maintenance." },
];
const read = (userId, key) => readLocal(PREFIX, userId, key, []);
const write = (userId, key, rows) => writeLocal(PREFIX, userId, key, rows);

export async function listRules(userId) {
  try { return await api.entities.FollowUpRule.filter({ user_id: userId }, "delay_days"); } catch { return read(userId, "rules"); }
}
export async function listQueue(userId) {
  try { return await api.entities.FollowUpQueue.filter({ user_id: userId }, "scheduled_for"); } catch { return read(userId, "queue"); }
}
export async function createRule(user, values) {
  const row = { channel: "in_app", is_active: true, trigger_event: "job_completed", ...values, user_id: user.id, created_by_id: user.id };
  try { return await api.entities.FollowUpRule.create(row); }
  catch { const item = { id: uid(), created_at: new Date().toISOString(), ...row }; write(user.id, "rules", [...read(user.id, "rules"), item]); return item; }
}
export async function seedDefaultFollowUpRules(user) {
  const rules = await listRules(user.id);
  if (rules.length) return rules;
  return Promise.all(defaults.map((rule) => createRule(user, rule)));
}
export async function enqueueFollowUpsForJob(user, job, customer = {}) {
  const rules = await listRules(user.id);
  const customerName = job.customer_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  const rows = rules.filter((rule) => rule.is_active).map((rule) => ({
    user_id: user.id, created_by_id: user.id, customer_id: job.customer_id || customer.id || null, customer_name: customerName,
    job_id: job.id, rule_id: rule.id, channel: rule.channel, scheduled_for: new Date(Date.now() + Number(rule.delay_days) * 86400000).toISOString(),
    message: rule.message_template.replaceAll("{customer_name}", customerName || "there"),
  }));
  try { return await Promise.all(rows.map((row) => api.entities.FollowUpQueue.create(row))); }
  catch { const items = rows.map((row) => ({ id: uid(), status: "pending", created_at: new Date().toISOString(), ...row })); write(user.id, "queue", [...read(user.id, "queue"), ...items]); return items; }
}
export async function markQueueSent(userId, id) {
  const patch = { status: "sent", sent_at: new Date().toISOString() };
  try { return await api.entities.FollowUpQueue.update(id, patch); }
  catch { const item = { ...read(userId, "queue").find((row) => row.id === id), ...patch }; write(userId, "queue", read(userId, "queue").map((row) => row.id === id ? item : row)); return item; }
}

/** Email the follow-up (Resend when configured) and mark queue item sent. */
export async function sendFollowUpNow(user, row, customerEmail = "") {
  try {
    const res = await api.functions.invoke("sendFollowUp", {
      queue_id: row.id,
      user_id: user.id,
      to: customerEmail || row.customer_email || "",
      subject: `Follow-up from ${user.full_name || "your service provider"}`,
      body: row.message,
    });
    const patch = { status: "sent", sent_at: new Date().toISOString(), channel: "email" };
    try {
      return { ...(await api.entities.FollowUpQueue.update(row.id, patch)), send: res };
    } catch {
      const item = { ...row, ...patch };
      write(user.id, "queue", read(user.id, "queue").map((q) => (q.id === row.id ? item : q)));
      return { ...item, send: res };
    }
  } catch {
    return markQueueSent(user.id, row.id);
  }
}
