/** Framer-motion props for staggered list rows — no-op when reduced motion is on. */
export function listItemMotion(reduceMotion, index = 0) {
  if (reduceMotion) {
    return {
      initial: false,
      animate: { opacity: 1 },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: Math.min(index * 0.03, 0.3) },
  };
}

export function hoverLiftMotion(reduceMotion) {
  if (reduceMotion) return {};
  return {
    whileHover: { y: -2, transition: { duration: 0.15 } },
    whileTap: { scale: 0.98, transition: { duration: 0.1 } },
  };
}

/** Subtle card/list press without framer — use with PRESSABLE class. */
export const CARD_PRESS =
  "titan-surface-interactive transition-transform duration-fast ease-out active:scale-[0.99]";
