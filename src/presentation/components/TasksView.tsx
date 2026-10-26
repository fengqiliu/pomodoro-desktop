import { memo, useState } from "react";
import {
  filterTaskEntries,
  nextTaskCategory,
  type Task,
  type TaskCategory,
  type TaskStatusFilter,
} from "../../domain/tasks";
import { TaskAddForm } from "./TaskAddForm";
import { TaskFilterBar } from "./TaskFilterBar";
import { TaskItem } from "./TaskItem";

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
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const doneCount = tasks.filter((t) => t.done).length;
  const activeCount = tasks.length - doneCount;

  const commitEdit = (task: Task, title: string, estimate: number | undefined) => {
    if (title) onRenameTask?.(task.id, title);
    if (task.estimatedPomodoros !== estimate) onUpdateEstimate?.(task.id, estimate);
    setEditingId(null);
  };

  const displayedTasks = filterTaskEntries(tasks, {
    status: statusFilter,
    category: categoryFilter,
    keyword: searchQuery,
  });

  return (
    <div className="tasks-view">
      <TaskAddForm tr={tr} onAdd={onAdd} />

      <TaskFilterBar
        tr={tr}
        totalCount={tasks.length}
        activeCount={activeCount}
        doneCount={doneCount}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

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
        {displayedTasks.map(({ task: t, index }, visibleIndex) => (
          <TaskItem
            key={t.id}
            tr={tr}
            task={t}
            isActive={t.id === activeTaskId}
            isEditing={editingId === t.id}
            canMoveUp={visibleIndex > 0}
            canMoveDown={visibleIndex < displayedTasks.length - 1}
            onSetActive={() => onSetActiveTask(t.id === activeTaskId ? null : t.id)}
            onToggleDone={() => onToggleDone(t.id)}
            onDelete={() => onDelete(t.id)}
            onCycleCategory={() => onUpdateCategory?.(t.id, nextTaskCategory(t.category))}
            onStartEdit={() => setEditingId(t.id)}
            onCommitEdit={(title, estimate) => commitEdit(t, title, estimate)}
            onCancelEdit={() => setEditingId(null)}
            onMove={
              onMoveTask &&
              ((direction) => onMoveTask(index, displayedTasks[visibleIndex + direction].index))
            }
          />
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
});
