import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const groups: Record<string, { label: string; icon: "gift.fill" | "gamecontroller.fill" | "bicycle" | "circle.fill" }[]> = {
  toys: [
    { label: "مجسمات", icon: "gift.fill" },
    { label: "ألعاب تحكم عن بعد", icon: "gamecontroller.fill" },
    { label: "تركيب وبناء", icon: "gift.fill" },
    { label: "ألعاب ركوب", icon: "bicycle" },
    { label: "ألعاب تعليمية", icon: "gift.fill" },
    { label: "دمى", icon: "gift.fill" },
    { label: "سيارات ومركبات", icon: "gamecontroller.fill" },
    { label: "ألعاب أطفال", icon: "gift.fill" },
  ],
  scooters: [
    { label: "دراجات توازن", icon: "bicycle" },
    { label: "سكوترات أطفال", icon: "bicycle" },
    { label: "سيارات أطفال", icon: "gamecontroller.fill" },
  ],
  board: [
    { label: "شطرنج", icon: "circle.fill" },
    { label: "طاولة زهر", icon: "circle.fill" },
    { label: "داما", icon: "circle.fill" },
    { label: "ألعاب لوحية", icon: "gift.fill" },
    { label: "طاولات ألعاب", icon: "circle.fill" },
    { label: "أحاجي وبازل", icon: "gift.fill" },
    { label: "ألعاب ورق", icon: "gift.fill" },
    { label: "دومينو", icon: "circle.fill" },
  ],
};

const titles: Record<string, string> = { toys: "ألعاب ودمى", scooters: "سكوترات ودراجات الأطفال", board: "ألعاب الطاولة والورق" };

export default function GameSubcategoryScreen() {
  const colors = useColors();
  const { kind = "toys" } = useLocalSearchParams<{ kind?: string }>();
  const [query, setQuery] = useState("");
  const items = groups[kind] ?? groups.toys;
  const title = titles[kind] ?? titles.toys;
  const filtered = useMemo(() => items.filter((item) => item.label.includes(query.trim())), [items, query]);

  return <ScreenContainer className="px-4"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.topBar}><Pressable onPress={() => router.back()}><IconSymbol name="xmark" size={30} color={colors.foreground} /></Pressable><Text numberOfLines={1} style={[styles.topTitle, { color: colors.foreground }]}>{title}</Text><Pressable onPress={() => router.back()}><IconSymbol name="chevron.right" size={29} color={colors.foreground} /></Pressable></View><Text style={[styles.title, { color: colors.foreground }]}>ما الذي تود بيعه او الإعلان عنه؟</Text><Text style={[styles.subtitle, { color: colors.muted }]}>اختر القسم المناسب لإضافة الإعلان</Text><View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><TextInput value={query} onChangeText={setQuery} placeholder="إبحث في القسم" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.foreground }]} textAlign="right" /><IconSymbol name="magnifyingglass" size={26} color={colors.muted} /></View><View style={styles.cards}>{filtered.map((item) => <Pressable key={item.label} onPress={() => router.push({ pathname: "/image-upload" as any, params: { category: `ألعاب وألعاب الفيديو / ${title} / ${item.label}` } })} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={28} color={colors.foreground} /><Text style={[styles.cardText, { color: colors.foreground }]}>{item.label}</Text><IconSymbol name={item.icon} size={34} color={colors.primary} /></Pressable>)}</View></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 30 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 9 }, topTitle: { flex: 1, fontSize: 21, fontWeight: "900", marginHorizontal: 10, textAlign: "center" }, title: { fontSize: 27, fontWeight: "900", marginTop: 43, textAlign: "right" }, subtitle: { fontSize: 15, marginTop: 8, textAlign: "right" }, search: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 26, minHeight: 58, paddingHorizontal: 16 }, searchInput: { flex: 1, fontSize: 16 }, cards: { gap: 14, marginTop: 18 }, card: { alignItems: "center", borderRadius: 17, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 110, paddingHorizontal: 19 }, cardText: { flex: 1, fontSize: 20, fontWeight: "900", marginHorizontal: 14, textAlign: "center" }, pressed: { opacity: 0.7 } });
