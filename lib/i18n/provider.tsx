"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries, type Locale, type MessageKey } from "./dictionaries";

const STORAGE_KEY = "credix.locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === "es" || saved === "en") setLocaleState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: MessageKey) => dictionaries[locale][key] ?? dictionaries.es[key] ?? key,
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n debe usarse dentro de <I18nProvider>");
  return ctx;
}

/** Traduce un codigo de error de validacion (ERR_*) al idioma activo. */
export function useErrorMessage() {
  const { t } = useI18n();
  return (code: string | null) => (code ? t(("err." + code) as MessageKey) : null);
}
