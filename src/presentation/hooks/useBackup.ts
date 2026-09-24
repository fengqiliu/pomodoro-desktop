import { useCallback } from "react";
import { buildBackup, parseBackup } from "../../application/backupService";
import { historyStore, stateStore } from "../../infrastructure/storage";
import type { DailyProgress } from "../../domain/timer";
import type { NoisePref, PersistedState, Settings } from "../../domain/settings";
import type { Task } from "../../domain/tasks";
import type { History } from "../../domain/stats";
import type { Tr } from "../i18n";

interface Options {
  settings: Settings;
  tasks: Task[];
  dailyProgress: DailyProgress;
  cycleFocusCount: number;
  noise: NoisePref;
  history: History;
  showToast: (key: string) => void;
  tr: Tr;
}

// ---- data backup (clipboard round-trip, works in browser and desktop) ----
export function useBackup({
  settings,
  tasks,
  dailyProgress,
  cycleFocusCount,
  noise,
  history,
  showToast,
  tr,
}: Options) {
  const exportData = useCallback(async () => {
    const state: PersistedState = {
      settings,
      tasks,
      completedToday: dailyProgress.completedToday,
      focusMinutesToday: dailyProgress.focusMinutesToday,
      date: dailyProgress.date,
      cycleFocusCount,
      noise,
    };
    try {
      await navigator.clipboard.writeText(buildBackup(state, history));
      showToast("toast.exported");
    } catch {
      showToast("toast.copyFailed");
    }
  }, [settings, tasks, dailyProgress, cycleFocusCount, noise, history, showToast]);

  const importData = useCallback(async () => {
    let text: string | null = null;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = null;
    }
    if (!text) {
      text = window.prompt(tr("settings.import.prompt")) ?? "";
    }
    const parsed = parseBackup(text);
    if (!parsed) {
      showToast("toast.importFailed");
      return;
    }
    stateStore.save(parsed.state);
    historyStore.save(parsed.history);
    window.location.reload();
  }, [showToast, tr]);

  return { exportData, importData };
}