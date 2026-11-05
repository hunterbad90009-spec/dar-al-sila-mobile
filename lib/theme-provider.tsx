import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme, type PaletteName } from "@/constants/theme";

/** What the user picked: follow the phone, the original brand look, pure white, or dark green. */
export type AppearanceChoice = "auto" | "original" | "white" | "dark";
const APPEARANCE_KEY = "dar_al_sila_appearance";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  palette: PaletteName;
  appearance: AppearanceChoice;
  setAppearance: (choice: AppearanceChoice) => void;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [appearance, setAppearanceState] = useState<AppearanceChoice>("auto");

  useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_KEY)
      .then((saved) => {
        if (saved === "original" || saved === "white" || saved === "dark" || saved === "auto") setAppearanceState(saved);
      })
      .catch(() => undefined);
  }, []);

  const colorScheme: ColorScheme = appearance === "dark" ? "dark" : appearance === "auto" ? systemScheme : "light";
  const palette: PaletteName = appearance === "white" ? "white" : colorScheme;

  const setAppearance = useCallback((choice: AppearanceChoice) => {
    setAppearanceState(choice);
    AsyncStorage.setItem(APPEARANCE_KEY, choice).catch(() => undefined);
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => setAppearance(scheme === "dark" ? "dark" : "original"), [setAppearance]);

  useEffect(() => {
    nativewindColorScheme.set(colorScheme);
    if (appearance !== "auto") Appearance.setColorScheme?.(colorScheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = colorScheme;
      root.classList.toggle("dark", colorScheme === "dark");
      Object.entries(SchemeColors[palette]).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
      document.body.style.backgroundColor = SchemeColors[palette].background;
    }
  }, [appearance, colorScheme, palette]);

  const themeVariables = useMemo(
    () => vars(Object.fromEntries(Object.entries(SchemeColors[palette]).map(([token, value]) => [`color-${token}`, value]))),
    [palette],
  );

  const value = useMemo(
    () => ({ colorScheme, palette, appearance, setAppearance, setColorScheme }),
    [colorScheme, palette, appearance, setAppearance, setColorScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
