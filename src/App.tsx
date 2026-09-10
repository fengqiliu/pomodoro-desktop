import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { NoiseEngine } from "./noise";
import {
  isAlwaysOnTop as platformPinned,
  isDesktop,
  notifyPhaseDone,
  registerShortcut,
  setAlwaysOnTop as platformPin,
  unregisterShortcut,
  type NativeTimerNotification,
} from "./platform";
import { PHASE_KEY, translate, type Lang } from "./i18n";
import { buildBackup, parseBackup } from "./dataBackup";
import { playChime } from "./chime";
import {
  LANG_KEY,
  PIN_KEY,
  THEME_KEY,
  loadState,
  saveState,
  todayKey,
} from "./persistence";
import { loadHistory, pruneHistory, recordFocus, saveHistory, last7Days, type History } from "./stats";
import {
  completeFocusCycle,
  nextPhaseAfterCompletedBreak,
  resetDailyProgressIfNeeded,
  type DailyProgress,
  type Phase,
} from "./timer/timerRules";
import { usePomodoroEngine } from "./hooks/usePomodoroEngine";
import { TopBar } from "./components/TopBar";
import { TimerView } from "./components/TimerView";
import { TasksView } from "./components/TasksView";
import { StatsView } from "./components/StatsView";
import { SettingsModal } from "./components/SettingsModal";
import type {
  ChartMetric,
  NoisePref,
  PersistedState,
  Settings,
  Tab,
  Task,
  Theme,
} from "./types";

const PHASE_COLOR: Record<Phase, string> = {
  focus: "#ff5b5b",
  short: "#3ecf8e",
  long: "#4a90e2",
};

function systemTheme(): Theme {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export default function App() {
  const initial = useRef(loadState()).current;

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
    const pruned = pruneHistory(loadHistory());
    saveHistory(pruned);
    return pruned;
  });

  // ---- ui state ----
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hotkeyDraft, setHotkeyDraft] = useState(initial.settings.hotkey);
  const [hotkeyError, setHotkeyError] = useState<"empty" | "registration" | null>(null);
  const [tab, setTab] = useState<Tab>("timer");
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || systemTheme()
  );
  const [pinned, setPinned] = useState<boolean>(() => localStorage.getItem(PIN_KEY) === "1");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("pomodoros");
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) || "zh");
  const [toast, setToast] = useState<string | null>(null);

  const tr = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );

  // Latest-value refs for callbacks that must read state outside render
  // (completion path, native notification builder, hotkey handler).
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

  // Persistent singletons.
  const noiseEngine = useRef<NoiseEngine | null>(null);
  if (!noiseEngine.current) noiseEngine.current = new NoiseEngine();

  const phaseMinutes = useCallback((p: Phase, s: Settings) => {
    return p === "focus" ? s.focus : p === "short" ? s.short : s.long;
  }, []);
  const getPhaseSeconds = useCallback(
    (p: Phase) => phaseMinutes(p, settingsRef.current) * 60,
    [phaseMinutes]
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
        setDailyProgress((progress) => {
          const current = resetDailyProgressIfNeeded(progress, todayKey());
          return {
            ...current,
            completedToday: current.completedToday + 1,
            focusMinutesToday: current.focusMinutesToday + mins,
          };
        });
        setHistory((prev) => {
          const next = recordFocus(prev, mins);
          saveHistory(next);
          return next;
        });
        setTasks((currentTasks) =>
          currentTasks.map((task) =>
            task.id === activeTaskIdRef.current
              ? { ...task, pomodoros: task.pomodoros + 1 }
              : task
          )
        );
      } else {
        np = nextPhaseAfterCompletedBreak();
      }

      if (settingsRef.current.notifications && !nativeNotificationSent) {
        const translateNow = trRef.current;
        const title =
          finished === "focus" ? translateNow("notif.title") : translateNow("notif.title.break");
        void notifyPhaseDone(
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
    saveState(state);
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

  // ---- language ----
  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  // ---- theme ----
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // ---- always-on-top ----
  useEffect(() => {
    localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
    void platformPin(pinned);
  }, [pinned]);

  // sync real window state on mount (in case OS changed it)
  useEffect(() => {
    void platformPinned().then(setPinned);
  }, []);

  // ---- white noise engine wiring ----
  useEffect(() => {
    const eng = noiseEngine.current!;
    eng.setType(noise.type);
    eng.setVolume(noise.volume);
    if (noise.on) eng.start();
    else eng.stop();
  }, [noise]);

  // Keep the paused countdown in sync with duration setting changes.
  useEffect(() => {
    syncIfIdle();
    // `running` is intentionally not a dependency: pausing must preserve the
    // remaining countdown rather than resetting it to the configured duration.
  }, [settings.focus, settings.short, settings.long, phase, syncIfIdle]);

  // ---- window title mirrors the countdown (dock/taskbar visibility) ----
  useEffect(() => {
    document.title = running
      ? `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")} · ${tr(PHASE_KEY[phase])}`
      : tr("app.name");
  }, [running, secondsLeft, phase, tr]);

  // ---- toast helper ----
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((key: string) => {
    setToast(key);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- in-app keyboard shortcuts: Space=开始/暂停, R=重置, S=跳过 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSettings) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        void toggle();
      } else if (e.key === "r" || e.key === "R") {
        void reset();
      } else if (e.key === "s" || e.key === "S") {
        void skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings, toggle, reset, skip]);

  // ---- global hotkey registration ----
  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    const keys = settings.hotkey;
    registerShortcut(keys, () => {
      void toggle();
    }).then((ok) => {
      if (cancelled) {
        if (ok) void unregisterShortcut(keys);
        return;
      }
      if (!ok) {
        setHotkeyError("registration");
        console.warn("hotkey registration failed:", keys);
      } else {
        setHotkeyError(null);
      }
    });
    return () => {
      cancelled = true;
      void unregisterShortcut(keys);
    };
  }, [settings.hotkey, toggle]);

  // ---- phase/settings controls ----
  const resetSettings = useCallback(() => {
    void reset();
    setSettings((current) => ({ ...current, ...DEFAULTS_RESET }));
    setHotkeyDraft(DEFAULTS_RESET.hotkey);
    setHotkeyError(null);
    setNoise((n) => ({ on: n.on, type: DEFAULTS_RESET.noiseType, volume: DEFAULTS_RESET.noiseVolume }));
  }, [reset]);

  const openSettings = useCallback(() => {
    setHotkeyDraft(settings.hotkey);
    setShowSettings(true);
  }, [settings.hotkey]);

  const saveSettings = useCallback(() => {
    const hotkey = hotkeyDraft.trim();
    if (!hotkey) {
      setHotkeyError("empty");
      return;
    }
    setSettings((current) => (current.hotkey === hotkey ? current : { ...current, hotkey }));
    setHotkeyError(null);
    setShowSettings(false);
  }, [hotkeyDraft]);

  // ---- data backup (clipboard round-trip, works in browser and desktop) ----
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
    saveState(parsed.state);
    saveHistory(parsed.history);
    window.location.reload();
  }, [showToast, tr]);

  // ---- tasks ----
  const addTask = useCallback((title: string) => {
    setTasks((ts) => [{ id: crypto.randomUUID(), title, done: false, pomodoros: 0 }, ...ts]);
  }, []);

  const toggleTask = useCallback(
    (id: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    []
  );

  const deleteTask = useCallback((id: string) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    setActiveTaskId((cur) => (cur === id ? null : cur));
  }, []);

  const clearDoneTasks = useCallback(() => {
    setTasks((ts) => ts.filter((t) => !t.done));
  }, []);

  // ---- derived ----
  const progress = 1 - secondsLeft / (phaseMinutes(phase, settings) * 60);
  const accent = PHASE_COLOR[phase];
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;
  const week = useMemo(() => last7Days(history), [history, dailyProgress.date]);

  return (
    <div className="app" style={{ ["--accent" as string]: accent }}>
      <TopBar
        tr={tr}
        theme={theme}
        pinned={pinned}
        noise={noise}
        onToggleNoise={() => setNoise((n) => ({ ...n, on: !n.on }))}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onTogglePin={() => setPinned((p) => !p)}
        onOpenSettings={openSettings}
      />

      <div className="tabs">
        <button className={tab === "timer" ? "tab active" : "tab"} onClick={() => setTab("timer")}>
          {tr("tab.timer")}
        </button>
        <button className={tab === "tasks" ? "tab active" : "tab"} onClick={() => setTab("tasks")}>
          {tr("tab.tasks")}
        </button>
        <button className={tab === "stats" ? "tab active" : "tab"} onClick={() => setTab("stats")}>
          {tr("tab.stats")}
        </button>
      </div>

      {tab === "timer" ? (
        <TimerView
          tr={tr}
          phase={phase}
          secondsLeft={secondsLeft}
          running={running}
          progress={progress}
          accent={accent}
          activeTaskTitle={activeTask?.title ?? null}
          dailyProgress={dailyProgress}
          cycleFocusCount={cycleFocusCount}
          longEvery={settings.longEvery}
          onToggle={() => void toggle()}
          onReset={() => void reset()}
          onSkip={() => void skip()}
          onSwitchPhase={(p) => void switchTo(p)}
        />
      ) : tab === "tasks" ? (
        <TasksView
          tr={tr}
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSetActiveTask={setActiveTaskId}
          onAdd={addTask}
          onToggleDone={toggleTask}
          onDelete={deleteTask}
          onClearDone={clearDoneTasks}
        />
      ) : (
        <StatsView
          tr={tr}
          lang={lang}
          week={week}
          chartMetric={chartMetric}
          accent={accent}
          onChartMetricChange={setChartMetric}
        />
      )}

      {showSettings && (
        <SettingsModal
          tr={tr}
          lang={lang}
          onLangChange={setLang}
          settings={settings}
          onSettingsChange={setSettings}
          noise={noise}
          onNoiseChange={setNoise}
          hotkeyDraft={hotkeyDraft}
          onHotkeyDraftChange={(v) => {
            setHotkeyDraft(v);
            setHotkeyError(null);
          }}
          hotkeyError={hotkeyError}
          onClose={() => setShowSettings(false)}
          onReset={resetSettings}
          onDone={saveSettings}
          onExport={() => void exportData()}
          onImport={() => void importData()}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {tr(toast)}
        </div>
      )}
    </div>
  );
}

// Settings restored by "Reset to defaults" — noise type/volume come along,
// the noise on/off switch is left as the user set it.
const DEFAULTS_RESET = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  sound: true,
  notifications: true,
  autoStartBreaks: false,
  autoStartFocus: false,
  hotkey: "CommandOrControl+Shift+P",
  noiseType: "brown" as const,
  noiseVolume: 0.3,
};
