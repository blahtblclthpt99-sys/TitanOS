/**
 * Business Timeline — chronological source of truth across jobs, money, and customer touchpoints.
 */

function ts(value) {
  const t = new Date(value || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function money(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

/**
 * Build a unified timeline from related records.
 * @returns {{ id, at, type, title, detail, path?, tone? }[]}
 */
export function buildBusinessTimeline({
  jobs = [],
  estimates = [],
  invoices = [],
  communications = [],
  files = [],
  photos = [],
  checkins = [],
  payments = [],
  reviews = [],
  customerId = null,
  customerName = null,
} = {}) {
  const events = [];
  const nameMatch = (row) => {
    if (!customerId && !customerName) return true;
    if (customerId && row.customer_id === customerId) return true;
    if (customerName && String(row.customer_name || "").trim().toLowerCase() === customerName.toLowerCase()) {
      return true;
    }
    return false;
  };

  for (const job of jobs.filter(nameMatch)) {
    events.push({
      id: `job-created-${job.id}`,
      at: job.created_date || job.created_at,
      type: "job",
      title: `Job created: ${job.title || "Untitled"}`,
      detail: job.status,
      path: "/jobs",
      tone: "neutral",
      entity_id: job.id,
    });
    if (job.scheduled_date) {
      events.push({
        id: `job-sched-${job.id}`,
        at: `${job.scheduled_date}T${job.scheduled_time || "09:00"}:00`,
        type: "appointment",
        title: `Appointment scheduled: ${job.title || "Job"}`,
        detail: [job.scheduled_date, job.scheduled_time].filter(Boolean).join(" · "),
        path: "/schedule",
        tone: "info",
        entity_id: job.id,
      });
    }
    if (job.status === "completed") {
      events.push({
        id: `job-done-${job.id}`,
        at: job.completed_at || job.updated_date || job.updated_at || job.scheduled_date,
        type: "completed",
        title: `Job completed: ${job.title || "Job"}`,
        detail: job.completion_summary ? String(job.completion_summary).slice(0, 120) : "Marked complete",
        path: "/jobs",
        tone: "success",
        entity_id: job.id,
      });
    }
    if (job.status === "cancelled") {
      events.push({
        id: `job-cancel-${job.id}`,
        at: job.updated_date || job.updated_at || job.created_date,
        type: "cancelled",
        title: `Job cancelled: ${job.title || "Job"}`,
        detail: "Cancelled",
        path: "/jobs",
        tone: "danger",
        entity_id: job.id,
      });
    }
  }

  for (const est of estimates.filter(nameMatch)) {
    events.push({
      id: `est-${est.id}`,
      at: est.created_date || est.created_at,
      type: "estimate",
      title: `Estimate ${est.estimate_number || ""}`.trim() || "Estimate created",
      detail: `${est.status || "draft"} · ${money(est.total)}`,
      path: "/estimates",
      tone: est.status === "accepted" ? "success" : "info",
      entity_id: est.id,
    });
    if (est.status === "accepted") {
      events.push({
        id: `est-acc-${est.id}`,
        at: est.updated_date || est.updated_at || est.created_date,
        type: "estimate_accepted",
        title: "Estimate approved by customer",
        detail: money(est.total),
        path: "/estimates",
        tone: "success",
        entity_id: est.id,
      });
    }
  }

  for (const inv of invoices.filter(nameMatch)) {
    events.push({
      id: `inv-${inv.id}`,
      at: inv.created_date || inv.created_at,
      type: "invoice",
      title: `Invoice ${inv.invoice_number || ""}`.trim() || "Invoice created",
      detail: `${inv.status || "draft"} · ${money(inv.total)}`,
      path: "/invoices",
      tone: inv.status === "overdue" ? "danger" : "info",
      entity_id: inv.id,
    });
    if (inv.status === "paid") {
      events.push({
        id: `inv-paid-${inv.id}`,
        at: inv.paid_at || inv.updated_date || inv.updated_at || inv.created_date,
        type: "payment",
        title: "Invoice paid",
        detail: money(inv.total || inv.amount_paid),
        path: "/payments",
        tone: "success",
        entity_id: inv.id,
      });
    }
  }

  for (const p of payments.filter(nameMatch)) {
    events.push({
      id: `pay-${p.id}`,
      at: p.created_date || p.created_at || p.paid_at,
      type: "payment",
      title: "Payment recorded",
      detail: money(p.amount || p.total),
      path: "/payments",
      tone: "success",
      entity_id: p.id,
    });
  }

  for (const c of communications) {
    events.push({
      id: `comm-${c.id}`,
      at: c.date || c.created_date || c.created_at,
      type: "message",
      title: `${String(c.type || "note").toUpperCase()} logged`,
      detail: String(c.body || "").slice(0, 140),
      path: null,
      tone: "neutral",
      entity_id: c.id,
    });
  }

  for (const f of files) {
    events.push({
      id: `file-${f.id}`,
      at: f.created_date || f.created_at,
      type: "file",
      title: `File uploaded: ${f.name || "Attachment"}`,
      detail: f.content_type || "document",
      path: null,
      tone: "neutral",
      entity_id: f.id,
    });
  }

  for (const ph of photos) {
    events.push({
      id: `photo-${ph.id}`,
      at: ph.created_date || ph.created_at,
      type: "photo",
      title: `${ph.kind === "before" ? "Before" : ph.kind === "after" ? "After" : "Job"} photo added`,
      detail: ph.caption || ph.kind || "photo",
      path: "/jobs",
      tone: "info",
      entity_id: ph.id,
    });
  }

  for (const ch of checkins) {
    events.push({
      id: `checkin-${ch.id}`,
      at: ch.created_date || ch.created_at,
      type: "checkin",
      title: ch.event_type === "check_out" ? "Worker checked out" : "Worker checked in",
      detail: ch.note || (ch.lat != null ? `GPS ${Number(ch.lat).toFixed(4)}, ${Number(ch.lng).toFixed(4)}` : "On site"),
      path: "/jobs",
      tone: "info",
      entity_id: ch.id,
    });
  }

  for (const r of reviews) {
    events.push({
      id: `rev-${r.id}`,
      at: r.created_date || r.created_at,
      type: "review",
      title: `Review · ${r.rating || r.stars || "?"}★`,
      detail: String(r.comment || r.body || "").slice(0, 120),
      path: "/reputation",
      tone: "success",
      entity_id: r.id,
    });
  }

  return events
    .filter((e) => e.at)
    .sort((a, b) => ts(b.at) - ts(a.at));
}

/** Compact feed for Home dashboard from the same entities. */
export function buildHomeTimelineFeed({ jobs = [], estimates = [], invoices = [], limit = 12 } = {}) {
  return buildBusinessTimeline({ jobs, estimates, invoices }).slice(0, limit);
}
