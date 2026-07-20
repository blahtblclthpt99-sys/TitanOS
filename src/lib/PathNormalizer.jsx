import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { normalizeAppPath } from "@/lib/routing";

/**
 * Fixes first-load paths like /index.html inside Capacitor WebViews,
 * and sends OAuth returns on `/` to `/auth/callback` for a clear signing-in UI
 * (session exchange also runs in main.jsx / oauthBootstrap).
 */
export default function PathNormalizer({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasOAuthPayload =
      params.has("code") ||
      params.has("access_token") ||
      (params.has("error") && (params.has("error_description") || params.get("error") === "access_denied"));

    const path = normalizeAppPath(location.pathname);
    const onCallback = path === "/auth/callback" || path === "/reset-password";

    // Prefer callback route for visible progress; bootstrap may already have exchanged.
    if (hasOAuthPayload && !onCallback) {
      navigate(`/auth/callback${location.search}`, { replace: true });
      return;
    }

    if (path !== location.pathname) {
      navigate(`${path}${location.search}${location.hash}`, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return children;
}
