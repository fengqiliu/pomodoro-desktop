import { useMemo, useState } from "react";
import "./App.css";
import { phaseMinutes, type Phase } from "../domain/timer";
import { last7Days } from "../domain/stats";
import { TopBar } from "./components/TopBar";
import { TimerView } from "./components/TimerView";
import { TasksView } from "./components/TasksView";
import { StatsView } from "./components/StatsView";
import { SettingsModal } from "./components/SettingsModal";
import type { ChartMetric, Tab } from "./uiTypes";
import { usePersistedState } from "./hooks/usePersistedState";
import { usePomodoroSession } from "./hooks/usePomodoroSession";
import { useTaskList } from "./hooks/useTaskList";
import { useToast } from "./hooks/useToast";
import { useTheme } from "./hooks/useTheme";
import { usePinned } from "./hooks/usePinned";
import { useLanguage } from "./hooks/useLanguage";
import { useNoise } from "./hooks/useNoise";
import { useHotkey } from "./hooks/useHotkey";
import { useSettingsDialog } from "./hooks/useSettingsDialog";
import { useAppShortcuts } from "./hooks/useAppShortcuts";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import { useBackup } from "./hooks/useBackup";

const PHASE_COLOR: Record<Phase, string> = {
  focus: "#ff5b5b",
  short: "#3ecf8e",
  long: "#4a90e2",
};

// Assembly root: composes the state/side-effect hooks above and renders the
// presentational components. Business rules live in hooks (session) + domain;
// keep new logic out of this file.
export default function App() {
  // ---- persisted domain state (save + daily reset side effects included) ----
  const {
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
  } = usePersistedState();

  const { lang, setLang, tr } = useLanguage();
  const { toast, showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const { pinned, setPinned } = usePinned();
  useNoise(noise);

  const {
    activeTaskId,
    setActiveTaskId,
    activeTask,
    addTask,
    toggleTask,
    deleteTask,
    clearDoneTasks,
  } = useTaskList({ tasks, setTasks });

  // ---- countdown engine + end-of-phase business rules ----
  const { phase, secondsLeft, running, toggle, reset, switchTo, skip } = usePomodoroSession({
    settings,
    cycleFocusCount,
    activeTaskId,
    tr,
    setCycleFocusCount,
    setDailyProgress,
    setHistory,
    setTasks,
  });

  const { hotkeyError, setHotkeyError } = useHotkey({ hotkey: settings.hotkey, toggle });
  const {
    showSettings,
    hotkeyDraft,
    changeHotkeyDraft,
    openSettings,
    closeSettings,
    resetSettings,
    saveSettings,
  } = useSettingsDialog({
    settings,
    setSettings,
    setNoise,
    setHotkeyError,
    resetTimer: reset,
  });

  useAppShortcuts({ showSettings, toggle, reset, skip });
  useDocumentTitle({ running, secondsLeft, phase, tr });
  const { exportData, importData } = useBackup({
    settings,
    tasks,
    dailyProgress,
    cycleFocusCount,
    noise,
    history,
    showToast,
    tr,
  });

  // ---- ui state ----
  const [tab, setTab] = useState<Tab>("timer");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("pomodoros");

  // ---- derived ----
  const progress = 1 - secondsLeft / (phaseMinutes(phase, settings) * 60);
  const accent = PHASE_COLOR[phase];
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
          onHotkeyDraftChange={changeHotkeyDraft}
          hotkeyError={hotkeyError}
          onClose={closeSettings}
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
