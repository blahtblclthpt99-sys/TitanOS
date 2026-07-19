import React, { useId } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * FormField — reusable label + input wrapper used in all dialogs.
 * Pass `id` to wire label/htmlFor when using custom children.
 */
export default function FormField({ label, id, children, className, ...inputProps }) {
  const generatedId = useId();
  const fieldId = id ?? inputProps.id ?? generatedId;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <Label htmlFor={fieldId} className="text-foreground/80 text-xs font-semibold">
          {label}
        </Label>
      )}
      {children
        ? React.isValidElement(children)
          ? React.cloneElement(children, { id: children.props.id ?? fieldId })
          : children
        : (
          <Input
            {...inputProps}
            id={fieldId}
            className="bg-muted border-border text-foreground rounded-xl focus:ring-1 focus:ring-titan-cyan/40"
          />
        )}
    </div>
  );
}
