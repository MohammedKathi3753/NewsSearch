import { en } from "./en";

const dictionaries = { en } as const;

export type Locale = keyof typeof dictionaries;

let locale: Locale = "en";

export function setLocale(next: Locale) {
  locale = next;
}

export function t(key: string): string {
  const dict = dictionaries[locale] as Record<string, string>;
  return dict[key] ?? (en as Record<string, string>)[key] ?? key;
}
