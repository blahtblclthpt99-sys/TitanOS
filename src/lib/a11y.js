/**
 * Accessibility helpers — keyboard activation, live announcements, contrast sync.
 */

/** Enter / Space → activate (for role=button / role=link custom controls) */
export function onActivateKey(event, callback) {
  if (!callback) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback(event);
  }
}

/** Props for a keyboard-activatable non-native control */
export function activatableProps({ onActivate, label, role = "button" }) {
  return {
    role,
    tabIndex: 0,
    "aria-label": label,
    onKeyDown: (e) => onActivateKey(e, onActivate),
    onClick: onActivate,
  };
}

let liveRegion;

function ensureLiveRegion() {
  if (typeof document === "undefined") return null;
  if (liveRegion && document.body.contains(liveRegion)) return liveRegion;
  liveRegion = document.createElement("div");
  liveRegion.setAttribute("role", "status");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.className = "sr-only";
  document.body.appendChild(liveRegion);
  return liveRegion;
}

/** Announce a short message to screen readers */
export function announce(message, { assertive = false } = {}) {
  const node = ensureLiveRegion();
  if (!node || !message) return;
  node.setAttribute("aria-live", assertive ? "assertive" : "polite");
  node.textContent = "";
  // Force a DOM change so SR re-reads
  requestAnimationFrame(() => {
    node.textContent = String(message);
  });
}

/** Whether OS requests more contrast */
export function systemPrefersContrast() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-contrast: more)").matches;
  } catch {
    return false;
  }
}
