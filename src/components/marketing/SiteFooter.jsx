import { Link } from "react-router-dom";
import TitanMark from "@/components/brand/TitanMark";

/**
 * Shared marketing footer — Privacy + Terms always present and public.
 */
export default function SiteFooter({ className = "" }) {
  return (
    <footer className={`border-t border-border px-4 py-8 ${className}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <TitanMark className="h-6 w-6" />© {new Date().getFullYear()} TitanOS
        </span>
        <nav className="-mx-2 flex flex-wrap gap-x-1 gap-y-1" aria-label="Legal and site links">
          <Link to="/download" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:text-foreground focus-ring">
            Download
          </Link>
          <Link to="/beta" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:text-foreground focus-ring">
            Beta
          </Link>
          <Link to="/privacy-policy" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:text-foreground focus-ring">
            Privacy Policy
          </Link>
          <Link to="/terms" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:text-foreground focus-ring">
            Terms of Service
          </Link>
          <Link to="/login" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:text-foreground focus-ring">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
