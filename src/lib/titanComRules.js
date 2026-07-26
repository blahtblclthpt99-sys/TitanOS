/** Pure TitanCom channel rules (no Supabase / Vite aliases). */

/** End of local calendar day (channel remake deadline for free users). */
export function endOfLocalDayIso(from = new Date()) {
  const d = new Date(from);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function isChannelExpired(channel, now = Date.now()) {
  if (!channel?.expires_at) return false;
  const t = Date.parse(channel.expires_at);
  return Number.isFinite(t) && t < now;
}

export function isChannelAdmin(channel, userId) {
  if (!channel || !userId) return false;
  if (channel.custom || channel.admin_id || channel.created_by_id) {
    return String(channel.admin_id || channel.created_by_id) === String(userId);
  }
  return false;
}
