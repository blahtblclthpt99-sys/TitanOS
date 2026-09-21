import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_ORIGINS = new Set([
  "https://titanos.app",
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
  "https://titanos-web.vercel.app",
  "https://titanfieldos.com",
]);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://titanos.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanText(value: unknown, max = 1000) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
}

function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return { error: "Sign in required", status: 401 } as const;
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { error: "Session expired or invalid", status: 401 } as const;
  }
  return { client, user: data.user } as const;
}


function adminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service role is unavailable");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function hasAdminAccess(client: ReturnType<typeof createClient>, user: { app_metadata?: Record<string, unknown> }) {
  if (String(user.app_metadata?.role || "") === "admin") return true;
  const { data, error } = await client.rpc("is_admin");
  return !error && data === true;
}

async function supportAccess(
  client: ReturnType<typeof createClient>,
  admin: ReturnType<typeof createClient>,
  user: { id: string; app_metadata?: Record<string, unknown> },
  caseId?: string
) {
  const role = String(user.app_metadata?.role || "");
  if (role === "admin" || role === "support_admin") return { allowed: true, role };
  let query = admin
    .from("support_agent_assignments")
    .select("case_id,assignment_role")
    .eq("agent_user_id", user.id)
    .eq("active", true);
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query.limit(250);
  if (error) throw error;
  const rows = data || [];
  return {
    allowed: rows.length > 0,
    role: cleanText(rows[0]?.assignment_role || "support_agent", 80),
    caseIds: rows.map((row) => row.case_id),
  };
}

function supportStats(cases: Array<Record<string, unknown>>) {
  return {
    open: cases.filter((item) => !["RESOLVED", "CLOSED"].includes(String(item.status))).length,
    urgent: cases.filter((item) => ["P0", "P1"].includes(String(item.priority)) && !["RESOLVED", "CLOSED"].includes(String(item.status))).length,
    waiting: cases.filter((item) => item.status === "NEEDS_USER").length,
    human: cases.filter((item) => item.status === "HUMAN_AGENT").length,
    engineering: cases.filter((item) => item.status === "ENGINEERING").length,
    ai_working: cases.filter((item) => item.status === "AI_WORKING").length,
  };
}

async function writeFeeHistory(
  admin: ReturnType<typeof createClient>,
  feeRuleId: string,
  action: string,
  snapshot: Record<string, unknown>,
  actorId: string
) {
  const { error } = await admin.from("fee_rule_history").insert({
    fee_rule_id: feeRuleId,
    action,
    snapshot,
    actor_id: actorId,
  });
  if (error) throw error;
}

async function nextFeeVersion(admin: ReturnType<typeof createClient>, categoryId: string, contextKey: string) {
  const { data, error } = await admin
    .from("fee_rules")
    .select("version")
    .eq("category_id", categoryId)
    .eq("context_key", contextKey)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw error;
  return Number(data?.[0]?.version || 0) + 1;
}

async function liveBusinessSummary(client: ReturnType<typeof createClient>, userId: string, prompt: string) {
  const [
    customersResult,
    jobsResult,
    invoicesResult,
    expensesResult,
  ] = await Promise.all([
    client.from("customers").select("id", { count: "exact", head: true }),
    client.from("jobs").select("id,status,title,scheduled_date").order("created_at", { ascending: false }).limit(250),
    client.from("invoices").select("id,status,total,amount_paid,balance_due,due_date").order("created_at", { ascending: false }).limit(500),
    client.from("expenses").select("amount,date").order("created_at", { ascending: false }).limit(500),
  ]);

  const jobs = jobsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const totalInvoiced = invoices.reduce((sum, row) => sum + money(row.total), 0);
  const totalPaid = invoices.reduce((sum, row) => sum + money(row.amount_paid), 0);
  const totalDue = invoices.reduce((sum, row) => sum + money(row.balance_due), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + money(row.amount), 0);
  const openJobs = jobs.filter((row) => !["completed", "cancelled"].includes(String(row.status || "").toLowerCase())).length;
  const completedJobs = jobs.filter((row) => String(row.status || "").toLowerCase() === "completed").length;
  const overdueInvoices = invoices.filter((row) => {
    if (!row.due_date || money(row.balance_due) <= 0) return false;
    return new Date(String(row.due_date)).getTime() < Date.now();
  }).length;

  const summary = {
    userId,
    customers: Number(customersResult.count || 0),
    jobs: jobs.length,
    openJobs,
    completedJobs,
    invoices: invoices.length,
    totalInvoiced,
    totalPaid,
    totalDue,
    overdueInvoices,
    expenses: totalExpenses,
  };

  const q = prompt.toLowerCase();
  let message =
    `Live TitanOS summary: ${summary.openJobs} open jobs, ${summary.customers} customers, ` +
    `${summary.invoices} invoices, $${summary.totalDue.toFixed(2)} outstanding, and $${summary.expenses.toFixed(2)} recorded expenses.`;

  if (/invoice|payment|owed|outstanding|revenue/.test(q)) {
    message =
      `Invoices: ${summary.invoices} total, $${summary.totalInvoiced.toFixed(2)} invoiced, ` +
      `$${summary.totalPaid.toFixed(2)} paid, $${summary.totalDue.toFixed(2)} outstanding, ` +
      `${summary.overdueInvoices} overdue.`;
  } else if (/job|schedule|work/.test(q)) {
    message = `Jobs: ${summary.jobs} loaded, ${summary.openJobs} open and ${summary.completedJobs} completed.`;
  } else if (/customer|client/.test(q)) {
    message = `You currently have ${summary.customers} customers in TitanOS.`;
  } else if (/expense|cost|spend/.test(q)) {
    message = `Recorded expenses total $${summary.expenses.toFixed(2)} across the currently loaded expense history.`;
  }

  return { message, summary };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "Method not allowed" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(origin, 400, { error: "Invalid JSON" });
  }

  const functionName = cleanText(body.functionName ?? body.action, 100);
  const payload = (body.payload && typeof body.payload === "object" ? body.payload : body) as Record<string, unknown>;

  if (functionName === "health") {
    return reply(origin, 200, {
      ok: true,
      service: "titan-api",
      backend: "supabase-edge",
      project: "TitanOS Recovery",
      capabilities: {
        database: true,
        auth: true,
        support: true,
        notifications: true,
        accountDeletion: true,
        liveBusinessSummary: true,
        referrals: true,
        adminControl: true,
        feeManagement: true,
        supportStaff: true,
        supportAttachments: true,
        supportCsat: true,
        openaiConfigured: Boolean(Deno.env.get("OPENAI_API_KEY")),
        stripeConfigured: Boolean(Deno.env.get("STRIPE_SECRET_KEY")),
        resendConfigured: Boolean(Deno.env.get("RESEND_API_KEY")),
      },
    });
  }

  const auth = await requireUser(req);
  if ("error" in auth) return reply(origin, auth.status, { error: auth.error });
  const { client, user } = auth;

  try {
    switch (functionName) {
      case "createNotification": {
        const targetUser = cleanText(payload.user_id ?? payload.userId ?? user.id, 80);
        if (targetUser !== user.id) return reply(origin, 403, { error: "Cannot create notifications for another user" });
        const row = {
          user_id: user.id,
          created_by_id: user.id,
          type: cleanText(payload.type || "system", 80),
          title: cleanText(payload.title || "TitanOS", 160),
          body: cleanText(payload.body || payload.message || "", 1000) || null,
          link: cleanText(payload.link || "", 500) || null,
          meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
        };
        const { data, error } = await client.from("notifications").insert(row).select("*").single();
        if (error) throw error;
        return reply(origin, 200, { data: { notification: data }, notification: data });
      }

      case "supportCreateCase": {
        const description = cleanText(payload.description ?? payload.message, 5000);
        const row = {
          created_by_id: user.id,
          title: cleanText(payload.title ?? payload.subject ?? "Support request", 180),
          description: description || "Support request",
          category: cleanText(payload.category || "technical", 80),
          priority: cleanText(payload.priority || "P3", 20),
          source: "android_edge",
          platform: cleanText(payload.platform || "android", 50),
          app_version: cleanText(payload.app_version || payload.appVersion || "", 50) || null,
        };
        const { data, error } = await client.from("support_cases").insert(row).select("*").single();
        if (error) throw error;
        if (description) {
          await client.from("support_messages").insert({
            case_id: data.id,
            sender_user_id: user.id,
            sender_kind: "customer",
            body: description,
            metadata: {},
          });
        }
        return reply(origin, 200, { case: data });
      }

      case "supportListCases": {
        const { data, error } = await client
          .from("support_cases")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return reply(origin, 200, { cases: data ?? [] });
      }

      case "supportGetCase": {
        const caseId = cleanText(payload.case_id, 80);
        const { data: supportCase, error } = await client.from("support_cases").select("*").eq("id", caseId).single();
        if (error) throw error;
        const { data: messages, error: msgError } = await client
          .from("support_messages")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: true });
        if (msgError) throw msgError;
        return reply(origin, 200, { case: supportCase, messages: messages ?? [] });
      }

      case "supportPostMessage": {
        const caseId = cleanText(payload.case_id, 80);
        const message = cleanText(payload.message, 5000);
        if (!message) return reply(origin, 400, { error: "Message is required" });
        const { error: accessError } = await client.from("support_cases").select("id").eq("id", caseId).single();
        if (accessError) throw accessError;
        const { data, error } = await client
          .from("support_messages")
          .insert({
            case_id: caseId,
            sender_user_id: user.id,
            sender_kind: "customer",
            body: message,
            metadata: {},
          })
          .select("*")
          .single();
        if (error) throw error;
        await client.from("support_cases").update({ last_message_at: new Date().toISOString() }).eq("id", caseId);
        return reply(origin, 200, { message: data });
      }

      case "supportEscalate": {
        const caseId = cleanText(payload.case_id, 80);
        const { data, error } = await client
          .from("support_cases")
          .update({ status: "ESCALATED", escalated_at: new Date().toISOString(), priority: "P2" })
          .eq("id", caseId)
          .select("*")
          .single();
        if (error) throw error;
        return reply(origin, 200, { case: data });
      }

      case "supportReopenCase": {
        const caseId = cleanText(payload.case_id, 80);
        const { data, error } = await client
          .from("support_cases")
          .update({ status: "NEW", resolved_at: null, closed_at: null })
          .eq("id", caseId)
          .select("*")
          .single();
        if (error) throw error;
        return reply(origin, 200, { case: data });
      }

      case "supportAI": {
        const text = cleanText(payload.message, 4000).toLowerCase();
        let response = "I can help with TitanOS. Tell me which screen or action is failing and what you expected to happen.";
        if (/sign.?in|login|password|auth/.test(text)) response = "For sign-in issues, confirm network access, retry the login once, and use Forgot Password if the credential is rejected. TitanOS will not silently create a second account.";
        else if (/sync|offline|network/.test(text)) response = "TitanOS protects writes when service connectivity is unavailable. Reconnect, reopen the affected screen, then retry the action so the server can confirm it.";
        else if (/invoice|payment/.test(text)) response = "For invoice or payment issues, open the invoice first and verify its balance/status before retrying payment. TitanOS keeps payment state server-authoritative.";
        return reply(origin, 200, { reply: response, source: "titan-support-edge" });
      }


      case "supportRegisterAttachment": {
        const caseId = cleanText(payload.case_id, 80);
        const storagePath = cleanText(payload.storage_path, 1000);
        const fileName = cleanText(payload.file_name, 255);
        const mimeType = cleanText(payload.mime_type, 160).toLowerCase();
        const sizeBytes = Number(payload.size_bytes);
        const allowedMime = new Set([
          "image/jpeg","image/png","image/webp","application/pdf","text/plain","text/csv",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","video/mp4",
        ]);
        if (!caseId || !fileName || !storagePath) return reply(origin, 400, { error: "Case and attachment details are required" });
        if (!allowedMime.has(mimeType)) return reply(origin, 400, { error: "This attachment type is not supported" });
        if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 10 * 1024 * 1024) {
          return reply(origin, 400, { error: "Attachment must be 10 MB or smaller" });
        }
        const admin = adminClient();
        const { data: supportCase } = await admin.from("support_cases").select("id,created_by_id").eq("id", caseId).eq("created_by_id", user.id).maybeSingle();
        if (!supportCase) return reply(origin, 404, { error: "Support case not found" });
        const prefix = `${user.id}/${caseId}/`;
        if (!storagePath.startsWith(prefix)) return reply(origin, 403, { error: "Attachment path is not authorized for this case" });
        const slash = storagePath.lastIndexOf("/");
        const folder = slash >= 0 ? storagePath.slice(0, slash) : "";
        const objectName = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
        const { data: objects, error: listError } = await admin.storage.from("support-attachments").list(folder, { limit: 10, search: objectName });
        if (listError) throw listError;
        const objectRow = (objects || []).find((item) => item.name === objectName);
        if (!objectRow) return reply(origin, 404, { error: "Uploaded attachment was not found" });
        const actualSize = Number(objectRow.metadata?.size || 0);
        if (actualSize && actualSize !== sizeBytes) return reply(origin, 409, { error: "Attachment size verification failed" });
        const { data, error } = await admin.from("support_attachments").insert({
          case_id: caseId,
          created_by_id: user.id,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: mimeType,
          size_bytes: sizeBytes,
        }).select("*").single();
        if (error?.code === "23505") return reply(origin, 409, { error: "This attachment is already registered" });
        if (error) throw error;
        return reply(origin, 201, { attachment: data });
      }

      case "supportSubmitCsat": {
        const caseId = cleanText(payload.case_id, 80);
        const admin = adminClient();
        const { data: supportCase } = await admin.from("support_cases").select("id,status,created_by_id").eq("id", caseId).eq("created_by_id", user.id).maybeSingle();
        if (!supportCase) return reply(origin, 404, { error: "Support case not found" });
        if (!["RESOLVED", "CLOSED"].includes(String(supportCase.status))) {
          return reply(origin, 409, { error: "Satisfaction feedback is available after resolution" });
        }
        if (typeof payload.solved !== "boolean") return reply(origin, 400, { error: "Choose whether the problem was solved" });
        const rating = payload.rating == null ? null : Number(payload.rating);
        if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
          return reply(origin, 400, { error: "Rating must be from 1 to 5" });
        }
        const { data, error } = await admin.from("support_csat").insert({
          case_id: caseId,
          created_by_id: user.id,
          solved: payload.solved,
          rating,
          comment: payload.comment ? cleanText(payload.comment, 2000) : null,
        }).select("*").single();
        if (error?.code === "23505") return reply(origin, 409, { error: "Feedback was already submitted for this case" });
        if (error) throw error;
        return reply(origin, 201, { csat: data });
      }

      case "supportAgentInbox": {
        const admin = adminClient();
        const access = await supportAccess(client, admin, user);
        if (!access.allowed) return reply(origin, 403, { error: "Support staff access required" });
        let query = admin
          .from("support_cases")
          .select("id,case_number,title,category,status,priority,source,platform,app_version,created_at,updated_at,last_message_at,escalated_at,resolved_at")
          .neq("status", "CLOSED")
          .order("updated_at", { ascending: false })
          .limit(250);
        if (!["admin", "support_admin"].includes(access.role) && access.caseIds?.length) query = query.in("id", access.caseIds);
        const { data, error } = await query;
        if (error) throw error;
        const cases = data || [];
        return reply(origin, 200, { role: access.role, stats: supportStats(cases), cases });
      }

      case "supportAgentGetCase": {
        const caseId = cleanText(payload.case_id, 80);
        const admin = adminClient();
        const access = await supportAccess(client, admin, user, caseId);
        if (!access.allowed) return reply(origin, 403, { error: "Support staff access required" });
        const { data: supportCase, error: caseError } = await admin.from("support_cases").select("*").eq("id", caseId).maybeSingle();
        if (caseError) throw caseError;
        if (!supportCase) return reply(origin, 404, { error: "Assigned support case not found" });
        const [messages, diagnostics, events, attachments, assignments, incidents] = await Promise.all([
          admin.from("support_messages").select("*").eq("case_id", caseId).order("created_at", { ascending: true }).limit(750),
          admin.from("support_diagnostics").select("*").eq("case_id", caseId).order("created_at", { ascending: false }).limit(20),
          admin.from("support_case_events").select("*").eq("case_id", caseId).order("created_at", { ascending: true }).limit(500),
          admin.from("support_attachments").select("*").eq("case_id", caseId).order("created_at", { ascending: true }).limit(100),
          admin.from("support_agent_assignments").select("*").eq("case_id", caseId).order("created_at", { ascending: false }).limit(50),
          admin.from("support_incident_cases").select("incident_id,support_incidents(*)").eq("case_id", caseId).limit(50),
        ]);
        for (const result of [messages, diagnostics, events, attachments, assignments, incidents]) if (result.error) throw result.error;
        return reply(origin, 200, {
          case: supportCase,
          messages: messages.data || [],
          diagnostics: diagnostics.data || [],
          events: events.data || [],
          attachments: attachments.data || [],
          assignments: assignments.data || [],
          incidents: (incidents.data || []).map((row) => row.support_incidents).filter(Boolean),
        });
      }

      case "supportAgentReply": {
        const caseId = cleanText(payload.case_id, 80);
        const message = cleanText(payload.message, 5000);
        const nextStatus = cleanText(payload.status || "NEEDS_USER", 40).toUpperCase();
        if (!message) return reply(origin, 400, { error: "Reply is required" });
        if (!new Set(["NEEDS_USER","HUMAN_AGENT","ENGINEERING","RESOLVED"]).has(nextStatus)) {
          return reply(origin, 400, { error: "Invalid support status transition" });
        }
        const admin = adminClient();
        const access = await supportAccess(client, admin, user, caseId);
        if (!access.allowed) return reply(origin, 403, { error: "Support staff access required" });
        const { data: supportCase } = await admin.from("support_cases").select("*").eq("id", caseId).maybeSingle();
        if (!supportCase) return reply(origin, 404, { error: "Assigned support case not found" });
        if (supportCase.status === "CLOSED") return reply(origin, 409, { error: "Closed cases cannot receive staff replies" });
        const now = new Date().toISOString();
        const senderKind = nextStatus === "ENGINEERING" || access.role === "support_engineering" ? "engineering" : "agent";
        const { data: supportMessage, error: msgError } = await admin.from("support_messages").insert({
          case_id: caseId,
          sender_user_id: user.id,
          sender_kind: senderKind,
          body: message,
          metadata: { role: access.role },
        }).select("*").single();
        if (msgError) throw msgError;
        const patch: Record<string, unknown> = {
          status: nextStatus,
          first_response_at: supportCase.first_response_at || now,
          last_message_at: now,
          updated_at: now,
        };
        if (nextStatus === "ENGINEERING" && !supportCase.escalated_at) patch.escalated_at = now;
        if (nextStatus === "RESOLVED") patch.resolved_at = now;
        const { error: updateError } = await admin.from("support_cases").update(patch).eq("id", caseId);
        if (updateError) throw updateError;
        await admin.from("support_case_events").insert({
          case_id: caseId,
          actor_user_id: user.id,
          event_type: nextStatus === "RESOLVED" ? "case_resolved" : "staff_replied",
          from_status: supportCase.status,
          to_status: nextStatus,
          details: { role: access.role },
        });
        return reply(origin, 201, { message: supportMessage, status: nextStatus });
      }

      case "supportRefreshSubscription":
        return reply(origin, 503, { error: "Subscription reconciliation is unavailable until the billing provider is configured", code: "BILLING_PROVIDER_UNAVAILABLE" });

      case "accountDeletionRequest": {
        const { data: existing } = await client
          .from("account_deletion_requests")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["requested", "processing"])
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) return reply(origin, 200, { request: existing, duplicate: true });
        const { data, error } = await client
          .from("account_deletion_requests")
          .insert({ user_id: user.id, reason: cleanText(payload.reason || "", 1000) || null })
          .select("*")
          .single();
        if (error) throw error;
        return reply(origin, 200, { request: data, duplicate: false });
      }

      case "submitFeedback": {
        const { data, error } = await client
          .from("beta_feedbacks")
          .insert({
            created_by_id: user.id,
            type: cleanText(payload.type || "general", 80),
            message: cleanText(payload.message || payload.description || "", 5000),
            email: user.email ?? null,
            page: cleanText(payload.page || payload.route || "", 500) || null,
          })
          .select("*")
          .single();
        if (error) throw error;
        return reply(origin, 200, { feedback: data });
      }


      case "attachReferral": {
        const code = cleanText(payload.refCode, 64);
        if (!code) return reply(origin, 400, { error: "refCode required" });
        const admin = adminClient();
        const email = String(user.email || cleanText(payload.email, 320)).toLowerCase();
        let { data: referrer } = await admin.from("profiles").select("id,email,referral_code").eq("referral_code", code).maybeSingle();
        if (!referrer) {
          const matched = await admin.from("profiles").select("id,email,referral_code").ilike("referral_code", code).limit(1);
          if (matched.error) throw matched.error;
          referrer = matched.data?.[0] || null;
        }
        if (!referrer) return reply(origin, 200, { ok: true, matched: false });
        if (referrer.id === user.id || (email && String(referrer.email || "").toLowerCase() === email)) {
          await admin.from("referrals").insert({
            referrer_user_id: referrer.id,
            referrer_email: referrer.email || "",
            referred_email: email,
            referred_user_id: user.id,
            referral_code: code,
            status: "pending",
            fraud_flag: true,
            fraud_reason: "self_referral",
            created_by_id: user.id,
          });
          return reply(origin, 200, { ok: true, matched: true, fraud: true });
        }
        const pending = await admin.from("referrals").select("*").eq("referral_code", code).eq("status", "pending").ilike("referred_email", email).limit(1);
        if (pending.error) throw pending.error;
        if (pending.data?.length) {
          const { error } = await admin.from("referrals").update({
            status: "signed_up",
            referred_user_id: user.id,
            referred_email: email,
            referrer_user_id: referrer.id,
            referrer_email: referrer.email || "",
          }).eq("id", pending.data[0].id);
          if (error) throw error;
        } else {
          const { error } = await admin.from("referrals").insert({
            referrer_user_id: referrer.id,
            referrer_email: referrer.email || "",
            referred_email: email,
            referred_user_id: user.id,
            referral_code: code,
            status: "signed_up",
            is_paying: false,
            created_by_id: user.id,
          });
          if (error) throw error;
        }
        await admin.from("profiles").update({ referred_by_code: code }).eq("id", user.id);
        await admin.from("notifications").insert({
          user_id: referrer.id,
          type: "referrals",
          title: "New referral signup",
          body: `${email || "Someone"} signed up with your code.`,
          link: "/referral",
          created_by_id: user.id,
        });
        return reply(origin, 200, { ok: true, matched: true, referrerId: referrer.id });
      }

      case "markReferralPaying":
        return reply(origin, 403, { error: "Referral payment status can only be changed by a verified billing event", code: "SERVER_ONLY" });

      case "adminControl": {
        if (!(await hasAdminAccess(client, user))) return reply(origin, 403, { error: "Admin only" });
        const admin = adminClient();
        const action = cleanText(payload.action || "summary", 80);
        if (action === "summary") {
          const [users, feedback, jobs, listings] = await Promise.all([
            admin.from("profiles").select("id", { count: "exact", head: true }),
            admin.from("beta_feedbacks").select("id", { count: "exact", head: true }).eq("status", "unread"),
            admin.from("jobs").select("id", { count: "exact", head: true }),
            admin.from("marketplace_listings").select("id", { count: "exact", head: true }),
          ]);
          return reply(origin, 200, {
            counts: { users: users.count || 0, unread_feedback: feedback.count || 0, jobs: jobs.count || 0, listings: listings.count || 0 },
            health: {
              database: users.error ? "degraded" : "healthy",
              server: "healthy",
              stripe: Deno.env.get("STRIPE_SECRET_KEY") ? "configured" : "not configured",
            },
          });
        }
        if (action === "users") {
          const { data, error } = await admin.from("profiles").select("id,email,full_name,role,created_at,paying_subscriber").order("created_at", { ascending: false }).limit(200);
          if (error) throw error;
          return reply(origin, 200, { users: data || [] });
        }
        if (action === "feedback") {
          const { data, error } = await admin.from("beta_feedbacks").select("*").order("created_at", { ascending: false }).limit(250);
          if (error) throw error;
          return reply(origin, 200, { feedback: data || [] });
        }
        if (action === "feedback_status") {
          const status = cleanText(payload.status, 40);
          if (!["unread","in_progress","completed"].includes(status)) return reply(origin, 400, { error: "Invalid status" });
          const { error } = await admin.from("beta_feedbacks").update({ status }).eq("id", cleanText(payload.id, 80));
          if (error) throw error;
          return reply(origin, 200, { success: true });
        }
        if (action === "suspend" || action === "restore") {
          const target = cleanText(payload.user_id, 80);
          if (!target || target === user.id) return reply(origin, 400, { error: "Invalid user" });
          const { error } = await admin.auth.admin.updateUserById(target, { ban_duration: action === "suspend" ? "876000h" : "none" });
          if (error) throw error;
          return reply(origin, 200, { success: true });
        }
        return reply(origin, 400, { error: "Unknown action" });
      }

      case "adminFees": {
        if (!(await hasAdminAccess(client, user))) return reply(origin, 403, { error: "Admin only" });
        const admin = adminClient();
        const action = cleanText(payload.action || "list", 80);
        if (action === "list") {
          const [categories, rules] = await Promise.all([
            admin.from("fee_categories").select("*").order("sort_order", { ascending: true }),
            admin.from("fee_rules").select("*").order("effective_from", { ascending: false }),
          ]);
          if (categories.error) throw categories.error;
          if (rules.error) throw rules.error;
          return reply(origin, 200, { categories: categories.data || [], rules: rules.data || [], source: "database" });
        }
        if (action === "history") {
          let query = admin.from("fee_rule_history").select("*").order("created_at", { ascending: false }).limit(100);
          const id = cleanText(payload.fee_rule_id || payload.id, 80);
          if (id) query = query.eq("fee_rule_id", id);
          const { data, error } = await query;
          if (error) throw error;
          return reply(origin, 200, { history: data || [] });
        }
        if (action === "setCategory") {
          const id = cleanText(payload.id, 100);
          if (!id) return reply(origin, 400, { error: "Category id required" });
          const row = {
            id,
            name: cleanText(payload.name || id, 160),
            description: cleanText(payload.description || "", 1000),
            enabled: payload.enabled !== false,
            sort_order: Number(payload.sort_order) || 100,
            updated_at: new Date().toISOString(),
          };
          const { data, error } = await admin.from("fee_categories").upsert(row).select("*").single();
          if (error) throw error;
          return reply(origin, 200, { category: data });
        }
        if (action === "disable") {
          const id = cleanText(payload.id || payload.fee_rule_id, 80);
          if (!id) return reply(origin, 400, { error: "id required" });
          const { data, error } = await admin.from("fee_rules").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
          if (error) throw error;
          await writeFeeHistory(admin, data.id, "disable", data, user.id);
          return reply(origin, 200, { rule: data });
        }
        if (action === "upsert" || action === "schedule") {
          const categoryId = cleanText(payload.category_id || payload.categoryId, 100);
          const contextKey = cleanText(payload.context_key || payload.contextKey || "*", 120) || "*";
          if (!categoryId) return reply(origin, 400, { error: "category_id required" });
          if (action === "schedule" && !payload.effective_from) return reply(origin, 400, { error: "effective_from required for schedule" });
          if (action === "upsert" && payload.replace_active !== false) {
            const { error } = await admin.from("fee_rules").update({ enabled: false, updated_at: new Date().toISOString() })
              .eq("category_id", categoryId).eq("context_key", contextKey).eq("enabled", true);
            if (error) throw error;
          }
          const version = await nextFeeVersion(admin, categoryId, contextKey);
          const row = {
            category_id: categoryId,
            context_key: contextKey,
            version,
            label: cleanText(payload.label || "", 200),
            enabled: payload.enabled !== false,
            effective_from: payload.effective_from || new Date().toISOString(),
            effective_until: payload.effective_until || null,
            rule_type: cleanText(payload.rule_type || "percentage", 40),
            percentage_rate: Number(payload.percentage_rate) || 0,
            flat_amount: Number(payload.flat_amount) || 0,
            min_fee: payload.min_fee == null || payload.min_fee === "" ? null : Number(payload.min_fee),
            max_fee: payload.max_fee == null || payload.max_fee === "" ? null : Number(payload.max_fee),
            fee_bearer: payload.fee_bearer === "seller" ? "seller" : "buyer",
            processing_fee_rate: Number(payload.processing_fee_rate) || 0,
            processing_fee_flat: Number(payload.processing_fee_flat) || 0,
            tax_enabled: Boolean(payload.tax_enabled),
            tax_rate: Number(payload.tax_rate) || 0,
            tiers: Array.isArray(payload.tiers) ? payload.tiers : [],
            promo: payload.promo || null,
            notes: cleanText(payload.notes || (action === "schedule" ? "Scheduled change" : ""), 1000),
            created_by_id: user.id,
          };
          const { data, error } = await admin.from("fee_rules").insert(row).select("*").single();
          if (error) throw error;
          await writeFeeHistory(admin, data.id, action === "schedule" ? "schedule" : "create", data, user.id);
          return reply(origin, 200, { rule: data });
        }
        if (action === "rollback") {
          const historyId = cleanText(payload.history_id, 80);
          if (!historyId) return reply(origin, 400, { error: "history_id required" });
          const { data: historyRow, error: historyError } = await admin.from("fee_rule_history").select("*").eq("id", historyId).maybeSingle();
          if (historyError) throw historyError;
          if (!historyRow?.snapshot) return reply(origin, 400, { error: "History entry not found" });
          const snap = historyRow.snapshot as Record<string, unknown>;
          const categoryId = cleanText(snap.category_id, 100);
          const contextKey = cleanText(snap.context_key || "*", 120) || "*";
          await admin.from("fee_rules").update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("category_id", categoryId).eq("context_key", contextKey).eq("enabled", true);
          const version = await nextFeeVersion(admin, categoryId, contextKey);
          const row = {
            category_id: categoryId,
            context_key: contextKey,
            version,
            label: cleanText(snap.label || "Rollback", 200),
            enabled: true,
            effective_from: new Date().toISOString(),
            effective_until: null,
            rule_type: cleanText(snap.rule_type || "percentage", 40),
            percentage_rate: Number(snap.percentage_rate) || 0,
            flat_amount: Number(snap.flat_amount) || 0,
            min_fee: snap.min_fee ?? null,
            max_fee: snap.max_fee ?? null,
            fee_bearer: snap.fee_bearer === "seller" ? "seller" : "buyer",
            processing_fee_rate: Number(snap.processing_fee_rate) || 0,
            processing_fee_flat: Number(snap.processing_fee_flat) || 0,
            tax_enabled: Boolean(snap.tax_enabled),
            tax_rate: Number(snap.tax_rate) || 0,
            tiers: Array.isArray(snap.tiers) ? snap.tiers : [],
            promo: snap.promo || null,
            notes: `Rollback from history ${historyId}`,
            created_by_id: user.id,
          };
          const { data, error } = await admin.from("fee_rules").insert(row).select("*").single();
          if (error) throw error;
          await writeFeeHistory(admin, data.id, "rollback", { ...data, from_history: historyId }, user.id);
          return reply(origin, 200, { rule: data });
        }
        return reply(origin, 400, { error: `Unknown fee action: ${action}` });
      }

      case "installMarketplaceModule": {
        const slug = cleanText(payload.module_slug, 120);
        if (!slug) return reply(origin, 400, { error: "module_slug is required" });
        const { data: existing } = await client
          .from("module_installs")
          .select("*")
          .eq("user_id", user.id)
          .eq("module_slug", slug)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (existing) return reply(origin, 200, { install: existing, duplicate: true });
        const { data, error } = await client
          .from("module_installs")
          .insert({
            user_id: user.id,
            created_by_id: user.id,
            module_slug: slug,
            module_name: cleanText(payload.module_name || "", 180) || null,
            status: "active",
            installed_at: new Date().toISOString(),
          })
          .select("*")
          .single();
        if (error) throw error;
        return reply(origin, 200, { install: data, duplicate: false });
      }

      case "jobMatchesV2": {
        const { data, error } = await client
          .from("hire_jobs")
          .select("*")
          .eq("status", "open")
          .neq("created_by_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return reply(origin, 200, { data: { matches: data ?? [], needsProfile: false, externalEnabled: false, source: "titanos" } });
      }

      case "titanAI": {
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const lastMessage = messages.length ? cleanText((messages[messages.length - 1] as Record<string, unknown>)?.content, 4000) : cleanText(payload.message, 4000);
        const live = await liveBusinessSummary(client, user.id, lastMessage);
        return reply(origin, 200, {
          data: {
            type: "response",
            source: "supabase-edge",
            dataBasis: "live_database",
            generalKnowledge: false,
            message: live.message,
            summary: live.summary,
          },
        });
      }

      case "directionsOptimize":
        return reply(origin, 200, { data: { ordered: Array.isArray(payload.stops) ? payload.stops : [], totalMiles: 0, legs: [], method: "preserve-order" } });


      case "sendFollowUp":
      case "sendEmail": {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) return reply(origin, 503, { error: "Email provider is not configured on the TitanOS Edge backend", code: "EMAIL_PROVIDER_UNAVAILABLE" });
        const to = cleanText(payload.to, 320);
        const subject = cleanText(payload.subject || "TitanOS", 240);
        const textBody = cleanText(payload.body || payload.message, 10000);
        if (!to || !to.includes("@")) return reply(origin, 400, { error: "A valid recipient email is required" });
        const from = cleanText(Deno.env.get("RESEND_FROM_EMAIL") || "TitanOS <noreply@titanos.app>", 320);
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [to], subject, text: textBody }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) return reply(origin, 502, { error: "Email provider rejected the message", code: "EMAIL_PROVIDER_ERROR" });
        if (functionName === "sendFollowUp" && payload.queue_id) {
          const { error } = await client.from("follow_up_queue").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            channel: "email",
          }).eq("id", cleanText(payload.queue_id, 80));
          if (error) throw error;
        }
        return reply(origin, 200, { success: true, id: result?.id || null, provider: "resend" });
      }
      case "createPaymentLink":
        return reply(origin, 503, { error: "Payment provider is not configured on the TitanOS Edge backend", code: "PAYMENT_PROVIDER_UNAVAILABLE" });
      case "receiptVisionOcr":
        return reply(origin, 503, { error: "Vision provider is not configured on the TitanOS Edge backend", code: "VISION_PROVIDER_UNAVAILABLE" });

      default:
        return reply(origin, 404, { error: `Titan function "${functionName}" is not available on the Edge backend`, code: "FUNCTION_UNAVAILABLE" });
    }
  } catch (error) {
    console.error("titan-api", functionName, error);
    return reply(origin, 500, { error: "Titan service could not complete the request", code: "EDGE_EXECUTION_FAILED" });
  }
});
