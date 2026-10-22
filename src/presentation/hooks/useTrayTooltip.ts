import { useEffect } from "react";
import { trayAdapter } from "../../infrastructure/platform";
import { formatClock, type Phase } from "../../domain/timer";
import { PHASE_KEY, type Tr } from "../i18n";

interface Options {
  running: boolean;
  secondsLeft: number;
  phase: Phase;
  tr: Tr;
}

// ---- tray tooltip mirrors the countdown while the window is hidden ----
export function useTrayTooltip({ running, secondsLeft, phase, tr }: Options) {
  useEffect(() => {
    const text = running
      ? `${formatClock(secondsLeft)} · ${tr(PHASE_KEY[phase])}`
      : tr("app.name");
    void trayAdapter.setTooltip(text);
  }, [running, secondsLeft, phase, tr]);
}
