import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Calendar, FileText, Users, Receipt, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SUGGESTIONS = [
  { icon: Calendar, label: "Schedule a job", action: "/jobs?new=1" },
  { icon: Receipt, label: "Create an invoice", action: "/invoices?new=1" },
  { icon: Users, label: "Find a customer", action: "/customers" },
  { icon: FileText, label: "Show unpaid invoices", action: "/invoices" },
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

  const handleSuggestion = (action) => {
    setOpen(false);
    navigate(action);
  };

  return (
    <div ref={ref} className="fixed bottom-24 right-4 z-50 md:bottom-8 md:right-8 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "rgba(26,26,28,0.97)",
              border: "1px solid rgba(0,199,217,0.2)",
              minWidth: 220,
            }}
          >
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs text-white/30 font-medium uppercase tracking-widest">Ask Titan…</p>
            </div>
            <div className="p-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s.label}
                  type="button"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleSuggestion(s.action)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all text-left"
                >
                  <s.icon className="w-4 h-4 text-titan-cyan flex-shrink-0" />
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all text-left"
                >
                  <MessageSquare className="w-4 h-4 text-titan-indigo flex-shrink-0" />
                  Send feedback
                </button>
              )}
            </div>
            <div className="px-4 pb-3 pt-1 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/assistant");
                }}
                className="w-full text-center text-xs text-titan-cyan hover:text-white transition-colors py-1.5"
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
        whileHover={{ scale: 1.05 }}
        onClick={() => setOpen((p) => !p)}
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl ai-pulse"
        style={{ background: "linear-gradient(135deg, #00C7D9, #7C5BFA)" }}
        aria-label={open ? "Close Titan menu" : "Open Titan menu"}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="x"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="spark"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
