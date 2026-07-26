/**
 * Correlate API requests — prefer inbound X-Request-Id, else mint one.
 */
import { randomUUID } from "node:crypto";

export function resolveRequestId(req) {
  const inbound =
    req?.headers?.["x-request-id"] ||
    req?.headers?.["x-correlation-id"] ||
    req?.headers?.["x-titanos-request-id"];
  if (inbound && typeof inbound === "string" && inbound.trim().length >= 6) {
    return inbound.trim().slice(0, 64);
  }
  return randomUUID().slice(0, 12);
}

export function applyRequestIdHeader(res, requestId) {
  try {
    if (res && !res.headersSent) {
      res.setHeader("X-Request-Id", String(requestId));
    }
  } catch {
    /* */
  }
}
