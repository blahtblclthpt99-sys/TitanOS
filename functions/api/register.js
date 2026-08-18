import registerHandler from "../../api/register.js";
import { runVercelHandler } from "../_lib/vercelAdapter.js";

export function onRequest(context) {
  return runVercelHandler(registerHandler, context);
}
