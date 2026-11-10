import { useEffect } from "react";
import type { InterruptionKind } from "../../domain/stats";

interface Options {
  /** while the settings modal is open the shortcuts are inert */
  showSettings: boolean;
  toggle: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
  /** I / E — log an internal / external interruption (the callee decides whether it applies now) */
  interrupt: (kind: InterruptionKind) => void;
  /** Ctrl/Cmd+Z — run the pending toast action (undo the last delete), if any */
  undo: () => void;
}

/**
 * Pure key-resolution rule, extracted so it can be unit-tested without a DOM.
 * Returns which timer action a keydown should trigger, or null to let the
 * browser handle it natively.
 *
 * - Modifier combos are never shortcuts (Cmd+R, Ctrl+S, …), except Ctrl/Cmd+Z
 *   (undo the last task deletion) outside text fields, which keep native undo.
 * - Typing in a field is never a shortcut.
 * - Space is the native activation key for buttons/links/checkboxes — a focused control
 *   must keep it, otherwise keyboard users toggle the timer instead of the
 *   button they focused.
 */
/** ARIA roles whose widgets toggle/activate on Space, like native buttons. */
const SPACE_ACTIVATED_ROLES = new Set(["button", "checkbox", "switch"]);

export function resolveShortcut(
  e: {
    key: string;
    code: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey?: boolean;
  },
  target: {
    tagName: string;
    isContentEditable: boolean;
    getAttribute(n: string): string | null;
  } | null
): "toggle" | "reset" | "skip" | "interrupt-internal" | "interrupt-external" | "undo" | null {
  if (target) {
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
      return null;
    }
  }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
    return "undo";
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return null;

  if (e.code === "Space") {
    const onActivatable =
      !!target &&
      (target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        SPACE_ACTIVATED_ROLES.has(target.getAttribute("role") ?? ""));
    return onActivatable ? null : "toggle";
  }
  if (e.key === "r" || e.key === "R") return "reset";
  if (e.key === "s" || e.key === "S") return "skip";
  if (e.key === "i" || e.key === "I") return "interrupt-internal";
  if (e.key === "e" || e.key === "E") return "interrupt-external";
  return null;
}

// ---- in-app keyboard shortcuts: Space=开始/暂停, R=重置, S=跳过, Ctrl/Cmd+Z=撤销删除 ----
export function useAppShortcuts({ showSettings, toggle, reset, skip, interrupt, undo }: Options) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSettings) return;
      const action = resolveShortcut(e, e.target as HTMLElement | null);
      // Space only needs suppressing when we act on it, otherwise the page scrolls.
      if (action === "toggle" || action === "undo") e.preventDefault();
      if (action === "toggle") void toggle();
      else if (action === "reset") void reset();
      else if (action === "skip") void skip();
      else if (action === "interrupt-internal") interrupt("internal");
      else if (action === "interrupt-external") interrupt("external");
      else if (action === "undo") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings, toggle, reset, skip, interrupt, undo]);
}
