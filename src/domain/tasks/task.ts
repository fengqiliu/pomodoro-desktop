// Task entity and its domain operations. All functions are pure — they take
// the current task list and return a new one; identity generation is injected
// so the domain never touches IO or globals.

export interface Task {
  id: string;
  title: string;
  done: boolean;
  pomodoros: number;
}

export function createTask(title: string, generateId: () => string): Task {
  return { id: generateId(), title, done: false, pomodoros: 0 };
}

/** Prepend a new task (newest first, matching the UI's ordering). */
export function addTask(tasks: Task[], title: string, generateId: () => string): Task[] {
  return [createTask(title, generateId), ...tasks];
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
