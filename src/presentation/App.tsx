import { useMemo, useState, type KeyboardEvent } from "react";
import "./App.css";
import { phaseMinutes, type Phase } from "../domain/timer";
import { last7Days } from "../domain/stats";
import { TopBar } from "./components/TopBar";
import { TimerView } from "./components/TimerView";
import { formatTaskProgress } from "../domain/tasks";
import { TasksView } from "./components/TasksView";

import { StatsView } from "./components/StatsView";
import { SettingsModal } from "./components/SettingsModal";
import "./a11y.css";
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
import { useTrayTooltip } from "./hooks/useTrayTooltip";
import { useBackup } from "./hooks/useBackup";
import { useWeeklyReport } from "./hooks/useWeeklyReport";

const TABS: { id: Tab; key: string }[] = [
  { id: "timer", key: "tab.timer" },
  { id: "tasks", key: "tab.tasks" },
  { id: "stats", key: "tab.stats" },
];

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

  const {
    activeTaskId,
    setActiveTaskId,
    activeTask,
    addTask,
    toggleTask,
    deleteTask,
    clearDoneTasks,
    moveTask,
    updateCategory,
    updateEstimate,
    renameTask,
  } = useTaskList({ tasks, setTasks });

  // ---- countdown engine + end-of-phase business rules ----
  const { phase, secondsLeft, running, toggle, reset, switchTo, skip } = usePomodoroSession({
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
  });

  useNoise({ noise, running, phase });

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
  useTrayTooltip({ running, secondsLeft, phase, tr });
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
  const { exportCsv } = useWeeklyReport({ lang, week, showToast });

  // Roving-tabindex arrow navigation for the tablist (WAI-ARIA pattern):
  // ←/→ cycle, Home/End jump to the ends. Only the selected tab is tabbable,
  // so Tab moves out of the tablist instead of walking all three buttons.
  const onTabListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const offset = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    let index = TABS.findIndex((t) => t.id === tab);
    if (e.key === "Home") index = 0;
    else if (e.key === "End") index = TABS.length - 1;
    else if (offset === 0) return;
    else {
      index = (index + offset + TABS.length) % TABS.length;
    }
    e.preventDefault();
    const next = TABS[index];
    setTab(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

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

      <div className="tabs" role="tablist" onKeyDown={onTabListKeyDown}>
        {TABS.map(({ id, key }) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`tabpanel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id)}
          >
            {tr(key)}
          </button>
        ))}
      </div>

      <div
        className="tab-panel"
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "timer" ? (
          <TimerView
            tr={tr}
            phase={phase}
            secondsLeft={secondsLeft}
            running={running}
            progress={progress}
            accent={accent}
            activeTaskTitle={
              activeTask
                ? formatTaskProgress(activeTask)
                  ? `${activeTask.title} (${formatTaskProgress(activeTask)} 🍅)`
                  : activeTask.title
                : null
            }
            dailyProgress={dailyProgress}
            dailyGoal={settings.dailyGoal}
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
            onMoveTask={moveTask}
            onRenameTask={renameTask}
            onUpdateCategory={updateCategory}
            onUpdateEstimate={updateEstimate}
          />
        ) : (
          <StatsView
            tr={tr}
            lang={lang}
            week={week}
            history={history}
            tasks={tasks}
            dailyGoal={settings.dailyGoal}
            chartMetric={chartMetric}
            accent={accent}
            onChartMetricChange={setChartMetric}
            onExportCsv={() => void exportCsv()}
          />
        )}
      </div>

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
