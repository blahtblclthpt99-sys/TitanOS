/** Shared admin role checks for nav gating. */
export function isUserAdmin(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.is_admin === true) return true;
  if (user.app_metadata?.role === "admin") return true;
  return false;
}
