import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getTokenExpiryDate } from "@/lib/jwt-utils";
import { readBooleanStorage, writeStorage } from "@/lib/storage";

const DISMISS_KEY = "titanos_session_warning_dismissed";
const WARNING_MINUTES = 5;
const POLL_MS = 60_000;

export function useSessionExpiry() {
  const { isAuthenticated, checkUserAuth } = useAuth();
  const [expiresAt, setExpiresAt] = useState(null);
  const [minutesRemaining, setMinutesRemaining] = useState(null);
  const [dismissed, setDismissed] = useState(() =>
    readBooleanStorage(DISMISS_KEY, false)
  );

  const refreshExpiry = useCallback(() => {
    setExpiresAt(getTokenExpiryDate());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setExpiresAt(null);
      setMinutesRemaining(null);
      return;
    }

    refreshExpiry();
    const interval = window.setInterval(refreshExpiry, POLL_MS);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, refreshExpiry]);

  useEffect(() => {
    if (!expiresAt) {
      setMinutesRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const diffMs = expiresAt.getTime() - Date.now();
      setMinutesRemaining(Math.max(0, Math.ceil(diffMs / 60_000)));
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 30_000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const isExpiringSoon =
    isAuthenticated &&
    minutesRemaining !== null &&
    minutesRemaining <= WARNING_MINUTES;

  const dismiss = () => {
    setDismissed(true);
    writeStorage(DISMISS_KEY, "true");
  };

  const extendSession = async () => {
    await checkUserAuth();
    setDismissed(false);
    writeStorage(DISMISS_KEY, "false");
    refreshExpiry();
  };

  useEffect(() => {
    if (!isExpiringSoon) {
      setDismissed(false);
      writeStorage(DISMISS_KEY, "false");
    }
  }, [isExpiringSoon]);

  return {
    isExpiringSoon,
    minutesRemaining,
    dismissed,
    dismiss,
    extendSession,
  };
}
