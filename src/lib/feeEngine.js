/**
 * Client-safe Fee Engine surface.
 * Re-exports shared pure math. Payment amounts are ALWAYS recalculated on the server.
 */
export {
  calculateFees,
  formatFeePercent,
  pickSeedRule,
  resolvePercentageRate,
  roundMoney,
  FEE_SEED_RULES,
} from "../../shared/feeEngine.js";
