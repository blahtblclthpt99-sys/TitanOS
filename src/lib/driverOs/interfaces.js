/**
 * Driver OS public contracts (JSDoc).
 * UI and engines should agree on these shapes — keep Mission Control honest.
 */

/**
 * @typedef {Object} DriverSessionLike
 * @property {boolean} [active]
 * @property {boolean} [paused]
 * @property {string} [id]
 * @property {string} [started_at]
 * @property {string} [ended_at]
 * @property {string} [stop_phase] e.g. "at_stop"
 * @property {number} [drive_sec]
 * @property {number} [idle_sec]
 * @property {number} [miles]
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {string[]} [apps]
 */

/**
 * @typedef {Object} DoorDashDeliveryLike
 * @property {string} [status] e.g. "active" | "completed"
 * @property {string} [screen] DoorDash screen id from driverActivity
 * @property {string} [id]
 */

/**
 * @typedef {"off_shift"|"shift_active"|"at_stop"|"between_orders"|"dd_to_restaurant"|"dd_at_restaurant"|"dd_to_customer"|"dd_at_customer"} WorkflowPhaseId
 */

/**
 * @typedef {Object} MissionSnapshot
 * @property {string} userId
 * @property {DriverSessionLike|null} session
 * @property {DoorDashDeliveryLike|null} delivery
 * @property {WorkflowPhaseId} phase
 * @property {string} phaseLabel
 * @property {object|null} dash Shift dashboard numbers
 * @property {object} network
 * @property {object|null} battery
 * @property {string} [coachTip]
 * @property {object} [rush]
 * @property {object} [goals]
 */

/**
 * @typedef {Object} WorkflowResolveInput
 * @property {DriverSessionLike|null|undefined} [session]
 * @property {DoorDashDeliveryLike|null|undefined} [delivery]
 */

export {};
