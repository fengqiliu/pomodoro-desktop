import type { Phase } from "./phase";

export interface FocusCycleResult {
  nextPhase: "short" | "long";
  cycleFocusCount: number;
}

function positiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

// `cycleFocusCount` is the number of completed focus sessions since the last
// long break. It intentionally survives a date change: the Pomodoro rhythm is
// separate from a calendar day's statistics.
export function completeFocusCycle(
  cycleFocusCount: number,
  longEvery: number
): FocusCycleResult {
  const interval = positiveInteger(longEvery, 1);
  const completedInCycle = Math.max(0, Math.floor(cycleFocusCount)) + 1;

  if (completedInCycle >= interval) {
    return { nextPhase: "long", cycleFocusCount: 0 };
  }

  return { nextPhase: "short", cycleFocusCount: completedInCycle };
}

export function nextPhaseAfterCompletedBreak(): "focus" {
  return "focus";
}

// Skipping moves through the UI without recording a completed focus session,
// so it cannot advance the long-break cycle.
export function nextPhaseAfterSkip(phase: Phase): Phase {
  return phase === "focus" ? "short" : "focus";
}

export function focusesUntilLongBreak(cycleFocusCount: number, longEvery: number): number {
  const interval = positiveInteger(longEvery, 1);
  const completedInCycle = Math.max(0, Math.floor(cycleFocusCount));
  return Math.max(1, interval - (completedInCycle % interval));
}
