import { api } from "@/api/apiClient";
import { readLocal, uid, writeLocal } from "@/lib/localStore";

const MEMBERS = "titanos_loyalty_members";
const EVENTS = "titanos_loyalty_events";

const membersLocal = (userId) => readLocal(MEMBERS, userId, "all", []);
const saveMembers = (userId, rows) => writeLocal(MEMBERS, userId, "all", rows);
const eventsLocal = (userId) => readLocal(EVENTS, userId, "all", []);
const saveEvents = (userId, rows) => writeLocal(EVENTS, userId, "all", rows);

export function tierForPoints(points) {
  if (points >= 2000) return "platinum";
  if (points >= 1000) return "gold";
  if (points >= 400) return "silver";
  return "bronze";
}

export async function listLoyaltyMembers(userId) {
  try {
    return await api.entities.LoyaltyMember.filter({ user_id: userId }, "-created_date");
  } catch {
    return membersLocal(userId);
  }
}

export async function createLoyaltyMember(user, values) {
  const points = Number(values.points || 0);
  const row = {
    points,
    tier: tierForPoints(points),
    ...values,
    user_id: user.id,
    created_by_id: user.id,
  };
  try {
    return await api.entities.LoyaltyMember.create(row);
  } catch {
    const item = { id: uid(), created_at: new Date().toISOString(), ...row };
    saveMembers(user.id, [item, ...membersLocal(user.id)]);
    return item;
  }
}

export async function awardPoints(user, member, delta, reason = "Job completed") {
  const points = Math.max(0, Number(member.points || 0) + Number(delta));
  const tier = tierForPoints(points);
  let updated;
  try {
    updated = await api.entities.LoyaltyMember.update(member.id, { points, tier });
  } catch {
    updated = { ...member, points, tier };
    saveMembers(user.id, membersLocal(user.id).map((m) => (m.id === member.id ? updated : m)));
  }
  const event = {
    member_id: member.id,
    points_delta: Number(delta),
    reason,
    source: "manual",
    user_id: user.id,
    created_by_id: user.id,
  };
  try {
    await api.entities.LoyaltyEvent.create(event);
  } catch {
    saveEvents(user.id, [{ id: uid(), created_at: new Date().toISOString(), ...event }, ...eventsLocal(user.id)]);
  }
  return updated;
}

export async function deleteLoyaltyMember(userId, id) {
  try {
    await api.entities.LoyaltyMember.delete(id);
  } catch {
    saveMembers(userId, membersLocal(userId).filter((m) => m.id !== id));
  }
}
