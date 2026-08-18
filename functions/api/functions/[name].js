import { runVercelHandler } from "../../_lib/vercelAdapter.js";

// Keep Titan's existing /api/functions/<name> contract intact on Cloudflare.
// The old titanAI alias intentionally resolves to titanAILive.
const handlers = Object.freeze({
  accountDeletionRequest: () => import("../../../api/functions/accountDeletionRequest.js"),
  adminControl: () => import("../../../api/functions/adminControl.js"),
  adminFees: () => import("../../../api/functions/adminFees.js"),
  aiExecuteAction: () => import("../../../api/functions/aiExecuteAction.js"),
  analyticsIngest: () => import("../../../api/functions/analyticsIngest.js"),
  appVersion: () => import("../../../api/functions/appVersion.js"),
  attachReferral: () => import("../../../api/functions/attachReferral.js"),
  calculateFee: () => import("../../../api/functions/calculateFee.js"),
  contractShareToken: () => import("../../../api/functions/contractShareToken.js"),
  createAutopilotOrder: () => import("../../../api/functions/createAutopilotOrder.js"),
  createNotification: () => import("../../../api/functions/createNotification.js"),
  createPaymentLink: () => import("../../../api/functions/createPaymentLink.js"),
  createSubscriptionCheckout: () => import("../../../api/functions/createSubscriptionCheckout.js"),
  directionsOptimize: () => import("../../../api/functions/directionsOptimize.js"),
  disputeEngagementEvent: () => import("../../../api/functions/disputeEngagementEvent.js"),
  engagementBatch: () => import("../../../api/functions/engagementBatch.js"),
  engagementSnapshot: () => import("../../../api/functions/engagementSnapshot.js"),
  featureFlags: () => import("../../../api/functions/featureFlags.js"),
  googlePlayVerifySubscription: () => import("../../../api/functions/googlePlayVerifySubscription.js"),
  health: () => import("../../../api/functions/health.js"),
  jobMatches: () => import("../../../api/functions/jobMatches.js"),
  jobMatchesV2: () => import("../../../api/functions/jobMatchesV2.js"),
  leadDiscovery: () => import("../../../api/functions/leadDiscovery.js"),
  markReferralPaying: () => import("../../../api/functions/markReferralPaying.js"),
  paypalWebhook: () => import("../../../api/functions/paypalWebhook.js"),
  portalAcceptEstimate: () => import("../../../api/functions/portalAcceptEstimate.js"),
  portalGetData: () => import("../../../api/functions/portalGetData.js"),
  portalLeaveReview: () => import("../../../api/functions/portalLeaveReview.js"),
  portalPayInvoice: () => import("../../../api/functions/portalPayInvoice.js"),
  portalRequestOtp: () => import("../../../api/functions/portalRequestOtp.js"),
  portalVerifyOtp: () => import("../../../api/functions/portalVerifyOtp.js"),
  publicContract: () => import("../../../api/functions/publicContract.js"),
  receiptVisionOcr: () => import("../../../api/functions/receiptVisionOcr.js"),
  recordOpportunityResponse: () => import("../../../api/functions/recordOpportunityResponse.js"),
  runAutopilotMembership: () => import("../../../api/functions/runAutopilotMembership.js"),
  runAutopilotOrder: () => import("../../../api/functions/runAutopilotOrder.js"),
  seedMarketplace: () => import("../../../api/functions/seedMarketplace.js"),
  sendEmail: () => import("../../../api/functions/sendEmail.js"),
  sendFollowUp: () => import("../../../api/functions/sendFollowUp.js"),
  setAccountType: () => import("../../../api/functions/setAccountType.js"),
  setWorkspaces: () => import("../../../api/functions/setWorkspaces.js"),
  stripeCustomerPortal: () => import("../../../api/functions/stripeCustomerPortal.js"),
  stripeWebhook: () => import("../../../api/functions/stripeWebhook.js"),
  submitFeedback: () => import("../../../api/functions/submitFeedback.js"),
  subscriptionStatus: () => import("../../../api/functions/subscriptionStatus.js"),
  supportAI: () => import("../../../api/functions/supportAI.js"),
  supportAdminAssignCase: () => import("../../../api/functions/supportAdminAssignCase.js"),
  supportAgentGetCase: () => import("../../../api/functions/supportAgentGetCase.js"),
  supportAgentInbox: () => import("../../../api/functions/supportAgentInbox.js"),
  supportAgentReply: () => import("../../../api/functions/supportAgentReply.js"),
  supportAnalytics: () => import("../../../api/functions/supportAnalytics.js"),
  supportCreateCase: () => import("../../../api/functions/supportCreateCase.js"),
  supportEscalate: () => import("../../../api/functions/supportEscalate.js"),
  supportGetCase: () => import("../../../api/functions/supportGetCase.js"),
  supportIncidentAdmin: () => import("../../../api/functions/supportIncidentAdmin.js"),
  supportListCases: () => import("../../../api/functions/supportListCases.js"),
  supportPostMessage: () => import("../../../api/functions/supportPostMessage.js"),
  supportRefreshSubscription: () => import("../../../api/functions/supportRefreshSubscription.js"),
  supportRegisterAttachment: () => import("../../../api/functions/supportRegisterAttachment.js"),
  supportReopenCase: () => import("../../../api/functions/supportReopenCase.js"),
  supportSubmitCsat: () => import("../../../api/functions/supportSubmitCsat.js"),
  titanAI: () => import("../../../api/functions/titanAILive.js"),
  titanAICapabilities: () => import("../../../api/functions/titanAICapabilities.js"),
  titanAILive: () => import("../../../api/functions/titanAILive.js"),
  workOpportunities: () => import("../../../api/functions/workOpportunities.js"),
});

export async function onRequest(context) {
  const name = String(context.params?.name || "").trim();
  const load = handlers[name];
  if (!load) {
    return Response.json({ error: "Titan function not found" }, { status: 404 });
  }

  try {
    const module = await load();
    if (typeof module.default !== "function") {
      return Response.json({ error: "Titan function is unavailable" }, { status: 503 });
    }
    return await runVercelHandler(module.default, context);
  } catch (error) {
    console.error("[cloudflare:function]", name, error?.message || error);
    return Response.json({ error: "Titan service failed" }, { status: 500 });
  }
}
