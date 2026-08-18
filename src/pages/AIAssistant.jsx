import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Sparkles, Zap, RotateCcw, RefreshCw, Scale, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from "react-markdown";
import { safeMarkdownComponents } from "@/components/ai/safeMarkdown";
import ConfirmationCard from "@/components/ai/ConfirmationCard";
import InvisibleInterface from "@/components/ai/InvisibleInterface";
import ActionResult from "@/components/ai/ActionResult";
import { buildBusinessSummary } from "@/lib/ai-business-summary";
import { buildAiPageContext } from "@/lib/aiPageContext";
import { useAuth } from "@/lib/AuthContext";
import { isOwnerAccount } from "@/lib/ownerAccount";
import { fetchUserInstalls, hasLawMastermind } from "@/lib/marketplaceApi";
import { appendAiConversationTurn, listAiConversationDocs } from "@/lib/aiConversationStore";
import { upsertSearchDocs } from "@/lib/searchIndex";
import { confirmedActionErrorMessage, rollbackMessage, shouldRetainRollback } from "@/lib/secondMeActionUi";
import { ensureSecondMeActionId } from "@/lib/secondMeActionId";
import {
  appendTitanActionLog,
  clearTitanActionLogs,
  getTitanOpsState,
  setTitanKillSwitch,
  setTitanRoutineEnabled,
} from "@/lib/titanAiOpsMemory";

const SUGGESTIONS = [
  { label: "What am I forgetting?", prompt: "What am I forgetting or leaving unresolved right now?" },
  { label: "Today's jobs", prompt: "What jobs do I have scheduled today?" },
  { label: "Who owes money?", prompt: "Which customers have outstanding invoices?" },
  { label: "What should I do next?", prompt: "Based on what you know, what deserves my attention next?" },
  { label: "Schedule a job", prompt: "I need to schedule a job" },
  { label: "Create an estimate", prompt: "Create an estimate for a customer" },
  { label: "Remember something", prompt: "I want you to remember something" },
  { label: "From now on…", prompt: "I want to create a from-now-on rule" },
];

const LAW_SUGGESTIONS = [
  { label: "Contract red flags", prompt: "What red flags should I look for in a service contract?" },
  { label: "Invoice dispute", prompt: "A customer disputes an invoice — what are my options and risks?" },
  { label: "Independent contractor", prompt: "Explain independent contractor vs employee risk in plain language." },
  { label: "Liability basics", prompt: "What liability issues should a field service business watch for?" },
  { label: "NDA outline", prompt: "Outline a simple NDA checklist before I share client data." },
  { label: "Late payment", prompt: "What steps can I take when a client is late on payment?" },
];

const WORKFLOW_PROMPTS = Object.freeze({
  morning_ops: "Run morning ops workflow",
  cash_recovery: "Run cash recovery sprint",
  closeout: "Run daily closeout workflow",
});

export default function AIAssistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ownerMode = isOwnerAccount(user);
  const [params] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [businessSummary, setBusinessSummary] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
  const [lawMastermind, setLawMastermind] = useState(false);
  const [ownerAutopilot, setOwnerAutopilot] = useState(false);
  const [opsState, setOpsState] = useState({ killSwitch: false, routines: [], logs: [] });
  const [rollbackingId, setRollbackingId] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const seededQ = useRef(false);
  const actionInFlightRef = useRef(false);

  useEffect(() => {
    if (!ownerMode) {
      setOwnerAutopilot(false);
      return;
    }
    try {
      const saved = window.localStorage.getItem("titanai_owner_autopilot");
      setOwnerAutopilot(saved === "1");
    } catch {
      setOwnerAutopilot(false);
    }
  }, [ownerMode]);

  const setAutopilot = useCallback(
    (enabled) => {
      if (!ownerMode) return;
      setOwnerAutopilot(Boolean(enabled));
      try {
        window.localStorage.setItem("titanai_owner_autopilot", enabled ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [ownerMode]
  );

  useEffect(() => {
    if (!ownerMode || !user?.id) {
      setOpsState({ killSwitch: false, routines: [], logs: [] });
      return;
    }
    setOpsState(getTitanOpsState(user.id));
  }, [ownerMode, user?.id]);

  const loadActionHistory = useCallback(async () => {
    if (!user?.id || lawMastermind) { setActionHistory([]); return; }
    try {
      const result = await api.functions.invoke("titanAI", { messages: [], historyRequest: true, historyLimit: 6, secondSelf: true });
      setActionHistory(Array.isArray(result?.data?.items) ? result.data.items : []);
    } catch {
      setActionHistory([]);
    }
  }, [lawMastermind, user?.id]);

  useEffect(() => { void loadActionHistory(); }, [loadActionHistory]);

  const refreshOpsState = useCallback(() => {
    if (!user?.id || !ownerMode) return;
    setOpsState(getTitanOpsState(user.id));
  }, [ownerMode, user?.id]);

  const setKillSwitch = useCallback(
    (enabled) => {
      if (!user?.id || !ownerMode) return;
      setTitanKillSwitch(user.id, enabled);
      appendTitanActionLog(user.id, {
        status: enabled ? "warn" : "ok",
        title: enabled ? "Kill switch enabled" : "Kill switch disabled",
        detail: enabled
          ? "All 2nd Me write actions are blocked until disabled."
          : "2nd Me write actions can run again.",
      });
      refreshOpsState();
    },
    [ownerMode, refreshOpsState, user?.id]
  );

  const setRoutineEnabled = useCallback(
    (routineId, enabled) => {
      if (!user?.id || !ownerMode) return;
      setTitanRoutineEnabled(user.id, routineId, enabled);
      appendTitanActionLog(user.id, {
        status: "ok",
        title: `${enabled ? "Enabled" : "Disabled"} routine`,
        detail: routineId,
      });
      refreshOpsState();
    },
    [ownerMode, refreshOpsState, user?.id]
  );

  const runWorkflow = useCallback(
    (workflowId) => {
      const enabled = opsState.routines.find((r) => r.id === workflowId)?.enabled !== false;
      if (!enabled || !WORKFLOW_PROMPTS[workflowId]) return;
      sendMessage(WORKFLOW_PROMPTS[workflowId]);
    },
    [opsState.routines]
  );

  const loadBusinessData = useCallback(async () => {
    setDataLoading(true);
    setDataError(false);
    const safeList = async (loader) => {
      try {
        const rows = await loader();
        return { rows: Array.isArray(rows) ? rows : [], failed: false };
      } catch {
        return { rows: [], failed: true };
      }
    };

    try {
      const [jobsResult, invoicesResult, customersResult, expensesResult, employeesResult] = await Promise.all([
        safeList(() => api.entities.Job.list("-created_date", 40)),
        safeList(() => api.entities.Invoice.list("-created_date", 40)),
        safeList(() => api.entities.Customer.list("-created_date", 40)),
        safeList(() => api.entities.Expense.list("-date", 30)),
        safeList(() => api.entities.Employee.list("-created_date", 20)),
      ]);
      setBusinessSummary(
        buildBusinessSummary({
          jobs: jobsResult.rows,
          invoices: invoicesResult.rows,
          customers: customersResult.rows,
          expenses: expensesResult.rows,
          employees: employeesResult.rows,
        })
      );
      setDataError([
        jobsResult,
        invoicesResult,
        customersResult,
        expensesResult,
        employeesResult,
      ].some((result) => result.failed));
    } catch {
      setBusinessSummary(buildBusinessSummary({ jobs: [], invoices: [], customers: [], expenses: [], employees: [] }));
      setDataError(true);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBusinessData();
  }, [loadBusinessData]);

  useEffect(() => {
    if (!user?.id) {
      setLawMastermind(false);
      return undefined;
    }
    let alive = true;
    fetchUserInstalls(user.id)
      .then((installs) => {
        if (alive) setLawMastermind(hasLawMastermind(installs));
      })
      .catch(() => {
        if (alive) setLawMastermind(false);
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const replaceLastMessage = (msg) => setMessages((prev) => [...prev.slice(0, -1), msg]);

  const sendMessage = async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading || confirming) return;
    setInput("");
    inputRef.current?.focus();

    const userEntry = { role: "user", content: userMsg, type: "text" };
    const placeholder = { role: "assistant", content: "", type: "loading" };
    setMessages((prev) => [...prev, userEntry, placeholder]);
    setLoading(true);

    if (user?.id) {
      appendAiConversationTurn(user.id, { role: "user", text: userMsg });
      upsertSearchDocs(user.id, listAiConversationDocs(user.id));
    }

    try {
      const history = [...messages, userEntry]
        .filter((m) => m.type !== "loading")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content || m.meta?.summary || "" }));

      const pageContext = buildAiPageContext({
        pathname: "/assistant",
        workflow: lawMastermind ? "law_mastermind" : "second_self",
      });

      const result = await api.functions.invoke("titanAI", {
        messages: history,
        pageContext,
        offlineSnapshot: businessSummary || undefined,
        lawMastermind,
        ownerAutopilot: ownerMode && ownerAutopilot,
        secondSelf: !lawMastermind,
        guardrails: {
          killSwitch: ownerMode && opsState.killSwitch,
        },
      });

      const data = result.data;

      if (data.type === "response" || data.type === "clarify") {
        replaceLastMessage({
          role: "assistant",
          content: data.message,
          type: "text",
          source: data.source,
          dataBasis: data.dataBasis,
          generalKnowledge: data.generalKnowledge,
          interface: data.interface || null,
        });
        if (user?.id && data.message) {
          appendAiConversationTurn(user.id, { role: "assistant", text: data.message });
          upsertSearchDocs(user.id, listAiConversationDocs(user.id));
        }
      } else if (data.type === "confirm") {
        replaceLastMessage({
          role: "assistant",
          content: "",
          type: "confirm",
          interface: data.interface || null,
          meta: {
            intent: data.intent,
            params: data.params,
            summary: data.confirmationSummary,
            details: data.confirmationDetails || [],
            actionId: ensureSecondMeActionId({}),
          },
        });
        setConfirming(true);
      } else if (data.type === "done" || data.type === "workflow_done") {
        const workflowDetails =
          data.type === "workflow_done" && Array.isArray(data.steps) && data.steps.length
            ? `\n\n${data.steps.map((s, i) => `${i + 1}. ${s.message || s.intent}`).join("\n")}`
            : "";
        replaceLastMessage({
          role: "assistant",
          content: `${data.message || "Action completed."}${workflowDetails}`,
          type: "done",
          rollback: data.rollback ? { ...data.rollback, correlationId: data.correlationId || data.actionId || null } : null,
        });
        if (user?.id && ownerMode) {
          appendTitanActionLog(user.id, {
            status: "ok",
            title: data.type === "workflow_done" ? "Workflow completed" : "Action completed",
            detail: data.message || "2nd Me action completed.",
            rollback: data.rollback || null,
          });
          refreshOpsState();
        }
      } else {
        replaceLastMessage({
          role: "assistant",
          content: data.message || "I need a little more context to help with that.",
          type: "text",
          source: data.source,
          interface: data.interface || null,
        });
      }
    } catch (e) {
      const msg =
        e?.status === 401
          ? "Please sign in again to use 2nd Me."
          : "I couldn't reach one of Titan's data services, but you can keep talking to me. Try the request again while I use the context I still have.";
      replaceLastMessage({ role: "assistant", content: msg, type: "error" });
      if (user?.id && ownerMode) {
        appendTitanActionLog(user.id, {
          status: "error",
          title: "2nd Me request failed",
          detail: e?.message || msg,
        });
        refreshOpsState();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = params.get("q")?.trim();
    if (!q || seededQ.current || dataLoading || loading || confirming) return;
    seededQ.current = true;
    void sendMessage(q);
  }, [params, dataLoading, loading, confirming]);

  const handleConfirm = async (msgIndex) => {
    const confirmMsg = messages[msgIndex];
    if (!confirmMsg?.meta || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    const actionId = ensureSecondMeActionId(confirmMsg.meta);
    setConfirming(true);
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, type: "executing", meta: { ...m.meta, actionId } } : m)));

    try {
      const result = await api.functions.invoke("titanAI", {
        messages: [],
        pageContext: buildAiPageContext({ pathname: "/assistant", workflow: "second_self" }),
        confirmedAction: { intent: confirmMsg.meta.intent, params: confirmMsg.meta.params, actionId },
        ownerAutopilot: ownerMode && ownerAutopilot,
        secondSelf: true,
        guardrails: { killSwitch: ownerMode && opsState.killSwitch },
      });
      const data = result.data;
      const isError = data.type === "error";
      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {
        role: "assistant",
        content: data.message,
        type: isError ? "error" : "done",
        rollback: data.rollback ? { ...data.rollback, correlationId: data.correlationId || data.actionId || actionId } : null,
        correlationId: data.correlationId || data.actionId || actionId,
      } : m));
      if (user?.id && ownerMode) {
        appendTitanActionLog(user.id, {
          status: isError ? "error" : "ok",
          title: isError ? "Confirmed action failed" : "Confirmed action completed",
          detail: data.message || "2nd Me completed a confirmed action.",
          rollback: data.rollback || null,
          correlationId: data.correlationId || data.actionId || confirmMsg.meta.actionId,
        });
        refreshOpsState();
      }
      if (!isError) { loadBusinessData(); void loadActionHistory(); }
    } catch (error) {
      const message = confirmedActionErrorMessage(error);
      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {
        ...m,
        role: "assistant",
        content: "",
        type: "confirm",
        retryError: message,
        meta: { ...confirmMsg.meta, actionId },
      } : m));
      if (user?.id && ownerMode) {
        appendTitanActionLog(user.id, {
          status: "error",
          title: "Confirmed action failed",
          detail: error?.message || message,
          correlationId: actionId,
        });
        refreshOpsState();
      }
    } finally {
      actionInFlightRef.current = false;
      setConfirming(false);
    }
  };

  const handleCancel = (msgIndex) => {
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { role: "assistant", content: "Action cancelled. Nothing was changed.", type: "text" } : m));
    setConfirming(false);
  };

  const handleRollback = async (message, msgIndex) => {
    if (!message?.rollback || rollbackingId != null) return;
    const rollback = message.rollback;
    setRollbackingId(msgIndex);
    try {
      const result = await api.functions.invoke("titanAI", {
        messages: [],
        pageContext: buildAiPageContext({ pathname: "/assistant", workflow: "second_self" }),
        secondSelf: true,
        rollbackAction: rollback,
      });
      const data = result.data;
      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {
        ...m,
        content: `${m.content || "Action completed."}\n\n${rollbackMessage(data)}`,
        rollback: shouldRetainRollback(data) ? rollback : null,
      } : m));
      if (user?.id && ownerMode) {
        appendTitanActionLog(user.id, {
          status: data.type === "error" ? "error" : "ok",
          title: data.type === "error" ? "Rollback failed" : "Rollback completed",
          detail: data.message || "2nd Me rollback completed.",
        });
        refreshOpsState();
      }
      if (data.type !== "error") { loadBusinessData(); void loadActionHistory(); }
    } catch (error) {
      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {
        ...m,
        content: `${m.content || "Action completed."}\n\n${rollbackMessage({ type: "error", message: error?.message })}`,
      } : m));
    } finally {
      setRollbackingId(null);
    }
  };

  const clearOpsLogs = () => {
    if (!user?.id || !ownerMode) return;
    clearTitanActionLogs(user.id);
    refreshOpsState();
  };

  const suggestions = lawMastermind ? LAW_SUGGESTIONS : SUGGESTIONS;

  return (
    <div className="page-pad max-w-5xl mx-auto pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Invisible Interface</p>
          <h1 className="text-2xl font-bold text-foreground">2nd Self</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask, remember, understand, and take approved actions across Titan.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/second-me")}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-ring"
        >
          2nd Self home
        </button>
      </div>

      {dataError ? (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
          Some live business context could not load. 2nd Self can still respond with the context that is available.
        </div>
      ) : null}

      {ownerMode && !lawMastermind ? (
        <section className="titan-surface p-4 mb-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Owner action controls</p>
              <p className="text-xs text-muted-foreground">Extra automation controls for the owner account only.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span>Owner autopilot</span>
              <Switch checked={ownerAutopilot} onCheckedChange={setAutopilot} />
            </label>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
            <span>
              <span className="block font-semibold">Kill switch</span>
              <span className="block text-xs text-muted-foreground">Block 2nd Self write actions immediately.</span>
            </span>
            <Switch checked={opsState.killSwitch} onCheckedChange={setKillSwitch} />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {opsState.routines.map((routine) => (
              <div key={routine.id} className="rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Checkbox checked={routine.enabled !== false} onCheckedChange={(checked) => setRoutineEnabled(routine.id, Boolean(checked))} />
                  {routine.label}
                </label>
                <Button size="sm" variant="outline" className="mt-3 w-full" disabled={routine.enabled === false || loading || confirming || opsState.killSwitch} onClick={() => runWorkflow(routine.id)}>
                  Run now
                </Button>
              </div>
            ))}
          </div>
          {opsState.logs.length ? (
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent owner operations</p>
                <button type="button" onClick={clearOpsLogs} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
              </div>
              <div className="mt-2 space-y-1">
                {opsState.logs.slice(0, 5).map((log) => (
                  <p key={log.id} className="text-xs text-muted-foreground">{log.title} · {log.detail}</p>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!messages.length ? (
        <section className="titan-surface p-5 mb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">What can I help with?</p>
              <p className="mt-1 text-sm text-muted-foreground">Ask about Titan Business data, unresolved work, memory, or an action you want to take.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => void sendMessage(suggestion.prompt)}
                disabled={dataLoading || loading || confirming}
                className="rounded-full border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 focus-ring"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={`${index}-${message.type}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[92%] rounded-2xl px-4 py-3 md:max-w-[78%] ${message.role === "user" ? "bg-primary text-primary-foreground" : "titan-surface"}`}>
                {message.type === "loading" ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" /> Thinking…</div>
                ) : message.type === "confirm" || message.type === "executing" ? (
                  <ConfirmationCard
                    message={message}
                    executing={message.type === "executing"}
                    onConfirm={() => handleConfirm(index)}
                    onCancel={() => handleCancel(index)}
                  />
                ) : (
                  <>
                    {message.content ? (
                      <ReactMarkdown components={safeMarkdownComponents}>{message.content}</ReactMarkdown>
                    ) : null}
                    {message.interface ? <InvisibleInterface spec={message.interface} onNavigate={(path) => navigate(path)} /> : null}
                    {message.type === "done" ? (
                      <ActionResult
                        message={message}
                        rollbacking={rollbackingId === index}
                        onRollback={message.rollback ? () => handleRollback(message, index) : undefined}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </section>

      {actionHistory.length && !lawMastermind ? (
        <section className="mt-5 titan-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent approved actions</p>
          <div className="mt-2 space-y-2">
            {actionHistory.map((item) => (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                {item.status === "failed" ? <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" /> : <Zap className="mt-0.5 h-4 w-4 text-primary" />}
                <div className="min-w-0"><p className="font-medium">{item.intent || "Action"}</p><p className="truncate text-xs text-muted-foreground">{item.status}</p></div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
        className="sticky bottom-4 mt-5 flex gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-lift backdrop-blur-xl"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask 2nd Self…"
          disabled={loading || confirming}
          className="min-h-[44px] border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" disabled={!input.trim() || loading || confirming} className="min-h-[44px] min-w-[44px] px-3" aria-label="Send to 2nd Self">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
