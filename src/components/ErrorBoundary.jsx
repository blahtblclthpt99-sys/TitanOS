import React from "react";
import AppError from "@/components/shared/AppError";
import { captureException } from "@/lib/sentry";

const CHUNK_RELOAD_KEY = "titanos-chunk-reload";

function isChunkLoadError(error) {
  const msg = String(error?.message || error || "");
  return (
    error?.name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

async function purgeShellCaches() {
  try {
    if (typeof caches !== "undefined" && caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("titanos-shell")).map((k) => caches.delete(k))
      );
    }
  } catch {
    /* ignore */
  }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
    captureException(error, {
      tags: { boundary: "ErrorBoundary" },
      extra: { componentStack: info?.componentStack },
    });

    // After a deploy, stale tabs often fail on missing hashed chunks — one hard reload usually fixes it.
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          purgeShellCaches().finally(() => {
            window.location.reload();
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  componentDidUpdate(prevProps) {
    // Allow parent `key` changes or explicit resetToken to clear a trapped error state
    if (this.state.hasError && prevProps.resetToken !== this.props.resetToken) {
      this.setState({ hasError: false });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <AppError
          title="Something went wrong"
          message={this.props.message ?? "This section failed to load. Try again."}
          onRetry={this.handleRetry}
          onHome={this.props.showHome ? this.handleHome : undefined}
          fullScreen={this.props.fullScreen}
        />
      );
    }
    return this.props.children;
  }
}
