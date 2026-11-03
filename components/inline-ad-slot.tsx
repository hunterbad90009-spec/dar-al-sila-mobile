import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function InlineAdSlot({ label = "مساحة إعلانية" }: { label?: string }) {
  const colors = useColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => undefined} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.mark, { backgroundColor: colors.primary }]}><Text style={styles.markText}>دار السلع</Text></View><View style={styles.copy}><Text style={[styles.title, { color: colors.foreground }]}>{label}</Text><Text style={[styles.subtitle, { color: colors.muted }]}>تظهر هنا العروض المعتمدة من إدارة المنصة</Text></View><Text style={[styles.badge, { color: colors.primary }]}>إعلان</Text></Pressable>;
}

const styles = StyleSheet.create({ card: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginHorizontal: 14, marginVertical: 10, padding: 12 }, mark: { alignItems: "center", borderRadius: 10, height: 48, justifyContent: "center", width: 48 }, markText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", textAlign: "center" }, copy: { flex: 1 }, title: { fontSize: 13, fontWeight: "900", textAlign: "right" }, subtitle: { fontSize: 11, marginTop: 4, textAlign: "right" }, badge: { fontSize: 11, fontWeight: "900" } });
