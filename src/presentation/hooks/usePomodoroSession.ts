import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { NativeTimerNotification } from "../../application/ports";
import { playChime } from "../../infrastructure/audio/chime";
import { notificationAdapter } from "../../infrastructure/platform";
import { historyStore } from "../../infrastructure/storage";
import { todayKey } from "../../shared/date";
import {
  addCompletedFocus,
  completeFocusCycle,
  nextPhaseAfterCompletedBreak,
  phaseMinutes,
  resetDailyProgressIfNeeded,
  type DailyProgress,
  type Phase,
} from "../../domain/timer";
import { recordPomodoro, type Task } from "../../domain/tasks";
import { recordFocus, type History } from "../../domain/stats";
import type { Settings } from "../../domain/settings";
import { PHASE_KEY, type Tr } from "../i18n";
import { usePomodoroEngine } from "./usePomodoroEngine";

interface Options {
  settings: Settings;
  cycleFocusCount: number;
  activeTaskId: string | null;
  tr: Tr;
  setCycleFocusCount: Dispatch<SetStateAction<number>>;
  setDailyProgress: Dispatch<SetStateAction<DailyProgress>>;
  setHistory: Dispatch<SetStateAction<History>>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
}

// Wires the countdown engine to the end-of-phase business rules: what a
// completed phase records (chime, stats, history, task pomodoros, cycle
// advance, notification fallback) and what phase runs next.
export function usePomodoroSession({
  settings,
  cycleFocusCount,
  activeTaskId,
  tr,
  setCycleFocusCount,
  setDailyProgress,
  setHistory,
  setTasks,
}: Options) {
  // Latest-value refs for callbacks that must read state outside render
  // (completion path, native notification builder).
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cycleFocusCountRef = useRef(cycleFocusCount);
  cycleFocusCountRef.current = cycleFocusCount;
  const activeTaskIdRef = useRef(activeTaskId);
  activeTaskIdRef.current = activeTaskId;
  const trRef = useRef(tr);
  trRef.current = tr;
  // The engine owns the authoritative phase; keep a ref for code that runs
  // outside render (notification builder reads it before a countdown starts).
  const enginePhaseRef = useRef<Phase>("focus");

  const getPhaseSeconds = useCallback(
    (p: Phase) => phaseMinutes(p, settingsRef.current) * 60,
    []
  );

  const buildCompletionNotification = useCallback((): NativeTimerNotification | undefined => {
    if (!settingsRef.current.notifications) return undefined;
    const finished: Phase = enginePhaseRef.current;
    const nextPhase =
      finished === "focus"
        ? completeFocusCycle(cycleFocusCountRef.current, settingsRef.current.longEvery).nextPhase
        : nextPhaseAfterCompletedBreak();
    const translateNow = trRef.current;
    return {
      title:
        finished === "focus" ? translateNow("notif.title") : translateNow("notif.title.break"),
      body: translateNow("notif.body", { next: translateNow(PHASE_KEY[nextPhase]) }),
    };
  }, []);
  // ---- end-of-phase business rules (chime, stats, tasks, notifications) ----
  const onPhaseComplete = useCallback(
    async (finished: Phase, nativeNotificationSent: boolean) => {
      if (settingsRef.current.sound) playChime(finished);

      let np: Phase;
      if (finished === "focus") {
        const mins = settingsRef.current.focus;
        const cycle = completeFocusCycle(
          cycleFocusCountRef.current,
          settingsRef.current.longEvery
        );
        cycleFocusCountRef.current = cycle.cycleFocusCount;
        setCycleFocusCount(cycle.cycleFocusCount);
        np = cycle.nextPhase;
        setDailyProgress((progress) =>
          addCompletedFocus(resetDailyProgressIfNeeded(progress, todayKey()), mins)
        );
        setHistory((prev) => {
          const next = recordFocus(prev, mins);
          historyStore.save(next);
          return next;
        });
        setTasks((currentTasks) => recordPomodoro(currentTasks, activeTaskIdRef.current));
      } else {
        np = nextPhaseAfterCompletedBreak();
      }

      if (settingsRef.current.notifications && !nativeNotificationSent) {
        const translateNow = trRef.current;
        const title =
          finished === "focus" ? translateNow("notif.title") : translateNow("notif.title.break");
        void notificationAdapter.notifyPhaseDone(
          title,
          translateNow("notif.body", { next: translateNow(PHASE_KEY[np]) })
        );
      }

      const shouldAuto =
        (finished === "focus" && settingsRef.current.autoStartBreaks) ||
        (finished !== "focus" && settingsRef.current.autoStartFocus);
      return {
        nextPhase: np,
        nextSeconds: getPhaseSeconds(np),
        autoStart: shouldAuto,
      };
    },
    [getPhaseSeconds]
  );

  const engine = usePomodoroEngine({
    getPhaseSeconds,
    getCompletionNotification: buildCompletionNotification,
    onPhaseComplete,
  });
  const { phase, secondsLeft, running, toggle, reset, switchTo, skip, syncIfIdle } = engine;
  enginePhaseRef.current = phase;

  // Keep the paused countdown in sync with duration setting changes.
  useEffect(() => {
    syncIfIdle();
    // `running` is intentionally not a dependency: pausing must preserve the
    // remaining countdown rather than resetting it to the configured duration.
  }, [settings.focus, settings.short, settings.long, phase, syncIfIdle]);

  return { phase, secondsLeft, running, toggle, reset, switchTo, skip };
}