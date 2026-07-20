/**
 * Saved + favorite drivers — device-local until a backend table exists.
 * Favorites = shortlist for quick hire; Saved = bookmarked for later.
 */

const FAV_KEY = "titanos_driver_favorites_v1";
const SAVED_KEY = "titanos_driver_saved_v1";

function scopeKey(base, userId) {
  return userId ? `${base}:${userId}` : base;
}

function readIds(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeIds(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify([...new Set(ids)].slice(0, 200)));
  } catch {
    /* ignore quota */
  }
}

export function listFavoriteDriverIds(userId) {
  return readIds(scopeKey(FAV_KEY, userId));
}

export function listSavedDriverIds(userId) {
  return readIds(scopeKey(SAVED_KEY, userId));
}

export function isFavoriteDriver(userId, driverId) {
  if (!driverId) return false;
  return listFavoriteDriverIds(userId).includes(driverId);
}

export function isSavedDriver(userId, driverId) {
  if (!driverId) return false;
  return listSavedDriverIds(userId).includes(driverId);
}

/** @returns {boolean} true if now favorited */
export function toggleFavoriteDriver(userId, driverId) {
  if (!driverId) return false;
  const key = scopeKey(FAV_KEY, userId);
  const ids = listFavoriteDriverIds(userId);
  const idx = ids.indexOf(driverId);
  if (idx >= 0) {
    ids.splice(idx, 1);
    writeIds(key, ids);
    return false;
  }
  ids.unshift(driverId);
  writeIds(key, ids);
  return true;
}

/** @returns {boolean} true if now saved */
export function toggleSavedDriver(userId, driverId) {
  if (!driverId) return false;
  const key = scopeKey(SAVED_KEY, userId);
  const ids = listSavedDriverIds(userId);
  const idx = ids.indexOf(driverId);
  if (idx >= 0) {
    ids.splice(idx, 1);
    writeIds(key, ids);
    return false;
  }
  ids.unshift(driverId);
  writeIds(key, ids);
  return true;
}
