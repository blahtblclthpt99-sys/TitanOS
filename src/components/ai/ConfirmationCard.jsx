import React from "react";
import { motion } from "framer-motion";
import { Check, X, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function ConfirmationCard({ summary, details = [], onConfirm, onCancel, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="glass rounded-2xl rounded-bl-md overflow-hidden border border-titan-cyan/20 max-w-[85%] md:max-w-[65%]"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-titan-cyan/5 border-b border-titan-cyan/10">
        <Zap className="w-3.5 h-3.5 text-titan-cyan flex-shrink-0" />
        <span className="text-xs font-semibold text-titan-cyan uppercase tracking-wider">Action Required</span>
      </div>

      {/* Summary */}
      <div className="px-4 pt-3 pb-1">
        <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none [&_strong]:text-foreground [&_p]:text-foreground [&_p]:my-0">
          {summary}
        </ReactMarkdown>
      </div>

      {/* Details */}
      {details.length > 0 && (
        <div className="px-4 py-3 space-y-1.5 border-t border-border mt-2">
          {details.map((line, i) => (
            <ReactMarkdown key={i} className="text-xs prose prose-sm prose-invert max-w-none [&_strong]:text-foreground/90 [&_p]:text-muted-foreground [&_p]:my-0">
              {line}
            </ReactMarkdown>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 border-t border-border">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl bg-titan-cyan hover:bg-titan-cyan/90 text-black text-sm font-semibold transition-all disabled:opacity-40"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <><Check className="w-4 h-4" /> Confirm</>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex items-center justify-center gap-1 px-4 h-9 rounded-xl bg-muted hover:bg-muted text-muted-foreground hover:text-foreground text-sm font-medium transition-all disabled:opacity-40"
        >
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>
    </motion.div>
  );
}