import React, { useState, useImperativeHandle, forwardRef } from "react";
import { MessageSquare, X, Bug, Lightbulb, Star, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

const TYPES = [
  { id: "bug", label: "Bug Report", icon: Bug, color: "text-red-400", bg: "bg-red-400/10" },
  { id: "feature", label: "Feature Request", icon: Lightbulb, color: "text-titan-amber", bg: "bg-titan-amber/10" },
  { id: "general", label: "General Feedback", icon: Star, color: "text-titan-cyan", bg: "bg-titan-cyan/10" },
];

function saveFeedbackLocally(payload) {
  try {
    const pending = JSON.parse(localStorage.getItem("titanos_beta_feedback") || "[]");
    pending.push({ ...payload, saved_at: new Date().toISOString() });
    localStorage.setItem("titanos_beta_feedback", JSON.stringify(pending));
  } catch {
    // ignore
  }
}

const FeedbackButton = forwardRef(function FeedbackButton({ hideTrigger = false }, ref) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setError("");
    },
  }));

  const handleSubmit = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError("");

    const payload = {
      type,
      message: message.trim(),
      email: user?.email || undefined,
      status: "new",
      page: typeof window !== "undefined" ? window.location.pathname : undefined,
    };

    try {
      try {
        await api.entities.BetaFeedback.create(payload);
      } catch {
        saveFeedbackLocally(payload);
      }

      try {
        await api.integrations.Core.SendEmail({
          to: "hello@titanos.app",
          subject: `[${type.toUpperCase()}] TitanOS Feedback`,
          body: `Type: ${type}\nUser: ${user?.email || "Unknown"}\nPage: ${payload.page || "/"}\n\nMessage:\n${payload.message}`,
        });
      } catch {
        /* optional */
      }

      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setMessage("");
        setType("general");
        setError("");
      }, 1800);
    } catch (err) {
      setError(err?.message || "Could not send feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError("");
          }}
          className="fixed bottom-[5.5rem] md:bottom-20 right-3 md:right-6 z-[60] w-9 h-9 rounded-xl bg-titan-indigo hover:bg-titan-indigo/90 active:scale-95 transition-all shadow-md flex items-center justify-center border border-border"
          aria-label="Send feedback"
          title="Send feedback"
        >
          <MessageSquare className="w-4 h-4 text-foreground" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[70] backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Send feedback"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed bottom-0 left-0 right-0 md:right-6 md:bottom-24 md:left-auto md:w-[340px] z-[80] bg-card border border-border rounded-t-3xl md:rounded-2xl p-5 shadow-2xl"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4 md:hidden" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Send Feedback</h3>
                  <p className="text-xs text-muted-foreground">Help us improve TitanOS</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {submitted ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-titan-cyan/10 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-titan-cyan" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Thank you!</p>
                  <p className="text-xs text-muted-foreground mt-1">Your feedback has been sent.</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    {TYPES.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setType(t.id)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          type === t.id
                            ? `${t.bg} border-current ${t.color}`
                            : "border-border text-muted-foreground hover:text-foreground/50"
                        }`}
                      >
                        <t.icon className="w-4 h-4" />
                        <span className="text-[10px] leading-tight text-center">{t.label}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      type === "bug"
                        ? "Describe what happened and how to reproduce it..."
                        : type === "feature"
                          ? "What feature would make TitanOS better for you?"
                          : "Share your thoughts, suggestions, or anything on your mind..."
                    }
                    rows={4}
                    className="w-full bg-muted border border-border text-foreground rounded-xl p-3 text-sm placeholder:text-muted-foreground/80 focus:outline-none focus:ring-1 focus:ring-titan-cyan/50 resize-none mb-3"
                  />

                  {error ? (
                    <p className="text-xs text-red-400 mb-3" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || !message.trim()}
                    className="w-full bg-titan-indigo hover:bg-titan-indigo/90 text-foreground font-semibold rounded-xl h-10 text-sm gap-2 disabled:opacity-40"
                  >
                    {loading ? (
                      "Sending…"
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Send Feedback
                      </>
                    )}
                  </Button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

export default FeedbackButton;
