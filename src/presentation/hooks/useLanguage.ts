import { useCallback, useEffect, useState } from "react";
import { LANG_KEY } from "../../infrastructure/storage";
import { translate, type Lang } from "../i18n";

// Language state + translator + persistence (<html lang> attribute included).
export function useLanguage() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) || "zh");

  const tr = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  return { lang, setLang, tr };
}