// Phase value object of the Pomodoro timer context.

export type Phase = "focus" | "short" | "long";

/** Configured phase durations in minutes. */
export interface PhaseDurations {
  focus: number;
  short: number;
  long: number;
}

export function phaseMinutes(phase: Phase, durations: PhaseDurations): number {
  return phase === "focus" ? durations.focus : phase === "short" ? durations.short : durations.long;
}

/**
 * An interruption can be logged once a focus session has begun: while it runs,
 * or while it is paused part-way (the usual reaction to being interrupted).
 */
export function canLogInterruption(
  phase: Phase,
  running: boolean,
  secondsLeft: number,
  phaseSeconds: number
): boolean {
  return phase === "focus" && (running || secondsLeft < phaseSeconds);
}
