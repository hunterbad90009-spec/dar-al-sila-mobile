import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const sections = ["أجهزة الألعاب الإلكترونية وإكسسواراتها", "ألعاب ودمى", "سكوترات ودراجات الأطفال", "ألعاب الطاولة والورق"];
const icons = ["gamecontroller.fill", "gift.fill", "bicycle", "circle.grid.2x2.fill"];

export default function GameCategoryScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => sections.filter((item) => item.includes(query.trim())), [query]);
  const choose = (section: string) => {
    if (section === sections[0]) return router.push("/gaming-devices");
    if (section === "ألعاب ودمى") return router.push({ pathname: "/game-subcategory" as any, params: { kind: "toys" } });
    if (section === "سكوترات ودراجات الأطفال") return router.push({ pathname: "/game-subcategory" as any, params: { kind: "scooters" } });
    if (section === "ألعاب الطاولة والورق") return router.push({ pathname: "/game-subcategory" as any, params: { kind: "board" } });
    return router.push({ pathname: "/image-upload" as any, params: { category: `ألعاب وألعاب الفيديو / ${section}` } });
  };
  return <ScreenContainer className="px-4"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.topBar}><Pressable onPress={() => router.back()}><IconSymbol name="xmark" size={30} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>ألعاب وألعاب الفيديو</Text><Pressable onPress={() => router.back()}><IconSymbol name="chevron.right" size={29} color={colors.foreground} /></Pressable></View><Text style={[styles.title, { color: colors.foreground }]}>ما الذي تود بيعه او الإعلان عنه؟</Text><Text style={[styles.subtitle, { color: colors.muted }]}>اختر القسم المناسب لإضافة الإعلان</Text><View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><TextInput value={query} onChangeText={setQuery} placeholder="إبحث في القسم" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.foreground }]} textAlign="right" /><IconSymbol name="magnifyingglass" size={26} color={colors.muted} /></View><View style={styles.cards}>{filtered.map((section) => { const index = sections.indexOf(section); return <Pressable key={section} onPress={() => choose(section)} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.7 }]}><IconSymbol name="chevron.left" size={28} color={colors.foreground} /><Text style={[styles.cardText, { color: colors.foreground }]}>{section}</Text><IconSymbol name={icons[index] as any} size={34} color={colors.primary} /></Pressable>; })}</View></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 28 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 9 }, topTitle: { fontSize: 23, fontWeight: "900" }, title: { fontSize: 27, fontWeight: "900", marginTop: 43, textAlign: "right" }, subtitle: { fontSize: 15, marginTop: 8, textAlign: "right" }, search: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 26, minHeight: 58, paddingHorizontal: 16 }, searchInput: { flex: 1, fontSize: 16 }, cards: { gap: 14, marginTop: 18 }, card: { alignItems: "center", borderRadius: 17, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 124, paddingHorizontal: 19 }, cardText: { flex: 1, fontSize: 20, fontWeight: "900", marginHorizontal: 14, textAlign: "center" } });
