import { api } from "@/api/apiClient";

/** Generate a post-job completion report + follow-up suggestions. */
export function buildLocalJobSummary(job = {}, { photos = [], checklist = [] } = {}) {
  const done = (checklist || []).filter((c) => c.done).length;
  const total = (checklist || []).length;
  const before = (photos || []).filter((p) => p.kind === "before").length;
  const after = (photos || []).filter((p) => p.kind === "after").length;
  const title = job.title || job.service_type || "Job";
  const customer = job.customer_name || "the customer";

  const report = [
    `Completed ${title} for ${customer}.`,
    total ? `Checklist ${done}/${total} items finished.` : "Scope completed per agreement.",
    before || after ? `Photos: ${before} before, ${after} after.` : "Recommend adding before/after photos next time.",
    job.amount ? `Quoted/job amount $${Number(job.amount).toLocaleString()}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const customerNotes = `Thanks ${customer.split(" ")[0] || "there"} — we finished ${title.toLowerCase()} today. Let us know if anything needs a touch-up.`;

  const followUp = `Hi ${customer.split(" ")[0] || "there"}, checking in after your recent ${String(job.service_type || "service").toLowerCase()}. Need anything else?`;

  const maintenance =
    /hvac|roof|lawn|pressure|plumb|electric/i.test(String(job.service_type || title))
      ? `Schedule a maintenance visit in 6–12 months for ${String(job.service_type || title).toLowerCase()}.`
      : "Offer a seasonal checkup or related add-on service in 30–90 days.";

  return {
    completion_report: report,
    customer_notes: customerNotes,
    follow_up_message: followUp,
    maintenance_reminder: maintenance,
    source: "local",
  };
}

export async function generateJobSummary(job, extras = {}) {
  const local = buildLocalJobSummary(job, extras);
  try {
    const res = await api.functions.invoke("titanAI", {
      message: `Write a short field-service job completion summary for: ${JSON.stringify({
        title: job.title,
        service: job.service_type,
        customer: job.customer_name,
        amount: job.amount,
        checklist_done: (extras.checklist || []).filter((c) => c.done).length,
        photos: (extras.photos || []).length,
      })}. Include: 1) completion report 2) customer note 3) follow-up text 4) maintenance tip. Keep under 120 words.`,
    });
    const text = res?.data?.message || res?.message || "";
    if (text) {
      return {
        ...local,
        completion_report: text.slice(0, 800),
        source: res?.data?.source || "ai",
      };
    }
  } catch {
    /* local fallback */
  }
  return local;
}
