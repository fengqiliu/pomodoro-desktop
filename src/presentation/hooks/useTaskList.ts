import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import {
  addTask as prependTask,
  clearCompletedTasks,
  removeTask,
  toggleTaskDone,
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

  const addTask = useCallback((title: string) => {
    setTasks((ts) => prependTask(ts, title, () => crypto.randomUUID()));
  }, []);

  const toggleTask = useCallback(
    (id: string) => setTasks((ts) => toggleTaskDone(ts, id)),
    []
  );

  const deleteTask = useCallback((id: string) => {
    setTasks((ts) => removeTask(ts, id));
    setActiveTaskId((cur) => (cur === id ? null : cur));
  }, []);

  const clearDoneTasks = useCallback(() => {
    setTasks((ts) => clearCompletedTasks(ts));
  }, []);

  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  return {
    activeTaskId,
    setActiveTaskId,
    activeTask,
    addTask,
    toggleTask,
    deleteTask,
    clearDoneTasks,
  };
}