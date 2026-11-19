import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/es";
import "dayjs/locale/fr";
import "dayjs/locale/gu";
import "dayjs/locale/hi";

dayjs.extend(localizedFormat);

import { en, legalContent as enLegal } from "./en";
import { storage } from "@/src/utils/storage";

type LegalSection = { heading: string; body: string };
type LocaleBundle = { strings: Record<string, string>; legal: { terms?: LegalSection[]; privacy?: LegalSection[] } };

/* eslint-disable @typescript-eslint/no-require-imports */
const bundles: Record<string, LocaleBundle> = {
  en: { strings: en, legal: enLegal },
  es: require("./locales/es.json"),
  fr: require("./locales/fr.json"),
  gu: require("./locales/gu.json"),
  hi: require("./locales/hi.json"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "hi", label: "हिन्दी" },
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number]["code"];

const STORAGE_KEY = "app_locale";
let current: Locale = "en";

function isSupported(code: string | null | undefined): code is Locale {
  return SUPPORTED_LOCALES.some((l) => l.code === code);
}

function apply(next: Locale) {
  current = next;
  dayjs.locale(next);
}

export function t(key: string): string {
  return bundles[current]?.strings?.[key] ?? (en as Record<string, string>)[key] ?? key;
}

export function getLegal(kind: "terms" | "privacy"): LegalSection[] {
  const sections = bundles[current]?.legal?.[kind];
  return sections && sections.length ? sections : enLegal[kind];
}

export function getLocale(): Locale {
  return current;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({ locale: "en", setLocale: () => {} });

function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return isSupported(code) ? code : "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    apply(deviceLocale());
    return current;
  });

  useEffect(() => {
    storage.getItem(STORAGE_KEY, null).then((saved) => {
      if (typeof saved === "string" && isSupported(saved) && saved !== current) {
        apply(saved);
        setLocaleState(saved);
      }
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    apply(next);
    setLocaleState(next);
    storage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Subscribe a screen to language changes (re-renders it on switch). */
export function useLocale() {
  return useContext(LocaleContext);
}
