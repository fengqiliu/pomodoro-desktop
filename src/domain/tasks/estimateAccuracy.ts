import type { Task } from "./task";

export type EstimateBias = "underestimate" | "overestimate" | "accurate";

export interface EstimateAccuracy {
  /** Finished, timed tasks that had a positive estimate. */
  sampleCount: number;
  /** Sum of those tasks' estimates, in pomodoros. */
  estimated: number;
  /** Sum of the pomodoros actually spent on them. */
  actual: number;
  /** Tasks that took more / fewer / exactly as many pomodoros as estimated. */
  over: number;
  under: number;
  exact: number;
  /** (actual − estimated) / estimated, rounded; positive = tasks took longer than estimated. */
  biasPercent: number;
  bias: EstimateBias;
}

/** Deviations within ±this many percent still count as an accurate estimate. */
export const ACCURATE_BIAS_PERCENT = 15;

/**
 * Compares estimates with actual pomodoros over finished tasks. Ignored: open
 * tasks (their count is still growing), tasks without an estimate, and tasks
 * with 0 pomodoros — those were ticked off without the timer, so 0 means "not
 * tracked", not "took no time".
 */
export function calculateEstimateAccuracy(tasks: Task[]): EstimateAccuracy {
  let sampleCount = 0;
  let estimated = 0;
  let actual = 0;
  let over = 0;
  let under = 0;
  let exact = 0;

  for (const t of tasks) {
    const estimate = t.estimatedPomodoros ?? 0;
    if (!t.done || estimate <= 0 || t.pomodoros <= 0) continue;
    sampleCount += 1;
    estimated += estimate;
    actual += t.pomodoros;
    if (t.pomodoros > estimate) over += 1;
    else if (t.pomodoros < estimate) under += 1;
    else exact += 1;
  }

  const biasPercent = estimated > 0 ? Math.round(((actual - estimated) / estimated) * 100) : 0;
  const bias: EstimateBias =
    Math.abs(biasPercent) <= ACCURATE_BIAS_PERCENT
      ? "accurate"
      : biasPercent > 0
        ? "underestimate"
        : "overestimate";

  return { sampleCount, estimated, actual, over, under, exact, biasPercent, bias };
}
