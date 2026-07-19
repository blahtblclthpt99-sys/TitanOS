import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

/**
 * Confirm + delete helper. Returns true if deleted.
 */
export async function confirmDelete(label, deleteFn) {
  if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return false;
  await deleteFn();
  return true;
}

/**
 * Compact trash control for list/detail rows.
 */
export default function DeleteButton({
  label = "this item",
  onDelete,
  className,
  stopPropagation = true,
  successTitle = "Deleted",
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (busy) return;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await onDelete();
      toast({ title: successTitle });
    } catch (err) {
      toast({
        title: "Couldn't delete",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={cn(
        "p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px] inline-flex items-center justify-center disabled:opacity-50",
        className
      )}
      aria-label={`Delete ${label}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
