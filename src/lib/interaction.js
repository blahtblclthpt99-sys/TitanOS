/**
 * Shared press / toast helpers for consistent microinteractions.
 * Motion: ≤200ms, honor reduce-motion via CSS (.btn-press kill-switch).
 */
import { toast } from "@/components/ui/use-toast";

/** Apply to raw buttons/chips/cards that are not using <Button /> */
export const PRESSABLE =
  "btn-press transition-[transform,box-shadow] duration-fast ease-out " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 select-none";

export function toastDone(title, description, opts = {}) {
  return toast.success(title, description, opts);
}

export function toastFail(title, description, opts = {}) {
  return toast.error(title, description, opts);
}

export function toastInfo(title, description, opts = {}) {
  return toast.info(title, description, opts);
}
