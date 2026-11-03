import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";

/** Shown where an interactive map is not available: the chosen area, with no fake controls. */
export function LocationCard({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceAlt }]} accessibilityLabel={title}>
      <View style={[styles.pin, { backgroundColor: colors.primary, borderColor: colors.surface }]}><MaterialIcons name="location-on" size={26} color={colors.accent} /></View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>{t("اختر المحافظة والولاية من القائمة أدناه")}</Text>
    </View>
  );
}

const styles = createStyles({
  card: { alignItems: "center", flex: 1, gap: 8, justifyContent: "center", minHeight: 200, padding: 20 },
  pin: { alignItems: "center", borderRadius: 28, borderWidth: 4, height: 56, justifyContent: "center", width: 56 },
  title: { fontSize: 17, fontWeight: "900", textAlign: "center" },
  note: { fontSize: 12, textAlign: "center" },
});
