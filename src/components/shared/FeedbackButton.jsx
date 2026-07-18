import React, { useState } from "react";
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

export default function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    try {
      await api.entities.BetaFeedback.create({ type, message, email: user?.email || undefined, status: "new" });
      await api.integrations.Core.SendEmail({
        to: "hello@titanos.app",
        subject: `[${type.toUpperCase()}] TitanOS Beta Feedback`,
        body: `Type: ${type}\nUser: ${user?.email || "Unknown"}\n\nMessage:\n${message}`,
      });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setMessage("");
        setType("general");
      }, 2000);
    } catch {
      // silently fail — don't block UI
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[5.5rem] md:bottom-6 right-4 md:right-6 z-50 w-12 h-12 rounded-2xl bg-titan-indigo hover:bg-titan-indigo/90 transition-all shadow-lg flex items-center justify-center"
        aria-label="Send feedback"
        title="Send feedback"
      >
        <MessageSquare className="w-5 h-5 text-white" />
      </button>

      {/* Feedback sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-auto md:right-6 md:bottom-24 md:left-auto md:w-[360px] z-50 bg-[#1A1A1C] border border-white/10 rounded-t-3xl md:rounded-2xl p-5 shadow-2xl"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
            >
              {/* Handle for mobile */}
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4 md:hidden" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Send Feedback</h3>
                  <p className="text-xs text-white/40">Help us improve TitanOS</p>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-white/40">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {submitted ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-titan-cyan/10 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-titan-cyan" />
                  </div>
                  <p className="text-sm font-semibold text-white">Thank you!</p>
                  <p className="text-xs text-white/40 mt-1">Your feedback has been sent.</p>
                </div>
              ) : (
                <>
                  {/* Type selector */}
                  <div className="flex gap-2 mb-4">
                    {TYPES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setType(t.id)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${type === t.id ? `${t.bg} border-current ${t.color}` : "border-white/5 text-white/30 hover:text-white/50"}`}
                      >
                        <t.icon className="w-4 h-4" />
                        <span className="text-[10px] leading-tight text-center">{t.label}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={
                      type === "bug" ? "Describe what happened and how to reproduce it..." :
                      type === "feature" ? "What feature would make TitanOS better for you?" :
                      "Share your thoughts, suggestions, or anything on your mind..."
                    }
                    rows={4}
                    className="w-full bg-[#242427] border border-white/10 text-white rounded-xl p-3 text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-titan-cyan/50 resize-none mb-3"
                  />

                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !message.trim()}
                    className="w-full bg-titan-indigo hover:bg-titan-indigo/90 text-white font-semibold rounded-xl h-10 text-sm gap-2 disabled:opacity-40"
                  >
                    {loading ? "Sending…" : <><Send className="w-4 h-4" /> Send Feedback</>}
                  </Button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}