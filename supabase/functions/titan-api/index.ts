import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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

      case "sendEmail":
        return reply(origin, 503, { error: "Email provider is not configured on the TitanOS Edge backend", code: "EMAIL_PROVIDER_UNAVAILABLE" });
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
