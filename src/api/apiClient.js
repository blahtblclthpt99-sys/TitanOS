import { createAuthModule } from "./auth";
import { createEntitiesModule } from "./entityAdapter";
import { createFunctionsModule } from "./functions";
import { createIntegrationsModule } from "./integrations";
import { isSupabaseConfigured } from "./supabaseClient";

export function createTitanApi() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local"
    );
  }

  return {
    auth: createAuthModule(),
    entities: createEntitiesModule(),
    functions: createFunctionsModule(),
    integrations: createIntegrationsModule(),
  };
}

let _api;

/** Lazy so unit tests can import modules that reference `api` without forcing a live client. */
export const api = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!_api) _api = createTitanApi();
      const value = _api[prop];
      return typeof value === "function" ? value.bind(_api) : value;
    },
  }
);
