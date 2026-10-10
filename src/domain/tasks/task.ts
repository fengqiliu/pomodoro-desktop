// Task entity and its domain operations. All functions are pure — they take
// the current task list and return a new one; identity generation is injected
// so the domain never touches IO or globals.

export type TaskCategory = "work" | "study" | "life" | "other";

export const TASK_CATEGORIES: TaskCategory[] = ["work", "study", "life", "other"];

export type TaskStatusFilter = "all" | "active" | "done";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  pomodoros: number;
  estimatedPomodoros?: number;
  category?: TaskCategory;
  completedAt?: string; // ISO 8601 string
}

export function createTask(
  title: string,
  generateId: () => string,
  estimatedPomodoros?: number,
  category?: TaskCategory
): Task {
  return {
    id: generateId(),
    title,
    done: false,
    pomodoros: 0,
    ...(estimatedPomodoros && estimatedPomodoros > 0
      ? { estimatedPomodoros: Math.floor(estimatedPomodoros) }
      : {}),
    ...(category ? { category } : {}),
  };
}

/** Prepend a new task (newest first, matching the UI's ordering). */
export function addTask(
  tasks: Task[],
  title: string,
  generateId: () => string,
  estimatedPomodoros?: number,
  category?: TaskCategory
): Task[] {
  return [createTask(title, generateId, estimatedPomodoros, category), ...tasks];
}

export function toggleTaskDone(tasks: Task[], id: string, now = new Date()): Task[] {
  return tasks.map((t) => {
    if (t.id !== id) return t;
    const nextDone = !t.done;
    return {
      ...t,
      done: nextDone,
      completedAt: nextDone ? now.toISOString() : undefined,
    };
  });
}

export function removeTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((t) => t.id !== id);
}

/** Renames a task. Disallows empty names. */
export function renameTask(tasks: Task[], id: string, newTitle: string): Task[] {
  const trimmed = newTitle.trim();
  if (!trimmed) return tasks;
  return tasks.map((t) => (t.id === id ? { ...t, title: trimmed } : t));
}

export function clearCompletedTasks(tasks: Task[]): Task[] {

  return tasks.filter((t) => !t.done);
}

/** A completed focus session feeds one pomodoro to the given (active) task. */
export function recordPomodoro(tasks: Task[], id: string | null): Task[] {
  if (id === null) return tasks;
  return tasks.map((t) => (t.id === id ? { ...t, pomodoros: t.pomodoros + 1 } : t));
}

/** Updates estimated pomodoros for a given task. */
export function updateTaskEstimate(
  tasks: Task[],
  id: string,
  estimatedPomodoros?: number
): Task[] {
  const sanitized =
    estimatedPomodoros && estimatedPomodoros > 0 ? Math.floor(estimatedPomodoros) : undefined;
  return tasks.map((t) => (t.id === id ? { ...t, estimatedPomodoros: sanitized } : t));
}

/** Pure reordering of a task by moving item from `fromIndex` to `toIndex`. */
export function reorderTask(tasks: Task[], fromIndex: number, toIndex: number): Task[] {
  if (
    fromIndex < 0 ||
    fromIndex >= tasks.length ||
    toIndex < 0 ||
    toIndex >= tasks.length ||
    fromIndex === toIndex
  ) {
    return tasks;
  }
  const result = [...tasks];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/** Returns formatted pomo progress string (e.g. "2/4" or "2" or ""). */
export function formatTaskProgress(task: Task): string {
  if (task.estimatedPomodoros && task.estimatedPomodoros > 0) {
    return `${task.pomodoros}/${task.estimatedPomodoros}`;
  }
  return task.pomodoros > 0 ? `${task.pomodoros}` : "";
}

/** Updates category for a given task. */
export function updateTaskCategory(
  tasks: Task[],
  id: string,
  category?: TaskCategory
): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, category } : t));
}

export interface TaskFilterOptions {
  status?: TaskStatusFilter;
  category?: TaskCategory | "all";
}

/** Pure filter function for tasks by status and category. */
export function filterTasks(tasks: Task[], filter: TaskFilterOptions): Task[] {
  return tasks.filter((t) => {
    if (filter.status === "active" && t.done) return false;
    if (filter.status === "done" && !t.done) return false;
    if (filter.category && filter.category !== "all" && t.category !== filter.category) {
      return false;
    }
    return true;
  });
}

export interface CategoryStat {
  count: number;
  pomodoros: number;
}

/** Aggregates tasks count and pomodoros grouped by category. */
export function calculateCategoryStats(
  tasks: Task[]
): Record<TaskCategory, CategoryStat> {
  const stats: Record<TaskCategory, CategoryStat> = {
    work: { count: 0, pomodoros: 0 },
    study: { count: 0, pomodoros: 0 },
    life: { count: 0, pomodoros: 0 },
    other: { count: 0, pomodoros: 0 },
  };
  for (const t of tasks) {
    if (t.category && stats[t.category]) {
      stats[t.category].count++;
      stats[t.category].pomodoros += t.pomodoros;
    }
  }
  return stats;
}


