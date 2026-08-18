import signupEmailsHandler from "../../api/signup-emails.js";
import { runVercelHandler } from "../_lib/vercelAdapter.js";

export function onRequest(context) {
  return runVercelHandler(signupEmailsHandler, context);
}
