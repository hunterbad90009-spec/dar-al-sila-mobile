import * as Font from "expo-font";
import { useEffect, useState } from "react";

/**
 * Fonts the admin can pick for the home announcement (all SIL Open Font License).
 * A font file is only loaded when the announcement actually uses it.
 */
export type AnnouncementFont = "default" | "tajawal" | "amiri" | "lalezar";

export const ANNOUNCEMENT_FONTS: { key: AnnouncementFont; label: string }[] = [
  { key: "default", label: "الافتراضي" },
  { key: "tajawal", label: "تجوال" },
  { key: "amiri", label: "أميري" },
  { key: "lalezar", label: "لاله‌زار" },
];

const FILES: Record<Exclude<AnnouncementFont, "default">, { family: string; file: number }> = {
  tajawal: { family: "DarTajawal", file: require("@/assets/fonts/Tajawal-Bold.ttf") },
  amiri: { family: "DarAmiri", file: require("@/assets/fonts/Amiri-Bold.ttf") },
  lalezar: { family: "DarLalezar", file: require("@/assets/fonts/Lalezar-Regular.ttf") },
};

export function asAnnouncementFont(v: unknown): AnnouncementFont {
  return v === "tajawal" || v === "amiri" || v === "lalezar" ? v : "default";
}

/** Returns the fontFamily to use (undefined = system font, also while loading or if loading fails). */
export function useAnnouncementFont(font: AnnouncementFont): string | undefined {
  const entry = font === "default" ? null : FILES[font];
  const [ready, setReady] = useState(() => Boolean(entry && Font.isLoaded(entry.family)));
  useEffect(() => {
    if (!entry) return;
    if (Font.isLoaded(entry.family)) { setReady(true); return; }
    let alive = true;
    setReady(false);
    Font.loadAsync({ [entry.family]: entry.file }).then(() => alive && setReady(true), () => undefined);
    return () => { alive = false; };
  }, [entry]);
  return entry && ready ? entry.family : undefined;
}
