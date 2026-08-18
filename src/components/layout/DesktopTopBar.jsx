import React, { useEffect, useRef, useState } from "react";
import { Brain, Plus } from "lucide-react";
import { useNavigate } from "react-router";
import NotificationCenter from "@/components/layout/NotificationCenter";
import UserProfileMenu from "@/components/layout/UserProfileMenu";
import ThemeToggle from "@/components/brand/ThemeToggle";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import { QUICK_CREATE_ACTIONS } from "@/lib/nav-items";

/**
 * Deliberately small desktop command bar.
 * 2nd Self replaces the old parallel global-search/AI surfaces; Create remains
 * limited to core business objects.
 */
export default function DesktopTopBar() {
  const navigate = useNavigate();
  const createRef = useRef(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const onPointer = (event) => {
      if (createRef.current && !createRef.current.contains(event.target)) setCreateOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setCreateOpen(false);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        navigate("/second-me");
      }
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [navigate]);

  return (
    <header
      className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl md:flex"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        left: "var(--sidebar-width, 72px)",
      }}
      role="banner"
    >
      <TitanBrandLogo to="/" className="mr-1" markClassName="h-7 w-7" />

      <button
        type="button"
        onClick={() => navigate("/second-me")}
        className="inline-flex h-11 min-w-0 flex-1 max-w-xl items-center gap-2 rounded-md border border-border bg-muted px-3 text-left text-sm text-muted-foreground shadow-soft transition-colors hover:border-primary/30 hover:text-foreground focus-ring"
        aria-label="Open 2nd Self"
      >
        <Brain className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate">Ask 2nd Self, recall context, or take an approved action…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-flex">
          Ctrl K
        </kbd>
      </button>

      <div className="relative" ref={createRef}>
        <button
          type="button"
          onClick={() => setCreateOpen((value) => !value)}
          aria-expanded={createOpen}
          aria-haspopup="menu"
          className="inline-flex h-11 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-fast hover:bg-primary/90 focus-ring btn-press"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden lg:inline">Create</span>
        </button>
        {createOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-lift"
          >
            {QUICK_CREATE_ACTIONS.map((action) => (
              <button
                key={action.path}
                type="button"
                role="menuitem"
                onClick={() => {
                  setCreateOpen(false);
                  navigate(action.path);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted focus-ring"
              >
                <action.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <NotificationCenter />
        <UserProfileMenu />
      </div>
    </header>
  );
}
