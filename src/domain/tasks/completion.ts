export type CompletionLabel =
  | { kind: "today"; time: string }
  | { kind: "yesterday"; time: string }
  | { kind: "date"; year?: number; month: number; day: number };

const pad = (n: number) => String(n).padStart(2, "0");

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Turns a task's `completedAt` timestamp into a calendar-relative label in local
 * time: today / yesterday (by calendar day) with HH:MM, otherwise month + day,
 * adding the year only when it differs from `now`'s. Wording is left to i18n.
 */
export function describeCompletion(
  completedAt: string | undefined,
  now = new Date()
): CompletionLabel | null {
  if (!completedAt) return null;
  const done = new Date(completedAt);
  if (Number.isNaN(done.getTime())) return null;

  const time = `${pad(done.getHours())}:${pad(done.getMinutes())}`;
  if (sameDay(done, now)) return { kind: "today", time };

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(done, yesterday)) return { kind: "yesterday", time };

  const label: CompletionLabel = { kind: "date", month: done.getMonth() + 1, day: done.getDate() };
  if (done.getFullYear() !== now.getFullYear()) label.year = done.getFullYear();
  return label;
}
