import { useEffect, useState } from "react";
import { windowAdapter } from "../../infrastructure/platform";
import { preferenceStore } from "../../infrastructure/storage";

// Always-on-top state: persisted locally, mirrored to the real window, and
// re-synced from the window on mount in case the OS/tool changed it meanwhile.
export function usePinned() {
  const [pinned, setPinned] = useState<boolean>(() => preferenceStore.getPinned());

  useEffect(() => {
    preferenceStore.setPinned(pinned);
    void windowAdapter.setAlwaysOnTop(pinned);
  }, [pinned]);

  // sync real window state on mount (in case OS changed it)
  useEffect(() => {
    void windowAdapter.isAlwaysOnTop().then(setPinned);
  }, []);

  return { pinned, setPinned };
}
