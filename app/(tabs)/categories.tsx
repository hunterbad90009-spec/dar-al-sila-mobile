import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const groups = [
  { title: "السيارات", icon: "car.fill" as const, items: ["سيارات للبيع", "سيارات للإيجار", "قطع غيار", "دراجات"] },
  { title: "العقارات", icon: "house.fill" as const, items: ["شقق للبيع", "شقق للإيجار", "فلل", "أراضٍ"] },
  { title: "الوظائف", icon: "briefcase.fill" as const, items: ["وظائف شاغرة", "باحثون عن عمل", "تدريب"] },
  { title: "الإلكترونيات", icon: "desktopcomputer" as const, items: ["هواتف", "كمبيوترات", "أجهزة منزلية", "ألعاب"] },
  { title: "الخدمات", icon: "wrench.and.screwdriver.fill" as const, items: ["صيانة", "نقل", "تصميم", "دروس خصوصية"] },
];

export default function CategoriesScreen() {
  const colors = useColors();
  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>كل التصنيفات</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>اختر القسم للوصول إلى الإعلانات المناسبة لك</Text>
        {groups.map((group) => (
          <View key={group.title} style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.groupHeader}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + "18" }]}><IconSymbol name={group.icon} size={23} color={colors.primary} /></View>
              <Text style={[styles.groupTitle, { color: colors.foreground }]}>{group.title}</Text>
            </View>
            <View style={styles.items}>
              {group.items.map((item) => <Pressable key={item} onPress={() => item === "شقق للبيع" || item === "فلل" || item === "أراضٍ" ? router.push({ pathname: "/real-estate", params: { mode: "sale" } }) : item === "شقق للإيجار" ? router.push({ pathname: "/real-estate", params: { mode: "rent" } }) : item === "صيانة" || item === "نقل" || item === "تصميم" || item === "دروس خصوصية" ? router.push("/services") : Alert.alert(item, `سيتم عرض إعلانات ${item} في دار السلع.`)} style={({ pressed }) => [styles.item, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}><Text style={[styles.itemText, { color: colors.foreground }]}>{item}</Text><IconSymbol name="chevron.right" size={17} color={colors.muted} /></Pressable>)}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  title: { fontSize: 28, fontWeight: "900", marginTop: 14, textAlign: "right" },
  subtitle: { fontSize: 14, marginTop: 5, marginBottom: 22, textAlign: "right" },
  group: { borderRadius: 18, borderWidth: 1, marginBottom: 13, padding: 14 },
  groupHeader: { alignItems: "center", flexDirection: "row-reverse", gap: 10, marginBottom: 12 },
  iconCircle: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  groupTitle: { fontSize: 18, fontWeight: "800" },
  items: { gap: 8 },
  item: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", paddingBottom: 9, paddingTop: 4 },
  itemText: { fontSize: 14, fontWeight: "600" },
});
