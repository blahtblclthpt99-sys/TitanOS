import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { QUICK_CREATE_ACTIONS } from "@/lib/nav-items";

/** Mobile FAB — primary create action above bottom nav. */
export default function QuickCreateFAB() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const fabRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const first = menuRef.current?.querySelector('[role="menuitem"]');
    first?.focus?.();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      ref={ref}
      className="md:hidden fixed z-50 flex flex-col items-center gap-2"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
        right: "1rem",
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="mb-1 min-w-[220px] overflow-hidden rounded-lg border border-border bg-card shadow-lift"
            role="menu"
            id="quick-create-menu"
            aria-label="Create"
            ref={menuRef}
          >
            <p className="border-b border-border px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Quick create
            </p>
            {QUICK_CREATE_ACTIONS.map((action, i) => (
              <motion.button
                key={action.path}
                type="button"
                role="menuitem"
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  setOpen(false);
                  navigate(action.path);
                }}
                className="flex min-h-[52px] w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors duration-fast last:border-0 hover:bg-muted active:bg-muted focus-ring"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <action.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {action.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        ref={fabRef}
        type="button"
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift focus-ring"
        aria-label={open ? "Close quick create" : "Create new"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="quick-create-menu"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="x"
              initial={reduceMotion ? false : { rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span
              key="plus"
              initial={reduceMotion ? false : { rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Plus className="h-6 w-6" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
