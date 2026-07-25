/**
 * Temporary verification route for Sentry Node.js setup.
 * Enable with SENTRY_DEBUG_ROUTE=1, then GET/POST /api/functions/sentryDebug
 */
import { applyCors, handleOptions } from "../_lib/cors.js";
import {
  isApiSentryEnabled,
  isApiSentryProfilingEnabled,
  Sentry,
} from "../_lib/sentry.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  if (String(process.env.SENTRY_DEBUG_ROUTE || "") !== "1") {
    return res.status(404).json({ error: "Not found" });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isApiSentryEnabled()) {
    return res.status(503).json({
      ok: false,
      message: "SENTRY_DSN (or VITE_SENTRY_DSN) is not set — nothing will be sent.",
      sentryEnabled: false,
    });
  }

  try {
    // Intentionally undefined — ReferenceError for setup verification
    foo();
  } catch (e) {
    Sentry.captureException(e);
  }

  try {
    await Sentry.flush(2000);
  } catch {
    /* ignore */
  }

  return res.status(200).json({
    ok: true,
    message: "Test exception sent. Check Sentry Issues within ~30s.",
    sentryEnabled: true,
    profilingEnabled: isApiSentryProfilingEnabled(),
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
  });
}
