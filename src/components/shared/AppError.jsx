import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  title = "Something went wrong",
  message = "This section failed to load. Try again.",
  onRetry,
  onHome,
  fullScreen = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 text-center ${
        fullScreen ? "min-h-screen bg-[#0A0A0B]" : "min-h-[50vh]"
      }`}
      role="alert"
    >
      <AlertTriangle className="w-10 h-10 text-red-400 mb-4" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
      <p className="text-sm text-white/50 mb-6 max-w-sm">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        )}
        {onHome && (
          <Button onClick={onHome} variant="outline" className="gap-2 border-white/10 text-white hover:bg-white/5">
            <Home className="w-4 h-4" />
            Go home
          </Button>
        )}
      </div>
    </div>
  );
}
