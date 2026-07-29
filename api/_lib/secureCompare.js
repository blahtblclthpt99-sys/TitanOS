import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string compare for shared secrets.
 * Returns false if either side is empty.
 */
export function secretsEqual(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (!left.length || !right.length || left.length !== right.length) {
    return false;
  }
  try {
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
