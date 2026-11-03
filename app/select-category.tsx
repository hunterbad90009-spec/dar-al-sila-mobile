import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const categories = [
  { label: "سيارات ومركبات", icon: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=160&q=80" },
  { label: "عقارات للبيع", icon: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=160&q=80" },
  { label: "عقارات للإيجار", icon: "https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=160&q=80" },
  { label: "ألعاب وألعاب الفيديو", icon: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=160&q=80" },
  { label: "أجهزة إلكترونية وأجهزة منزلية", icon: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=160&q=80" },
  { label: "منزل وحدائق", icon: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=160&q=80" },
  { label: "موضة وأطفال", icon: "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=160&q=80" },
  { label: "جمال وصحة", icon: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=160&q=80" },
  { label: "طعام - غذاء", icon: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=160&q=80" },
  { label: "الخدمات", icon: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=160&q=80" },
  { label: "وظائف", icon: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=160&q=80" },
  { label: "حيوانات وإكسسوارات", icon: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=160&q=80" },
  { label: "ترفيه وكتب ومقتنيات", icon: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=160&q=80" },
  { label: "معدات رياضية ولياقة", icon: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=160&q=80" },
  { label: "تجهيزات ومعدات الشركات", icon: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=160&q=80" },
];

export default function SelectCategoryScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => categories.filter((item) => item.label.includes(query.trim())), [query]);
  const choose = (category: string) => {
    router.push({ pathname: "/image-upload", params: { category } });
  };

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.closeRow}><Pressable onPress={() => router.back()}><IconSymbol name="xmark" size={30} color={colors.foreground} /></Pressable></View>
        <Text style={[styles.title, { color: colors.foreground }]}>ما الذي تود بيعه او الإعلان عنه؟</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>اختر القسم المناسب لإضافة الإعلان</Text>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><TextInput value={query} onChangeText={setQuery} placeholder="إبحث في القسم" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.foreground }]} textAlign="right" /><IconSymbol name="magnifyingglass" size={26} color={colors.muted} /></View>
        <View style={styles.cards}>{filtered.map((item) => <Pressable key={item.label} onPress={() => choose(item.label)} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] }]}><IconSymbol name="chevron.left" size={27} color={colors.foreground} /><Text style={[styles.cardText, { color: colors.foreground }]}>{item.label}</Text><Image source={{ uri: item.icon }} style={styles.cardImage} /></Pressable>)}</View>
        {filtered.length === 0 && <Text style={[styles.empty, { color: colors.muted }]}>لا توجد أقسام مطابقة للبحث</Text>}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  closeRow: { alignItems: "flex-start", paddingTop: 10 },
  title: { fontSize: 27, fontWeight: "900", marginTop: 38, textAlign: "right" },
  subtitle: { fontSize: 15, marginTop: 8, textAlign: "right" },
  search: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 26, minHeight: 58, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontSize: 16 },
  cards: { gap: 14, marginTop: 18 },
  card: { alignItems: "center", borderRadius: 17, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 124, paddingHorizontal: 19 },
  cardImage: { borderRadius: 14, height: 70, width: 84 },
  cardText: { flex: 1, fontSize: 20, fontWeight: "900", marginHorizontal: 13, textAlign: "center" },
  empty: { fontSize: 15, marginTop: 40, textAlign: "center" },
});
