import { describe, expect, it } from "vitest";
import {
  addTask,
  clearCompletedTasks,
  recordPomodoro,
  removeTask,
  toggleTaskDone,
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
