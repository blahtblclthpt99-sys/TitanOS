import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { QUICK_CREATE_ACTIONS } from "@/lib/nav-items";

/** Mobile FAB for Quick Create (Estimate / Job / Invoice / Customer). */
export default function QuickCreateFAB() {
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
      className="md:hidden fixed z-50 flex flex-col items-center gap-2"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="mb-1 rounded-2xl border border-border bg-card shadow-lift overflow-hidden min-w-[200px]"
          >
            {QUICK_CREATE_ACTIONS.map((action, i) => (
              <motion.button
                key={action.path}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => {
                  setOpen(false);
                  navigate(action.path);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground hover:bg-muted transition-colors text-left border-b border-border last:border-0 min-h-[48px]"
              >
                <action.icon className="w-4 h-4 text-primary" />
                {action.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lift flex items-center justify-center"
        aria-label={open ? "Close quick create" : "Quick create"}
        aria-expanded={open}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ opacity: 0 }}>
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span key="plus" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ opacity: 0 }}>
              <Plus className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
