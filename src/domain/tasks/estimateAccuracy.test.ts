import { describe, expect, it } from "vitest";
import { calculateEstimateAccuracy, type Task } from "./index";

function task(over: Partial<Task> & Pick<Task, "id">): Task {
  return { title: over.id, done: true, pomodoros: 0, ...over };
}

describe("calculateEstimateAccuracy", () => {
  it("returns zeros and an accurate bias when there is nothing to compare", () => {
    expect(calculateEstimateAccuracy([])).toEqual({
      sampleCount: 0,
      estimated: 0,
      actual: 0,
      over: 0,
      under: 0,
      exact: 0,
      biasPercent: 0,
      bias: "accurate",
    });
  });

  it("only compares finished tasks that carry a positive estimate", () => {
    const tasks = [
      task({ id: "open", done: false, pomodoros: 3, estimatedPomodoros: 2 }),
      task({ id: "no-estimate", pomodoros: 5 }),
      task({ id: "zero-estimate", pomodoros: 5, estimatedPomodoros: 0 }),
      task({ id: "ok", pomodoros: 2, estimatedPomodoros: 2 }),
    ];
    const r = calculateEstimateAccuracy(tasks);
    expect(r.sampleCount).toBe(1);
    expect(r.estimated).toBe(2);
    expect(r.actual).toBe(2);
  });

  it("skips finished tasks that were never timed, since 0 pomodoros means no data rather than a tiny task", () => {
    const tasks = [
      task({ id: "ticked-off", pomodoros: 0, estimatedPomodoros: 4 }),
      task({ id: "timed", pomodoros: 3, estimatedPomodoros: 3 }),
    ];
    const r = calculateEstimateAccuracy(tasks);
    expect(r).toMatchObject({ sampleCount: 1, estimated: 3, actual: 3, exact: 1, under: 0 });
    expect(r.bias).toBe("accurate");
  });

  it("counts tasks that ran over, under and exactly on their estimate", () => {
    const tasks = [
      task({ id: "a", pomodoros: 5, estimatedPomodoros: 3 }), // over
      task({ id: "b", pomodoros: 4, estimatedPomodoros: 4 }), // exact
      task({ id: "c", pomodoros: 1, estimatedPomodoros: 2 }), // under
      task({ id: "d", pomodoros: 6, estimatedPomodoros: 2 }), // over
    ];
    const r = calculateEstimateAccuracy(tasks);
    expect(r).toMatchObject({
      sampleCount: 4,
      estimated: 11,
      actual: 16,
      over: 2,
      exact: 1,
      under: 1,
    });
  });

  it("reports bias as a rounded percentage of the total estimate (positive = underestimated)", () => {
    const low = calculateEstimateAccuracy([task({ id: "a", pomodoros: 5, estimatedPomodoros: 4 })]);
    expect(low.biasPercent).toBe(25);
    expect(low.bias).toBe("underestimate");

    const high = calculateEstimateAccuracy([
      task({ id: "a", pomodoros: 2, estimatedPomodoros: 4 }),
    ]);
    expect(high.biasPercent).toBe(-50);
    expect(high.bias).toBe("overestimate");

    const rounded = calculateEstimateAccuracy([
      task({ id: "a", pomodoros: 4, estimatedPomodoros: 3 }),
    ]);
    expect(rounded.biasPercent).toBe(33);
  });

  it("treats a deviation within ±15% as accurate, including the boundary", () => {
    const edge = calculateEstimateAccuracy([
      task({ id: "a", pomodoros: 23, estimatedPomodoros: 20 }),
    ]);
    expect(edge.biasPercent).toBe(15);
    expect(edge.bias).toBe("accurate");

    const justOver = calculateEstimateAccuracy([
      task({ id: "a", pomodoros: 12, estimatedPomodoros: 10 }),
    ]);
    expect(justOver.biasPercent).toBe(20);
    expect(justOver.bias).toBe("underestimate");

    const slightlyHigh = calculateEstimateAccuracy([
      task({ id: "a", pomodoros: 9, estimatedPomodoros: 10 }),
    ]);
    expect(slightlyHigh.biasPercent).toBe(-10);
    expect(slightlyHigh.bias).toBe("accurate");
  });
});
