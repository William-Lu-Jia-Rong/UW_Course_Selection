import { createContext, useContext, useMemo } from "react";

export type Lang = "en" | "zh";

export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
];

export const DEFAULT_LANG: Lang = "en";

/** A string in every supported language, for text produced outside React components. */
export type Text = Record<Lang, string>;

export const same = (s: string): Text => ({ en: s, zh: s });

export interface Translate {
  (text: Text): string;
  (en: string, zh: string): string;
}

export function translator(lang: Lang): Translate {
  return ((a: string | Text, zh?: string) => (typeof a === "string" ? (lang === "zh" ? zh! : a) : a[lang])) as Translate;
}

/** English count with a naively pluralized noun, e.g. "1 course" / "3 courses". */
export const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** BCP 47 tag for date/number formatting. */
export const locale = (lang: Lang) => (lang === "zh" ? "zh-CN" : "en-CA");

const LangContext = createContext<Lang>(DEFAULT_LANG);

export const LangProvider = LangContext.Provider;

export const useLang = () => useContext(LangContext);

export function useT(): Translate {
  const lang = useLang();
  return useMemo(() => translator(lang), [lang]);
}
