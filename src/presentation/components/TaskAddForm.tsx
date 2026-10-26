import { useState } from "react";
import { parseEstimate, type TaskCategory } from "../../domain/tasks";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  onAdd: (title: string, estimatedPomodoros?: number, category?: TaskCategory) => void;
}

export function TaskAddForm({ tr, onAdd }: Props) {
  const [newTask, setNewTask] = useState("");
  const [estimatedStr, setEstimatedStr] = useState("");
  const [newCategory, setNewCategory] = useState<TaskCategory | "">("");

  const add = () => {
    const title = newTask.trim();
    if (!title) return;
    const category = newCategory !== "" ? newCategory : undefined;
    onAdd(title, parseEstimate(estimatedStr), category);
    setNewTask("");
    setEstimatedStr("");
  };

  return (
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
  );
}
