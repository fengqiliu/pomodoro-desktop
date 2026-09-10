import { PHASE_KEY } from "../i18n";
import { focusesUntilLongBreak, type Phase } from "../timer/timerRules";
import type { DailyProgress } from "../timer/timerRules";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  phase: Phase;
  secondsLeft: number;
  running: boolean;
  progress: number; // 0..1
  accent: string;
  activeTaskTitle: string | null;
  dailyProgress: DailyProgress;
  cycleFocusCount: number;
  longEvery: number;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
  onSwitchPhase: (p: Phase) => void;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerView({
  tr,
  phase,
  secondsLeft,
  running,
  progress,
  accent,
  activeTaskTitle,
  dailyProgress,
  cycleFocusCount,
  longEvery,
  onToggle,
  onReset,
  onSkip,
  onSwitchPhase,
}: Props) {
  const R = 132;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="timer-view">
      <div className="phase-pills">
        {(["focus", "short", "long"] as Phase[]).map((p) => (
          <button
            key={p}
            className={phase === p ? "phase-pill active" : "phase-pill"}
            onClick={() => onSwitchPhase(p)}
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

      {activeTaskTitle && (
        <div className="active-task">
          <span className="active-task-label">{tr("timer.focusing")}</span>
          <span className="active-task-title">{activeTaskTitle}</span>
        </div>
      )}

      <div className="controls">
        <button className="ctrl ctrl-reset" onClick={onReset} aria-label={tr("control.reset")} title={tr("control.reset")}>
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
        <button className="ctrl ctrl-main" onClick={onToggle}>
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
        <button className="ctrl ctrl-reset" onClick={onSkip} aria-label={tr("control.skip")} title={tr("control.skip")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M5 5l8 7-8 7V5z" fill="currentColor" />
            <rect x="16" y="5" width="2.4" height="14" rx="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-num">{dailyProgress.completedToday}</div>
          <div className="stat-label">{tr("stat.todayPomos")}</div>
        </div>
        <div className="stat">
          <div className="stat-num">{dailyProgress.focusMinutesToday}</div>
          <div className="stat-label">{tr("stat.focusMins")}</div>
        </div>
        <div className="stat">
          <div className="stat-num">{focusesUntilLongBreak(cycleFocusCount, longEvery)}</div>
          <div className="stat-label">{tr("stat.toLong")}</div>
        </div>
      </div>
    </div>
  );
}
