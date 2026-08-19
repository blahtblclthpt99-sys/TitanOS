import { runVercelHandler } from "../../../_lib/vercelAdapter.js";
import handler from "../../../../api/functions/auth/register.js";

export function onRequest(context) {
  return runVercelHandler(handler, context);
}
