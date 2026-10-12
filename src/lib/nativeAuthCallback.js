/** Safely map Android app links to the in-app OAuth callback without dropping token fragments. */
const ALLOWED_PARAMS = new Set([
  "code", "state", "error", "error_code", "error_description",
  "access_token", "refresh_token", "token_type", "expires_in", "type",
]);

export function nativeAuthCallbackRoute(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== "com.titanos.myapp:" || url.hostname !== "auth" || url.pathname !== "/callback") {
    return null;
  }

  const params = new URLSearchParams();
  const sources = [url.search.slice(1)];
  const fragment = url.hash.slice(1);
  if (fragment && !fragment.startsWith("/")) sources.push(fragment);
  for (const source of sources) {
    for (const [name, value] of new URLSearchParams(source)) {
      if (ALLOWED_PARAMS.has(name) && !params.has(name)) params.set(name, value);
    }
  }
  const result = params.toString();
  return result ? `/auth/callback?${result}` : "/auth/callback";
}
