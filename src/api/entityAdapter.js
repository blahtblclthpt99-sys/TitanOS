import { supabase } from "./supabaseClient";
import {
  ENTITY_TABLES,
  parseSort,
  stripMetaFields,
  toEntityRow,
} from "./entityTables";

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function throwIfError(error, status = 400) {
  if (!error) return;
  if (error.code === "PGRST116") {
    throw apiError("Not found", 404);
  }
  throw apiError(error.message || "Request failed", status);
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error, 401);
  return data.user?.id ?? null;
}

function applyFilters(query, filters) {
  let next = query;
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null) continue;
    next = next.eq(key, value);
  }
  return next;
}

function createEntityHandler(entityName) {
  const table = ENTITY_TABLES[entityName];
  if (!table) {
    throw new Error(`Unknown entity: ${entityName}`);
  }

  return {
    async list(sort, limit, skip) {
      const { column, ascending } = parseSort(sort);
      let query = supabase.from(table).select("*").order(column, { ascending });
      if (typeof limit === "number") {
        const from = typeof skip === "number" ? skip : 0;
        query = query.range(from, from + limit - 1);
      }
      const { data, error } = await query;
      throwIfError(error);
      return (data || []).map(toEntityRow);
    },

    async filter(filters, sort, limit, skip) {
      const { column, ascending } = parseSort(sort);
      let query = applyFilters(supabase.from(table).select("*"), filters).order(
        column,
        { ascending }
      );
      if (typeof limit === "number") {
        const from = typeof skip === "number" ? skip : 0;
        query = query.range(from, from + limit - 1);
      }
      const { data, error } = await query;
      throwIfError(error);
      return (data || []).map(toEntityRow);
    },

    async get(id) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      throwIfError(error);
      if (!data) throw apiError("Not found", 404);
      return toEntityRow(data);
    },

    async create(data) {
      // Public marketing forms (beta signup/feedback) may run while logged out
      let userId = null;
      try {
        userId = await currentUserId();
      } catch {
        userId = null;
      }
      const payload = {
        ...stripMetaFields(data),
        created_by_id: userId,
      };
      const { data: row, error } = await supabase
        .from(table)
        .insert(payload)
        .select("*")
        .single();
      throwIfError(error);
      return toEntityRow(row);
    },

    async update(id, data) {
      const payload = stripMetaFields(data);
      const { data: row, error } = await supabase
        .from(table)
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      throwIfError(error);
      return toEntityRow(row);
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      throwIfError(error);
      return { success: true };
    },
  };
}

export function createEntitiesModule() {
  return new Proxy(
    {},
    {
      get(_target, entityName) {
        if (typeof entityName !== "string" || entityName === "then") {
          return undefined;
        }
        return createEntityHandler(entityName);
      },
    }
  );
}
