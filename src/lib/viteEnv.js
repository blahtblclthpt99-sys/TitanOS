/**
 * Read Vite/Node env safely (Node has no import.meta.env).
 */
export function readViteEnv() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env === "object") {
      return import.meta.env;
    }
  } catch {
    /* */
  }
  if (globalThis.__VITE_ENV__ && typeof globalThis.__VITE_ENV__ === "object") {
    return globalThis.__VITE_ENV__;
  }
  return process.env || {};
}

export function envString(key, fallback = "") {
  const v = readViteEnv()[key];
  if (v == null || v === "") return fallback;
  return String(v);
}

export function envFlag(key) {
  const v = envString(key, "");
  return v === "true" || v === "1";
}

export function isViteDev() {
  return Boolean(readViteEnv().DEV);
}

export function isViteProd() {
  const e = readViteEnv();
  return Boolean(e.PROD) || e.MODE === "production";
}
