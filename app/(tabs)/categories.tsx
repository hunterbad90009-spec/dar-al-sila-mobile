import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { ErrorState, Header, Loading } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { categoryStyle } from "@/lib/category-icons";
import { isRTL, pickName, t } from "@/lib/i18n";
import { useCategories } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

export default function CategoriesScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const categories = useCategories();

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header back={false} title={t("كل التصنيفات")} subtitle={t("اختر القسم للوصول إلى الإعلانات المناسبة لك")} />
        {categories.isLoading ? <Loading /> : categories.isError ? <ErrorState onRetry={() => categories.refetch()} /> : categories.top.map((top) => {
          const style = categoryStyle(top.slug);
          const groups = categories.childrenOf(top.id);
          return (
            <View key={top.id} style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: top.slug } })} style={styles.groupHeader}>
                <View style={[styles.iconCircle, { backgroundColor: scheme === "dark" ? colors.surfaceAlt : style.tint }]}><MaterialIcons name={style.icon} size={23} color={colors.primary} /></View>
                <Text style={[styles.groupTitle, { color: colors.foreground }]}>{pickName(top)}</Text>
                <Text style={[styles.viewAll, { color: colors.primary }]}>{t("عرض الكل")}</Text>
              </Pressable>
              {groups.length > 0 ? (
                <View style={styles.items}>
                  {groups.slice(0, 6).map((sub) => (
                    <Pressable key={sub.id} onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: sub.slug } })} style={({ pressed }) => [styles.item, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                      <Text style={[styles.itemText, { color: colors.foreground }]}>{pickName(sub)}</Text>
                      <MaterialIcons name={isRTL() ? "chevron-left" : "chevron-right"} size={20} color={colors.muted} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 30 },
  group: { borderRadius: 18, borderWidth: 1, marginTop: 13, padding: 14 },
  groupHeader: { alignItems: "center", flexDirection: "row-reverse", gap: 10 },
  iconCircle: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  groupTitle: { flex: 1, fontSize: 17, fontWeight: "900", textAlign: "right" },
  viewAll: { fontSize: 12, fontWeight: "800" },
  items: { gap: 4, marginTop: 10 },
  item: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 10 },
  itemText: { flex: 1, fontSize: 14, fontWeight: "600", textAlign: "right" },
});
