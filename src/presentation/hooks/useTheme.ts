import { useEffect, useState } from "react";
import { preferenceStore } from "../../infrastructure/storage";
import type { Theme } from "../uiTypes";

function systemTheme(): Theme {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

// Theme state + persistence + `data-theme` attribute on <html>.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (preferenceStore.getTheme() as Theme) || systemTheme()
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    preferenceStore.setTheme(theme);
  }, [theme]);

  return { theme, setTheme };
}
