export const CAREER_PIPELINE_STAGES = Object.freeze([
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "closed",
]);

const TRACKABLE_STATES = new Set([...CAREER_PIPELINE_STAGES, "ignored"]);

export function isTrackableCareerState(state) {
  return TRACKABLE_STATES.has(String(state || ""));
}

export function canTransitionCareerState(currentState, nextState) {
  const current = String(currentState || "");
  const next = String(nextState || "");

  if (!isTrackableCareerState(next)) return false;
  if (!current) return true;
  if (!isTrackableCareerState(current)) return false;
  if (current === next) return true;

  // Ignore is a search preference, not an application-stage destination.
  // A previously ignored opportunity may be restored by explicitly saving or applying it.
  if (current === "ignored") return next === "saved" || next === "applied";
  if (next === "ignored") return current === "saved";

  const currentIndex = CAREER_PIPELINE_STAGES.indexOf(current);
  const nextIndex = CAREER_PIPELINE_STAGES.indexOf(next);
  if (currentIndex < 0 || nextIndex < 0) return false;

  // Pipeline history is monotonic. Seekers may skip irrelevant stages, but a
  // completed/advanced application cannot silently regress to an earlier stage.
  return nextIndex > currentIndex;
}

export function assertCareerStateTransition(currentState, nextState) {
  if (!canTransitionCareerState(currentState, nextState)) {
    throw new Error("Application stage cannot move backward or use an invalid transition.");
  }
  return String(nextState);
}

export function availableCareerStageTransitions(currentState) {
  const current = String(currentState || "saved");
  return CAREER_PIPELINE_STAGES.filter((stage) => canTransitionCareerState(current, stage));
}
