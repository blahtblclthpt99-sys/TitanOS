import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] bg-titan-amber text-black text-center text-xs font-semibold py-2 px-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      role="status"
      aria-live="polite"
    >
      You&apos;re offline. Some features may be unavailable until your connection returns.
    </div>
  );
}
