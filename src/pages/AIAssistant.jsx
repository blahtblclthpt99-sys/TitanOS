import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, RefreshCw, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ConfirmationCard from "@/components/ai/ConfirmationCard";
import InvisibleInterface from "@/components/ai/InvisibleInterface";
import ActionResult from "@/components/ai/ActionResult";
import { safeMarkdownComponents } from "@/components/ai/safeMarkdown";
import { buildBusinessSummary } from "@/lib/ai-business-summary";
import { buildAiPageContext } from "@/lib/aiPageContext";
import { useAuth } from "@/lib/AuthContext";
import { confirmedActionErrorMessage, rollbackMessage, shouldRetainRollback } from "@/lib/secondMeActionUi";
import { ensureSecondMeActionId } from "@/lib/secondMeActionId";

const SUGGESTIONS = [
  ["What am I forgetting?", "What am I forgetting or leaving unresolved right now?"],
  ["What should I do next?", "Based on my Titan context, what deserves my attention next?"],
  ["Today's jobs", "What jobs do I have scheduled today?"],
  ["Who owes me money?", "Which customers have outstanding invoices?"],
  ["Remember something", "I want you to remember something"],
  ["From now on…", "I want to create a from-now-on rule"],
];

function userMessage(content) {
  return { role: "user", content, type: "text" };
}

function assistantLoading() {
  return { role: "assistant", content: "", type: "loading" };
}

export default function AIAssistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [businessSummary, setBusinessSummary] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
  const [actionHistory, setActionHistory] = useState([]);
  const [rollbackingId, setRollbackingId] = useState(null);
  const seededQ = useRef(false);
  const actionInFlight = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const replaceLastMessage = useCallback((message) => {
    setMessages((current) => [...current.slice(0, -1), message]);
  }, []);

  const loadActionHistory = useCallback(async () => {
    if (!user?.id) {
      setActionHistory([]);
      return;
    }
    try {
      const result = await api.functions.invoke("titanAI", {
        messages: [],
        historyRequest: true,
        historyLimit: 6,
        secondSelf: true,
      });
      setActionHistory(Array.isArray(result?.data?.items) ? result.data.items : []);
    } catch {
      setActionHistory([]);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadActionHistory();
  }, [loadActionHistory]);

  useEffect(() => {
    let alive = true;
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

    (async () => {
      const [jobs, invoices, customers] = await Promise.all([
        safeList(() => api.entities.Job.list("-created_date", 40)),
        safeList(() => api.entities.Invoice.list("-created_date", 40)),
        safeList(() => api.entities.Customer.list("-created_date", 40)),
      ]);
      if (!alive) return;
      setBusinessSummary(
        buildBusinessSummary({
          jobs: jobs.rows,
          invoices: invoices.rows,
          customers: customers.rows,
          expenses: [],
          employees: [],
        })
      );
      setDataError(jobs.failed || invoices.failed || customers.failed);
      setDataLoading(false);
    })().catch(() => {
      if (!alive) return;
      setBusinessSummary(null);
      setDataError(true);
      setDataLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text) => {
      const content = String(text ?? input).trim();
      if (!content || loading || confirming) return;

      const entry = userMessage(content);
      const history = [...messages, entry]
        .filter((message) => message.type !== "loading")
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.content || message.meta?.summary || "",
        }));

      setInput("");
      setMessages((current) => [...current, entry, assistantLoading()]);
      setLoading(true);

      try {
        const result = await api.functions.invoke("titanAI", {
          messages: history,
          pageContext: buildAiPageContext({ pathname: "/assistant", workflow: "second_self" }),
          offlineSnapshot: businessSummary || undefined,
          secondSelf: true,
        });
        const data = result?.data || {};

        if (data.type === "confirm") {
          replaceLastMessage({
            role: "assistant",
            type: "confirm",
            content: "",
            interface: data.interface || null,
            meta: {
              intent: data.intent,
              params: data.params,
              summary: data.confirmationSummary || "Confirm this action?",
              details: data.confirmationDetails || [],
              actionId: ensureSecondMeActionId({}),
            },
          });
          setConfirming(true);
          return;
        }

        if (data.type === "done" || data.type === "workflow_done") {
          const steps =
            data.type === "workflow_done" && Array.isArray(data.steps) && data.steps.length
              ? `\n\n${data.steps.map((step, index) => `${index + 1}. ${step.message || step.intent}`).join("\n")}`
              : "";
          replaceLastMessage({
            role: "assistant",
            type: "done",
            content: `${data.message || "Action completed."}${steps}`,
            interface: data.interface || null,
            rollback: data.rollback
              ? { ...data.rollback, correlationId: data.correlationId || data.actionId || null }
              : null,
          });
          void loadActionHistory();
          return;
        }

        replaceLastMessage({
          role: "assistant",
          type: data.type === "error" ? "error" : "text",
          content: data.message || "I need a little more context to help with that.",
          interface: data.interface || null,
          source: data.source || null,
        });
      } catch (error) {
        replaceLastMessage({
          role: "assistant",
          type: "error",
          content:
            Number(error?.status || 0) === 401
              ? "Your session needs to be refreshed. Return to 2nd Self and try again after Titan reconnects your account."
              : "I couldn't reach Titan's live intelligence service. Your business data was not changed. Try again when the connection recovers.",
        });
      } finally {
        setLoading(false);
      }
    },
    [businessSummary, confirming, input, loadActionHistory, loading, messages, replaceLastMessage]
  );

  useEffect(() => {
    const q = params.get("q")?.trim();
    if (!q || seededQ.current || dataLoading || loading || confirming) return;
    seededQ.current = true;
    void sendMessage(q);
  }, [confirming, dataLoading, loading, params, sendMessage]);

  const handleConfirm = async (index) => {
    const message = messages[index];
    if (!message?.meta || actionInFlight.current) return;
    actionInFlight.current = true;
    const actionId = ensureSecondMeActionId(message.meta);
    setConfirming(true);
    setMessages((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, type: "executing", meta: { ...item.meta, actionId } }
          : item
      )
    );

    try {
      const result = await api.functions.invoke("titanAI", {
        messages: [],
        pageContext: buildAiPageContext({ pathname: "/assistant", workflow: "second_self" }),
        confirmedAction: {
          intent: message.meta.intent,
          params: message.meta.params,
          actionId,
        },
        secondSelf: true,
      });
      const data = result?.data || {};
      const isError = data.type === "error";
      setMessages((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                role: "assistant",
                content: data.message || (isError ? "The action failed." : "Action completed."),
                type: isError ? "error" : "done",
                interface: data.interface || null,
                rollback: data.rollback
                  ? { ...data.rollback, correlationId: data.correlationId || data.actionId || actionId }
                  : null,
              }
            : item
        )
      );
      if (!isError) void loadActionHistory();
    } catch (error) {
      const retryMessage = confirmedActionErrorMessage(error);
      setMessages((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...message,
                type: "confirm",
                retryError: retryMessage,
                meta: { ...message.meta, actionId },
              }
            : item
        )
      );
    } finally {
      actionInFlight.current = false;
      setConfirming(false);
    }
  };

  const handleCancel = (index) => {
    setMessages((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { role: "assistant", content: "Action cancelled. Nothing was changed.", type: "text" }
          : item
      )
    );
    setConfirming(false);
  };

  const handleRollback = async (message, index) => {
    if (!message?.rollback || rollbackingId != null) return;
    setRollbackingId(index);
    try {
      const result = await api.functions.invoke("titanAI", {
        messages: [],
        pageContext: buildAiPageContext({ pathname: "/assistant", workflow: "second_self" }),
        secondSelf: true,
        rollbackAction: message.rollback,
      });
      const data = result?.data || {};
      setMessages((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                content: `${item.content || "Action completed."}\n\n${rollbackMessage(data)}`,
                rollback: shouldRetainRollback(data) ? message.rollback : null,
              }
            : item
        )
      );
      if (data.type !== "error") void loadActionHistory();
    } catch (error) {
      setMessages((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                content: `${item.content || "Action completed."}\n\n${rollbackMessage({ type: "error", message: error?.message })}`,
              }
            : item
        )
      );
    } finally {
      setRollbackingId(null);
    }
  };

  return (
    <div className="page-pad mx-auto max-w-5xl pb-28">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Invisible Interface</p>
          <h1 className="text-2xl font-bold text-foreground">2nd Self</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask, remember, understand, and take approved actions across Titan.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate("/second-me")}>2nd Self home</Button>
      </div>

      {dataError ? (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
          Some local fallback context could not refresh. Live server context will still be used when available.
        </div>
      ) : null}

      {!messages.length ? (
        <section className="titan-surface mb-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-foreground">What can I help with?</p>
              <p className="mt-1 text-sm text-muted-foreground">Ask about business data, open loops, memory, or an action you want to take.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map(([label, prompt]) => (
              <button
                key={label}
                type="button"
                disabled={dataLoading || loading || confirming}
                onClick={() => void sendMessage(prompt)}
                className="rounded-full border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 focus-ring"
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-live="polite">
        {messages.map((message, index) => {
          if (message.type === "loading") {
            return (
              <div key={`${index}-loading`} className="flex justify-start">
                <div className="titan-surface flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> Thinking…
                </div>
              </div>
            );
          }

          if (message.type === "confirm" || message.type === "executing") {
            return (
              <ConfirmationCard
                key={`${index}-confirm`}
                summary={message.meta?.summary || "Confirm this action?"}
                details={message.retryError ? [...(message.meta?.details || []), `Retry note: ${message.retryError}`] : message.meta?.details || []}
                loading={message.type === "executing"}
                onConfirm={() => handleConfirm(index)}
                onCancel={() => handleCancel(index)}
              />
            );
          }

          if (message.type === "done") {
            return (
              <div key={`${index}-done`} className="space-y-2">
                <ActionResult
                  message={message.content || "Action completed."}
                  onRollback={message.rollback ? () => handleRollback(message, index) : null}
                  rollbackLoading={rollbackingId === index}
                />
                {message.interface ? (
                  <InvisibleInterface
                    spec={message.interface}
                    onNavigate={navigate}
                    onPrompt={(prompt) => void sendMessage(prompt)}
                  />
                ) : null}
              </div>
            );
          }

          return (
            <div key={`${index}-${message.type}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm md:max-w-[78%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.type === "error"
                      ? "border border-destructive/25 bg-destructive/5 text-foreground"
                      : "titan-surface text-foreground"
                }`}
              >
                <ReactMarkdown components={safeMarkdownComponents}>{message.content || ""}</ReactMarkdown>
                {message.interface ? (
                  <div className="mt-3">
                    <InvisibleInterface
                      spec={message.interface}
                      onNavigate={navigate}
                      onPrompt={(prompt) => void sendMessage(prompt)}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </section>

      {actionHistory.length ? (
        <section className="titan-surface mt-5 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent approved actions</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {actionHistory.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3">
                <p className="truncate text-sm font-semibold text-foreground">{item.intent || "Action"}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">{item.status || "completed"}</p>
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
        <Button
          type="submit"
          disabled={!input.trim() || loading || confirming}
          className="min-h-[44px] min-w-[44px] px-3"
          aria-label="Send to 2nd Self"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
