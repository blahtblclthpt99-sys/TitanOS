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
    const q = params.get("q");
    if (!q || seededQ.current || dataLoading) return;
    seededQ.current = true;
    setInput(q);
  }, [params, dataLoading]);

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

  const handleRollback = async (msgIndex) => {
    const row = messages[msgIndex];
    const rollback = row?.rollback;
    if (!rollback || !user?.id || !ownerMode || rollbackingId || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setRollbackingId(row?.rollback?.id || `msg-${msgIndex}`);
    try {
      const result = await api.functions.invoke("titanAI", {
        messages: [],
        pageContext: buildAiPageContext({ pathname: "/assistant", workflow: "second_self" }),
        rollbackAction: { ...rollback, correlationId: rollback.correlationId || row?.correlationId || null },
        ownerAutopilot: ownerMode && ownerAutopilot,
        secondSelf: true,
        guardrails: { killSwitch: ownerMode && opsState.killSwitch },
      });
      const data = result.data || {};
      const retainRollback = shouldRetainRollback(data);
      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {
        ...m,
        content: rollbackMessage(m.content, data),
        rollback: retainRollback ? m.rollback : null,
      } : m));
      appendTitanActionLog(user.id, {
        status: data.type === "error" ? "error" : "ok",
        title: data.type === "error" ? "Rollback failed" : "Rollback completed",
        detail: data.message || "Rollback result.",
        correlationId: data.correlationId || rollback.correlationId || null,
      });
      refreshOpsState();
      if (!shouldRetainRollback(data)) { loadBusinessData(); void loadActionHistory(); }
    } catch (error) {
      const data = { type: "error", message: error?.message || "Rollback could not be completed." };
      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {
        ...m,
        content: rollbackMessage(m.content, data),
        rollback: m.rollback,
      } : m));
      appendTitanActionLog(user.id, {
        status: "error",
        title: "Rollback failed",
        detail: data.message,
      });
      refreshOpsState();
    } finally {
      actionInFlightRef.current = false;
      setRollbackingId(null);
    }
  };

  const handleCancel = (msgIndex) => {
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? {
      role: "assistant",
      content: "Cancelled. I didn't change anything.",
      type: "text",
    } : m));
    setConfirming(false);
  };

  const clearChat = () => {
    setMessages([]);
    setConfirming(false);
  };

  const isInputDisabled = loading || confirming;

  const renderMessage = (msg, i) => {
    if (msg.role === "user") {
      return <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end"><div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] md:max-w-[65%]"><p className="text-sm font-medium">{msg.content}</p></div></motion.div>;
    }
    if (msg.type === "loading") {
      return <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start"><div className="titan-surface rounded-bl-md px-4 py-3"><div className="flex items-center gap-1.5">{[0,150,300].map((delay) => <div key={delay} className="w-2 h-2 bg-titan-cyan rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />)}</div></div></motion.div>;
    }
    if (msg.type === "executing") {
      return <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start"><div className="titan-surface rounded-bl-md px-4 py-3 border border-titan-cyan/20 flex items-center gap-3"><div className="w-4 h-4 border-2 border-titan-cyan/30 border-t-titan-cyan rounded-full animate-spin flex-shrink-0"/><span className="text-xs text-muted-foreground">Executing…</span></div></motion.div>;
    }
    if (msg.type === "confirm") {
      return <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start"><div className="space-y-2 w-full max-w-2xl"><InvisibleInterface spec={msg.interface} onNavigate={navigate} onPrompt={sendMessage}/>{msg.retryError ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{msg.retryError} Retry uses the same protected action ID.</div> : null}<ConfirmationCard summary={msg.meta.summary} details={msg.meta.details} onConfirm={() => handleConfirm(i)} onCancel={() => handleCancel(i)} loading={confirming}/></div></motion.div>;
    }
    if (msg.type === "done" || msg.type === "error") {
      return <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start"><ActionResult message={msg.content} isError={msg.type === "error"} onRollback={msg.rollback ? () => handleRollback(i) : null} rollbackLoading={rollbackingId === (msg?.rollback?.id || `msg-${i}`)}/></motion.div>;
    }
    return <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start"><div className="titan-surface rounded-bl-md px-4 py-3 max-w-[92%] md:max-w-[72%] space-y-2">{(msg.source || msg.dataBasis) && <div className="flex flex-wrap gap-1.5">{msg.dataBasis === "server_snapshot" || msg.source === "local" ? <span className="text-[10px] font-semibold uppercase tracking-wide rounded-md bg-primary/10 text-primary px-1.5 py-0.5">Your data</span> : null}{msg.generalKnowledge || msg.source === "openai" ? <span className="text-[10px] font-semibold uppercase tracking-wide rounded-md bg-muted text-muted-foreground px-1.5 py-0.5">General knowledge</span> : null}{msg.source === "offline" || msg.dataBasis === "device_cache" ? <span className="text-[10px] font-semibold uppercase tracking-wide rounded-md bg-warning/15 text-warning-foreground px-1.5 py-0.5">Device context</span> : null}</div>}<InvisibleInterface spec={msg.interface} onNavigate={navigate} onPrompt={sendMessage}/><ReactMarkdown className="text-sm prose prose-sm dark:prose-invert max-w-none [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5" components={safeMarkdownComponents}>{msg.content}</ReactMarkdown></div></motion.div>;
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100svh - 8rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))", maxHeight: "calc(100svh - 8rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}>
      <div className="flex items-center justify-between px-4 md:px-8 pt-5 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-titan-cyan to-titan-indigo flex items-center justify-center flex-shrink-0">{lawMastermind ? <Scale className="w-5 h-5 text-foreground"/> : <Bot className="w-5 h-5 text-foreground"/>}</div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">{lawMastermind ? "Law Mastermind AI" : "2nd Me"}</h1>
            <div className="flex items-center gap-1.5">{dataLoading ? <span className="text-xs text-muted-foreground">Connecting context…</span> : dataError ? <><div className="w-1.5 h-1.5 rounded-full bg-amber-400"/><span className="text-xs text-muted-foreground">Partial context available · conversation still works</span><button onClick={loadBusinessData} className="text-muted-foreground hover:text-foreground/60 transition-colors" aria-label="Retry context"><RefreshCw className="w-3 h-3"/></button></> : <><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/><span className="text-xs text-muted-foreground">Memory + context ready</span></>}</div>
            {ownerMode && !lawMastermind ? <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={ownerAutopilot} onCheckedChange={setAutopilot} aria-label="Owner autopilot"/>Owner autopilot</label> : null}
          </div>
        </div>
        {messages.length > 0 && <button onClick={clearChat} className="text-muted-foreground hover:text-foreground/60 transition-colors p-2 rounded-xl hover:bg-muted" title="New conversation"><RotateCcw className="w-4 h-4"/></button>}
      </div>

      {!lawMastermind && actionHistory.length > 0 ? <div className="px-4 md:px-8 pt-3 flex-shrink-0"><div className="max-w-4xl mx-auto rounded-xl border border-border bg-card/50 px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Recent 2nd Me actions</div><div className="flex gap-2 overflow-x-auto pb-1">{actionHistory.map((item) => <div key={item.correlationId} className="min-w-[180px] rounded-lg bg-background/70 border border-border px-2.5 py-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold truncate">{String(item.intent || "action").replaceAll("_", " ")}</span><span className={`text-[10px] ${item.status === "completed" ? "text-emerald-500" : item.status === "failed" ? "text-destructive" : "text-amber-500"}`}>{item.status}</span></div><div className="text-[10px] text-muted-foreground mt-1 truncate">{item.message}</div><div className="text-[9px] text-muted-foreground/70 mt-1 font-mono" title={item.correlationId}>ID {String(item.correlationId).slice(-10)}</div></div>)}</div></div></div> : null}

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
        {messages.length === 0 ? <div className="max-w-2xl mx-auto py-8"><div className="text-center mb-6"><Sparkles className="w-8 h-8 text-titan-cyan mx-auto mb-3"/><h2 className="text-xl font-bold text-foreground">What are we doing?</h2><p className="text-sm text-muted-foreground mt-2">Tell me naturally. I’ll use what I know, figure out what’s missing, and bring up the right interface or action.</p></div><div className="grid gap-2 sm:grid-cols-2">{(lawMastermind ? LAW_SUGGESTIONS : SUGGESTIONS).map((s) => <button key={s.label} onClick={() => sendMessage(s.prompt)} className="rounded-xl border border-border bg-card/70 px-3 py-3 text-left text-sm hover:bg-muted transition-colors">{s.label}</button>)}</div></div> : <div className="space-y-4 max-w-4xl mx-auto">{messages.map(renderMessage)}<div ref={messagesEndRef}/></div>}
      </div>

      <div className="px-4 md:px-8 py-3 border-t border-border flex-shrink-0"><form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="max-w-4xl mx-auto flex gap-2"><Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={lawMastermind ? "Ask Law Mastermind…" : "What are we doing?"} disabled={isInputDisabled} className="flex-1"/><button type="submit" disabled={isInputDisabled || !input.trim()} className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40" aria-label="Send"><Send className="w-4 h-4"/></button></form></div>
    </div>
  );
}
