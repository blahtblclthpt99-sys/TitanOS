import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, AlertCircle, Undo2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { safeMarkdownComponents } from "@/components/ai/safeMarkdown";

export default function ActionResult({
  message,
  isError = false,
  onRollback = null,
  rollbackLabel = "Rollback",
  rollbackLoading = false,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`titan-surface rounded-bl-md px-4 py-3 max-w-[85%] md:max-w-[65%] border ${
        isError ? "border-red-400/20 bg-red-400/5" : "border-emerald-400/20 bg-emerald-400/5"
      }`}
      role={isError ? "alert" : "status"}
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <ReactMarkdown
          components={safeMarkdownComponents}
          className="text-sm prose prose-sm dark:prose-invert max-w-none [&_p]:text-foreground [&_strong]:text-foreground [&_p]:my-0.5 [&_li]:text-foreground/90"
        >
          {message}
        </ReactMarkdown>
      </div>
      {!isError && typeof onRollback === "function" ? (
        <div className="mt-3 border-t border-border/70 pt-2.5">
          <button
            type="button"
            onClick={onRollback}
            disabled={rollbackLoading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
          >
            {rollbackLoading ? (
              <div className="h-3.5 w-3.5 rounded-full border-2 border-foreground/25 border-t-foreground animate-spin" />
            ) : (
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {rollbackLabel}
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}
