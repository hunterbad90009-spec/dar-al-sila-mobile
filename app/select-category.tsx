import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { ErrorState, Header, Input, Loading } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { categoryStyle } from "@/lib/category-icons";
import { isRTL, pickName, t } from "@/lib/i18n";
import { useCategories } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

/** Step 1 of creating a listing: drill down the category tree, then open the form. */
export default function SelectCategoryScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const categories = useCategories();
  const [path, setPath] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const parentId = path[path.length - 1] ?? null;

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return categories.all.filter((c) => `${c.name_ar} ${c.name}`.toLowerCase().includes(q)).slice(0, 40);
    return categories.childrenOf(parentId);
  }, [categories, parentId, query]);

  const choose = (id: number) => {
    if (!query && categories.childrenOf(id).length) { setPath([...path, id]); return; }
    router.replace({ pathname: "/(tabs)/post", params: { categoryId: String(id) } });
  };

  const parent = categories.byId(parentId);

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Header title={parent ? pickName(parent) : t("ما الذي تود بيعه أو الإعلان عنه؟")} subtitle={t("اختر القسم المناسب لإضافة الإعلان")} />
        {path.length ? <Pressable onPress={() => setPath(path.slice(0, -1))} style={styles.back}><MaterialIcons name={isRTL() ? "arrow-forward" : "arrow-back"} size={18} color={colors.primary} /><Text style={[styles.backText, { color: colors.primary }]}>{t("القسم السابق")}</Text></Pressable> : null}
        <Input value={query} onChangeText={setQuery} placeholder={t("ابحث في الأقسام")} style={{ marginTop: 10 }} />
        {parent && !query ? (
          <Pressable onPress={() => router.replace({ pathname: "/(tabs)/post", params: { categoryId: String(parent.id) } })} style={[styles.card, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text style={[styles.cardText, { color: colors.foreground }]}>{t("أضف في: {name}", { name: pickName(parent) })}</Text>
            <MaterialIcons name="check-circle" size={24} color={colors.primary} />
          </Pressable>
        ) : null}
        {categories.isLoading ? <Loading /> : categories.isError ? <ErrorState onRetry={() => categories.refetch()} /> : (
          <View style={styles.cards}>
            {options.map((item) => {
              const style = categoryStyle(categories.topOf(item.id)?.slug);
              const drill = !query && categories.childrenOf(item.id).length > 0;
              const top = categories.topOf(item.id);
              return (
                <Pressable key={item.id} onPress={() => choose(item.id)} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
                  <View style={[styles.icon, { backgroundColor: scheme === "dark" ? colors.surfaceAlt : style.tint }]}><MaterialIcons name={style.icon} size={26} color={colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardText, { color: colors.foreground }]}>{pickName(item)}</Text>
                    {query && top && top.id !== item.id ? <Text style={[styles.cardHint, { color: colors.muted }]}>{pickName(top)}</Text> : null}
                  </View>
                  <MaterialIcons name={drill ? (isRTL() ? "chevron-left" : "chevron-right") : "add-circle-outline"} size={24} color={colors.muted} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 30 },
  back: { alignItems: "center", alignSelf: "flex-end", flexDirection: "row-reverse", gap: 4, marginTop: 4 },
  backText: { fontSize: 13, fontWeight: "800" },
  cards: { gap: 10, marginTop: 14 },
  card: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginTop: 4, minHeight: 72, paddingHorizontal: 14 },
  icon: { alignItems: "center", borderRadius: 14, height: 48, justifyContent: "center", width: 48 },
  cardText: { fontSize: 16, fontWeight: "900", textAlign: "right" },
  cardHint: { fontSize: 11, marginTop: 3, textAlign: "right" },
});
