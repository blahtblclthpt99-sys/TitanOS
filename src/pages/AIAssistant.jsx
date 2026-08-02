import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { api } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Sparkles, Zap, RotateCcw, RefreshCw, Scale, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from "react-markdown";
import { safeMarkdownComponents } from "@/components/ai/safeMarkdown";
import ConfirmationCard from "@/components/ai/ConfirmationCard";
import ActionResult from "@/components/ai/ActionResult";
import { buildBusinessSummary } from "@/lib/ai-business-summary";
import { buildAiPageContext } from "@/lib/aiPageContext";
import { useAuth } from "@/lib/AuthContext";
import { isOwnerAccount } from "@/lib/ownerAccount";
import { fetchUserInstalls, hasLawMastermind } from "@/lib/marketplaceApi";
import { appendAiConversationTurn, listAiConversationDocs } from "@/lib/aiConversationStore";
import { upsertSearchDocs } from "@/lib/searchIndex";
import {
  appendTitanActionLog,
  clearTitanActionLogs,
  getTitanOpsState,
  setTitanKillSwitch,
  setTitanRoutineEnabled,
} from "@/lib/titanAiOpsMemory";

const SUGGESTIONS = [
  { label: "Today's jobs", prompt: "What jobs do I have scheduled today?" },
  { label: "Who owes money?", prompt: "Which customers have outstanding invoices?" },
  { label: "Revenue this month", prompt: "How much revenue have I collected this month?" },
  { label: "Schedule a job", prompt: "I need to schedule a job" },
  { label: "Create an estimate", prompt: "Create an estimate for a customer" },
  { label: "Top customers", prompt: "Who are my top 5 customers by revenue?" },
  { label: "Overdue invoices", prompt: "Show me all overdue invoices" },
  { label: "Profit margin", prompt: "What's my net profit margin?" },
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const seededQ = useRef(false);

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
          ? "All Titan AI write actions are blocked until disabled."
          : "Titan AI write actions can run again.",
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
    try {
      const [jobs, invoices, customers, expenses, employees] = await Promise.all([
        api.entities.Job.list("-created_date", 40),
        api.entities.Invoice.list("-created_date", 40),
        api.entities.Customer.list("-created_date", 40),
        api.entities.Expense.list("-date", 30),
        api.entities.Employee.list("-created_date", 20),
      ]);
      setBusinessSummary(buildBusinessSummary({ jobs, invoices, customers, expenses, employees }));
    } catch {
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
        workflow: lawMastermind ? "law_mastermind" : "office",
      });

      // Never send businessSummary as trusted facts — server loads owned snapshot.
      // offlineSnapshot is only used if the API is unreachable (device cache, labeled).
      const result = await api.functions.invoke("titanAI", {
        messages: history,
        pageContext,
        offlineSnapshot: businessSummary || undefined,
        lawMastermind,
        ownerAutopilot: ownerMode && ownerAutopilot,
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
          meta: {
            intent: data.intent,
            params: data.params,
            summary: data.confirmationSummary,
            details: data.confirmationDetails || [],
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
          rollback: data.rollback || null,
        });
        if (user?.id && ownerMode) {
          appendTitanActionLog(user.id, {
            status: "ok",
            title: data.type === "workflow_done" ? "Workflow completed" : "Action completed",
            detail: data.message || "Titan AI action completed.",
            rollback: data.rollback || null,
          });
          refreshOpsState();
        }
      } else {
        replaceLastMessage({
          role: "assistant",
          content: data.message || "I'm not sure how to handle that.",
          type: "text",
          source: data.source,
        });
      }
    } catch (e) {
      const msg =
        e?.status === 401
          ? "Please sign in again to use Titan AI."
          : e?.message || "Something went wrong. Please try again.";
      replaceLastMessage({ role: "assistant", content: msg, type: "error" });
      if (user?.id && ownerMode) {
        appendTitanActionLog(user.id, {
          status: "error",
          title: "Action failed",
          detail: msg,
        });
        refreshOpsState();
      }
    } finally {
      setLoading(false);
    }
  };

  // Deep-link: /assistant?q=…
  useEffect(() => {
    const q = params.get("q");
    if (!q || seededQ.current || dataLoading) return;
    seededQ.current = true;
    setInput(q);
  }, [params, dataLoading]);

  const handleConfirm = async (msgIndex) => {
    const confirmMsg = messages[msgIndex];
    if (!confirmMsg?.meta) return;
    setConfirming(true);
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, type: "executing" } : m)));

    try {
      const result = await api.functions.invoke("titanAI", {
        messages: [],
        pageContext: buildAiPageContext({ pathname: "/assistant" }),
        confirmedAction: { intent: confirmMsg.meta.intent, params: confirmMsg.meta.params },
        ownerAutopilot: ownerMode && ownerAutopilot,
        guardrails: {
          killSwitch: ownerMode && opsState.killSwitch,
        },
      });
      const data = result.data;
      const isError = data.type === "error";
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? {
                role: "assistant",
                content: data.message,
                type: isError ? "error" : "done",
                rollback: data.rollback || null,
              }
            : m
        )
      );
      if (user?.id && ownerMode) {
        appendTitanActionLog(user.id, {
          status: isError ? "error" : "ok",
          title: isError ? "Confirmed action failed" : "Confirmed action completed",
          detail: data.message || "Titan AI completed a confirmed action.",
          rollback: data.rollback || null,
        });
        refreshOpsState();
      }
      if (!isError) loadBusinessData();
    } catch {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? {
                role: "assistant",
                content: "Action failed. Please try again or use the app directly.",
                type: "error",
              }
            : m
        )
      );
      if (user?.id && ownerMode) {
        appendTitanActionLog(user.id, {
          status: "error",
          title: "Confirmed action failed",
          detail: "Action failed. Please try again or use the app directly.",
        });
        refreshOpsState();
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleRollback = async (msgIndex) => {
    const row = messages[msgIndex];
    const rollback = row?.rollback;
    if (!rollback || !user?.id || !ownerMode || rollbackingId) return;
    setRollbackingId(row?.rollback?.id || `msg-${msgIndex}`);
    try {
      const result = await api.functions.invoke("titanAI", {
        messages: [],
        pageContext: buildAiPageContext({ pathname: "/assistant" }),
        rollbackAction: rollback,
        ownerAutopilot: ownerMode && ownerAutopilot,
        guardrails: {
          killSwitch: ownerMode && opsState.killSwitch,
        },
      });
      const data = result.data || {};
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? {
                ...m,
                content: `${m.content}\n\nRollback: ${data.message || "completed."}`,
                rollback: null,
              }
            : m
        )
      );
      appendTitanActionLog(user.id, {
        status: data.type === "error" ? "error" : "ok",
        title: data.type === "error" ? "Rollback failed" : "Rollback completed",
        detail: data.message || "Rollback result.",
      });
      refreshOpsState();
      loadBusinessData();
    } catch (e) {
      appendTitanActionLog(user.id, {
        status: "error",
        title: "Rollback failed",
        detail: e?.message || "Rollback request failed.",
      });
      refreshOpsState();
    } finally {
      setRollbackingId(null);
    }
  };

  const handleCancel = (msgIndex) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex
          ? { role: "assistant", content: "Cancelled. What else can I help you with?", type: "text" }
          : m
      )
    );
    setConfirming(false);
  };

  const clearChat = () => {
    setMessages([]);
    setConfirming(false);
  };

  const isInputDisabled = loading || confirming;

  const renderMessage = (msg, i) => {
    if (msg.role === "user") {
      return (
        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] md:max-w-[65%]">
            <p className="text-sm font-medium">{msg.content}</p>
          </div>
        </motion.div>
      );
    }
    if (msg.type === "loading") {
      return (
        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
          <div className="titan-surface rounded-bl-md px-4 py-3">
            <div className="flex items-center gap-1.5">
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  className="w-2 h-2 bg-titan-cyan rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      );
    }
    if (msg.type === "executing") {
      return (
        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
          <div className="titan-surface rounded-bl-md px-4 py-3 border border-titan-cyan/20 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-titan-cyan/30 border-t-titan-cyan rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Executing…</span>
          </div>
        </motion.div>
      );
    }
    if (msg.type === "confirm") {
      return (
        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
          <ConfirmationCard
            summary={msg.meta.summary}
            details={msg.meta.details}
            onConfirm={() => handleConfirm(i)}
            onCancel={() => handleCancel(i)}
            loading={confirming}
          />
        </motion.div>
      );
    }
    if (msg.type === "done" || msg.type === "error") {
      return (
        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
          <ActionResult
            message={msg.content}
            isError={msg.type === "error"}
            onRollback={msg.rollback ? () => handleRollback(i) : null}
            rollbackLoading={rollbackingId === (msg?.rollback?.id || `msg-${i}`)}
          />
        </motion.div>
      );
    }
    return (
      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
        <div className="titan-surface rounded-bl-md px-4 py-3 max-w-[85%] md:max-w-[65%] space-y-2">
          {(msg.source || msg.dataBasis) && (
            <div className="flex flex-wrap gap-1.5">
              {msg.dataBasis === "server_snapshot" || msg.source === "local" ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide rounded-md bg-primary/10 text-primary px-1.5 py-0.5">
                  Your data
                </span>
              ) : null}
              {msg.generalKnowledge || msg.source === "openai" ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide rounded-md bg-muted text-muted-foreground px-1.5 py-0.5">
                  May include general knowledge
                </span>
              ) : null}
              {msg.source === "offline" || msg.dataBasis === "device_cache" ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide rounded-md bg-warning/15 text-warning-foreground px-1.5 py-0.5">
                  Offline cache
                </span>
              ) : null}
            </div>
          )}
          <ReactMarkdown
            className="text-sm prose prose-sm dark:prose-invert max-w-none [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5"
            components={safeMarkdownComponents}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
      </motion.div>
    );
  };

  return (
    <div
      className="flex flex-col"
      style={{
        // Stay inside the app chrome (header + bottom nav + safe areas)
        height: "calc(100svh - 8rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
        maxHeight: "calc(100svh - 8rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex items-center justify-between px-4 md:px-8 pt-5 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-titan-cyan to-titan-indigo flex items-center justify-center flex-shrink-0">
            {lawMastermind ? <Scale className="w-5 h-5 text-foreground" /> : <Bot className="w-5 h-5 text-foreground" />}
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">
              {lawMastermind ? "Law Mastermind AI" : "Titan AI"}
            </h1>
            <div className="flex items-center gap-1.5">
              {dataLoading ? (
                <span className="text-xs text-muted-foreground">Loading snapshot…</span>
              ) : dataError ? (
                <>
                  <span className="text-xs text-red-400">Data unavailable</span>
                  <button onClick={loadBusinessData} className="text-muted-foreground hover:text-foreground/60 transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    Preview · {businessSummary?.counts?.customers || 0} customers ·{" "}
                    {businessSummary?.counts?.jobs || 0} jobs · answers use server snapshot
                  </span>
                </>
              )}
            </div>
            {ownerMode && !lawMastermind ? (
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={ownerAutopilot}
                  onCheckedChange={setAutopilot}
                  aria-label="Owner autopilot"
                />
                Owner autopilot
              </label>
            ) : null}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-muted-foreground hover:text-foreground/60 transition-colors p-2 rounded-xl hover:bg-muted"
            title="New conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
        {ownerMode && !lawMastermind ? (
          <div className="mb-4 rounded-2xl border border-border bg-card/70 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Titan Command Guardrails
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Kill switch blocks all Titan AI write actions until disabled.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-foreground">
                <ShieldAlert className={`w-3.5 h-3.5 ${opsState.killSwitch ? "text-red-400" : "text-emerald-400"}`} />
                Kill switch
                <Switch checked={Boolean(opsState.killSwitch)} onCheckedChange={setKillSwitch} />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                className="h-10 rounded-xl border border-border bg-muted/50 px-3 text-xs font-semibold text-foreground hover:bg-muted"
                onClick={() => runWorkflow("morning_ops")}
                disabled={loading || opsState.killSwitch || !opsState.routines.find((r) => r.id === "morning_ops")?.enabled}
              >
                Run Morning Ops
              </button>
              <button
                type="button"
                className="h-10 rounded-xl border border-border bg-muted/50 px-3 text-xs font-semibold text-foreground hover:bg-muted"
                onClick={() => runWorkflow("cash_recovery")}
                disabled={loading || opsState.killSwitch || !opsState.routines.find((r) => r.id === "cash_recovery")?.enabled}
              >
                Run Cash Recovery
              </button>
              <button
                type="button"
                className="h-10 rounded-xl border border-border bg-muted/50 px-3 text-xs font-semibold text-foreground hover:bg-muted"
                onClick={() => runWorkflow("closeout")}
                disabled={loading || opsState.killSwitch || !opsState.routines.find((r) => r.id === "closeout")?.enabled}
              >
                Run Daily Closeout
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {opsState.routines.map((routine) => (
                <label key={routine.id} className="inline-flex items-center gap-2 text-xs text-foreground">
                  <Checkbox
                    checked={routine.enabled !== false}
                    onCheckedChange={(checked) => setRoutineEnabled(routine.id, checked === true)}
                  />
                  {routine.label}
                </label>
              ))}
            </div>

            <div className="rounded-xl border border-border/80 bg-background/40 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Action log</p>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    if (!user?.id) return;
                    clearTitanActionLogs(user.id);
                    refreshOpsState();
                  }}
                >
                  Clear
                </button>
              </div>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {opsState.logs.slice(0, 6).map((log) => (
                  <li key={log.id} className="text-[11px] text-muted-foreground">
                    <span className="text-foreground font-semibold">{log.title}</span>
                    {log.detail ? ` · ${log.detail}` : ""}
                  </li>
                ))}
                {opsState.logs.length === 0 ? (
                  <li className="text-[11px] text-muted-foreground">No actions yet.</li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-full text-center py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-titan-cyan/20 to-titan-indigo/20 flex items-center justify-center mb-5 ai-pulse">
              <Sparkles className="w-8 h-8 text-titan-cyan" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {lawMastermind ? "Legal strategy, plain language" : "What can I do for you?"}
            </h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed">
              {lawMastermind
                ? "Educational legal coaching only — not a lawyer. Ask about contracts, disputes, and risk checklists."
                : "Ask about jobs, invoices, customers, or tell me what you need done."}
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {(lawMastermind ? LAW_SUGGESTIONS : SUGGESTIONS).map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.prompt)}
                  disabled={loading}
                  className="text-left px-4 py-3 rounded-lg titan-surface titan-surface-interactive text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <Zap className="w-3 h-3 inline mr-2 text-titan-cyan" />
                  {s.label}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4 pb-2">
            <AnimatePresence initial={false}>{messages.map((msg, i) => renderMessage(msg, i))}</AnimatePresence>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 md:px-8 pb-6 pt-3 border-t border-border flex-shrink-0">
        {confirming && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-titan-amber mb-3">
            Confirm or cancel the action above before sending a new message.
          </motion.p>
        )}
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isInputDisabled && sendMessage()}
            placeholder={confirming ? "Waiting for confirmation…" : "Ask Titan anything…"}
            className="bg-card border-border text-foreground rounded-2xl h-12 pl-5 placeholder:text-muted-foreground/80 focus:ring-1 focus:ring-titan-cyan/30 disabled:opacity-50"
            disabled={isInputDisabled}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isInputDisabled || !input.trim()}
            className="w-12 h-12 rounded-2xl bg-titan-cyan hover:bg-titan-cyan/90 text-black flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
