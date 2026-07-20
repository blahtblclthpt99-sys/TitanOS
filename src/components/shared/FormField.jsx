import React, { useId } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * FormField — label + control + optional hint/error with a11y wiring.
 */
export default function FormField({
  label,
  id,
  children,
  className,
  error,
  hint,
  required,
  ...inputProps
}) {
  const generatedId = useId();
  const fieldId = id ?? inputProps.id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const control = children
    ? React.isValidElement(children)
      ? React.cloneElement(children, {
          id: children.props.id ?? fieldId,
          "aria-invalid": error ? true : children.props["aria-invalid"],
          "aria-describedby":
            [children.props["aria-describedby"], describedBy].filter(Boolean).join(" ") ||
            undefined,
          className: cn(
            children.props.className,
            error && "border-destructive focus-visible:ring-destructive"
          ),
        })
      : children
    : (
      <Input
        {...inputProps}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required ?? inputProps.required}
        className={cn(
          "bg-muted border-border text-foreground rounded-md",
          error && "border-destructive focus-visible:ring-destructive",
          inputProps.className
        )}
      />
    );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={fieldId} className="text-foreground/80 text-xs font-semibold">
          {label}
          {required ? <span className="text-destructive ml-0.5" aria-hidden="true">*</span> : null}
        </Label>
      )}
      {control}
      {error ? (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
