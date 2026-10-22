import { useEffect } from "react";
import { formatClock, type Phase } from "../../domain/timer";
import { PHASE_KEY, type Tr } from "../i18n";

interface Options {
  running: boolean;
  secondsLeft: number;
  phase: Phase;
  tr: Tr;
}

// ---- window title mirrors the countdown (dock/taskbar visibility) ----
export function useDocumentTitle({ running, secondsLeft, phase, tr }: Options) {
  useEffect(() => {
    document.title = running
      ? `${formatClock(secondsLeft)} · ${tr(PHASE_KEY[phase])}`
      : tr("app.name");
  }, [running, secondsLeft, phase, tr]);
}