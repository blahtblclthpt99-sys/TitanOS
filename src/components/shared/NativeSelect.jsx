/**
 * NativeSelect — mobile-native bottom-sheet picker, desktop dropdown.
 * Drop-in replacement for Radix Select in forms.
 *
 * Props:
 *   value, onValueChange, placeholder, options: [{value, label}]
 *   className (applied to trigger button)
 */
import React, { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle
} from "@/components/ui/drawer";

export default function NativeSelect({
  value,
  onValueChange,
  placeholder = "Select…",
  options = [],
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  const pick = (val) => {
    onValueChange(val);
    setOpen(false);
  };

  return (
    <>
      {/* Trigger — looks like a select input on all screen sizes */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex h-9 w-full items-center justify-between rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-[#00C7D9] ${className}`}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
      </button>

      {/* Bottom-sheet on mobile / centered modal feel on desktop */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border max-h-[70vh]">
          <DrawerHeader className="border-b border-border pb-3">
            <DrawerTitle className="text-foreground text-base">{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto py-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt.value)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm text-left hover:bg-muted active:bg-muted transition-colors capitalize"
              >
                <span className={opt.value === value ? "text-[#00C7D9] font-semibold" : "text-foreground"}>
                  {opt.label}
                </span>
                {opt.value === value && <Check className="w-4 h-4 text-[#00C7D9]" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}