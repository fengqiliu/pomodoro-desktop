import { useCallback, useEffect, useRef, useState } from "react";
import { historyStore, stateStore } from "../../infrastructure/storage";
import { todayKey } from "../../shared/date";
import { resetDailyProgressIfNeeded, type DailyProgress } from "../../domain/timer";
import type { Task } from "../../domain/tasks";
import { pruneHistory, type History } from "../../domain/stats";
import type { NoisePref, PersistedState, Settings } from "../../domain/settings";

// All persisted domain state plus its side effects: the localStorage save,
// the startup history prune, and the daily (midnight/foreground) reset guard.
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

  // ---- persist core state ----
  useEffect(() => {
    const currentDailyProgress = resetDailyProgressIfNeeded(dailyProgress, todayKey());
    if (currentDailyProgress !== dailyProgress) {
      setDailyProgress(currentDailyProgress);
      return;
    }

    const state: PersistedState = {
      settings,
      tasks,
      completedToday: dailyProgress.completedToday,
      focusMinutesToday: dailyProgress.focusMinutesToday,
      date: dailyProgress.date,
      cycleFocusCount,
      noise,
    };
    stateStore.save(state);
  }, [settings, tasks, dailyProgress, cycleFocusCount, noise]);

  // Daily statistics are calendar-bound, while cycleFocusCount deliberately
  // continues across midnight. Check at midnight and whenever the app returns
  // to the foreground; completion and persistence each check defensively too.
  const rollOverDailyProgress = useCallback(() => {
    setDailyProgress((progress) => resetDailyProgressIfNeeded(progress, todayKey()));
  }, []);

  useEffect(() => {
    const onWindowFocus = () => rollOverDailyProgress();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") rollOverDailyProgress();
    };
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 50);
      return window.setTimeout(() => {
        rollOverDailyProgress();
        midnightTimeout = scheduleNextMidnight();
      }, Math.max(0, nextMidnight.getTime() - now.getTime()));
    };

    let midnightTimeout = scheduleNextMidnight();
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(midnightTimeout);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [rollOverDailyProgress]);

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