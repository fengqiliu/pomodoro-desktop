import { useCallback, useRef, useState } from "react";

// Transient toast message: an i18n key shown for 2.6s.
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((key: string) => {
    setToast(key);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  return { toast, showToast };
}