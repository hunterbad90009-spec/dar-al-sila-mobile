import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { Colors } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";
import { type AppearanceChoice, useThemeContext } from "@/lib/theme-provider";

const OPTIONS: { key: AppearanceChoice; label: string; swatch: [string, string] }[] = [
  { key: "original", label: "الأصلي", swatch: [Colors.light.background, Colors.light.primary] },
  { key: "white", label: "الأبيض", swatch: [Colors.white.background, Colors.white.primary] },
  { key: "dark", label: "الداكن", swatch: [Colors.dark.background, Colors.dark.primary] },
  { key: "auto", label: "حسب الجوال", swatch: [Colors.light.background, Colors.dark.background] },
];

/** Lets the user pick the app's look; the choice is saved on the device. */
export function AppearancePicker() {
  const colors = useColors();
  const { appearance, setAppearance } = useThemeContext();
  return (
    <View style={styles.row}>
      {OPTIONS.map((o) => {
        const active = appearance === o.key;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => setAppearance(o.key)}
            style={[styles.option, { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border }, active && styles.optionActive]}
          >
            <View style={styles.swatch}>
              <View style={[styles.half, { backgroundColor: o.swatch[0], borderColor: colors.border }]} />
              <View style={[styles.half, { backgroundColor: o.swatch[1], borderColor: colors.border }]} />
            </View>
            <Text numberOfLines={1} style={[styles.label, { color: active ? colors.primary : colors.foreground }]}>{t(o.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = createStyles({
  row: { flexDirection: "row-reverse", gap: 8 },
  option: { alignItems: "center", borderRadius: 14, borderWidth: 1, flex: 1, gap: 6, paddingHorizontal: 4, paddingVertical: 10 },
  optionActive: { borderWidth: 2 },
  swatch: { borderRadius: 10, flexDirection: "row", height: 26, overflow: "hidden", width: 40 },
  half: { borderWidth: 0.5, flex: 1 },
  label: { fontSize: 12, fontWeight: "800" },
});
