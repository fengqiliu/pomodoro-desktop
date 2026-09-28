import { useState } from "react";
import { formatTaskProgress, type Task } from "../../domain/tasks";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  tasks: Task[];
  activeTaskId: string | null;
  onSetActiveTask: (id: string | null) => void;
  onAdd: (title: string, estimatedPomodoros?: number) => void;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onClearDone: () => void;
  onMoveTask?: (fromIndex: number, toIndex: number) => void;
  onRenameTask?: (id: string, newTitle: string) => void;
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
  onMoveTask,
  onRenameTask,
}: Props) {
  const [newTask, setNewTask] = useState("");
  const [estimatedStr, setEstimatedStr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const doneCount = tasks.filter((t) => t.done).length;

  const add = () => {
    const title = newTask.trim();
    if (!title) return;
    const estNum = parseInt(estimatedStr, 10);
    const estimated = !Number.isNaN(estNum) && estNum > 0 ? estNum : undefined;
    onAdd(title, estimated);
    setNewTask("");
    setEstimatedStr("");
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditingTitle(task.title);
  };

  const finishEditing = (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameTask?.(id, trimmed);
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
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
        <input
          className="task-est-input"
          type="number"
          min="1"
          max="99"
          placeholder={tr("task.estPlaceholder")}
          title={tr("task.estimated")}
          value={estimatedStr}
          onChange={(e) => setEstimatedStr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
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
        {tasks.map((t, idx) => {
          const progress = formatTaskProgress(t);
          return (
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
              {editingId === t.id ? (
                <input
                  className="task-edit-input"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => finishEditing(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishEditing(t.id);
                    else if (e.key === "Escape") cancelEditing();
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="task-title"
                  title={`${t.title} (${tr("task.editTitle")})`}
                  onDoubleClick={() => !t.done && startEditing(t)}
                >
                  {t.title}
                </span>
              )}

              {progress && (
                <span className="task-pomos" title={tr("task.pomoCount")}>
                  🍅 {progress}
                </span>
              )}
              <div className="task-actions">
                {onMoveTask && (
                  <>
                    <button
                      className="task-reorder-btn"
                      disabled={idx === 0}
                      onClick={() => onMoveTask(idx, idx - 1)}
                      title={tr("task.moveUp")}
                      aria-label={tr("task.moveUp")}
                    >
                      ▲
                    </button>
                    <button
                      className="task-reorder-btn"
                      disabled={idx === tasks.length - 1}
                      onClick={() => onMoveTask(idx, idx + 1)}
                      title={tr("task.moveDown")}
                      aria-label={tr("task.moveDown")}
                    >
                      ▼
                    </button>
                  </>
                )}
                <button
                  className="task-del"
                  onClick={() => onDelete(t.id)}
                  aria-label={tr("task.delete")}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
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

