import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_phone_scripts";
const local = (userId) => readLocal(PREFIX, userId, "all", []);
const save = (userId, rows) => writeLocal(PREFIX, userId, "all", rows);

export const DEFAULT_FAQ = [
  { q: "What are your hours?", a: "We're typically available weekdays 8am–6pm. Leave a message anytime and we'll call back." },
  { q: "Do you offer free estimates?", a: "Yes — most standard jobs include a free estimate. Tell me a bit about the work." },
  { q: "Are you licensed and insured?", a: "Yes. I can text you our license and insurance details right after this call." },
];

export async function listPhoneScripts(userId) {
  try {
    return await api.entities.PhoneScript.filter({ user_id: userId }, "-created_date");
  } catch {
    return local(userId);
  }
}

export async function getOrCreatePhoneScript(user) {
  const rows = await listPhoneScripts(user.id);
  if (rows[0]) return rows[0];
  const row = {
    name: "Main greeting",
    greeting: `Thanks for calling ${user.company_name || user.full_name || "us"}. I can help book a job, answer common questions, or take a message.`,
    faq_json: DEFAULT_FAQ,
    transfer_number: user.phone || "",
    is_active: true,
    user_id: user.id,
    created_by_id: user.id,
  };
  try {
    return await api.entities.PhoneScript.create(row);
  } catch {
    const item = { id: uid(), created_at: new Date().toISOString(), ...row };
    save(user.id, [item]);
    return item;
  }
}

export async function updatePhoneScript(userId, id, values) {
  try {
    return await api.entities.PhoneScript.update(id, values);
  } catch {
    const item = { ...local(userId).find((r) => r.id === id), ...values };
    save(userId, local(userId).map((r) => (r.id === id ? item : r)));
    return item;
  }
}

export async function createPhoneScript(user, values = {}) {
  const row = {
    name: values.name || "New script",
    greeting:
      values.greeting ||
      `Thanks for calling ${user.company_name || user.full_name || "us"}. How can I help?`,
    faq_json: values.faq_json || DEFAULT_FAQ,
    transfer_number: values.transfer_number || user.phone || "",
    is_active: true,
    user_id: user.id,
    created_by_id: user.id,
  };
  try {
    return await api.entities.PhoneScript.create(row);
  } catch {
    const item = { id: uid(), created_at: new Date().toISOString(), ...row };
    save(user.id, [item, ...local(user.id)]);
    return item;
  }
}

export async function deletePhoneScript(userId, id) {
  try {
    await api.entities.PhoneScript.delete(id);
  } catch {
    save(userId, local(userId).filter((r) => r.id !== id));
  }
}

/** Simple keyword matcher for receptionist simulator */
export function answerFromScript(script, utterance) {
  const text = (utterance || "").toLowerCase();
  const faqs = Array.isArray(script?.faq_json) ? script.faq_json : DEFAULT_FAQ;
  for (const item of faqs) {
    const keys = String(item.q || "")
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    if (keys.some((k) => text.includes(k))) return item.a;
  }
  if (/book|schedule|appoint/.test(text)) {
    return "I can help book that. What day works best, and what's a good callback number?";
  }
  if (/price|cost|quote|estimate/.test(text)) {
    return "Happy to help with pricing. Most jobs start with a free estimate — can you describe the work briefly?";
  }
  return script?.greeting
    ? `I'm not sure I caught that. ${script.greeting}`
    : "Thanks for calling — can you repeat that, or say book, estimate, or hours?";
}
