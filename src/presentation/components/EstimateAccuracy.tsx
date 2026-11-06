import { useMemo } from "react";
import { calculateEstimateAccuracy, type Task } from "../../domain/tasks";
import "./EstimateAccuracy.css";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  tasks: Task[];
}

export function EstimateAccuracyCard({ tr, tasks }: Props) {
  const acc = useMemo(() => calculateEstimateAccuracy(tasks), [tasks]);
  const sign = acc.biasPercent > 0 ? "+" : "";

  return (
    <div className="estimate-accuracy">
      <div className="chart-head">
        <span className="chart-title">{tr("stats.estimate.title")}</span>
        {acc.sampleCount > 0 && (
          <span className={`estimate-badge ${acc.bias}`}>
            {sign}
            {acc.biasPercent}%
          </span>
        )}
      </div>

      {acc.sampleCount > 0 ? (
        <>
          <div className="estimate-line">
            {tr("stats.estimate.summary", {
              n: acc.sampleCount,
              estimated: acc.estimated,
              actual: acc.actual,
            })}
          </div>
          <div className="estimate-split">
            <span>{tr("stats.estimate.over", { n: acc.over })}</span>
            <span>{tr("stats.estimate.exact", { n: acc.exact })}</span>
            <span>{tr("stats.estimate.under", { n: acc.under })}</span>
          </div>
          <div className={`estimate-hint ${acc.bias}`}>{tr(`stats.estimate.hint.${acc.bias}`)}</div>
        </>
      ) : (
        <div className="estimate-empty">{tr("stats.estimate.empty")}</div>
      )}
    </div>
  );
}
