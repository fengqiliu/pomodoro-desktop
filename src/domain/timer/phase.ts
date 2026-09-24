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
