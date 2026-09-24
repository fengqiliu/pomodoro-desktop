import { resetDailyProgressIfNeeded, type DailyProgress } from "../timer/dailyProgress";
import type { Task } from "../tasks/task";
import { todayKey } from "../../shared/date";
import { DEFAULT_SETTINGS, type NoisePref, type Settings } from "./settings";

// Snapshot of the persisted aggregates. Storage adapters serialize this shape
// verbatim — bump the storage key suffix (not this type) when it changes.
export interface PersistedState {
  settings: Settings;
  tasks: Task[];
  completedToday: number;
  focusMinutesToday: number;
  date: string; // YYYY-M-D for daily reset
  cycleFocusCount: number; // completed focus sessions since the last long break
  noise: NoisePref;
}

export function defaultState(): PersistedState {
  return {
    settings: DEFAULT_SETTINGS,
    tasks: [],
    completedToday: 0,
    focusMinutesToday: 0,
    date: todayKey(),
    cycleFocusCount: 0,
    noise: { on: false, type: DEFAULT_SETTINGS.noiseType, volume: DEFAULT_SETTINGS.noiseVolume },
  };
}

// Merge a partial (possibly untrusted, e.g. imported) state over the defaults.
// Pure — callers decide whether to persist the result.
export function mergeState(parsed: Partial<PersistedState> | null | undefined): PersistedState {
  const fallback = defaultState();
  if (!parsed || typeof parsed !== "object") return fallback;
  const merged: PersistedState = {
    ...fallback,
    ...parsed,
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    noise: { ...fallback.noise, ...(parsed.noise ?? {}) } as NoisePref,
    tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as Task[]) : fallback.tasks,
  };
  const dailyProgress: DailyProgress = resetDailyProgressIfNeeded(
    {
      date: merged.date,
      completedToday: merged.completedToday,
      focusMinutesToday: merged.focusMinutesToday,
    },
    todayKey()
  );
  merged.date = dailyProgress.date;
  merged.completedToday = dailyProgress.completedToday;
  merged.focusMinutesToday = dailyProgress.focusMinutesToday;
  return merged;
}
