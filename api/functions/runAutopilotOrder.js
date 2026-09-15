import { applyCors, handleOptions } from "../_lib/cors.js";

// Paid Autopilot orders are retired. Existing Recovery Receipts remain in the
// audit trail, but no payment-backed execution path is available in this release.
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  return res.status(410).json({
    error: "Paid Titan Autopilot runs are retired. Refresh TitanOS to use the free recovery sprint.",
    code: "AUTOPILOT_PAID_RUN_RETIRED",
  });
}
