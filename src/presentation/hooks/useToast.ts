import { useCallback, useRef, useState } from "react";

export interface ToastAction {
  /** i18n key of the button label */
  labelKey: string;
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

  return { toast, showToast, dismissToast };
}
