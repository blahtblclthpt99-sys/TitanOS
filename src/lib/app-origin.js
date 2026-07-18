/**
 * Public origin used for OAuth redirects.
 */
export function getAppOrigin() {
  const configured =
    import.meta.env.VITE_TITANOS_PUBLIC_ORIGIN ||
    import.meta.env.VITE_TITANOS_APP_URL;

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}
