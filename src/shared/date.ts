// Calendar helpers shared across bounded contexts. Pure, no IO.

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
