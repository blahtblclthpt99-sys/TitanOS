import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Calendar, FileText, Users, Receipt, MessageSquare, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={ref}
      className="fixed z-50 flex flex-col items-end gap-2 right-4 md:right-8 bottom-24 md:bottom-8"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl overflow-hidden shadow-lift border border-border bg-card min-w-[240px]"
          >
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Ask Titan</p>
            </div>
            <div className="p-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s.label}
                  type="button"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => {
                    setOpen(false);
                    navigate(s.action);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground/80 hover:text-foreground hover:bg-muted transition-all text-left min-h-[44px]"
                >
                  <s.icon className="w-4 h-4 text-primary flex-shrink-0" />
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground/80 hover:text-foreground hover:bg-muted transition-all text-left min-h-[44px]"
                >
                  <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
                  Send feedback
                </button>
              )}
            </div>
            <div className="px-4 pb-3 pt-1 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/assistant");
                }}
                className="w-full text-center text-xs font-semibold text-primary hover:underline py-1.5"
              >
                Open full AI assistant →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.04 }}
        onClick={() => setOpen((p) => !p)}
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lift ai-pulse bg-gradient-to-br from-titan-navy to-titan-electric"
        aria-label={open ? "Close Titan menu" : "Open Titan AI"}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.div key="spark" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
