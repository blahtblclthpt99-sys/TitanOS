const TOKEN_KEYS = ["titanos_access_token", "token"];

export function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export function parseJwtExpiry(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (!payload?.exp) return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

export function getTokenExpiryDate() {
  return parseJwtExpiry(getStoredAccessToken());
}
