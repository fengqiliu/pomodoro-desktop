import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import {
  buildPhaseNotificationDescriptor,
  completePhase,
  type NativeTimerNotification,
} from "../../application";
import { playChime } from "../../infrastructure/audio/chime";
import { notificationAdapter } from "../../infrastructure/platform";
import { historyStore } from "../../infrastructure/storage";
import { phaseMinutes, type DailyProgress, type Phase } from "../../domain/timer";
import type { Task } from "../../domain/tasks";
import type { History } from "../../domain/stats";
import type { Settings } from "../../domain/settings";
import { PHASE_KEY, type Tr } from "../i18n";
import { usePomodoroEngine } from "./usePomodoroEngine";

interface Options {
  settings: Settings;
  dailyProgress: DailyProgress;
  cycleFocusCount: number;
  tasks: Task[];
  activeTaskId: string | null;
  history: History;
  tr: Tr;
  showToast?: (message: string) => void;
  setCycleFocusCount: Dispatch<SetStateAction<number>>;
  setDailyProgress: Dispatch<SetStateAction<DailyProgress>>;
  setHistory: Dispatch<SetStateAction<History>>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
}

// Wires the countdown engine to the end-of-phase business rules: invokes the
// completePhase application use case, updates state and history storage,
// triggers audio/notification side-effects, and instructs the engine on the next phase.
export function usePomodoroSession({
  settings,
  dailyProgress,
  cycleFocusCount,
  tasks,
  activeTaskId,
  history,
  tr,
  showToast,
  setCycleFocusCount,
  setDailyProgress,
  setHistory,
  setTasks,
}: Options) {

  // Latest-value refs for callbacks that must read state outside render
  // (completion path, native notification builder).
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const dailyProgressRef = useRef(dailyProgress);
  dailyProgressRef.current = dailyProgress;
  const cycleFocusCountRef = useRef(cycleFocusCount);
  cycleFocusCountRef.current = cycleFocusCount;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const activeTaskIdRef = useRef(activeTaskId);
  activeTaskIdRef.current = activeTaskId;
  const historyRef = useRef(history);
  historyRef.current = history;
  const trRef = useRef(tr);
  trRef.current = tr;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  // The engine owns the authoritative phase; keep a ref for code that runs

  // outside render (notification builder reads it before a countdown starts).
  const enginePhaseRef = useRef<Phase>("focus");

  const getPhaseSeconds = useCallback(
    (p: Phase) => phaseMinutes(p, settingsRef.current) * 60,
    []
  );

  const buildCompletionNotification = useCallback((): NativeTimerNotification | undefined => {
    const descriptor = buildPhaseNotificationDescriptor(
      enginePhaseRef.current,
      settingsRef.current,
      cycleFocusCountRef.current
    );
    if (!descriptor) return undefined;
    const translateNow = trRef.current;
    return {
      title: translateNow(descriptor.titleKey),
      body: translateNow(descriptor.bodyKey, {
        next: translateNow(PHASE_KEY[descriptor.nextPhase]),
      }),
    };
  }, []);

  // ---- end-of-phase coordination via application use case ----
  const onPhaseComplete = useCallback(
    async (finished: Phase, nativeNotificationSent: boolean) => {
      const result = completePhase({
        finished,
        settings: settingsRef.current,
        dailyProgress: dailyProgressRef.current,
        cycleFocusCount: cycleFocusCountRef.current,
        tasks: tasksRef.current,
        activeTaskId: activeTaskIdRef.current,
        history: historyRef.current,
      });

      if (result.playSound) playChime(finished);

      cycleFocusCountRef.current = result.nextCycleFocusCount;
      setCycleFocusCount(result.nextCycleFocusCount);
      setDailyProgress(result.nextDailyProgress);
      setHistory(result.nextHistory);
      historyStore.save(result.nextHistory);
      setTasks(result.nextTasks);

      if (result.goalReachedJustNow && showToastRef.current) {
        showToastRef.current(
          trRef.current("toast.goalReached", { goal: String(settingsRef.current.dailyGoal ?? 0) })
        );
      }

      if (result.notification && !nativeNotificationSent) {

        const translateNow = trRef.current;
        const title = translateNow(result.notification.titleKey);
        const body = translateNow(result.notification.bodyKey, {
          next: translateNow(PHASE_KEY[result.notification.nextPhase]),
        });
        void notificationAdapter.notifyPhaseDone(title, body);
      }

      return {
        nextPhase: result.nextPhase,
        nextSeconds: result.nextSeconds,
        autoStart: result.autoStart,
      };
    },
    [setCycleFocusCount, setDailyProgress, setHistory, setTasks]
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
