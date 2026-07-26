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

function resolveSelect(columns) {
  if (!columns) return "*";
  if (Array.isArray(columns)) return columns.join(",");
  return String(columns);
}

/** Hard ceiling so accidental unbounded list/filter cannot pull PostgREST max rows. */
export const DEFAULT_ENTITY_PAGE_SIZE = 100;
/** Absolute max — prefer DEFAULT; use only for rare bulk tools, never as “load all”. */
export const MAX_ENTITY_PAGE_SIZE = 500;
/** Preferred working-set size for dashboards / finances (scale default). */
export const PREFERRED_ENTITY_PAGE_SIZE = 100;

function resolvePageSize(limit) {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_ENTITY_PAGE_SIZE;
  }
  return Math.min(Math.floor(limit), MAX_ENTITY_PAGE_SIZE);
}

/**
 * Keyset cursor for descending time-ordered lists (created_at / scheduled_date / date).
 * Pass the last row’s sort-column value as `before` to fetch the next older page.
 * @param {string} sortColumn
 * @param {unknown} beforeValue
 */
export function buildBeforeCursor(sortColumn, beforeValue) {
  if (beforeValue == null || beforeValue === "") return {};
  return { [sortColumn]: { lt: beforeValue } };
}

/**
 * Support eq, in, and range operators used by scale-safe queries.
 * Examples: { status: "open" }, { status: { in: ["a","b"] } }, { created_at: { gt: iso } }
 */
function applyFilters(query, filters) {
  let next = query;
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      if (Array.isArray(value.in)) {
        if (value.in.length === 0) {
          next = next.eq(key, "__no_match__");
        } else {
          next = next.in(key, value.in);
        }
        continue;
      }
      if (value.gt != null) {
        next = next.gt(key, value.gt);
        continue;
      }
      if (value.gte != null) {
        next = next.gte(key, value.gte);
        continue;
      }
      if (value.lt != null) {
        next = next.lt(key, value.lt);
        continue;
      }
      if (value.lte != null) {
        next = next.lte(key, value.lte);
        continue;
      }
      if (value.is === null) {
        next = next.is(key, null);
        continue;
      }
    }
    next = next.eq(key, value);
  }
  return next;
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
  "founding_user",
  "founding_number",
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
      const pageSize = resolvePageSize(limit);
      const from = typeof skip === "number" && skip > 0 ? skip : 0;
      let query = supabase
        .from(table)
        .select(resolveSelect(columns))
        .order(column, { ascending })
        .range(from, from + pageSize - 1);
      const { data, error } = await query;
      throwIfError(error);
      return (data || []).map(toEntityRow);
    },

    async filter(filters, sort, limit, skip, columns) {
      const { column, ascending } = parseSort(sort);
      const pageSize = resolvePageSize(limit);
      const from = typeof skip === "number" && skip > 0 ? skip : 0;
      let query = applyFilters(supabase.from(table).select(resolveSelect(columns)), filters)
        .order(column, { ascending })
        .range(from, from + pageSize - 1);
      const { data, error } = await query;
      throwIfError(error);
      return (data || []).map(toEntityRow);
    },

    /**
     * Keyset page — prefer over large `skip` for deep history.
     * @param {Record<string, unknown>} filters
     * @param {string} sort e.g. "-created_date"
     * @param {number} limit
     * @param {{ before?: unknown }} [cursor] `before` = last row's sort field (descending lists)
     * @param {string|string[]} [columns]
     */
    async filterPage(filters, sort, limit, cursor = {}, columns) {
      const { column, ascending } = parseSort(sort);
      const pageSize = resolvePageSize(limit);
      const merged = { ...(filters || {}) };
      if (cursor?.before != null && cursor.before !== "") {
        merged[column] = ascending
          ? { gt: cursor.before }
          : { lt: cursor.before };
      }
      let query = applyFilters(supabase.from(table).select(resolveSelect(columns)), merged)
        .order(column, { ascending })
        .limit(pageSize);
      const { data, error } = await query;
      throwIfError(error);
      return (data || []).map(toEntityRow);
    },

    /** Cheap head count — prefer this over downloading rows for badges/unread. */
    async count(filters = {}) {
      let query = applyFilters(
        supabase.from(table).select("id", { count: "exact", head: true }),
        filters
      );
      const { count, error } = await query;
      throwIfError(error);
      return typeof count === "number" ? count : 0;
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
