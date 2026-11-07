import { describe, expect, it } from "vitest";
import { restoreRemovedTasks, splitTasks, type Task } from "./index";

const t = (id: string, done = false): Task => ({ id, title: id, done, pomodoros: 0 });
const ids = (ts: Task[]) => ts.map((x) => x.id);

describe("splitTasks", () => {
  it("separates removed tasks and remembers their position and the task just above", () => {
    const { kept, removed } = splitTasks([t("a"), t("b"), t("c")], (x) => x.id === "b");
    expect(ids(kept)).toEqual(["a", "c"]);
    expect(removed).toEqual([{ task: t("b"), index: 1, afterId: "a" }]);
  });

  it("records a null anchor for the first task", () => {
    const { removed } = splitTasks([t("a"), t("b")], (x) => x.id === "a");
    expect(removed[0]).toMatchObject({ index: 0, afterId: null });
  });

  it("removes several tasks at once, e.g. clearing completed ones", () => {
    const tasks = [t("a"), t("b", true), t("c"), t("d", true)];
    const { kept, removed } = splitTasks(tasks, (x) => x.done);
    expect(ids(kept)).toEqual(["a", "c"]);
    expect(removed.map((r) => [r.task.id, r.index, r.afterId])).toEqual([
      ["b", 1, "a"],
      ["d", 3, "c"],
    ]);
  });

  it("returns the list unchanged and nothing removed when no task matches", () => {
    const tasks = [t("a")];
    const { kept, removed } = splitTasks(tasks, () => false);
    expect(kept).toEqual(tasks);
    expect(removed).toEqual([]);
  });
});

describe("restoreRemovedTasks", () => {
  it("round-trips a single delete back to the exact original order", () => {
    const original = [t("a"), t("b"), t("c")];
    const { kept, removed } = splitTasks(original, (x) => x.id === "b");
    expect(ids(restoreRemovedTasks(kept, removed))).toEqual(["a", "b", "c"]);
  });

  it("round-trips several removals, including adjacent ones", () => {
    const original = [t("a", true), t("b", true), t("c"), t("d", true), t("e")];
    const { kept, removed } = splitTasks(original, (x) => x.done);
    expect(ids(restoreRemovedTasks(kept, removed))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("puts a task back below its old neighbour even after new tasks were added on top", () => {
    const { kept, removed } = splitTasks([t("a"), t("b"), t("c")], (x) => x.id === "b");
    const withNewTask = [t("x"), ...kept]; // a task added while the undo was pending
    expect(ids(restoreRemovedTasks(withNewTask, removed))).toEqual(["x", "a", "b", "c"]);
  });

  it("falls back to the old index when the neighbour above is gone too", () => {
    const { kept, removed } = splitTasks([t("a"), t("b"), t("c")], (x) => x.id === "b");
    const neighbourDeleted = kept.filter((x) => x.id !== "a"); // ["c"]
    expect(ids(restoreRemovedTasks(neighbourDeleted, removed))).toEqual(["c", "b"]);
  });

  it("does not duplicate a task that is already back in the list", () => {
    const { kept, removed } = splitTasks([t("a"), t("b")], (x) => x.id === "b");
    const once = restoreRemovedTasks(kept, removed);
    expect(ids(restoreRemovedTasks(once, removed))).toEqual(["a", "b"]);
  });
});
