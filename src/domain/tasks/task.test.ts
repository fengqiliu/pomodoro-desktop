import { describe, expect, it } from "vitest";
import {
  addTask,
  clearCompletedTasks,
  formatTaskProgress,
  recordPomodoro,
  removeTask,
  reorderTask,
  toggleTaskDone,
  updateTaskEstimate,
  type Task,
} from "./index";


let nextId = 0;
const generateId = () => `t${++nextId}`;

function fixture(): Task[] {
  return [
    { id: "a", title: "写周报", done: false, pomodoros: 2 },
    { id: "b", title: "回邮件", done: true, pomodoros: 1 },
  ];
}

describe("addTask", () => {
  it("prepends a fresh task using the injected id generator", () => {
    const tasks = addTask(fixture(), "新任务", generateId);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toEqual({ id: expect.any(String), title: "新任务", done: false, pomodoros: 0 });
    expect(tasks[1].id).toBe("a");
  });
});

describe("toggleTaskDone", () => {
  it("flips only the targeted task", () => {
    const tasks = toggleTaskDone(fixture(), "a");
    expect(tasks[0].done).toBe(true);
    expect(tasks[1].done).toBe(true); // unchanged (was already done)
  });
});

describe("removeTask", () => {
  it("drops the task by id", () => {
    expect(removeTask(fixture(), "a").map((t) => t.id)).toEqual(["b"]);
  });
});

describe("clearCompletedTasks", () => {
  it("keeps only unfinished tasks", () => {
    expect(clearCompletedTasks(fixture()).map((t) => t.id)).toEqual(["a"]);
  });
});

describe("recordPomodoro", () => {
  it("increments the pomodoro count of the active task", () => {
    const tasks = recordPomodoro(fixture(), "a");
    expect(tasks[0].pomodoros).toBe(3);
    expect(tasks[1].pomodoros).toBe(1);
  });

  it("is a no-op when no task is active", () => {
    const tasks = fixture();
    expect(recordPomodoro(tasks, null)).toBe(tasks);
  });
});

describe("task estimates & reordering", () => {
  it("creates and adds task with optional estimate", () => {
    const tasks = addTask(fixture(), "新任务", generateId, 4);
    expect(tasks[0].estimatedPomodoros).toBe(4);
    expect(formatTaskProgress(tasks[0])).toBe("0/4");
  });

  it("updates task estimate", () => {
    const updated = updateTaskEstimate(fixture(), "a", 5);
    expect(updated[0].estimatedPomodoros).toBe(5);
    expect(formatTaskProgress(updated[0])).toBe("2/5");
  });

  it("reorders tasks safely", () => {
    const list = fixture(); // ["a", "b"]
    const reordered = reorderTask(list, 0, 1);
    expect(reordered.map((t) => t.id)).toEqual(["b", "a"]);

    // Out of bounds should return original array unchanged
    expect(reorderTask(list, -1, 1)).toBe(list);
    expect(reorderTask(list, 0, 99)).toBe(list);
  });

  it("formats task progress appropriately", () => {
    expect(formatTaskProgress({ id: "1", title: "t", done: false, pomodoros: 3, estimatedPomodoros: 5 })).toBe("3/5");
    expect(formatTaskProgress({ id: "2", title: "t", done: false, pomodoros: 3 })).toBe("3");
    expect(formatTaskProgress({ id: "3", title: "t", done: false, pomodoros: 0 })).toBe("");
  });
});

