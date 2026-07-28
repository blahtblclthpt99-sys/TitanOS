import { sanitizeAiInput, assertAllowedAiAction, publicAiError } from "../../src/lib/ai/policy.js";

export default async function handler(req, res) {
  try {
    const { user } = await auth(req, res);

    const safe = sanitizeAiInput(req.body || {});
    assertAllowedAiAction(safe.action);

    const result = await model(safe);
    // Ensure only safe.message and safe.pageContext are used.

    return res.status(200).json({ ok: true, result });
  } catch (err) {
    const safeErr = publicAiError(err);
    return res.status(400).json({ ok: false, error: safeErr });
  }
}