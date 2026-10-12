/** Scrub one-time OAuth credentials from browser and Capacitor hash-router URLs. */
const OAUTH_PARAMETER_NAMES = [
  "code", "state", "error", "error_code", "error_description",
  "access_token", "refresh_token", "token_type", "expires_in",
  "expires_at", "provider_token", "provider_refresh_token",
];

function stripAuthParameters(value) {
  const params = new URLSearchParams(value);
  for (const name of OAUTH_PARAMETER_NAMES) params.delete(name);
  return params.toString();
}

export function cleanedOAuthCallbackUrl(href) {
  const url = new URL(href);
  for (const name of OAUTH_PARAMETER_NAMES) url.searchParams.delete(name);

  let hash = url.hash.replace(/^#/, "");
  if (hash.startsWith("/")) {
    const questionMark = hash.indexOf("?");
    if (questionMark !== -1) {
      const route = hash.slice(0, questionMark);
      const query = stripAuthParameters(hash.slice(questionMark + 1));
      hash = route + (query ? "?" + query : "");
    }
  } else if (hash.includes("=")) {
    hash = stripAuthParameters(hash);
  }

  // HashRouter needs the original document path; never rewrite it to /auth/callback.
  const pathname = url.pathname === "/auth/callback" ? "/" : url.pathname;
  return pathname + url.search + (hash ? "#" + hash : "");
}
