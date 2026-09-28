import { useCallback, useEffect, useRef, useState } from "react";
import { historyStore, stateStore } from "../../infrastructure/storage";
import { todayKey } from "../../shared/date";
import { resetDailyProgressIfNeeded, type DailyProgress } from "../../domain/timer";
import type { Task } from "../../domain/tasks";
import { pruneHistory, type History } from "../../domain/stats";
import {
  composePersistedState,
  type NoisePref,
  type Settings,
} from "../../domain/settings";
import { useMidnightRollover } from "./useMidnightRollover";

// All persisted domain state plus its side effects: the localStorage save,
// startup history prune, and automatic midnight/foreground day boundary reset.
export function usePersistedState() {
  const initial = useRef(stateStore.load()).current;

  // ---- persisted domain state ----
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>({
    date: initial.date,
    completedToday: initial.completedToday,
    focusMinutesToday: initial.focusMinutesToday,
  });
  const [cycleFocusCount, setCycleFocusCount] = useState(initial.cycleFocusCount);
  const [noise, setNoise] = useState<NoisePref>(initial.noise);
  const [history, setHistory] = useState<History>(() => {
    // Drop records older than the retention window on startup.
    const pruned = pruneHistory(historyStore.load());
    historyStore.save(pruned);
    return pruned;
  });

  // ---- day boundary rollover guard ----
  const rollOverDailyProgress = useCallback(() => {
    setDailyProgress((progress) => resetDailyProgressIfNeeded(progress, todayKey()));
  }, []);

  useMidnightRollover(rollOverDailyProgress);

  // ---- persist core state ----
  useEffect(() => {
    const currentDailyProgress = resetDailyProgressIfNeeded(dailyProgress, todayKey());
    if (currentDailyProgress !== dailyProgress) {
      setDailyProgress(currentDailyProgress);
      return;
    }

    const state = composePersistedState({
      settings,
      tasks,
      dailyProgress,
      cycleFocusCount,
      noise,
    });
    stateStore.save(state);
  }, [settings, tasks, dailyProgress, cycleFocusCount, noise]);

  return {
    settings,
    setSettings,
    tasks,
    setTasks,
    dailyProgress,
    setDailyProgress,
    cycleFocusCount,
    setCycleFocusCount,
    noise,
    setNoise,
    history,
    setHistory,
  };
}
