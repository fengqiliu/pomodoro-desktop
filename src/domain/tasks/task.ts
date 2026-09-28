// Task entity and its domain operations. All functions are pure — they take
// the current task list and return a new one; identity generation is injected
// so the domain never touches IO or globals.

export interface Task {
  id: string;
  title: string;
  done: boolean;
  pomodoros: number;
  estimatedPomodoros?: number;
}

export function createTask(
  title: string,
  generateId: () => string,
  estimatedPomodoros?: number
): Task {
  return {
    id: generateId(),
    title,
    done: false,
    pomodoros: 0,
    ...(estimatedPomodoros && estimatedPomodoros > 0
      ? { estimatedPomodoros: Math.floor(estimatedPomodoros) }
      : {}),
  };
}

/** Prepend a new task (newest first, matching the UI's ordering). */
export function addTask(
  tasks: Task[],
  title: string,
  generateId: () => string,
  estimatedPomodoros?: number
): Task[] {
  return [createTask(title, generateId, estimatedPomodoros), ...tasks];
}

export function toggleTaskDone(tasks: Task[], id: string): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function removeTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((t) => t.id !== id);
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

