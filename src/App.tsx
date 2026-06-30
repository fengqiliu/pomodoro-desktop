import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./App.css";
import { NoiseEngine, type NoiseType } from "./noise";
import {
  setAlwaysOnTop as platformPin,
  isAlwaysOnTop as platformPinned,
  registerShortcut,
  unregisterShortcut,
  isDesktop,
  notifyPhaseDone,
} from "./platform";
import { translate, weekdayLabel, LANGS, type Lang } from "./i18n";

type Phase = "focus" | "short" | "long";
type Theme = "light" | "dark";
type ChartMetric = "pomodoros" | "minutes";

interface Task {
  id: string;
  title: string;
  done: boolean;
  pomodoros: number;
}

interface Settings {
  focus: number; // minutes
  short: number;
  long: number;
  longEvery: number; // long break after this many focus sessions
  sound: boolean;
  notifications: boolean;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  hotkey: string;
  noiseType: NoiseType;
  noiseVolume: number; // 0..1
}

interface NoisePref {
  on: boolean;
  type: NoiseType;
  volume: number;
}

const DEFAULT_SETTINGS: Settings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  sound: true,
  notifications: true,
  autoStartBreaks: false,
  autoStartFocus: false,
  hotkey: "CommandOrControl+Shift+P",
  noiseType: "brown",
  noiseVolume: 0.3,
};

const PHASE_COLOR: Record<Phase, string> = {
  focus: "#ff5b5b",
  short: "#3ecf8e",
  long: "#4a90e2",
};

const STATE_KEY = "pomodoro-state-v2";
const THEME_KEY = "pomodoro-theme";
const PIN_KEY = "pomodoro-pinned";
const HISTORY_KEY = "pomodoro-history-v1";
const LANG_KEY = "pomodoro-lang";

const PHASE_KEY: Record<Phase, string> = {
  focus: "phase.focus",
  short: "phase.short",
  long: "phase.long",
};

const NOISE_KEY: Record<NoiseType, string> = {
  white: "noise.white",
  brown: "noise.brown",
  pink: "noise.pink",
};

interface PersistedState {
  settings: Settings;
  tasks: Task[];
  completedToday: number;
  focusMinutesToday: number;
  date: string; // YYYY-M-D for daily reset
  noise: NoisePref;
}

interface DayRecord {
  date: string; // YYYY-M-D
  dayIndex: number; // 0..6 — label resolved at render time by lang
  pomodoros: number;
  minutes: number;
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadState(): PersistedState {
  const fallback: PersistedState = {
    settings: DEFAULT_SETTINGS,
    tasks: [],
    completedToday: 0,
    focusMinutesToday: 0,
    date: todayKey(),
    noise: { on: false, type: DEFAULT_SETTINGS.noiseType, volume: DEFAULT_SETTINGS.noiseVolume },
  };
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const merged: PersistedState = {
      ...fallback,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      noise: { ...fallback.noise, ...parsed.noise },
    };
    if (merged.date !== todayKey()) {
      merged.completedToday = 0;
      merged.focusMinutesToday = 0;
      merged.date = todayKey();
    }
    return merged;
  } catch {
    return fallback;
  }
}

function loadHistory(): Record<string, DayRecord> {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as Record<string, DayRecord>;
  } catch {
    /* ignore */
  }
  return {};
}

function last7Days(history: Record<string, DayRecord>): DayRecord[] {
  const out: DayRecord[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    out.push(
      history[key] || {
        date: key,
        dayIndex: d.getDay(),
        pomodoros: 0,
        minutes: 0,
      }
    );
  }
  return out;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Shared AudioContext for the completion chime. Reused across chimes instead of
// new+close each time — avoids hitting the browser's AudioContext instance cap
// and repeated autoplay-policy warnings.
let chimeCtx: AudioContext | null = null;
function getChimeCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!chimeCtx) chimeCtx = new Ctor();
  if (chimeCtx.state === "suspended") void chimeCtx.resume();
  return chimeCtx;
}

function playChime(phase: Phase) {
  try {
    const ctx = getChimeCtx();
    if (!ctx) return;
    const notes = phase === "focus" ? [880, 660, 523] : [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  } catch {
    /* audio unavailable */
  }
}

function systemTheme(): Theme {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export default function App() {
  const initial = useRef(loadState()).current;

  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [completedToday, setCompletedToday] = useState(initial.completedToday);
  const [focusMinutesToday, setFocusMinutesToday] = useState(initial.focusMinutesToday);
  const [noise, setNoise] = useState<NoisePref>(initial.noise);
  const [history, setHistory] = useState<Record<string, DayRecord>>(() => loadHistory());

  const [phase, setPhase] = useState<Phase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(settings.focus * 60);
  const [running, setRunning] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const [newTask, setNewTask] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"timer" | "tasks" | "stats">("timer");
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || systemTheme()
  );
  const [pinned, setPinned] = useState<boolean>(() => localStorage.getItem(PIN_KEY) === "1");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("pomodoros");
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem(LANG_KEY) as Lang) || "zh"
  );

  const tr = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const runningRef = useRef(running);
  runningRef.current = running;
  const noiseRef = useRef(noise);
  noiseRef.current = noise;

  // Wall-clock end timestamp for the running countdown. Recomputed when (re)starting;
  // the tick derives remaining time from this so setInterval jitter / background
  // throttling can't drift the timer over a long session.
  const endAtRef = useRef<number | null>(null);

  // Persistent singletons.
  const noiseEngine = useRef<NoiseEngine | null>(null);
  if (!noiseEngine.current) noiseEngine.current = new NoiseEngine();

  // ---- persist core state ----
  useEffect(() => {
    const state: PersistedState = {
      settings,
      tasks,
      completedToday,
      focusMinutesToday,
      date: todayKey(),
      noise,
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [settings, tasks, completedToday, focusMinutesToday, noise]);

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

  // ---- close settings modal on Escape ----
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

  // ---- helpers ----
  const phaseMinutes = useCallback((p: Phase, s: Settings) => {
    return p === "focus" ? s.focus : p === "short" ? s.short : s.long;
  }, []);

  const nextPhase = useCallback(
    (justFinished: Phase): Phase => {
      if (justFinished !== "focus") return "focus";
      return completedToday + 1 >= settingsRef.current.longEvery ? "long" : "short";
    },
    [completedToday]
  );

  // When the current phase's duration changes while paused, keep secondsLeft in
  // sync so the ring and countdown reflect the new length. A running session is
  // left untouched (don't silently stretch/shrink an in-progress timer).
  useEffect(() => {
    if (running) return;
    setSecondsLeft(phaseMinutes(phase, settings) * 60);
  }, [phase, settings, phaseMinutes, running]);

  const commitFocusToHistory = useCallback((minutes: number) => {
    const key = todayKey();
    setHistory((prev) => {
      const cur = prev[key] || { date: key, dayIndex: new Date().getDay(), pomodoros: 0, minutes: 0 };
      const next = {
        ...prev,
        [key]: { ...cur, pomodoros: cur.pomodoros + 1, minutes: cur.minutes + minutes },
      };
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // ---- ticking loop ----
  useEffect(() => {
    if (!running) return;
    // Seed the end timestamp from the current remaining seconds when (re)starting.
    endAtRef.current = Date.now() + secondsLeft * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAtRef.current! - Date.now()) / 1000));
      if (remaining <= 0) {
        const finished = phase;
        if (settingsRef.current.sound) playChime(finished);
        if (finished === "focus") {
          const mins = settingsRef.current.focus;
          setCompletedToday((c) => c + 1);
          setFocusMinutesToday((m) => m + mins);
          commitFocusToHistory(mins);
          setTasks((ts) =>
            ts.map((t) =>
              t.id === activeTaskId ? { ...t, pomodoros: t.pomodoros + 1 } : t
            )
          );
        }
        const np = nextPhase(finished);
        // Native notification on every phase end (guarded by the toggle).
        if (settingsRef.current.notifications) {
          const title =
            finished === "focus" ? tr("notif.title") : tr("notif.title.break");
          void notifyPhaseDone(title, tr("notif.body", { next: tr(PHASE_KEY[np]) }));
        }
        // Auto-advance into the next phase when the corresponding toggle is set.
        const shouldAuto =
          (finished === "focus" && settingsRef.current.autoStartBreaks) ||
          (finished !== "focus" && settingsRef.current.autoStartFocus);
        setPhase(np);
        setRunning(shouldAuto);
        setSecondsLeft(phaseMinutes(np, settingsRef.current) * 60);
        return;
      }
      setSecondsLeft(remaining);
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase, activeTaskId, nextPhase, phaseMinutes, commitFocusToHistory]);

  // ---- toggle (used by button + global hotkey) ----
  const toggle = useCallback(() => setRunning((r) => !r), []);

  // ---- global hotkey registration ----
  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    const keys = settings.hotkey;
    registerShortcut(keys, () => {
      // closure over latest toggle via ref-free state setter is fine,
      // but also stop noise toggle is separate. just toggle play/pause.
      toggle();
    }).then((ok) => {
      if (cancelled) void unregisterShortcut(keys);
      if (!ok) console.warn("hotkey registration failed:", keys);
    });
    return () => {
      cancelled = true;
      void unregisterShortcut(keys);
    };
  }, [settings.hotkey, toggle]);

  // ---- phase controls ----
  const switchPhase = useCallback(
    (p: Phase) => {
      setPhase(p);
      setRunning(false);
      setSecondsLeft(phaseMinutes(p, settings) * 60);
    },
    [phaseMinutes, settings]
  );

  const reset = useCallback(() => {
    setRunning(false);
    setSecondsLeft(phaseMinutes(phase, settings) * 60);
  }, [phase, settings, phaseMinutes]);

  const skip = useCallback(() => {
    const np = nextPhase(phase);
    setPhase(np);
    setRunning(false);
    setSecondsLeft(phaseMinutes(np, settings) * 60);
  }, [phase, settings, nextPhase, phaseMinutes]);

  // ---- tasks ----
  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    setTasks((ts) => [
      { id: crypto.randomUUID(), title, done: false, pomodoros: 0 },
      ...ts,
    ]);
    setNewTask("");
  };

  const toggleTask = (id: string) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const deleteTask = (id: string) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    setActiveTaskId((cur) => (cur === id ? null : cur));
  };

  // ---- derived ----
  const progress = 1 - secondsLeft / (phaseMinutes(phase, settings) * 60);
  const R = 132;
  const CIRC = 2 * Math.PI * R;
  const accent = PHASE_COLOR[phase];
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  // Chart is derived from `history` state (not a fresh localStorage parse each render),
  // so a per-second timer tick no longer re-parses the history JSON on the timer tab.
  const week = useMemo(() => last7Days(history), [history]);
  const weekPomos = useMemo(() => week.reduce((s, d) => s + d.pomodoros, 0), [week]);
  const weekMinutes = useMemo(() => week.reduce((s, d) => s + d.minutes, 0), [week]);
  const maxVal = useMemo(
    () => Math.max(1, ...week.map((d) => (chartMetric === "pomodoros" ? d.pomodoros : d.minutes))),
    [week, chartMetric]
  );
  const chartW = 300;
  const chartH = 150;
  const barGap = 12;
  const barW = (chartW - barGap * (week.length + 1)) / week.length;
  const todayRecord = week[week.length - 1];

  return (
    <div className="app" style={{ ["--accent" as string]: accent }}>
      <div className="window-controls">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">Pomodoro</span>
        </div>
        <div className="ctrl-cluster">
          <button
            className={noise.on ? "icon-btn active-noise" : "icon-btn"}
            onClick={() => setNoise((n) => ({ ...n, on: !n.on }))}
            aria-label={tr("top.noise")}
            title={noise.on ? tr("top.noise.on", { type: tr(NOISE_KEY[noise.type]) }) : tr("top.noise")}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            className="icon-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={tr("top.theme.toDark")}
            title={theme === "dark" ? tr("top.theme.toLight") : tr("top.theme.toDark")}
          >
            {theme === "dark" ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 2.5v2.2M12 19.3v2.2M4.5 4.5l1.6 1.6M17.9 17.9l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.5 19.5l1.6-1.6M17.9 6.1l1.6-1.6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 14.5A8 8 0 119.5 4 6.5 6.5 0 0020 14.5z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <button
            className={pinned ? "icon-btn active-pin" : "icon-btn"}
            onClick={() => setPinned((p) => !p)}
            aria-label={tr("top.pin")}
            title={pinned ? tr("top.unpin") : tr("top.pin")}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 4h6l-1 6 3.5 2.5-.5 1.5H13v6l-1 1-1-1v-6H7l-.5-1.5L9 10 9 4z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
                fill={pinned ? "currentColor" : "none"}
              />
            </svg>
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            aria-label={tr("top.settings")}
            title={tr("top.settings")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M19.4 13a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

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
        <div className="timer-view">
          <div className="phase-pills">
            {(["focus", "short", "long"] as Phase[]).map((p) => (
              <button
                key={p}
                className={phase === p ? "phase-pill active" : "phase-pill"}
                onClick={() => switchPhase(p)}
              >
                {tr(PHASE_KEY[p])}
              </button>
            ))}
          </div>

          <div className="ring-wrap">
            <svg className="ring" width="300" height="300" viewBox="0 0 300 300">
              <circle cx="150" cy="150" r={R} className="ring-track" />
              <circle
                cx="150"
                cy="150"
                r={R}
                className="ring-progress"
                stroke={accent}
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress)}
                transform="rotate(-90 150 150)"
              />
            </svg>
            <div className="ring-center">
              <div className="time">{fmt(secondsLeft)}</div>
              <div className="phase-label">{tr(PHASE_KEY[phase])}</div>
            </div>
          </div>

          {activeTask && (
            <div className="active-task">
              <span className="active-task-label">{tr("timer.focusing")}</span>
              <span className="active-task-title">{activeTask.title}</span>
            </div>
          )}

          <div className="controls">
            <button className="ctrl ctrl-reset" onClick={reset} aria-label={tr("control.reset")} title={tr("control.reset")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3M3 4v4h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="ctrl ctrl-main" onClick={toggle}>
              {running ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.5v13a1 1 0 001.5.87l10-6.5a1 1 0 000-1.74l-10-6.5A1 1 0 008 5.5z" />
                </svg>
              )}
            </button>
            <button className="ctrl ctrl-reset" onClick={skip} aria-label={tr("control.skip")} title={tr("control.skip")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M5 5l8 7-8 7V5z" fill="currentColor" />
                <rect x="16" y="5" width="2.4" height="14" rx="1" fill="currentColor" />
              </svg>
            </button>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat-num">{completedToday}</div>
              <div className="stat-label">{tr("stat.todayPomos")}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{focusMinutesToday}</div>
              <div className="stat-label">{tr("stat.focusMins")}</div>
            </div>
            <div className="stat">
              <div className="stat-num">
                {settings.longEvery - (completedToday % settings.longEvery)}
              </div>
              <div className="stat-label">{tr("stat.toLong")}</div>
            </div>
          </div>
        </div>
      ) : tab === "tasks" ? (
        <div className="tasks-view">
          <div className="task-add">
            <input
              className="task-input"
              placeholder={tr("task.addPlaceholder")}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              autoFocus
            />
            <button className="add-btn" onClick={addTask}>
              {tr("task.addBtn")}
            </button>
          </div>

          <div className="task-list">
            {tasks.length === 0 && (
              <div className="empty">
                <div className="empty-ico">{tr("task.empty.icon")}</div>
                <div>{tr("task.empty.title")}</div>
              </div>
            )}
            {tasks.map((t) => (
              <div key={t.id} className={t.done ? "task done" : "task"}>
                <button
                  className={t.id === activeTaskId ? "task-radio active" : "task-radio"}
                  onClick={() => setActiveTaskId(t.id === activeTaskId ? null : t.id)}
                  title={tr("task.activeHint")}
                >
                  {t.id === activeTaskId && <span className="task-radio-dot" />}
                </button>
                <span
                  className="task-check"
                  onClick={() => toggleTask(t.id)}
                  role="button"
                  aria-label={tr("task.done.aria")}
                >
                  {t.done && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="task-title">{t.title}</span>
                <span className="task-pomos" title={tr("task.pomoCount")}>
                  {t.pomodoros > 0 && `🍅 ${t.pomodoros}`}
                </span>
                <button className="task-del" onClick={() => deleteTask(t.id)} aria-label={tr("task.delete")}>
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="tasks-foot">
            {tr("task.footer", { total: tasks.length, done: tasks.filter((tt) => tt.done).length })}
          </div>
        </div>
      ) : (
        <div className="stats-view">
          <div className="stats-summary">
            <div className="summary-card">
              <div className="summary-num">{todayRecord.pomodoros}</div>
              <div className="summary-label">{tr("stats.card.today")}</div>
            </div>
            <div className="summary-card">
              <div className="summary-num">{weekPomos}</div>
              <div className="summary-label">{tr("stats.card.weekPomos")}</div>
            </div>
            <div className="summary-card">
              <div className="summary-num">{weekMinutes}</div>
              <div className="summary-label">{tr("stats.card.weekMins")}</div>
            </div>
          </div>

          <div className="chart-head">
            <span className="chart-title">{tr("stats.chart.title")}</span>
            <div className="chart-toggle">
              <button
                className={chartMetric === "pomodoros" ? "seg active" : "seg"}
                onClick={() => setChartMetric("pomodoros")}
              >
                {tr("stats.chart.pomos")}
              </button>
              <button
                className={chartMetric === "minutes" ? "seg active" : "seg"}
                onClick={() => setChartMetric("minutes")}
              >
                {tr("stats.chart.minutes")}
              </button>
            </div>
          </div>

          <svg className="chart" width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
            {week.map((d, i) => {
              const val = chartMetric === "pomodoros" ? d.pomodoros : d.minutes;
              const h = (val / maxVal) * (chartH - 36);
              const x = barGap + i * (barW + barGap);
              const y = chartH - 22 - h;
              const isToday = i === week.length - 1;
              return (
                <g key={d.date}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(h, val > 0 ? 4 : 0)}
                    rx={4}
                    className={isToday ? "chart-bar today" : "chart-bar"}
                    fill={isToday ? accent : "var(--chart-bar)"}
                  />
                  <text x={x + barW / 2} y={chartH - 7} textAnchor="middle" className="chart-axis">
                    {weekdayLabel(lang, d.dayIndex)}
                  </text>
                  {val > 0 && (
                    <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="chart-val">
                      {val}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="stats-foot">
            {weekPomos === 0
              ? tr("stats.footer.empty")
              : tr("stats.footer.avg", {
                  avg: (weekPomos / 7).toFixed(1),
                  mins: Math.round(weekMinutes / 7),
                })}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>{tr("settings.title")}</span>
              <button className="icon-btn" onClick={() => setShowSettings(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="field-divider">{tr("settings.section.general")}</div>
              <label className="field">
                <span>{tr("settings.language")}</span>
                <select
                  className="select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                >
                  {LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{tr("settings.focus")}</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={settings.focus}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, focus: Number(e.target.value) || 1 }))
                  }
                />
              </label>
              <label className="field">
                <span>{tr("settings.short")}</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.short}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, short: Number(e.target.value) || 1 }))
                  }
                />
              </label>
              <label className="field">
                <span>{tr("settings.long")}</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.long}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, long: Number(e.target.value) || 1 }))
                  }
                />
              </label>
              <label className="field">
                <span>{tr("settings.longEvery")}</span>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={settings.longEvery}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, longEvery: Number(e.target.value) || 4 }))
                  }
                />
              </label>
              <label className="field switch-field">
                <span>{tr("settings.sound")}</span>
                <button
                  className={settings.sound ? "switch on" : "switch"}
                  onClick={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
                  aria-label={tr("settings.sound")}
                >
                  <span className="switch-knob" />
                </button>
              </label>
              <label className="field switch-field">
                <span>{tr("settings.notifications")}</span>
                <button
                  className={settings.notifications ? "switch on" : "switch"}
                  onClick={() =>
                    setSettings((s) => ({ ...s, notifications: !s.notifications }))
                  }
                  aria-label={tr("settings.notifications")}
                >
                  <span className="switch-knob" />
                </button>
              </label>
              <label className="field switch-field">
                <span>{tr("settings.autoStartBreaks")}</span>
                <button
                  className={settings.autoStartBreaks ? "switch on" : "switch"}
                  onClick={() =>
                    setSettings((s) => ({ ...s, autoStartBreaks: !s.autoStartBreaks }))
                  }
                  aria-label={tr("settings.autoStartBreaks")}
                >
                  <span className="switch-knob" />
                </button>
              </label>
              <label className="field switch-field">
                <span>{tr("settings.autoStartFocus")}</span>
                <button
                  className={settings.autoStartFocus ? "switch on" : "switch"}
                  onClick={() =>
                    setSettings((s) => ({ ...s, autoStartFocus: !s.autoStartFocus }))
                  }
                  aria-label={tr("settings.autoStartFocus")}
                >
                  <span className="switch-knob" />
                </button>
              </label>

              <div className="field-divider">{tr("settings.section.noise")}</div>
              <label className="field">
                <span>{tr("settings.noiseType")}</span>
                <select
                  className="select"
                  value={noise.type}
                  onChange={(e) =>
                    setNoise((n) => ({ ...n, type: e.target.value as NoiseType }))
                  }
                >
                  <option value="brown">{tr("settings.noiseType.brown")}</option>
                  <option value="white">{tr("settings.noiseType.white")}</option>
                  <option value="pink">{tr("settings.noiseType.pink")}</option>
                </select>
              </label>
              <label className="field">
                <span>{tr("settings.volume")}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={noise.volume}
                  onChange={(e) => setNoise((n) => ({ ...n, volume: Number(e.target.value) }))}
                  className="range"
                />
              </label>

              <div className="field-divider">{tr("settings.section.hotkey")}</div>
              <label className="field">
                <span>{tr("settings.hotkey.startPause")}</span>
                <input
                  type="text"
                  className="hotkey-input"
                  value={settings.hotkey}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, hotkey: e.target.value.trim() }))
                  }
                  placeholder="CommandOrControl+Shift+P"
                />
              </label>
              <div className="field-hint">
                {tr("settings.hotkey.hint")}
                <code>CommandOrControl+Shift+P</code>
              </div>
            </div>
            <div className="modal-foot">
              <button
                className="ghost-btn"
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                  setNoise({ on: noise.on, type: DEFAULT_SETTINGS.noiseType, volume: DEFAULT_SETTINGS.noiseVolume });
                  setSecondsLeft(DEFAULT_SETTINGS.focus * 60);
                  setPhase("focus");
                }}
              >
                {tr("settings.reset")}
              </button>
              <button className="primary-btn" onClick={() => setShowSettings(false)}>
                {tr("settings.done")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
