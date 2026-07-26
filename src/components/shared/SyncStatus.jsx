import { DATA_SOURCE } from "@/lib/dataSource";
import { cn } from "@/lib/utils";

/**
 * Honest sync / offline-storage cue when data is device-local or stubbed.
 */
export default function SyncStatus({ source, className }) {
  if (source !== DATA_SOURCE.local && source !== DATA_SOURCE.stub) return null;

  const message =
    source === DATA_SOURCE.stub
      ? "Demo mode — not synced to the cloud yet."
      : "Saved on this device — sync when you’re back online.";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-xl border border-titan-amber/30 bg-titan-amber/10 px-3 py-2 text-xs font-medium text-foreground",
        className
      )}
    >
      {message}
    </div>
  );
}
