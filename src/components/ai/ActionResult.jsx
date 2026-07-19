import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function ActionResult({ message, isError = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] md:max-w-[65%] border ${
        isError ? "border-red-400/20 bg-red-400/5" : "border-emerald-400/20 bg-emerald-400/5"
      }`}
    >
      <div className="flex items-start gap-2">
        {isError
          ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          : <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        }
        <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none [&_p]:text-foreground/80 [&_strong]:text-foreground [&_p]:my-0.5 [&_li]:text-foreground/70">
          {message}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
}