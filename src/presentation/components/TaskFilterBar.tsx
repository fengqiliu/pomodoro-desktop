import { useState } from "react";
import type { TaskCategory, TaskStatusFilter } from "../../domain/tasks";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  totalCount: number;
  activeCount: number;
  doneCount: number;
  statusFilter: TaskStatusFilter;
  onStatusFilterChange: (filter: TaskStatusFilter) => void;
  categoryFilter: TaskCategory | "all";
  onCategoryFilterChange: (category: TaskCategory | "all") => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export function TaskFilterBar({
  tr,
  totalCount,
  activeCount,
  doneCount,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  searchQuery,
  onSearchQueryChange,
}: Props) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <>
      <div className="task-filter-bar">
        <div className="task-status-pills" role="group" aria-label={tr("task.filter.label")}>
          <button
            className={statusFilter === "all" ? "status-pill active" : "status-pill"}
            aria-pressed={statusFilter === "all"}
            onClick={() => onStatusFilterChange("all")}
          >
            {tr("task.filter.all")}
            <span className="count-badge">{totalCount}</span>
          </button>
          <button
            className={statusFilter === "active" ? "status-pill active" : "status-pill"}
            aria-pressed={statusFilter === "active"}
            onClick={() => onStatusFilterChange("active")}
          >
            {tr("task.filter.active")}
            <span className="count-badge">{activeCount}</span>
          </button>
          <button
            className={statusFilter === "done" ? "status-pill active" : "status-pill"}
            aria-pressed={statusFilter === "done"}
            onClick={() => onStatusFilterChange("done")}
          >
            {tr("task.filter.done")}
            <span className="count-badge">{doneCount}</span>
          </button>
        </div>
        <div className="task-filter-actions">
          <select
            className="task-cat-filter-select"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value as TaskCategory | "all")}
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
            className={
              showSearch || searchQuery ? "task-search-toggle active" : "task-search-toggle"
            }
            onClick={() => {
              if (showSearch && searchQuery) onSearchQueryChange("");
              setShowSearch((v) => !v);
            }}
            title={tr("task.search")}
            aria-label={tr("task.search")}
            aria-expanded={showSearch || searchQuery !== ""}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
            onChange={(e) => onSearchQueryChange(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              className="task-search-clear"
              onClick={() => onSearchQueryChange("")}
              title={tr("task.searchClear")}
              aria-label={tr("task.searchClear")}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </>
  );
}
