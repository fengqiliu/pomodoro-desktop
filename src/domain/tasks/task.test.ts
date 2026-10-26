import { describe, expect, it } from "vitest";
import {
  addTask,
  calculateCategoryDistribution,
  calculateCategoryStats,
  clearCompletedTasks,
  filterTaskEntries,
  filterTasks,
  formatTaskProgress,
  nextTaskCategory,
  parseEstimate,
  recordPomodoro,
  removeTask,
  renameTask,
  reorderTask,
  toggleTaskDone,
  updateTaskCategory,
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
    expect(tasks[0]).toEqual({
      id: expect.any(String),
      title: "新任务",
      done: false,
      pomodoros: 0,
    });
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

describe("renameTask", () => {
  it("renames the specified task when title is valid", () => {
    const tasks = renameTask(fixture(), "a", "重命名任务");
    expect(tasks[0].title).toBe("重命名任务");
    expect(tasks[1].title).toBe("回邮件");
  });

  it("ignores empty or whitespace-only rename", () => {
    const list = fixture();
    expect(renameTask(list, "a", "")).toBe(list);
    expect(renameTask(list, "a", "   ")).toBe(list);
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

  it("clears the estimate for zero, negative or invalid input", () => {
    const withEstimate = updateTaskEstimate(fixture(), "a", 4);
    for (const value of [0, -3, Number.NaN]) {
      expect(updateTaskEstimate(withEstimate, "a", value)[0].estimatedPomodoros).toBeUndefined();
    }
  });

  it("floors fractional estimates and leaves unknown ids untouched", () => {
    expect(updateTaskEstimate(fixture(), "a", 3.9)[0].estimatedPomodoros).toBe(3);
    const original = fixture();
    expect(updateTaskEstimate(original, "missing", 2)).toEqual(original);
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
    expect(
      formatTaskProgress({ id: "1", title: "t", done: false, pomodoros: 3, estimatedPomodoros: 5 })
    ).toBe("3/5");
    expect(formatTaskProgress({ id: "2", title: "t", done: false, pomodoros: 3 })).toBe("3");
    expect(formatTaskProgress({ id: "3", title: "t", done: false, pomodoros: 0 })).toBe("");
  });
});

describe("task categories & completion timestamp", () => {
  it("adds task with optional category tag", () => {
    const tasks = addTask(fixture(), "阅读论文", generateId, 2, "study");
    expect(tasks[0].category).toBe("study");
    expect(tasks[0].title).toBe("阅读论文");
  });

  it("updates task category", () => {
    const list = fixture();
    const updated = updateTaskCategory(list, "a", "work");
    expect(updated[0].category).toBe("work");

    const cleared = updateTaskCategory(updated, "a", undefined);
    expect(cleared[0].category).toBeUndefined();
  });

  it("sets completedAt when toggling to done and clears it when un-doing", () => {
    const time = new Date("2026-10-10T12:00:00.000Z");
    const list = fixture(); // 'a' is undone, 'b' is done
    const doneList = toggleTaskDone(list, "a", time);
    expect(doneList[0].done).toBe(true);
    expect(doneList[0].completedAt).toBe("2026-10-10T12:00:00.000Z");

    const undoneList = toggleTaskDone(doneList, "a");
    expect(undoneList[0].done).toBe(false);
    expect(undoneList[0].completedAt).toBeUndefined();
  });
});

describe("filterTaskEntries", () => {
  it("keeps source indices so filtered views can reorder across hidden tasks", () => {
    const tasks: Task[] = [
      { id: "a", title: "写周报", done: false, pomodoros: 0 },
      { id: "b", title: "已完成", done: true, pomodoros: 0 },
      { id: "c", title: "Review API", done: false, pomodoros: 0 },
    ];
    const visible = filterTaskEntries(tasks, { status: "active" });
    expect(visible.map(({ index }) => index)).toEqual([0, 2]);
    const moved = reorderTask(tasks, visible[1].index, visible[0].index);
    expect(moved.map((t) => t.id)).toEqual(["c", "a", "b"]);
    expect(filterTasks(moved, { status: "active" }).map((t) => t.id)).toEqual(["c", "a"]);
  });
});

describe("filterTasks & calculateCategoryStats", () => {
  const sampleTasks: Task[] = [
    { id: "1", title: "代码审查", done: false, pomodoros: 2, category: "work" },
    { id: "2", title: "单词打卡", done: true, pomodoros: 3, category: "study" },
    { id: "3", title: "买菜做饭", done: false, pomodoros: 1, category: "life" },
    { id: "4", title: "健身运动", done: true, pomodoros: 2, category: "life" },
    { id: "5", title: "随手记", done: false, pomodoros: 0 },
  ];

  it("filters by status (active vs done vs all)", () => {
    expect(filterTasks(sampleTasks, { status: "all" })).toHaveLength(5);
    expect(filterTasks(sampleTasks, { status: "active" }).map((t) => t.id)).toEqual([
      "1",
      "3",
      "5",
    ]);
    expect(filterTasks(sampleTasks, { status: "done" }).map((t) => t.id)).toEqual(["2", "4"]);
  });

  it("filters by category", () => {
    expect(filterTasks(sampleTasks, { category: "all" })).toHaveLength(5);
    expect(filterTasks(sampleTasks, { category: "life" }).map((t) => t.id)).toEqual(["3", "4"]);
    expect(filterTasks(sampleTasks, { category: "work" }).map((t) => t.id)).toEqual(["1"]);
  });

  it("filters by combined status and category", () => {
    const activeLife = filterTasks(sampleTasks, { status: "active", category: "life" });
    expect(activeLife.map((t) => t.id)).toEqual(["3"]);

    const doneLife = filterTasks(sampleTasks, { status: "done", category: "life" });
    expect(doneLife.map((t) => t.id)).toEqual(["4"]);
  });

  it("filters by keyword search (case-insensitive, whitespace trimmed)", () => {
    expect(filterTasks(sampleTasks, { keyword: "代码" }).map((t) => t.id)).toEqual(["1"]);
    expect(filterTasks(sampleTasks, { keyword: "  打卡  " }).map((t) => t.id)).toEqual(["2"]);
    expect(filterTasks(sampleTasks, { keyword: "不存在的任务" })).toEqual([]);
    expect(filterTasks(sampleTasks, { keyword: "" })).toHaveLength(5);
  });

  it("combines keyword search with status and category", () => {
    const res = filterTasks(sampleTasks, {
      status: "active",
      category: "life",
      keyword: "买菜",
    });
    expect(res.map((t) => t.id)).toEqual(["3"]);

    const noMatch = filterTasks(sampleTasks, {
      status: "done",
      category: "life",
      keyword: "买菜",
    });
    expect(noMatch).toEqual([]);
  });

  it("calculates category stats correctly", () => {
    const stats = calculateCategoryStats(sampleTasks);
    expect(stats.work).toEqual({ count: 1, pomodoros: 2 });
    expect(stats.study).toEqual({ count: 1, pomodoros: 3 });
    expect(stats.life).toEqual({ count: 2, pomodoros: 3 });
    expect(stats.other).toEqual({ count: 0, pomodoros: 0 });
  });

  it("calculates category distribution with percentages", () => {
    const dist = calculateCategoryDistribution(sampleTasks);
    expect(dist.totalTasks).toBe(5);
    // 2 (work) + 3 (study) + 3 (life) = 8 pomodoros
    expect(dist.totalPomodoros).toBe(8);

    const workItem = dist.items.find((i) => i.category === "work");
    expect(workItem).toEqual({ category: "work", count: 1, pomodoros: 2, percent: 25 });

    const studyItem = dist.items.find((i) => i.category === "study");
    expect(studyItem).toEqual({ category: "study", count: 1, pomodoros: 3, percent: 38 });

    const lifeItem = dist.items.find((i) => i.category === "life");
    expect(lifeItem).toEqual({ category: "life", count: 2, pomodoros: 3, percent: 38 });

    const otherItem = dist.items.find((i) => i.category === "other");
    expect(otherItem).toEqual({ category: "other", count: 0, pomodoros: 0, percent: 0 });
  });

  it("handles empty tasks in category distribution", () => {
    const dist = calculateCategoryDistribution([]);
    expect(dist.totalTasks).toBe(0);
    expect(dist.totalPomodoros).toBe(0);
    expect(dist.items.every((i) => i.percent === 0 && i.pomodoros === 0 && i.count === 0)).toBe(
      true
    );
  });
});

describe("nextTaskCategory", () => {
  it("cycles none → work → study → life → other → none", () => {
    expect(nextTaskCategory(undefined)).toBe("work");
    expect(nextTaskCategory("work")).toBe("study");
    expect(nextTaskCategory("study")).toBe("life");
    expect(nextTaskCategory("life")).toBe("other");
    expect(nextTaskCategory("other")).toBeUndefined();
  });
});

describe("parseEstimate", () => {
  it("accepts positive integers and truncates decimals", () => {
    expect(parseEstimate("3")).toBe(3);
    expect(parseEstimate("2.7")).toBe(2);
  });

  it("returns undefined for empty, zero, negative and non-numeric input", () => {
    for (const s of ["", "0", "-2", "abc"]) expect(parseEstimate(s)).toBeUndefined();
  });
});
