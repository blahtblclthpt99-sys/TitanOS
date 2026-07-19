import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Command } from "lucide-react";
import NotificationBell from "@/components/shared/NotificationBell";
import { useAuth } from "@/lib/AuthContext";
import { QUICK_CREATE_ACTIONS } from "@/lib/nav-items";
import { AnimatePresence, motion } from "framer-motion";

const SEARCH_TARGETS = [
  { label: "Customers", path: "/customers", hint: "People & companies" },
  { label: "Jobs", path: "/jobs", hint: "Schedule & field work" },
  { label: "Invoices", path: "/invoices", hint: "Billing" },
  { label: "Estimates", path: "/estimates", hint: "Quotes" },
  { label: "Marketplace", path: "/marketplace", hint: "Buy & sell" },
  { label: "Community", path: "/community", hint: "Messages & posts" },
  { label: "Employees", path: "/employees", hint: "Team" },
  { label: "Finances", path: "/finances", hint: "Money" },
  { label: "AI Assistant", path: "/assistant", hint: "Ask Titan" },
  { label: "Settings", path: "/settings", hint: "Profile & prefs" },
];

export default function DesktopTopBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const searchRef = useRef(null);
  const createRef = useRef(null);

  const name = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "You";
  const initials = (user?.full_name || user?.email || "T")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const results = query.trim()
    ? SEARCH_TARGETS.filter(
        (t) =>
          t.label.toLowerCase().includes(query.toLowerCase()) ||
          t.hint.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_TARGETS.slice(0, 6);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.querySelector("input")?.focus(), 50);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setCreateOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (createRef.current && !createRef.current.contains(e.target)) setCreateOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target) && !e.target.closest?.("[data-search-trigger]")) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header
      className="hidden md:flex fixed top-0 right-0 z-30 h-16 items-center gap-3 px-5 bg-background/80 backdrop-blur-xl border-b border-border"
      style={{ left: "var(--sidebar-width, 72px)" }}
    >
      <div className="relative flex-1 max-w-xl" ref={searchRef}>
        <button
          type="button"
          data-search-trigger
          onClick={() => {
            setSearchOpen(true);
            setTimeout(() => searchRef.current?.querySelector("input")?.focus(), 50);
          }}
          className={`w-full flex items-center gap-2 h-11 px-3.5 rounded-xl border border-border bg-card text-muted-foreground shadow-soft hover:border-primary/30 transition-colors text-left ${
            searchOpen ? "ring-2 ring-ring border-primary/40" : ""
          }`}
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          {searchOpen ? (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  navigate(results[0].path);
                  setSearchOpen(false);
                  setQuery("");
                }
              }}
              placeholder="Search customers, jobs, invoices…"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              aria-label="Global search"
            />
          ) : (
            <span className="flex-1 text-sm">Search TitanOS…</span>
          )}
          <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
            <Command className="w-3 h-3" />K
          </kbd>
        </button>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute top-full mt-2 left-0 right-0 rounded-2xl border border-border bg-card shadow-lift overflow-hidden z-50"
            >
              <ul className="py-2 max-h-72 overflow-y-auto">
                {results.map((item) => (
                  <li key={item.path}>
                    <button
                      type="button"
                      onClick={() => {
                        navigate(item.path);
                        setSearchOpen(false);
                        setQuery("");
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.hint}</span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="px-4 py-6 text-sm text-muted-foreground text-center">No matches</li>
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative" ref={createRef}>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-soft hover:shadow-lift hover:bg-primary/90 transition-all btn-press"
        >
          <Plus className="w-4 h-4" />
          Quick Create
        </button>
        <AnimatePresence>
          {createOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-card shadow-lift overflow-hidden z-50"
            >
              {QUICK_CREATE_ACTIONS.map((action) => (
                <button
                  key={action.path}
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    navigate(action.path);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors text-left"
                >
                  <action.icon className="w-4 h-4 text-primary" />
                  {action.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <NotificationBell />

      <button
        type="button"
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-muted transition-colors min-h-[44px]"
        aria-label="Open profile settings"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-titan-navy to-titan-electric text-white text-xs font-bold flex items-center justify-center shadow-soft">
          {initials}
        </div>
        <span className="hidden lg:block text-sm font-medium text-foreground max-w-[100px] truncate">{name}</span>
      </button>
    </header>
  );
}
