import { useCallback, useRef, useState } from "react";

export interface ToastAction {
  /** i18n key of the button label */
  labelKey: string;
  /** optional i18n key for the button tooltip (e.g. its keyboard shortcut) */
  titleKey?: string;
  onAction: () => void;
}

export interface Toast {
  /** i18n key (or already-translated text; `tr` falls back to it) */
  key: string;
  params?: Record<string, string | number>;
  action?: ToastAction;
}

const PLAIN_MS = 2600;
// A toast with a button (e.g. Undo) stays longer so there is time to reach it.
const ACTION_MS = 5000;

// Transient toast message, optionally carrying one action button.
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | null>(null);
  // Mirrors `toast` so runAction stays stable for keyboard listeners.
  const toastRef = useRef<Toast | null>(null);
  toastRef.current = toast;

  const dismissToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback(
    (key: string, action?: ToastAction, params?: Record<string, string | number>) => {
      setToast({ key, action, params });
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), action ? ACTION_MS : PLAIN_MS);
    },
    []
  );

  /** Runs the visible toast's action (button click or Ctrl/Cmd+Z), then hides it. */
  const runToastAction = useCallback(() => {
    const action = toastRef.current?.action;
    if (!action) return;
    toastRef.current = null;
    action.onAction();
    dismissToast();
  }, [dismissToast]);

  return { toast, showToast, dismissToast, runToastAction };
}
