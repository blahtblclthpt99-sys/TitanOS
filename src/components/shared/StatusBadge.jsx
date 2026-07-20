import React from "react";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONES } from "@/lib/design-system";
import { cn } from "@/lib/utils";

/**
 * Domain status → semantic Badge tone (jobs, invoices, customers, estimates).
 */
export default function StatusBadge({ status, className, label: labelProp }) {
  const key = String(status || "").toLowerCase();
  const tone = STATUS_TONES[key] || "muted";
  const label = labelProp ?? (status ? String(status).replace(/_/g, " ") : "—");

  return (
    <Badge variant={tone} className={cn("capitalize", className)}>
      {label}
    </Badge>
  );
}
