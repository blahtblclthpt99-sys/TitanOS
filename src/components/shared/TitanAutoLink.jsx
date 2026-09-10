import React from "react";
import { Link } from "react-router";
import { Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";

export function buildTitanAutoUrl({ source, workflow, contextId } = {}) {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (workflow) params.set("workflow", workflow);
  if (contextId) params.set("context", String(contextId));
  const query = params.toString();
  return `/titan-auto${query ? `?${query}` : ""}`;
}

export default function TitanAutoLink({
  source,
  workflow,
  contextId,
  label = "Titan Auto",
  variant = "outline",
  size = "sm",
  className = "",
}) {
  return (
    <Button asChild type="button" variant={variant} size={size} className={className}>
      <Link to={buildTitanAutoUrl({ source, workflow, contextId })}>
        <Workflow className="h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}
