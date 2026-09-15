import { applyCors, handleOptions } from "../_lib/cors.js";

// Titan Autopilot is free for this release. Keep this retired route briefly so
// stale clients cannot accidentally create a Stripe Checkout session.
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  return res.status(410).json({
    error: "Titan Autopilot is free now. Refresh TitanOS to use the free recovery sprint.",
    code: "AUTOPILOT_PAID_CHECKOUT_RETIRED",
  });
}
