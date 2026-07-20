/**
 * NativeSelect — mobile bottom-sheet picker, desktop drawer.
 * Matches Input / SelectTrigger height and field chrome.
 */
import React, { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export default function NativeSelect({
  value,
  onValueChange,
  placeholder = "Select…",
  options = [],
  className = "",
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const pick = (val) => {
    onValueChange(val);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel || placeholder}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex h-11 min-h-[44px] w-full items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/40",
          className
        )}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" aria-hidden="true" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border max-h-[70vh] rounded-t-lg">
          <DrawerHeader className="border-b border-border pb-3">
            <DrawerTitle className="text-foreground text-base">{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div
            className="overflow-y-auto py-2"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            role="listbox"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => pick(opt.value)}
                className="w-full flex items-center justify-between min-h-[48px] px-5 py-3 text-sm text-left hover:bg-muted active:bg-muted transition-colors capitalize focus-ring"
              >
                <span className={opt.value === value ? "text-primary font-semibold" : "text-foreground"}>
                  {opt.label}
                </span>
                {opt.value === value && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
