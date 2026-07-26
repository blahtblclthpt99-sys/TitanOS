import { randomUUID } from "node:crypto";
import { logError, redactValue } from "./safeLog.js";
import { captureApiException } from "./sentry.js";
import { applyRequestIdHeader, resolveRequestId } from "./requestId.js";
import { alertProductionFailure } from "./opsAlert.js";

/**
 * Domain error with a public, non-leaky message for API clients.
 */
export class AppError extends Error {
  /**
   * @param {string} publicMessage
   * @param {{ status?: number, code?: string, cause?: unknown, category?: string }} [opts]
   */
  constructor(publicMessage, opts = {}) {
    super(publicMessage);
    this.name = "AppError";
    this.status = opts.status || 400;
    this.code = opts.code || "APP_ERROR";
    this.category = opts.category || "app";
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

/**
 * Map unexpected failures to a safe client payload.
 * Always logs + captures; never returns raw err.message for 5xx.
 *
 * @param {import('http').ServerResponse} res
 * @param {unknown} err
 * @param {{
 *   route: string,
 *   category?: string,
 *   publicMessage?: string,
 *   publicCode?: string,
 *   status?: number,
 *   extra?: Record<string, unknown>,
 * }} opts
 */
export function sendApiError(res, err, opts) {
  const route = opts.route || "api";
  const category = opts.category || "api";
  const requestId =
    (opts.requestId && String(opts.requestId)) ||
    (opts.req ? resolveRequestId(opts.req) : randomUUID().slice(0, 8));
  applyRequestIdHeader(res, requestId);

  const isApp = err instanceof AppError || (err && err.name === "AppError");
  const status =
    opts.status ||
    (isApp && Number(err.status)) ||
    (err && Number(err.status)) ||
    500;

  const safeStatus = Number.isFinite(status) && status >= 400 && status < 600 ? status : 500;

  const code =
    opts.publicCode ||
    (isApp && err.code) ||
    (safeStatus === 401
      ? "UNAUTHORIZED"
      : safeStatus === 403
        ? "FORBIDDEN"
        : safeStatus === 404
          ? "NOT_FOUND"
          : safeStatus === 429
            ? "RATE_LIMITED"
            : "INTERNAL_ERROR");

  const publicMessage =
    opts.publicMessage ||
    (isApp && err.message) ||
    (safeStatus === 401
      ? "Sign in required"
      : safeStatus === 403
        ? "Not allowed"
        : safeStatus === 404
          ? "Not found"
          : safeStatus === 429
            ? "Too many requests. Try again shortly."
            : "Something went wrong. Please try again.");

  logError(`${category}:${route}`, err, redactValue({ ...(opts.extra || {}), requestId, code }));
  captureApiException(err, {
    tags: { route, category, code, requestId },
    extra: redactValue(opts.extra || {}),
  });

  if (safeStatus >= 500) {
    void alertProductionFailure({
      title: publicMessage,
      severity: "critical",
      route,
      category,
      requestId,
      detail: code,
    });
  }

  return res.status(safeStatus).json({
    error: publicMessage,
    code,
    requestId,
  });
}

/** Safe 4xx for known PostgREST / validation failures — no raw DB text. */
export function sendDbClientError(res, dbError, opts) {
  const msg = String(dbError?.message || "").toLowerCase();
  let publicMessage = opts.publicMessage || "Request could not be completed";
  let code = opts.publicCode || "REQUEST_INVALID";
  let status = opts.status || 400;

  if (/duplicate|unique|already exists/i.test(msg)) {
    publicMessage = opts.duplicateMessage || "That record already exists";
    code = "DUPLICATE";
    status = 409;
  } else if (/foreign key|violates|not-null|check constraint/i.test(msg)) {
    publicMessage = opts.constraintMessage || "Invalid or incomplete data";
    code = "CONSTRAINT";
  } else if (/permission|rls|policy/i.test(msg)) {
    publicMessage = "Not allowed";
    code = "FORBIDDEN";
    status = 403;
  }

  logError(`${opts.category || "api"}:${opts.route}`, dbError, { code });
  return res.status(status).json({ error: publicMessage, code });
}
