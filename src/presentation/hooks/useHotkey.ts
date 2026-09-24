import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { isDesktop, shortcutAdapter } from "../../infrastructure/platform";

export type HotkeyError = "empty" | "registration" | null;

interface Options {
  hotkey: string;
  toggle: () => Promise<void>;
}

// Registers the global start/pause hotkey (desktop only; no-ops in the
// browser) and tracks whether the current combination failed to register.
export function useHotkey({ hotkey, toggle }: Options) {
  const [hotkeyError, setHotkeyError] = useState<HotkeyError>(null);

  // ---- global hotkey registration ----
  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    shortcutAdapter.register(hotkey, () => {
      void toggle();
    }).then((ok) => {
      if (cancelled) {
        if (ok) void shortcutAdapter.unregister(hotkey);
        return;
      }
      if (!ok) {
        setHotkeyError("registration");
        console.warn("hotkey registration failed:", hotkey);
      } else {
        setHotkeyError(null);
      }
    });
    return () => {
      cancelled = true;
      void shortcutAdapter.unregister(hotkey);
    };
  }, [hotkey, toggle]);

  return { hotkeyError, setHotkeyError } as {
    hotkeyError: HotkeyError;
    setHotkeyError: Dispatch<SetStateAction<HotkeyError>>;
  };
}