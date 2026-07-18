export function readStorage(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode errors
  }
}

export function readBooleanStorage(key, fallback = false) {
  const value = readStorage(key);
  if (value === null) return fallback;
  return value === "true";
}
