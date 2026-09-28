// Calendar helpers shared across bounded contexts. Pure, no IO.

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Calculates milliseconds from `now` until the next midnight (00:00:00.050).
 * The 50ms buffer ensures that once timer fires, new Date() is reliably on the new day.
 */
export function getMillisUntilNextMidnight(now = new Date(), bufferMs = 50): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, bufferMs);
  return Math.max(0, nextMidnight.getTime() - now.getTime());
}

