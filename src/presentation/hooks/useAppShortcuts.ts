import { useEffect } from "react";

interface Options {
  /** while the settings modal is open the shortcuts are inert */
  showSettings: boolean;
  toggle: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
}

/**
 * Pure key-resolution rule, extracted so it can be unit-tested without a DOM.
 * Returns which timer action a keydown should trigger, or null to let the
 * browser handle it natively.
 *
 * - Modifier combos are never shortcuts (Cmd+R, Ctrl+S, …).
 * - Typing in a field is never a shortcut.
 * - Space is the native activation key for buttons/links — a focused control
 *   must keep it, otherwise keyboard users toggle the timer instead of the
 *   button they focused.
 */
export function resolveShortcut(
  e: {
    key: string;
    code: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
  },
  target: { tagName: string; isContentEditable: boolean; getAttribute(n: string): string | null } | null
): "toggle" | "reset" | "skip" | null {
  if (target) {
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
      return null;
    }
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return null;

  if (e.code === "Space") {
    const onActivatable =
      !!target && (target.tagName === "BUTTON" || target.tagName === "A" || target.getAttribute("role") === "button");
    return onActivatable ? null : "toggle";
  }
  if (e.key === "r" || e.key === "R") return "reset";
  if (e.key === "s" || e.key === "S") return "skip";
  return null;
}

// ---- in-app keyboard shortcuts: Space=开始/暂停, R=重置, S=跳过 ----
export function useAppShortcuts({ showSettings, toggle, reset, skip }: Options) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSettings) return;
      const action = resolveShortcut(e, e.target as HTMLElement | null);
      // Space only needs suppressing when we act on it, otherwise the page scrolls.
      if (action === "toggle") e.preventDefault();
      if (action === "toggle") void toggle();
      else if (action === "reset") void reset();
      else if (action === "skip") void skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings, toggle, reset, skip]);
}