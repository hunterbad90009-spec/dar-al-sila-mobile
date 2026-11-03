/**
 * Central language system for دار السلع (Arabic RTL / English LTR).
 *
 * - Arabic is the source language: every UI string is written in Arabic and wrapped in t().
 *   English comes from the single dictionary in ./en.ts (Arabic text → English text).
 * - The current language lives here (module state + React context) so plain functions
 *   (data layer errors, stylesheet mirroring) and components read the same value.
 * - Changing language re-mounts the app tree: every string and every mirrored style is
 *   recomputed while the app keeps running, and the choice is saved for the next launch.
 * - User-generated content (titles, descriptions, messages) is never translated.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nManager, Platform } from "react-native";
import { en } from "./en";

export type Lang = "ar" | "en";

const STORAGE_KEY = "dar_al_sila_lang";
let current: Lang = detectDeviceLang();
const listeners = new Set<(lang: Lang) => void>();

function detectDeviceLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "ar";
    return locale.toLowerCase().startsWith("en") ? "en" : "ar";
  } catch {
    return "ar";
  }
}

// Layout direction is handled by our own mirroring (lib/i18n/rtl.ts), so the native
// RTL flag must stay off; otherwise Arabic devices would flip every row a second time.
if (Platform.OS !== "web") {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

export function getLang(): Lang {
  return current;
}

/** True when the interface reads right-to-left (Arabic). */
export function isRTL(): boolean {
  return current === "ar";
}

function applyDocumentLang(lang: Lang) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    // The page stays dir="ltr": rows are mirrored in styles; this only sets the text direction default.
    document.documentElement.style.setProperty("direction", "ltr");
  }
}

function setLangInternal(lang: Lang) {
  current = lang;
  applyDocumentLang(lang);
  listeners.forEach((listener) => listener(lang));
}

const missing = new Set<string>();

/**
 * Translate an Arabic UI string. `vars` fill {placeholders}:
 * t("الصورة {n} من {total}", { n: 1, total: 3 })
 */
export function t(arabic: string, vars?: Record<string, string | number>): string {
  let text = arabic;
  if (current === "en") {
    const english = en[arabic];
    if (english === undefined) {
      if (__DEV__ && !missing.has(arabic)) {
        missing.add(arabic);
        console.warn(`[i18n] missing English for: ${arabic}`);
      }
    } else {
      text = english;
    }
  }
  if (vars) {
    for (const [key, value] of Object.entries(vars)) text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}

/** Pick the right language from a bilingual database row ({ name, name_ar }). */
export function pickName(row: { name?: string | null; name_ar?: string | null } | null | undefined): string {
  if (!row) return "";
  return (current === "en" ? row.name || row.name_ar : row.name_ar || row.name) ?? "";
}

/** Numbers, prices and dates in the active language. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(current === "ar" ? "ar-OM" : "en-OM", options).format(value);
  } catch {
    return String(value);
  }
}

export function formatPrice(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const amount = formatNumber(Number(value), { maximumFractionDigits: 3 });
  return current === "ar" ? `${amount} ر.ع.` : `OMR ${amount}`;
}

export function formatDate(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(value).toLocaleDateString(current === "ar" ? "ar-OM" : "en-GB", options ?? { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/** "منذ 3 ساعات" / "3 hours ago" */
export function timeAgo(value: Date | string | number): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  try {
    const rtf = new Intl.RelativeTimeFormat(current === "ar" ? "ar" : "en", { numeric: "auto" });
    for (const [unit, size] of units) if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
    return rtf.format(0, "minute");
  } catch {
    return formatDate(value);
  }
}

type LanguageContextValue = { lang: Lang; isRTL: boolean; setLang: (lang: Lang) => Promise<void>; t: typeof t };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!mounted) return;
        const next = saved === "ar" || saved === "en" ? saved : current;
        setLangInternal(next);
        setLangState(next);
      })
      .catch(() => applyDocumentLang(current))
      .finally(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  const setLang = useCallback(async (next: Lang) => {
    setLangInternal(next);
    setLangState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the choice still applies for this session */
    }
  }, []);

  const value = useMemo(() => ({ lang, isRTL: lang === "ar", setLang, t }), [lang, setLang]);

  if (!ready) return null;
  return <LanguageContext.Provider value={value}>{children(lang)}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: current, isRTL: current === "ar", setLang: async (next) => setLangInternal(next), t };
  return ctx;
}

export function onLanguageChange(listener: (lang: Lang) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
