import { api } from "@/api/apiClient";

export function entityQueryKey({ entity, method = "list", args = [] }) {
  return ["entity", entity, method, ...args];
}

export function fetchEntity(descriptor) {
  const { entity, method = "list", args = [] } = descriptor;
  return api.entities[entity][method](...args);
}

export const ENTITY_STALE_TIME = 60_000;
