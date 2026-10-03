import { useCallback } from "react";
import { buildWeeklyReportCsv, type DayRecord } from "../../domain/stats";
import { weekdayLabel, type Lang } from "../i18n";

interface Options {
  lang: Lang;
  week: DayRecord[];
  showToast: (key: string) => void;
}

// CSV export of the weekly report — clipboard round-trip (browser & desktop),
// mirroring the backup UX in useBackup.ts. Labels are injected at the call
// site so the domain/stats module stays free of i18n.
export function useWeeklyReport({ lang, week, showToast }: Options) {
  const exportCsv = useCallback(async () => {
    try {
      const csv = buildWeeklyReportCsv(week, (dayIndex) => weekdayLabel(lang, dayIndex));
      await navigator.clipboard.writeText(csv);
      showToast("toast.exported");
    } catch {
      showToast("toast.copyFailed");
    }
  }, [lang, week, showToast]);

  return { exportCsv };
}
