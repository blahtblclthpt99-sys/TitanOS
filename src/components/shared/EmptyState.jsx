import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function EmptyState({ icon: Icon, title, description, onAction, actionLabel }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-white/20" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-white/40 max-w-sm mb-6">{description}</p>
      {onAction && (
        <Button
          onClick={onAction}
          className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl gap-2"
        >
          <Plus className="w-4 h-4" /> {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}