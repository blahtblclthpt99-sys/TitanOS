import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Calendar,
  FileText,
  Users,
  Receipt,
  MessageSquare,
  DollarSign,
  Plus,
  Mic,
} from "lucide-react";
import { useNavigate } from "react-router";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useAuth } from "@/lib/AuthContext";
import { appendVoiceTranscript, listVoiceTranscriptDocs } from "@/lib/voiceTranscriptStore";
import { upsertSearchDocs } from "@/lib/searchIndex";

const SUGGESTIONS = [
  { icon: Calendar, label: "Schedule a job", action: "/jobs?new=1" },
  { icon: FileText, label: "Create estimate", action: "/estimates?new=1" },
  { icon: Receipt, label: "Create an invoice", action: "/invoices?new=1" },
  { icon: DollarSign, label: "Who owes me money?", action: "/invoices" },
  { icon: Users, label: "Find a customer", action: "/customers" },
];

/**
 * Floating action dock — matches product screenshots: + · AI sparkle · mic pill.
 */
export default function FloatingAIButton({ onOpenFeedback }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const ref = useRef(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const panelMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 12, scale: 0.95 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 8, scale: 0.95 },
        transition: { duration: 0.2 },
      };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      navigate("/assistant");
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = false;
      setListening(true);
      rec.onresult = (ev) => {
        const text = ev.results?.[0]?.[0]?.transcript?.trim();
        setListening(false);
        if (text && user?.id) {
          appendVoiceTranscript(user.id, text, "ai-mic");
          upsertSearchDocs(user.id, listVoiceTranscriptDocs(user.id));
        }
        if (text) navigate(`/assistant?q=${encodeURIComponent(text)}`);
        else navigate("/assistant");
      };
      rec.onerror = () => {
        setListening(false);
        navigate("/assistant");
      };
      rec.onend = () => setListening(false);
      rec.start();
    } catch {
      setListening(false);
      navigate("/assistant");
    }
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 flex flex-col items-center gap-2 left-1/2 -translate-x-1/2 bottom-[5.25rem] md:left-auto md:right-6 md:translate-x-0 md:bottom-6 md:items-end"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            {...panelMotion}
            className="rounded-2xl overflow-hidden shadow-lift border border-border bg-card min-w-[220px] max-w-[260px]"
            role="menu"
            aria-label="Suggested AI actions"
          >
            <div className="px-3 pt-2.5 pb-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
                Ask Titan
              </p>
            </div>
            <div className="p-1.5">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s.label}
                  type="button"
                  initial={reduceMotion ? false : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: i * 0.04 }}
                  onClick={() => {
                    setOpen(false);
                    navigate(s.action);
                  }}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-foreground hover:bg-muted transition-all text-left min-h-[44px] focus-ring"
                >
                  <s.icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  {s.label}
                </motion.button>
              ))}
              {typeof onOpenFeedback === "function" && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenFeedback();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-foreground hover:bg-muted transition-all text-left min-h-[44px]"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  Send feedback
                </button>
              )}
            </div>
            <div className="px-3 pb-2.5 pt-1 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/assistant");
                }}
                className="w-full text-center text-[11px] font-semibold text-primary hover:underline py-1"
              >
                Open full AI assistant →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pill dock — reference screenshots */}
      <div className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card/95 p-1.5 shadow-lift backdrop-blur-xl">
        <button
          type="button"
          onClick={() => navigate("/jobs?new=1")}
          className="flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted focus-ring"
          aria-label="Quick create job"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>

        <motion.button
          type="button"
          whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          onClick={() => setOpen((p) => !p)}
          className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] text-white shadow-[0_0_24px_rgba(37,99,235,0.45)] focus-ring ${
            reduceMotion ? "" : "ai-pulse"
          }`}
          aria-label={open ? "Close Titan menu" : "Open Titan AI"}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div
                key="x"
                initial={reduceMotion ? false : { rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={reduceMotion ? undefined : { rotate: 90, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              >
                <X className="h-5 w-5" />
              </motion.div>
            ) : (
              <motion.div
                key="spark"
                initial={reduceMotion ? false : { rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={reduceMotion ? undefined : { rotate: -90, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }}
              >
                <Sparkles className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <button
          type="button"
          onClick={startVoice}
          className={`flex h-11 w-11 items-center justify-center rounded-full focus-ring ${
            listening
              ? "bg-primary/15 text-primary"
              : "text-foreground hover:bg-muted"
          }`}
          aria-label={listening ? "Listening…" : "Voice to Titan AI"}
          aria-pressed={listening}
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
