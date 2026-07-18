import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { normalizeAppPath } from "@/lib/routing";

/**
 * Fixes first-load paths like /index.html inside Capacitor WebViews.
 */
export default function PathNormalizer({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const normalized = normalizeAppPath(location.pathname);
    if (normalized !== location.pathname) {
      navigate(`${normalized}${location.search}${location.hash}`, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return children;
}
