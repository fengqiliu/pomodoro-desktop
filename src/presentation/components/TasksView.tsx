import { memo, useRef, useState } from "react";
import {
  filterTaskEntries,
  formatTaskProgress,
  type Task,
  type TaskCategory,
  type TaskStatusFilter,
} from "../../domain/tasks";
import { TASK_CATEGORY_KEY } from "../i18n";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  tasks: Task[];
  activeTaskId: string | null;
  onSetActiveTask: (id: string | null) => void;
  onAdd: (title: string, estimatedPomodoros?: number, category?: TaskCategory) => void;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onClearDone: () => void;
  onMoveTask?: (fromIndex: number, toIndex: number) => void;
  onRenameTask?: (id: string, newTitle: string) => void;
  onUpdateCategory?: (id: string, category?: TaskCategory) => void;
  onUpdateEstimate?: (id: string, estimated?: number) => void;
}

const NEXT_CATEGORY: Record<string, TaskCategory | undefined> = {
  "": "work",
  work: "study",
  study: "life",
  life: "other",
  other: undefined,
};

export const TasksView = memo(function TasksView({
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
  onUpdateCategory,
  onUpdateEstimate,
}: Props) {
  const [newTask, setNewTask] = useState("");
  const [estimatedStr, setEstimatedStr] = useState("");
  const [newCategory, setNewCategory] = useState<TaskCategory | "">("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingEstimate, setEditingEstimate] = useState("");
  // Suppresses the blur-save that follows an explicit Enter/Escape, and the
  // focus move from the title input to the estimate input (same edit row).
  const ignoreBlurRef = useRef(false);

  const doneCount = tasks.filter((t) => t.done).length;
  const activeCount = tasks.length - doneCount;

  const add = () => {
    const title = newTask.trim();
    if (!title) return;
    const estNum = parseInt(estimatedStr, 10);
    const estimated = !Number.isNaN(estNum) && estNum > 0 ? estNum : undefined;
    const category = newCategory !== "" ? newCategory : undefined;
    onAdd(title, estimated, category);
    setNewTask("");
    setEstimatedStr("");
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditingTitle(task.title);
    setEditingEstimate(
      task.estimatedPomodoros ? String(task.estimatedPomodoros) : ""
    );
    ignoreBlurRef.current = false;
  };

  const finishEditing = (id: string) => {
    ignoreBlurRef.current = true;
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameTask?.(id, trimmed);
    }
    const estNum = parseInt(editingEstimate, 10);
    const nextEstimate = !Number.isNaN(estNum) && estNum > 0 ? estNum : undefined;
    const task = tasks.find((t) => t.id === id);
    if (task && task.estimatedPomodoros !== nextEstimate) {
      onUpdateEstimate?.(id, nextEstimate);
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    ignoreBlurRef.current = true;
    setEditingId(null);
  };

  // Only leave edit mode when focus moves outside the whole edit row, so
  // tabbing/clicks between the title and estimate inputs keep it open.
  const handleEditBlur = (id: string, row: HTMLElement, next: EventTarget | null) => {
    if (row.contains(next as Node | null)) return;
    if (ignoreBlurRef.current) {
      ignoreBlurRef.current = false;
      return;
    }
    finishEditing(id);
  };

  const cycleCategory = (id: string, current?: TaskCategory) => {
    const next = NEXT_CATEGORY[current ?? ""];
    onUpdateCategory?.(id, next);
  };

  const displayedTasks = filterTaskEntries(tasks, {
    status: statusFilter,
    category: categoryFilter,
    keyword: searchQuery,
  });

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
        <select
          className="task-cat-select"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value as TaskCategory | "")}
          title={tr("task.category.all")}
          aria-label={tr("task.category.all")}
        >
          <option value="">{tr("task.category.none")}</option>
          <option value="work">{tr("task.category.work")}</option>
          <option value="study">{tr("task.category.study")}</option>
          <option value="life">{tr("task.category.life")}</option>
          <option value="other">{tr("task.category.other")}</option>
        </select>
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

      <div className="task-filter-bar">
        <div className="task-status-pills" role="group" aria-label="Task status filters">
          <button
            className={statusFilter === "all" ? "status-pill active" : "status-pill"}
            onClick={() => setStatusFilter("all")}
          >
            {tr("task.filter.all")}
            <span className="count-badge">{tasks.length}</span>
          </button>
          <button
            className={statusFilter === "active" ? "status-pill active" : "status-pill"}
            onClick={() => setStatusFilter("active")}
          >
            {tr("task.filter.active")}
            <span className="count-badge">{activeCount}</span>
          </button>
          <button
            className={statusFilter === "done" ? "status-pill active" : "status-pill"}
            onClick={() => setStatusFilter("done")}
          >
            {tr("task.filter.done")}
            <span className="count-badge">{doneCount}</span>
          </button>
        </div>
        <div className="task-filter-actions">
          <select
            className="task-cat-filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as TaskCategory | "all")}
            aria-label={tr("task.category.all")}
          >
            <option value="all">{tr("task.category.all")}</option>
            <option value="work">{tr("task.category.work")}</option>
            <option value="study">{tr("task.category.study")}</option>
            <option value="life">{tr("task.category.life")}</option>
            <option value="other">{tr("task.category.other")}</option>
          </select>
          <button
            type="button"
            className={showSearch || searchQuery ? "task-search-toggle active" : "task-search-toggle"}
            onClick={() => {
              if (showSearch && searchQuery) setSearchQuery("");
              setShowSearch((v) => !v);
            }}
            title={tr("task.search")}
            aria-label={tr("task.search")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>

      {(showSearch || searchQuery) && (
        <div className="task-search-row">
          <input
            className="task-search-input"
            placeholder={tr("task.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              className="task-search-clear"
              onClick={() => setSearchQuery("")}
              title={tr("task.searchClear")}
              aria-label={tr("task.searchClear")}
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className="task-list">
        {tasks.length === 0 && (
          <div className="empty">
            <div className="empty-ico">{tr("task.empty.icon")}</div>
            <div>{tr("task.empty.title")}</div>
          </div>
        )}
        {tasks.length > 0 && displayedTasks.length === 0 && (
          <div className="empty">
            <div className="empty-ico">🔍</div>
            <div>{tr("task.emptyFilter")}</div>
          </div>
        )}
        {displayedTasks.map(({ task: t, index: idx }, visibleIndex) => {
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

              {t.category ? (
                <button
                  type="button"
                  className={`task-cat-badge ${t.category}`}
                  onClick={() => cycleCategory(t.id, t.category)}
                  title={tr("task.categoryTag", { category: tr(TASK_CATEGORY_KEY[t.category]) })}
                >
                  {tr(TASK_CATEGORY_KEY[t.category])}
                </button>
              ) : (
                <button
                  type="button"
                  className="task-cat-badge empty"
                  onClick={() => cycleCategory(t.id, undefined)}
                  title={tr("task.category.none")}
                >
                  ·
                </button>
              )}

              {editingId === t.id ? (
                <div
                  className="task-edit-row"
                  onBlur={(e) => handleEditBlur(t.id, e.currentTarget, e.relatedTarget)}
                >
                  <input
                    className="task-edit-input"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishEditing(t.id);
                      else if (e.key === "Escape") cancelEditing();
                    }}
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishEditing(t.id);
                      else if (e.key === "Escape") cancelEditing();
                    }}
                  />
                </div>
              ) : (
                <span
                  className="task-title"
                  title={`${t.title} (${tr("task.editTitle")})`}
                  onDoubleClick={() => !t.done && startEditing(t)}
                >
                  {t.title}
                </span>
              )}

              {editingId !== t.id && progress && (
                <span className="task-pomos" title={tr("task.pomoCount")}>
                  🍅 {progress}
                </span>
              )}
              <div className="task-actions">
                {onMoveTask && editingId !== t.id && (
                  <>
                    <button
                      className="task-reorder-btn"
                      disabled={visibleIndex === 0}
                      onClick={() => onMoveTask(idx, displayedTasks[visibleIndex - 1].index)}
                      title={tr("task.moveUp")}
                      aria-label={tr("task.moveUp")}
                    >
                      ▲
                    </button>
                    <button
                      className="task-reorder-btn"
                      disabled={visibleIndex === displayedTasks.length - 1}
                      onClick={() => onMoveTask(idx, displayedTasks[visibleIndex + 1].index)}
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
});

