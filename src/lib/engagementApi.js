import { api } from "@/api/apiClient";

export async function getEngagementSnapshot({ subjectUserId, opportunityId } = {}) {
  const response = await api.functions.invoke("engagementSnapshot", {
    ...(subjectUserId ? { subject_user_id: subjectUserId } : {}),
    ...(opportunityId ? { opportunity_id: opportunityId } : {}),
  });
  return response?.data || null;
}

export async function getEngagementBatch({ subjectUserIds = [], opportunityId } = {}) {
  const response = await api.functions.invoke("engagementBatch", {
    subject_user_ids: subjectUserIds,
    opportunity_id: opportunityId,
  });
  return response?.data?.snapshots || {};
}

export async function disputeEngagementEvent(eventId, reason) {
  const response = await api.functions.invoke("disputeEngagementEvent", {
    event_id: eventId,
    reason,
  });
  return response?.data || null;
}
