// Wall-clock countdown math: derive whole remaining seconds from an absolute
// end timestamp so interval jitter / background throttling can't drift the timer.

export function remainingSeconds(endAt: number, now: number): number {
  return Math.max(0, Math.round((endAt - now) / 1000));
}
