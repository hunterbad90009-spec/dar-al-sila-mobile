/**
 * Layout mirroring for English (LTR).
 *
 * Every screen in دار السلع was designed visually right-to-left. Rather than keep two
 * copies of each layout, styles are mirrored at read time when the language is English:
 * row ↔ row-reverse, right ↔ left, start ↔ end alignment, and left/right offsets, margins,
 * paddings, borders and corner radii swap sides. Arabic reads the styles unchanged.
 *
 * `installStyleMirroring()` patches StyleSheet.create once at startup (see /index.js),
 * so every stylesheet in the app follows the active language without per-screen code.
 */
import { StyleSheet } from "react-native";
import { getLang, isRTL } from "./index";

type Style = Record<string, unknown>;

const SWAP_KEYS: [string, string][] = [
  ["left", "right"],
  ["marginLeft", "marginRight"],
  ["paddingLeft", "paddingRight"],
  ["borderLeftWidth", "borderRightWidth"],
  ["borderLeftColor", "borderRightColor"],
  ["borderTopLeftRadius", "borderTopRightRadius"],
  ["borderBottomLeftRadius", "borderBottomRightRadius"],
];

const flipEdge = (value: unknown) => (value === "flex-end" ? "flex-start" : value === "flex-start" ? "flex-end" : value);

/** Mirror one style object for LTR. Returns the same object when nothing changes. */
export function mirrorStyle<T>(style: T): T {
  if (!style || typeof style !== "object" || Array.isArray(style)) return style;
  const source = style as unknown as Style;
  const out: Style = { ...source };
  let changed = false;

  const direction = source.flexDirection;
  if (direction === "row") { out.flexDirection = "row-reverse"; changed = true; }
  else if (direction === "row-reverse") { out.flexDirection = "row"; changed = true; }

  if (source.textAlign === "right") { out.textAlign = "left"; changed = true; }
  else if (source.textAlign === "left") { out.textAlign = "right"; changed = true; }

  // In a column the cross axis is horizontal, so start/end alignment mirrors too.
  const isRow = direction === "row" || direction === "row-reverse";
  if (!isRow && (source.alignItems === "flex-end" || source.alignItems === "flex-start")) {
    out.alignItems = flipEdge(source.alignItems); changed = true;
  }
  if (source.alignSelf === "flex-end" || source.alignSelf === "flex-start") {
    out.alignSelf = flipEdge(source.alignSelf); changed = true;
  }

  for (const [a, b] of SWAP_KEYS) {
    if (a in source || b in source) {
      const va = source[a];
      const vb = source[b];
      delete out[a]; delete out[b];
      if (vb !== undefined) out[a] = vb;
      if (va !== undefined) out[b] = va;
      changed = true;
    }
  }
  return (changed ? out : style) as T;
}

/** Text alignment for the reading direction ("right" in Arabic, "left" in English). */
export const startAlign = (): "right" | "left" => (isRTL() ? "right" : "left");
/** Row direction that puts the first child at the reading start. */
export const startRow = (): "row-reverse" | "row" => (isRTL() ? "row-reverse" : "row");

/**
 * StyleSheet.create for app code. Styles are authored for Arabic (RTL); in English each
 * style is mirrored on read (row <-> row-reverse, text alignment, left/right swaps).
 * Library styles (navigation, etc.) are never touched, since they are authored LTR.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(styles: T & StyleSheet.NamedStyles<any>): T {
  const base = StyleSheet.create(styles as never) as unknown as Record<string, unknown>;
  const cache = new Map<string, unknown>();
  return new Proxy(base, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof key !== "string" || getLang() !== "en" || !value || typeof value !== "object") return value;
      if (!cache.has(key)) cache.set(key, mirrorStyle(value));
      return cache.get(key);
    },
  }) as unknown as T;
}
