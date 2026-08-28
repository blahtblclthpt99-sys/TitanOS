/* OAuth may return to /?code=…; forward before React boots. */
(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname || "/";
    const isAuthDestination = path === "/auth/callback" || path === "/reset-password";
    const hasAuthResult =
      params.has("code") ||
      params.has("access_token") ||
      params.get("error") === "access_denied" ||
      params.has("error_description");

    if (!isAuthDestination && hasAuthResult) {
      window.location.replace(`/auth/callback${window.location.search}${window.location.hash}`);
    }
  } catch {
    // React auth handling remains the fallback if URL parsing is unavailable.
  }
})();
