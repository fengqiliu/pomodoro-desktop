import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import {
  addTask as prependTask,
  renameTask as updateTaskTitle,
  reorderTask,
  restoreRemovedTasks,
  splitTasks,
  toggleTaskDone,
  updateTaskCategory,
  updateTaskEstimate,
  type RemovedTask,
  type Task,
  type TaskCategory,
} from "../../domain/tasks";
import type { ToastAction } from "./useToast";

interface Options {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  /** shows the "deleted · Undo" toast; omitted → deletions are silent */
  showToast?: (key: string, action?: ToastAction, params?: Record<string, string | number>) => void;
}

// Task list operations (domain functions) + the currently focused task.
// `crypto.randomUUID` is injected as the id generator so the domain stays pure.
export function useTaskList({ tasks, setTasks, showToast }: Options) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Deletions are immediate; the toast offers to put the tasks back where they
  // were (and re-select the focused task if it was among them).
  const offerUndo = useCallback(
    (
      key: string,
      removed: RemovedTask[],
      removedActiveId: string | null,
      params?: Record<string, string | number>
    ) => {
      showToast?.(
        key,
        {
          labelKey: "toast.undo",
          titleKey: "toast.undoHint",
          onAction: () => {
            setTasks((ts) => restoreRemovedTasks(ts, removed));
            if (removedActiveId) setActiveTaskId((cur) => cur ?? removedActiveId);
          },
        },
        params
      );
    },
    [setTasks, showToast]
  );

  const addTask = useCallback(
    (title: string, estimatedPomodoros?: number, category?: TaskCategory) => {
      setTasks((ts) =>
        prependTask(ts, title, () => crypto.randomUUID(), estimatedPomodoros, category)
      );
    },
    [setTasks]
  );

  const toggleTask = useCallback(
    (id: string) => setTasks((ts) => toggleTaskDone(ts, id)),
    [setTasks]
  );

  const deleteTask = useCallback(
    (id: string) => {
      const { removed } = splitTasks(tasks, (t) => t.id === id);
      if (removed.length === 0) return;
      const removedActiveId = activeTaskId === id ? id : null;
      setTasks((ts) => splitTasks(ts, (t) => t.id === id).kept);
      if (removedActiveId) setActiveTaskId(null);
      offerUndo("toast.taskDeleted", removed, removedActiveId);
    },
    [tasks, activeTaskId, setTasks, offerUndo]
  );

  const clearDoneTasks = useCallback(() => {
    const { removed } = splitTasks(tasks, (t) => t.done);
    if (removed.length === 0) return;
    const removedActiveId = removed.some((r) => r.task.id === activeTaskId) ? activeTaskId : null;
    setTasks((ts) => splitTasks(ts, (t) => t.done).kept);
    if (removedActiveId) setActiveTaskId(null);
    offerUndo("toast.doneCleared", removed, removedActiveId, { n: removed.length });
  }, [tasks, activeTaskId, setTasks, offerUndo]);

  const moveTask = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTasks((ts) => reorderTask(ts, fromIndex, toIndex));
    },
    [setTasks]
  );

  const updateEstimate = useCallback(
    (id: string, estimated?: number) => {
      setTasks((ts) => updateTaskEstimate(ts, id, estimated));
    },
    [setTasks]
  );

  const updateCategory = useCallback(
    (id: string, category?: TaskCategory) => {
      setTasks((ts) => updateTaskCategory(ts, id, category));
    },
    [setTasks]
  );

  const renameTask = useCallback(
    (id: string, newTitle: string) => {
      setTasks((ts) => updateTaskTitle(ts, id, newTitle));
    },
    [setTasks]
  );

  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  return {
    activeTaskId,
    setActiveTaskId,
    activeTask,
    addTask,
    toggleTask,
    deleteTask,
    clearDoneTasks,
    moveTask,
    updateEstimate,
    updateCategory,
    renameTask,
  };
}
