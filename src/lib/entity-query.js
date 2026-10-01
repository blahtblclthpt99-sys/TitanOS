import { api } from "@/api/apiClient";

function indexEntityRowsLater(entity, rows) {
  if (typeof window === "undefined" || !Array.isArray(rows) || rows.length === 0) return;

  const run = () => {
    void import("@/lib/searchIndex")
      .then(({ ingestEntityRows }) => ingestEntityRows(entity, rows))
      .catch(() => {});
  };

  // Search indexing is best-effort derived work. Never make route data wait for
  // localStorage/index CPU before React Query can render the response.
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 0);
  }
}

export function entityQueryKey({ entity, method = "list", args = [] }) {
  return ["entity", entity, method, ...args];
}

export async function fetchEntity(descriptor) {
  const { entity, method = "list", args = [] } = descriptor;
  const rows = await api.entities[entity][method](...args);
  if ((method === "list" || method === "filter") && Array.isArray(rows)) {
    indexEntityRowsLater(entity, rows);
  }
  return rows;
}

export const ENTITY_STALE_TIME = 90_000;
