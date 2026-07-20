import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Calendar, FileText, Users, Receipt, MessageSquare, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const SUGGESTIONS = [
  { icon: Calendar, label: "Schedule a job", action: "/jobs?new=1" },
  { icon: FileText, label: "Create estimate", action: "/estimates?new=1" },
  { icon: Receipt, label: "Create an invoice", action: "/invoices?new=1" },
  { icon: DollarSign, label: "Who owes me money?", action: "/invoices" },
  { icon: Users, label: "Find a customer", action: "/customers" },
];

export default function FloatingAIButton({ onOpenFeedback }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
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

  return (
    <div
      ref={ref}
      className="fixed z-50 flex flex-col items-end gap-1.5 right-3 md:right-6 bottom-[5.25rem] md:bottom-6"
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
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Ask Titan</p>
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-foreground hover:bg-muted transition-all text-left min-h-[40px]"
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-foreground hover:bg-muted transition-all text-left min-h-[40px]"
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

      <motion.button
        type="button"
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
        whileHover={reduceMotion ? undefined : { scale: 1.04 }}
        onClick={() => setOpen((p) => !p)}
        className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lift bg-gradient-to-br from-titan-navy to-titan-electric ${reduceMotion ? "" : "ai-pulse"}`}
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
              <X className="w-4.5 h-4.5 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="spark"
              initial={reduceMotion ? false : { rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={reduceMotion ? undefined : { rotate: -90, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
            >
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
