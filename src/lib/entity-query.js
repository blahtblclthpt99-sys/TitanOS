import { api } from "@/api/apiClient";
import { ingestEntityRows } from "@/lib/searchIndex";

export function entityQueryKey({ entity, method = "list", args = [] }) {
  return ["entity", entity, method, ...args];
}

export async function fetchEntity(descriptor) {
  const { entity, method = "list", args = [] } = descriptor;
  const rows = await api.entities[entity][method](...args);
  if ((method === "list" || method === "filter") && Array.isArray(rows)) {
    try {
      ingestEntityRows(entity, rows);
    } catch {
      /* search index is best-effort */
    }
  }
  return rows;
}

export const ENTITY_STALE_TIME = 90_000;
