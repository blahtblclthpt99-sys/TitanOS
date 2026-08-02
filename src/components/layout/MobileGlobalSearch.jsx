import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Search, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  getSuggestedSearches,
  pushRecentSearch,
  runGlobalSearch,
} from "@/lib/globalSearch";
import { cn } from "@/lib/utils";

/**
 * Full-screen mobile global search — same sync index as desktop Cmd/Ctrl+K.
 */
export default function MobileGlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => runGlobalSearch(query, { userId: user?.id }), [query, user?.id]);
  const suggestions = useMemo(() => getSuggestedSearches(query), [query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setActiveIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const goTo = (path, label) => {
    if (query.trim()) pushRecentSearch(query.trim());
    else if (label) pushRecentSearch(label);
    navigate(path);
    onClose?.();
  };

  return (
    <div className="md:hidden fixed inset-0 z-[80] bg-background/95 backdrop-blur-xl flex flex-col" role="dialog" aria-modal="true" aria-label="Search TitanOS">
      <div
        className="flex items-center gap-2 border-b border-border px-3"
        style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(env(safe-area-inset-top) + 3.5rem)" }}
      >
        <Search className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[activeIndex]) {
              e.preventDefault();
              goTo(results[activeIndex].path, results[activeIndex].label);
            } else if (e.key === "Escape") {
              onClose?.();
            }
          }}
          placeholder="Search jobs, trips, messages…"
          className="flex-1 h-12 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          aria-label="Search"
        />
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-muted-foreground"
          aria-label="Close search"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
        {!query.trim() && suggestions.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground min-h-[40px]"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {results.length === 0 && query.trim() ? (
          <p className="text-sm text-muted-foreground px-1">No matches in the local index yet.</p>
        ) : (
          <ul className="space-y-1">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => goTo(r.path, r.label)}
                  className={cn(
                    "w-full text-left rounded-xl px-3 py-3 min-h-[52px] border border-transparent",
                    i === activeIndex ? "bg-primary/10 border-primary/30" : "hover:bg-muted/50"
                  )}
                >
                  <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.group}
                    {r.hint ? ` · ${r.hint}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
