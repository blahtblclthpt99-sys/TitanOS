import { runVercelHandler } from "../../../_lib/vercelAdapter.js";
import handler from "../../../../api/functions/auth/me.js";

export function onRequest(context) {
  return runVercelHandler(handler, context);
}
