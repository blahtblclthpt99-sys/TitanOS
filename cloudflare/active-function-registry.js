import accountDeletionRequest from "../api/functions/accountDeletionRequest.js";
import adminControl from "../api/functions/adminControl.js";
import adminFees from "../api/functions/adminFees.js";
import analyticsIngest from "../api/functions/analyticsIngest.js";
import appVersion from "../api/functions/appVersion.js";
import attachReferral from "../api/functions/attachReferral.js";
import createAutopilotOrder from "../api/functions/createAutopilotOrder.js";
import createNotification from "../api/functions/createNotification.js";
import createPaymentLink from "../api/functions/createPaymentLink.js";
import directionsOptimize from "../api/functions/directionsOptimize.js";
import featureFlags from "../api/functions/featureFlags.js";
import installMarketplaceModule from "../api/functions/installMarketplaceModule.js";
import jobMatchesV2 from "../api/functions/jobMatchesV2.js";
import markReferralPaying from "../api/functions/markReferralPaying.js";
import portalAcceptEstimate from "../api/functions/portalAcceptEstimate.js";
import portalGetData from "../api/functions/portalGetData.js";
import portalLeaveReview from "../api/functions/portalLeaveReview.js";
import portalPayInvoice from "../api/functions/portalPayInvoice.js";
import portalRequestOtp from "../api/functions/portalRequestOtp.js";
import portalVerifyOtp from "../api/functions/portalVerifyOtp.js";
import receiptVisionOcr from "../api/functions/receiptVisionOcr.js";
import runAutopilotMembership from "../api/functions/runAutopilotMembership.js";
import runAutopilotOrder from "../api/functions/runAutopilotOrder.js";
import sendFollowUp from "../api/functions/sendFollowUp.js";
import submitFeedback from "../api/functions/submitFeedback.js";
import supportAgentGetCase from "../api/functions/supportAgentGetCase.js";
import supportAgentInbox from "../api/functions/supportAgentInbox.js";
import supportAgentReply from "../api/functions/supportAgentReply.js";
import supportAI from "../api/functions/supportAI.js";
import supportCreateCase from "../api/functions/supportCreateCase.js";
import supportEscalate from "../api/functions/supportEscalate.js";
import supportGetCase from "../api/functions/supportGetCase.js";
import supportListCases from "../api/functions/supportListCases.js";
import supportPostMessage from "../api/functions/supportPostMessage.js";
import supportRefreshSubscription from "../api/functions/supportRefreshSubscription.js";
import supportRegisterAttachment from "../api/functions/supportRegisterAttachment.js";
import supportReopenCase from "../api/functions/supportReopenCase.js";
import supportSubmitCsat from "../api/functions/supportSubmitCsat.js";
import titanAI from "../api/functions/titanAI.js";
import register from "../api/register.js";
import signupEmails from "../api/signup-emails.js";

export const ACTIVE_FUNCTION_REGISTRY = Object.freeze({
  accountDeletionRequest,
  adminControl,
  adminFees,
  analyticsIngest,
  appVersion,
  attachReferral,
  createAutopilotOrder,
  createNotification,
  createPaymentLink,
  directionsOptimize,
  featureFlags,
  installMarketplaceModule,
  jobMatchesV2,
  markReferralPaying,
  portalAcceptEstimate,
  portalGetData,
  portalLeaveReview,
  portalPayInvoice,
  portalRequestOtp,
  portalVerifyOtp,
  receiptVisionOcr,
  runAutopilotMembership,
  runAutopilotOrder,
  sendFollowUp,
  submitFeedback,
  supportAgentGetCase,
  supportAgentInbox,
  supportAgentReply,
  supportAI,
  supportCreateCase,
  supportEscalate,
  supportGetCase,
  supportListCases,
  supportPostMessage,
  supportRefreshSubscription,
  supportRegisterAttachment,
  supportReopenCase,
  supportSubmitCsat,
  titanAI,
});

export const ACTIVE_TOP_LEVEL_API_REGISTRY = Object.freeze({
  "/api/register": register,
  "/api/signup-emails": signupEmails,
});

export const ACTIVE_FUNCTION_NAMES = Object.freeze(Object.keys(ACTIVE_FUNCTION_REGISTRY).sort());
export const ACTIVE_TOP_LEVEL_API_PATHS = Object.freeze(Object.keys(ACTIVE_TOP_LEVEL_API_REGISTRY).sort());

export function getActiveFunctionHandler(name) {
  if (typeof name !== "string" || !/^[A-Za-z0-9_-]+$/.test(name)) return null;
  return ACTIVE_FUNCTION_REGISTRY[name] || null;
}

export function getActiveTopLevelApiHandler(pathname) {
  if (typeof pathname !== "string") return null;
  return ACTIVE_TOP_LEVEL_API_REGISTRY[pathname] || null;
}
