import { useEffect } from "react";

interface Options {
  /** while the settings modal is open the shortcuts are inert */
  showSettings: boolean;
  toggle: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
}

// ---- in-app keyboard shortcuts: Space=开始/暂停, R=重置, S=跳过 ----
export function useAppShortcuts({ showSettings, toggle, reset, skip }: Options) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSettings) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        void toggle();
      } else if (e.key === "r" || e.key === "R") {
        void reset();
      } else if (e.key === "s" || e.key === "S") {
        void skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings, toggle, reset, skip]);
}