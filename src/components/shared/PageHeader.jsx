import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function PageHeader({ title, subtitle, onAdd, addLabel = "Add New" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between mb-6"
    >
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-white/40 mt-1">{subtitle}</p>}
      </div>
      {onAdd && (
        <Button
          onClick={onAdd}
          className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl gap-2"
        >
          <Plus className="w-4 h-4" /> {addLabel}
        </Button>
      )}
    </motion.div>
  );
}