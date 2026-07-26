import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Global offline banner — honest about what still works (device cache / local
 * writes). Does not claim a full cloud sync queue unless one exists.
 */
export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] bg-warning text-warning-foreground text-center text-xs font-semibold py-2 px-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      role="status"
      aria-live="polite"
    >
      You&apos;re offline. Device data and the app shell still work — reconnect to reach the cloud.
    </div>
  );
}
