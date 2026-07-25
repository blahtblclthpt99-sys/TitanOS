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
    if (typeof value === "object" && !Array.isArray(value) && Array.isArray(value.in)) {
      if (value.in.length === 0) {
        // Empty IN should match nothing (PostgREST rejects empty .in())
        next = next.eq(key, "__no_match__");
      } else {
        next = next.in(key, value.in);
      }
      continue;
    }
    next = next.eq(key, value);
  }
  return next;
}

function resolveSelect(columns) {
  if (!columns) return "*";
  if (Array.isArray(columns)) return columns.join(",");
  return String(columns);
}

const WEBHOOK_ONLY_PAYMENT_STATUS = new Set(["succeeded", "refunded", "paid"]);
const PROFILE_SERVER_ONLY_KEYS = new Set([
  "role",
  "is_pro",
  "lifetime_premium",
  "paying_subscriber",
  "plan_tier",
  "account_type",
  "verified_worker",
  "verification_notes",
]);

/** Defense-in-depth: block money/privilege escalation via entity adapter (RLS/triggers are source of truth). */
function sanitizeClientUpdate(entityName, data) {
  const payload = { ...data };
  if (entityName === "Payment") {
    const status = String(payload.status || "").toLowerCase();
    if (WEBHOOK_ONLY_PAYMENT_STATUS.has(status)) {
      throw apiError(
        "Paid / refunded status is set only by the payment provider webhook.",
        403
      );
    }
  }
  if (entityName === "Invoice") {
    if (String(payload.status || "").toLowerCase() === "paid") {
      throw apiError(
        "Invoice paid status is set only by the payment provider webhook.",
        403
      );
    }
  }
  if (entityName === "Profile") {
    for (const key of PROFILE_SERVER_ONLY_KEYS) {
      delete payload[key];
    }
  }
  return payload;
}

function createEntityHandler(entityName) {
  const table = ENTITY_TABLES[entityName];
  if (!table) {
    throw new Error(`Unknown entity: ${entityName}`);
  }

  return {
    async list(sort, limit, skip, columns) {
      const { column, ascending } = parseSort(sort);
      let query = supabase.from(table).select(resolveSelect(columns)).order(column, { ascending });
      if (typeof limit === "number") {
        const from = typeof skip === "number" ? skip : 0;
        query = query.range(from, from + limit - 1);
      }
      const { data, error } = await query;
      throwIfError(error);
      return (data || []).map(toEntityRow);
    },

    async filter(filters, sort, limit, skip, columns) {
      const { column, ascending } = parseSort(sort);
      let query = applyFilters(supabase.from(table).select(resolveSelect(columns)), filters).order(
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

    async get(id, columns) {
      const { data, error } = await supabase
        .from(table)
        .select(resolveSelect(columns))
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
      const payload = sanitizeClientUpdate(entityName, stripMetaFields(data));
      const { data: row, error } = await supabase
        .from(table)
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      throwIfError(error);
      return toEntityRow(row);
    },

    /** Batch update by id list — one round-trip instead of N. */
    async updateMany(ids, data) {
      const unique = [...new Set((ids || []).filter(Boolean))];
      if (!unique.length) return [];
      const payload = sanitizeClientUpdate(entityName, stripMetaFields(data));
      const { data: rows, error } = await supabase
        .from(table)
        .update(payload)
        .in("id", unique)
        .select("*");
      throwIfError(error);
      return (rows || []).map(toEntityRow);
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
