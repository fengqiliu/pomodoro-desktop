// Wall-clock countdown math: derive whole remaining seconds from an absolute
// end timestamp so interval jitter / background throttling can't drift the timer.
//
// `ceil` (not `round`) matters twice over: the display keeps the last partial
// second visible instead of jumping to 00:00 early, and the browser fallback's
// `remaining <= 0` completion check now only fires once the deadline is truly
// reached — matching the native timer's wall-clock semantics. `pauseCountdown`
// already uses `Math.ceil` on the native snapshot for the same reason.
export function remainingSeconds(endAt: number, now: number): number {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
