import React from "react";
import { LifeBuoy } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

export default function TitanSupportButton() {
  const navigate = useNavigate();
  const location = useLocation();
  if (location.pathname === "/support") return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/support")}
      aria-label="Open Titan Support"
      title="Titan Support"
      className="fixed right-4 z-40 inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-lift transition-colors hover:bg-muted focus-ring md:bottom-5"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 9.75rem)" }}
    >
      <LifeBuoy className="h-5 w-5 text-primary" aria-hidden="true" />
      <span className="hidden sm:inline">Support</span>
    </button>
  );
}
