import { applyCors, handleOptions } from "../_lib/cors.js";

// Membership-gated Autopilot is retired. Autopilot is free for every signed-in
// TitanOS user in this release; stale clients must move to runAutopilotFree.
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  return res.status(410).json({
    error: "Titan Autopilot no longer requires a paid membership. Refresh TitanOS to use the free recovery sprint.",
    code: "AUTOPILOT_PAID_MEMBERSHIP_RETIRED",
  });
}
