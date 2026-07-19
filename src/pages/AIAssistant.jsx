import React, { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Sparkles, Zap, RotateCcw, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import ConfirmationCard from "@/components/ai/ConfirmationCard";
import ActionResult from "@/components/ai/ActionResult";
import { buildBusinessSummary } from "@/lib/ai-business-summary";

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

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [businessSummary, setBusinessSummary] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

    try {
      const history = [...messages, userEntry]
        .filter((m) => m.type !== "loading")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content || m.meta?.summary || "" }));

      const result = await api.functions.invoke("titanAI", {
        messages: history,
        businessSummary: businessSummary || undefined,
      });

      const data = result.data;

      if (data.type === "response" || data.type === "clarify") {
        replaceLastMessage({ role: "assistant", content: data.message, type: "text" });
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
      } else {
        replaceLastMessage({
          role: "assistant",
          content: data.message || "I'm not sure how to handle that.",
          type: "text",
        });
      }
    } catch (e) {
      const msg =
        e?.status === 401
          ? "Please sign in again to use Titan AI."
          : e?.message || "Something went wrong. Please try again.";
      replaceLastMessage({ role: "assistant", content: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (msgIndex) => {
    const confirmMsg = messages[msgIndex];
    if (!confirmMsg?.meta) return;
    setConfirming(true);
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, type: "executing" } : m)));

    try {
      const result = await api.functions.invoke("titanAI", {
        messages: [],
        businessSummary: businessSummary || undefined,
        confirmedAction: { intent: confirmMsg.meta.intent, params: confirmMsg.meta.params },
      });
      const data = result.data;
      const isError = data.type === "error";
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? { role: "assistant", content: data.message, type: isError ? "error" : "done" }
            : m
        )
      );
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
    } finally {
      setConfirming(false);
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
          <div className="bg-titan-cyan text-black rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] md:max-w-[65%]">
            <p className="text-sm font-medium">{msg.content}</p>
          </div>
        </motion.div>
      );
    }
    if (msg.type === "loading") {
      return (
        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
          <div className="glass rounded-2xl rounded-bl-md px-4 py-3">
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
          <div className="glass rounded-2xl rounded-bl-md px-4 py-3 border border-titan-cyan/20 flex items-center gap-3">
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
          <ActionResult message={msg.content} isError={msg.type === "error"} />
        </motion.div>
      );
    }
    return (
      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
        <div className="glass rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] md:max-w-[65%]">
          <ReactMarkdown
            className="text-sm prose prose-sm prose-invert max-w-none [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5"
            components={{
              a: ({ href, children }) => {
                const safe =
                  typeof href === "string" &&
                  (href.startsWith("https://") || href.startsWith("http://") || href.startsWith("/"));
                if (!safe) return <span>{children}</span>;
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-titan-cyan underline">
                    {children}
                  </a>
                );
              },
            }}
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
            <Bot className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">Titan AI</h1>
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
                    Live · {businessSummary?.counts?.customers || 0} customers ·{" "}
                    {businessSummary?.counts?.jobs || 0} jobs
                  </span>
                </>
              )}
            </div>
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
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-full text-center py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-titan-cyan/20 to-titan-indigo/20 flex items-center justify-center mb-5 ai-pulse">
              <Sparkles className="w-8 h-8 text-titan-cyan" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">What can I do for you?</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed">
              Ask about today&apos;s jobs, who owes money, revenue, or profit — answers use your live TitanOS data.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.prompt)}
                  disabled={loading}
                  className="text-left px-4 py-3 rounded-xl glass glass-hover text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
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
