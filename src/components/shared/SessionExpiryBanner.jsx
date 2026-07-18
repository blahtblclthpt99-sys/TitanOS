import { Clock, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";

export default function SessionExpiryBanner() {
  const { isExpiringSoon, minutesRemaining, dismissed, dismiss, extendSession } =
    useSessionExpiry();

  if (!isExpiringSoon || dismissed) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[55] px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-3xl mx-auto glass border border-titan-amber/30 bg-titan-amber/10 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
        <Clock className="w-4 h-4 text-titan-amber flex-shrink-0" aria-hidden="true" />
        <p className="text-sm text-white flex-1">
          Your session expires in{" "}
          <span className="font-semibold text-titan-amber">
            {minutesRemaining} minute{minutesRemaining === 1 ? "" : "s"}
          </span>
          . Stay signed in to keep working.
        </p>
        <Button
          size="sm"
          onClick={extendSession}
          className="bg-titan-amber hover:bg-titan-amber/90 text-black font-semibold h-8 gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Stay signed in
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss session warning"
          className="text-white/40 hover:text-white transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
