import { useEffect } from "react";
import type { Phase } from "../../domain/timer";
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
      ? `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")} · ${tr(PHASE_KEY[phase])}`
      : tr("app.name");
  }, [running, secondsLeft, phase, tr]);
}