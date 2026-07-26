/**
 * Driver OS — thin workflow engine facade.
 * Unifies shift session + DoorDash stages; does not replace doorDashWorkflow / driverHubApi.
 */
import { DD_EVENT, DD_SCREENS, DD_STAGE_META } from "@/lib/driverActivity/doorDashWorkflow.js";

export const WORKFLOW_EVENT = "titanos-driver-workflow";
export const DRIVER_SESSION_EVENT = "titanos-driver-session";

/** High-level workflow phases shown in Mission Control / digests. */
export const WORKFLOW_PHASE = Object.freeze({
  OFF_SHIFT: "off_shift",
  SHIFT_ACTIVE: "shift_active",
  AT_STOP: "at_stop",
  BETWEEN_ORDERS: "between_orders",
  DD_TO_RESTAURANT: "dd_to_restaurant",
  DD_AT_RESTAURANT: "dd_at_restaurant",
  DD_TO_CUSTOMER: "dd_to_customer",
  DD_AT_CUSTOMER: "dd_at_customer",
});

export function emitWorkflow(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WORKFLOW_EVENT, { detail }));
}

/**
 * Resolve current workflow phase from mission-like inputs.
 * @param {import("./interfaces.js").WorkflowResolveInput} [input]
 * @returns {import("./interfaces.js").WorkflowPhaseId}
 */
export function resolveWorkflowPhase({ session, delivery } = {}) {
  const screen = delivery?.status === "active" ? delivery.screen : null;
  if (screen === DD_SCREENS.TO_RESTAURANT) return WORKFLOW_PHASE.DD_TO_RESTAURANT;
  if (screen === DD_SCREENS.AT_RESTAURANT) return WORKFLOW_PHASE.DD_AT_RESTAURANT;
  if (screen === DD_SCREENS.TO_CUSTOMER) return WORKFLOW_PHASE.DD_TO_CUSTOMER;
  if (screen === DD_SCREENS.AT_CUSTOMER) return WORKFLOW_PHASE.DD_AT_CUSTOMER;
  if (!session?.active) return WORKFLOW_PHASE.OFF_SHIFT;
  if (session.stop_phase === "at_stop") return WORKFLOW_PHASE.AT_STOP;
  if (session.paused) return WORKFLOW_PHASE.BETWEEN_ORDERS;
  return WORKFLOW_PHASE.SHIFT_ACTIVE;
}

export function phaseLabel(phase) {
  const map = {
    [WORKFLOW_PHASE.OFF_SHIFT]: "Off shift",
    [WORKFLOW_PHASE.SHIFT_ACTIVE]: "En route",
    [WORKFLOW_PHASE.AT_STOP]: "At stop",
    [WORKFLOW_PHASE.BETWEEN_ORDERS]: "Between orders",
    [WORKFLOW_PHASE.DD_TO_RESTAURANT]: DD_STAGE_META[DD_SCREENS.TO_RESTAURANT]?.label,
    [WORKFLOW_PHASE.DD_AT_RESTAURANT]: DD_STAGE_META[DD_SCREENS.AT_RESTAURANT]?.label,
    [WORKFLOW_PHASE.DD_TO_CUSTOMER]: DD_STAGE_META[DD_SCREENS.TO_CUSTOMER]?.label,
    [WORKFLOW_PHASE.DD_AT_CUSTOMER]: DD_STAGE_META[DD_SCREENS.AT_CUSTOMER]?.label,
  };
  return map[phase] || "Live";
}

/** Re-export event names so callers have one import surface. */
export const ENGINE_EVENTS = Object.freeze({
  workflow: WORKFLOW_EVENT,
  session: DRIVER_SESSION_EVENT,
  doordash: DD_EVENT,
});
