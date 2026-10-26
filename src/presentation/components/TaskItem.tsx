import { useRef, useState, type KeyboardEvent } from "react";
import {
  formatEstimateInput,
  formatTaskProgress,
  parseEstimate,
  type Task,
} from "../../domain/tasks";
import { TASK_CATEGORY_KEY } from "../i18n";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  task: Task;
  isActive: boolean;
  isEditing: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSetActive: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onCycleCategory: () => void;
  onStartEdit: () => void;
  /** title is already trimmed; empty means "keep the current title" */
  onCommitEdit: (title: string, estimate: number | undefined) => void;
  onCancelEdit: () => void;
  /** omitted → reorder buttons are not rendered */
  onMove?: (direction: -1 | 1) => void;
}

export function TaskItem({
  tr,
  task: t,
  isActive,
  isEditing,
  canMoveUp,
  canMoveDown,
  onSetActive,
  onToggleDone,
  onDelete,
  onCycleCategory,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onMove,
}: Props) {
  // Seeded from the task (not "") so a row that remounts while still in edit
  // mode shows — and on blur commits — the current values instead of blanks.
  const [editingTitle, setEditingTitle] = useState(() => t.title);
  const [editingEstimate, setEditingEstimate] = useState(() =>
    formatEstimateInput(t.estimatedPomodoros)
  );
  // Suppresses the blur-save that follows an explicit Enter/Escape, and the
  // focus move from the title input to the estimate input (same edit row).
  const ignoreBlurRef = useRef(false);
  const progress = formatTaskProgress(t);

  const startEditing = () => {
    setEditingTitle(t.title);
    setEditingEstimate(formatEstimateInput(t.estimatedPomodoros));
    ignoreBlurRef.current = false;
    onStartEdit();
  };

  const finishEditing = () => {
    ignoreBlurRef.current = true;
    onCommitEdit(editingTitle.trim(), parseEstimate(editingEstimate));
  };

  const cancelEditing = () => {
    ignoreBlurRef.current = true;
    onCancelEdit();
  };

  // Only leave edit mode when focus moves outside the whole edit row, so
  // tabbing/clicks between the title and estimate inputs keep it open.
  const handleEditBlur = (row: HTMLElement, next: EventTarget | null) => {
    if (row.contains(next as Node | null)) return;
    if (ignoreBlurRef.current) {
      ignoreBlurRef.current = false;
      return;
    }
    finishEditing();
  };

  const onEditKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") finishEditing();
    else if (e.key === "Escape") cancelEditing();
  };

  return (
    <div className={t.done ? "task done" : "task"}>
      <button
        className={isActive ? "task-radio active" : "task-radio"}
        onClick={onSetActive}
        title={tr("task.activeHint")}
        aria-label={tr("task.activeHint")}
        aria-pressed={isActive}
      >
        {isActive && <span className="task-radio-dot" />}
      </button>
      <span
        className="task-check"
        onClick={onToggleDone}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onToggleDone();
          }
        }}
        role="checkbox"
        aria-checked={t.done}
        tabIndex={0}
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

      {t.category ? (
        <button
          type="button"
          className={`task-cat-badge ${t.category}`}
          onClick={onCycleCategory}
          title={tr("task.categoryTag", { category: tr(TASK_CATEGORY_KEY[t.category]) })}
        >
          {tr(TASK_CATEGORY_KEY[t.category])}
        </button>
      ) : (
        <button
          type="button"
          className="task-cat-badge empty"
          onClick={onCycleCategory}
          title={tr("task.category.none")}
        >
          ·
        </button>
      )}

      {isEditing ? (
        <div
          className="task-edit-row"
          onBlur={(e) => handleEditBlur(e.currentTarget, e.relatedTarget)}
        >
          <input
            className="task-edit-input"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={onEditKeyDown}
            autoFocus
          />
          <input
            className="task-edit-est"
            type="number"
            min="1"
            max="99"
            inputMode="numeric"
            placeholder={tr("task.estPlaceholder")}
            title={tr("task.estimated")}
            aria-label={tr("task.estimated")}
            value={editingEstimate}
            onChange={(e) => setEditingEstimate(e.target.value)}
            onKeyDown={onEditKeyDown}
          />
        </div>
      ) : (
        <span
          className="task-title"
          title={`${t.title} (${tr("task.editTitle")})`}
          onDoubleClick={() => !t.done && startEditing()}
        >
          {t.title}
        </span>
      )}

      {!isEditing && progress && (
        <span className="task-pomos" title={tr("task.pomoCount")}>
          🍅 {progress}
        </span>
      )}
      <div className="task-actions">
        {onMove && !isEditing && (
          <>
            <button
              className="task-reorder-btn"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              title={tr("task.moveUp")}
              aria-label={tr("task.moveUp")}
            >
              ▲
            </button>
            <button
              className="task-reorder-btn"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              title={tr("task.moveDown")}
              aria-label={tr("task.moveDown")}
            >
              ▼
            </button>
          </>
        )}
        <button className="task-del" onClick={onDelete} aria-label={tr("task.delete")}>
          ×
        </button>
      </div>
    </div>
  );
}
