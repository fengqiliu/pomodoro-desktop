import type { Task } from "./task";

/** A task taken out of the list, with what is needed to put it back in place. */
export interface RemovedTask {
  task: Task;
  /** Position in the list it was removed from. */
  index: number;
  /** Id of the task directly above it at removal time; null when it was first. */
  afterId: string | null;
}

/** Splits a list into the tasks to keep and undo records for the removed ones. */
export function splitTasks(
  tasks: Task[],
  shouldRemove: (task: Task) => boolean
): { kept: Task[]; removed: RemovedTask[] } {
  const kept: Task[] = [];
  const removed: RemovedTask[] = [];
  tasks.forEach((task, index) => {
    if (shouldRemove(task)) {
      removed.push({ task, index, afterId: index > 0 ? tasks[index - 1].id : null });
    } else {
      kept.push(task);
    }
  });
  return { kept, removed };
}

/**
 * Puts removed tasks back. Each goes directly below the task that was above it
 * (so tasks added meanwhile don't shift it); if that neighbour is gone too, or
 * it was first, it falls back to its old index. Records are applied top-down,
 * so neighbours removed together are restored before the tasks anchored to them.
 * Tasks already present are skipped, which makes a repeated undo harmless.
 */
export function restoreRemovedTasks(current: Task[], removed: RemovedTask[]): Task[] {
  const out = [...current];
  for (const r of [...removed].sort((a, b) => a.index - b.index)) {
    if (out.some((t) => t.id === r.task.id)) continue;
    const anchor = r.afterId === null ? -1 : out.findIndex((t) => t.id === r.afterId);
    const at = anchor >= 0 ? anchor + 1 : Math.min(r.index, out.length);
    out.splice(at, 0, r.task);
  }
  return out;
}
