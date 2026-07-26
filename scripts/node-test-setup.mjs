/**
 * Node test bootstrap: Vite aliases + browser shims (localStorage, document).
 * Usage: node --import ./scripts/node-test-setup.mjs --test …
 */
import { register } from "node:module";

register("./node-alias-hooks.mjs", import.meta.url);

  globalThis.__VITE_ENV__ = {
  MODE: "test",
  DEV: false,
  PROD: true,
  SSR: false,
  BASE_URL: "/",
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || "public-anon-placeholder-for-tests",
  VITE_TITANOS_PUBLIC_ORIGIN: process.env.VITE_TITANOS_PUBLIC_ORIGIN || "https://titanos-web.vercel.app",
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || "https://titanos-web.vercel.app",
};

for (const [k, v] of Object.entries(globalThis.__VITE_ENV__)) {
  if (process.env[k] == null) process.env[k] = String(v);
}

/** Minimal localStorage for Node. */
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(String(key)) ? map.get(String(key)) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
    key(i) {
      return [...map.keys()][i] ?? null;
    },
    get length() {
      return map.size;
    },
  };
}

if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = createMemoryStorage();
}

if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}

if (typeof globalThis.document === "undefined") {
  const classList = {
    _set: new Set(),
    toggle(name, force) {
      if (force === true) this._set.add(name);
      else if (force === false) this._set.delete(name);
      else if (this._set.has(name)) this._set.delete(name);
      else this._set.add(name);
    },
    contains(name) {
      return this._set.has(name);
    },
    add(name) {
      this._set.add(name);
    },
    remove(name) {
      this._set.delete(name);
    },
  };
  globalThis.document = {
    documentElement: {
      classList,
      style: {},
      dataset: {},
    },
    body: { appendChild() {}, removeChild() {} },
    createElement() {
      return {
        style: {},
        click() {},
        setAttribute() {},
        remove() {},
      };
    },
    getElementById() {
      return null;
    },
  };
}

if (typeof globalThis.matchMedia === "undefined") {
  globalThis.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
}

if (typeof globalThis.Blob === "undefined") {
  globalThis.Blob = class Blob {
    constructor(parts = [], opts = {}) {
      this.parts = parts;
      this.type = opts.type || "";
    }
  };
}

if (typeof globalThis.URL === "undefined" || typeof globalThis.URL.createObjectURL !== "function") {
  const Base = globalThis.URL || class URL {};
  if (!globalThis.URL) globalThis.URL = Base;
  globalThis.URL.createObjectURL = () => "blob:test";
  globalThis.URL.revokeObjectURL = () => {};
}

if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.randomUUID) {
  globalThis.crypto = {
    ...(globalThis.crypto || {}),
    randomUUID: () => `test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
}

if (typeof globalThis.CustomEvent === "undefined") {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
}

if (typeof globalThis.window.dispatchEvent !== "function") {
  globalThis.window.dispatchEvent = () => true;
  globalThis.window.addEventListener = () => {};
  globalThis.window.removeEventListener = () => {};
}
