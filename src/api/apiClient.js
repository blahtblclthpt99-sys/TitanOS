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

export const api = createTitanApi();
