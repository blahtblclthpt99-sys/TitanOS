import React, { Children, cloneElement, forwardRef, isValidElement, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const MAX = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

const FULL_PAGE_PREF_KEY = "titanos_page_full_view";

function readFullViewPref() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FULL_PAGE_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFullViewPref(next) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FULL_PAGE_PREF_KEY, next ? "1" : "0");
  } catch {
    /* ignore storage errors */
  }
}

function detailsBlock(rest, label = "More details") {
  return (
    <details className="rounded-xl border border-border bg-card/50 p-3" open={false}>
      <summary className="cursor-pointer text-sm font-semibold text-foreground">{label}</summary>
      <div className="mt-3 space-y-3">{rest}</div>
    </details>
  );
}

function collapseInsideContainer(node, visibleCount) {
  if (!isValidElement(node)) return node;
  if (node.props?.["data-no-essential-collapse"] || !(node.type === "div" || node.type === "section")) {
    return node;
  }
  const kids = Children.toArray(node.props.children);
  if (kids.length <= visibleCount + 1) return node;

  const head = kids.slice(0, visibleCount);
  const tail = kids.slice(visibleCount);
  const nextChildren = [...head, detailsBlock(tail, "More from this page")];
  return cloneElement(node, { ...node.props }, nextChildren);
}

/**
 * Standard page chrome — consistent padding, width, and bottom clearance
 * so every screen feels like one operating system, not unrelated pages.
 */
const PageShell = forwardRef(function PageShell(
  { children, maxWidth = "lg", className, dense = false, style, essentialFirst = true },
  ref
) {
  const [showFull, setShowFull] = useState(readFullViewPref);

  const renderedChildren = useMemo(() => {
    const nodes = Children.toArray(children);
    if (!essentialFirst || showFull || nodes.length === 0) return nodes;

    // Keep page identity/header first, then fold secondary detail while preserving export/report sections.
    if (nodes.length > 2) {
      const head = nodes.slice(0, 2);
      const tail = nodes.slice(2);
      return [...head, detailsBlock(tail)];
    }
    if (nodes.length === 1) {
      return [collapseInsideContainer(nodes[0], 2)];
    }
    return nodes;
  }, [children, essentialFirst, showFull]);

  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "page-pad mx-auto w-full overflow-x-hidden",
        dense ? "pb-24" : "pb-28 md:pb-10",
        MAX[maxWidth] || MAX.lg,
        className
      )}
    >
      {essentialFirst ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              const next = !showFull;
              setShowFull(next);
              writeFullViewPref(next);
            }}
            className="text-xs rounded-full border border-border bg-card/60 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            {showFull ? "Important only" : "Show full page"}
          </button>
        </div>
      ) : null}
      {renderedChildren}
    </div>
  );
});

export default PageShell;
