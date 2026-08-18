import { api } from "@/api/apiClient";
import { ensureFreshSession } from "@/lib/sessionRecovery";

export async function getWorkOpportunities() {
  await ensureFreshSession({ minValidityMs: 180_000 });
  const response = await api.functions.invoke("workOpportunities", {});
  return response?.data || {
    opportunities: [],
    needsProfile: true,
    discoveryMode: "broad",
    counts: { total: 0, strong: 0, customerRequests: 0, contracts: 0, interested: 0 },
  };
}
