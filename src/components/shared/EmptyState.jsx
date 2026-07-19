import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function EmptyState({ icon: Icon, title, description, onAction, actionLabel }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 md:py-20 text-center px-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 shadow-soft">
        {Icon && <Icon className="w-8 h-8 text-primary" aria-hidden="true" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{description}</p>
      {onAction && (
        <Button onClick={onAction} className="gap-2">
          <Plus className="w-4 h-4" /> {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
