import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import {
  addTask as prependTask,
  clearCompletedTasks,
  renameTask as updateTaskTitle,
  reorderTask,
  removeTask,
  toggleTaskDone,
  updateTaskEstimate,
  type Task,
} from "../../domain/tasks";


interface Options {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
}

// Task list operations (domain functions) + the currently focused task.
// `crypto.randomUUID` is injected as the id generator so the domain stays pure.
export function useTaskList({ tasks, setTasks }: Options) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const addTask = useCallback((title: string, estimatedPomodoros?: number) => {
    setTasks((ts) => prependTask(ts, title, () => crypto.randomUUID(), estimatedPomodoros));
  }, [setTasks]);

  const toggleTask = useCallback(
    (id: string) => setTasks((ts) => toggleTaskDone(ts, id)),
    [setTasks]
  );

  const deleteTask = useCallback((id: string) => {
    setTasks((ts) => removeTask(ts, id));
    setActiveTaskId((cur) => (cur === id ? null : cur));
  }, [setTasks]);

  const clearDoneTasks = useCallback(() => {
    setTasks((ts) => clearCompletedTasks(ts));
  }, [setTasks]);

  const moveTask = useCallback((fromIndex: number, toIndex: number) => {
    setTasks((ts) => reorderTask(ts, fromIndex, toIndex));
  }, [setTasks]);

  const updateEstimate = useCallback((id: string, estimated?: number) => {
    setTasks((ts) => updateTaskEstimate(ts, id, estimated));
  }, [setTasks]);

  const renameTask = useCallback((id: string, newTitle: string) => {
    setTasks((ts) => updateTaskTitle(ts, id, newTitle));
  }, [setTasks]);

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
    renameTask,
  };

}
