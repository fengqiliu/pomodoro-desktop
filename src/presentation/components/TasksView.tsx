import { useState } from "react";
import type { Task } from "../../domain/tasks";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  tasks: Task[];
  activeTaskId: string | null;
  onSetActiveTask: (id: string | null) => void;
  onAdd: (title: string) => void;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onClearDone: () => void;
}

export function TasksView({
  tr,
  tasks,
  activeTaskId,
  onSetActiveTask,
  onAdd,
  onToggleDone,
  onDelete,
  onClearDone,
}: Props) {
  const [newTask, setNewTask] = useState("");
  const doneCount = tasks.filter((t) => t.done).length;

  const add = () => {
    const title = newTask.trim();
    if (!title) return;
    onAdd(title);
    setNewTask("");
  };

  return (
    <div className="tasks-view">
      <div className="task-add">
        <input
          className="task-input"
          placeholder={tr("task.addPlaceholder")}
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          autoFocus
        />
        <button className="add-btn" onClick={add}>
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
              onClick={() => onSetActiveTask(t.id === activeTaskId ? null : t.id)}
              title={tr("task.activeHint")}
            >
              {t.id === activeTaskId && <span className="task-radio-dot" />}
            </button>
            <span
              className="task-check"
              onClick={() => onToggleDone(t.id)}
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
            <button className="task-del" onClick={() => onDelete(t.id)} aria-label={tr("task.delete")}>
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="tasks-foot">
        <span>{tr("task.footer", { total: tasks.length, done: doneCount })}</span>
        {doneCount > 0 && (
          <button className="link-btn" onClick={onClearDone}>
            {tr("task.clearDone")}
          </button>
        )}
      </div>
    </div>
  );
}
