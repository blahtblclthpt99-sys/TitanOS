import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  LogOut,
  Palette,
  Settings,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

/**
 * Desktop user profile menu — settings, companies, appearance, sign out.
 */
export default function UserProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  const name = user?.full_name || user?.email?.split("@")[0] || "Account";
  const email = user?.email || "";
  const initials = (user?.full_name || user?.email || "T")
    .split(/[\s@]/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const items = [
    { icon: User, label: "Professional profile", path: "/profile", hint: "Bio, portfolio, badges" },
    { icon: Settings, label: "Settings", path: "/settings", hint: "Account & marketing prefs" },
    { icon: Palette, label: "Appearance", path: "/settings", hint: "Theme & contrast" },
    { icon: Building2, label: "Companies", path: "/companies" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex min-h-[40px] items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors duration-fast hover:bg-muted focus-ring ${
          open ? "bg-muted" : ""
        }`}
      >
        {user?.avatar_url || user?.avatar ? (
          <img
            src={user.avatar_url || user.avatar}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-soft">
            {initials}
          </span>
        )}
        <span className="hidden max-w-[110px] truncate text-sm font-medium text-foreground lg:block">
          {name.split(" ")[0]}
        </span>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-muted-foreground transition-transform duration-fast lg:block ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Account"
            initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-lift"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
            </div>

            <div className="py-1">
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => go(item.path)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors duration-fast hover:bg-muted focus-ring"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1">
                    <span className="block font-medium">{item.label}</span>
                    {item.hint && (
                      <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="border-t border-border py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  logout("/login");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-destructive transition-colors duration-fast hover:bg-destructive/10 focus-ring"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>

            <div className="border-t border-border bg-muted/40 px-3 py-2">
              <Link
                to="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground focus-ring"
              >
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                All settings
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
