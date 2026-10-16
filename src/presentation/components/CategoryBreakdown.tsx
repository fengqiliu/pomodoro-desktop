import { useMemo } from "react";
import {
  calculateCategoryDistribution,
  type Task,
  type TaskCategory,
} from "../../domain/tasks";
import { TASK_CATEGORY_KEY } from "../i18n";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  tasks: Task[];
}

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  work: "var(--cat-work, #3b82f6)",
  study: "var(--cat-study, #8b5cf6)",
  life: "var(--cat-life, #10b981)",
  other: "var(--cat-other, #6b7280)",
};

export function CategoryBreakdownCard({ tr, tasks }: Props) {
  const dist = useMemo(() => calculateCategoryDistribution(tasks), [tasks]);
  const hasData = dist.totalPomodoros > 0;

  return (
    <div className="category-breakdown">
      <div className="chart-head">
        <span className="chart-title">{tr("stats.category.title")}</span>
        <span className="category-total-badge">
          {dist.totalPomodoros} 🍅
        </span>
      </div>

      {hasData ? (
        <>
          <div className="category-bar-wrap" role="progressbar" aria-label={tr("stats.category.title")}>
            {dist.items.map((item) => {
              if (item.pomodoros <= 0) return null;
              const segWidth = (item.pomodoros / dist.totalPomodoros) * 100;
              return (
                <div
                  key={item.category}
                  className={`category-bar-seg cat-${item.category}`}
                  style={{
                    width: `${segWidth}%`,
                    backgroundColor: CATEGORY_COLORS[item.category],
                  }}
                  title={`${tr(TASK_CATEGORY_KEY[item.category])}: ${item.pomodoros} 🍅 (${item.percent}%)`}
                />
              );
            })}
          </div>

          <div className="category-legend">
            {dist.items.map((item) => (
              <div key={item.category} className="category-legend-item">
                <span
                  className="category-legend-dot"
                  style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                />
                <span className="category-legend-name">
                  {tr(TASK_CATEGORY_KEY[item.category])}
                </span>
                <span className="category-legend-stats">
                  {item.pomodoros} 🍅 ({item.percent}%)
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="category-empty">
          {tr("stats.category.empty")}
        </div>
      )}
    </div>
  );
}
