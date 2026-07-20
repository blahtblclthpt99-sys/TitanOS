import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bookmark, BookmarkCheck, Clock, Command, Plus, Search, Sparkles } from "lucide-react";
import NotificationCenter from "@/components/layout/NotificationCenter";
import UserProfileMenu from "@/components/layout/UserProfileMenu";
import { QUICK_CREATE_ACTIONS } from "@/lib/nav-items";
import { useAuth } from "@/lib/AuthContext";
import {
  clearRecentSearches,
  getAiSearchTips,
  getRecentSearches,
  getSavedSearches,
  getSuggestedSearches,
  isSearchSaved,
  pushRecentSearch,
  runGlobalSearch,
  toggleSavedSearch,
} from "@/lib/globalSearch";

export default function DesktopTopBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState(getRecentSearches);
  const [saved, setSaved] = useState(getSavedSearches);
  const searchRef = useRef(null);
  const createRef = useRef(null);
  const inputRef = useRef(null);

  const results = useMemo(() => runGlobalSearch(query, { userId: user?.id }), [query, user?.id]);
  const suggestions = useMemo(() => getSuggestedSearches(query), [query]);
  const aiTips = useMemo(() => getAiSearchTips(query), [query]);
  const showBrowse = searchOpen && !query.trim();

  useEffect(() => {
    setActiveIndex(0);
  }, [query, searchOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setCreateOpen(false);
        setTimeout(() => inputRef.current?.focus(), 40);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setCreateOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (createRef.current && !createRef.current.contains(e.target)) setCreateOpen(false);
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target) &&
        !e.target.closest?.("[data-search-trigger]")
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goTo = (path, label) => {
    if (query.trim()) {
      setRecent(pushRecentSearch(query.trim()));
    } else if (label) {
      setRecent(pushRecentSearch(label));
    }
    navigate(path);
    setSearchOpen(false);
    setQuery("");
  };

  const applyQuery = (q) => {
    setQuery(q);
    setRecent(pushRecentSearch(q));
    inputRef.current?.focus();
  };

  const onSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      goTo(results[activeIndex].path, results[activeIndex].label);
    }
  };

  const savedActive = isSearchSaved(query);

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
      <div className="relative max-w-xl flex-1" ref={searchRef}>
        <button
          type="button"
          data-search-trigger
          onClick={() => {
            setSearchOpen(true);
            setTimeout(() => inputRef.current?.focus(), 40);
          }}
          className={`flex h-10 w-full items-center gap-2 rounded-md border border-border bg-muted px-3 text-left text-muted-foreground shadow-soft transition-colors duration-fast hover:border-primary/30 focus-ring ${
            searchOpen ? "border-primary/40 ring-2 ring-ring" : ""
          }`}
        >
          <Search className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {searchOpen ? (
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search pages, drivers, actions…"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/80"
              aria-label="Global search"
              aria-autocomplete="list"
              aria-controls="titan-search-results"
              role="combobox"
              aria-activedescendant={
                searchOpen && results[activeIndex] ? `titan-search-opt-${results[activeIndex].id}` : undefined
              }
              aria-expanded={searchOpen}
            />
          ) : (
            <span className="flex-1 truncate text-sm">Search Titan OS…</span>
          )}
          <kbd className="hidden items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-flex">
            <Command className="h-3 w-3" aria-hidden="true" />K
          </kbd>
        </button>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              id="titan-search-results"
              role="listbox"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,520px)] overflow-hidden rounded-lg border border-border bg-card shadow-lift"
            >
              {query.trim() && (
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <p className="truncate text-xs text-muted-foreground">
                    Results for <span className="font-semibold text-foreground">“{query}”</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSaved(toggleSavedSearch(query))}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 focus-ring"
                    aria-label={savedActive ? "Unsave search" : "Save search"}
                  >
                    {savedActive ? (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Bookmark className="h-3.5 w-3.5" />
                    )}
                    {savedActive ? "Saved" : "Save"}
                  </button>
                </div>
              )}

              <div className="max-h-[400px] overflow-y-auto">
                {showBrowse && (
                  <div className="space-y-3 p-3">
                    {recent.length > 0 && (
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Recent
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              clearRecentSearches();
                              setRecent([]);
                            }}
                            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {recent.slice(0, 6).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => applyQuery(r)}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-ring"
                            >
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {saved.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Saved searches
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {saved.slice(0, 6).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => applyQuery(r)}
                              className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 focus-ring"
                            >
                              <BookmarkCheck className="h-3 w-3" />
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Suggested
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => applyQuery(s)}
                            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <ul className="py-1.5">
                  {results.map((item, i) => (
                    <li key={item.id} role="option" id={`titan-search-opt-${item.id}`} aria-selected={i === activeIndex}>
                      <button
                        type="button"
                        onClick={() => goTo(item.path, item.label)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-fast ${
                          i === activeIndex ? "bg-muted" : "hover:bg-muted/70"
                        }`}
                      >
                        {item.icon ? (
                          <item.icon className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                        ) : (
                          <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {item.label}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {item.group}
                            {item.hint ? ` · ${item.hint}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {query.trim() && results.length === 0 && (
                    <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No matches for “{query}” — try another spelling
                    </li>
                  )}
                </ul>

                {query.trim() && (
                  <div className="border-t border-border bg-primary/5 px-3 py-2.5">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Sparkles className="h-3 w-3" /> AI tip
                    </p>
                    {aiTips.map((tip) => (
                      <p key={tip} className="text-xs text-foreground/90">
                        {tip}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
                ↑↓ navigate · Enter open · Esc close · typo-tolerant matching
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative" ref={createRef}>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          aria-expanded={createOpen}
          aria-haspopup="menu"
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-fast hover:bg-primary/90 hover:shadow-lift focus-ring btn-press"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Create</span>
        </button>
        <AnimatePresence>
          {createOpen && (
            <motion.div
              role="menu"
              initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
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
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors duration-fast hover:bg-muted focus-ring"
                >
                  <action.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {action.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <NotificationCenter />
        <UserProfileMenu />
      </div>
    </header>
  );
}
