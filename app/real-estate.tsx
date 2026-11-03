import { useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const propertyTypes = [
  { label: "سكني", icon: "building.2.fill" as const },
  { label: "تجاري", icon: "storefront.fill" as const },
  { label: "أراضي", icon: "location.fill" as const },
];

const stories = [
  { label: "شقق مسقط", image: "https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=180&q=80" },
  { label: "فلل راقية", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=180&q=80" },
  { label: "مكاتب", image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=180&q=80" },
  { label: "أراضٍ للبيع", image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=180&q=80" },
];

const listings = [
  { id: "1", operation: "rent", title: "شقة راقية غرفتان وصالة للإيجار", price: "420 ر.ع / شهريًا", location: "المعبيلة الجنوبية، مسقط", date: "اليوم", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80" },
  { id: "2", operation: "rent", title: "فيلا حديثة مع حديقة وموقفين", price: "950 ر.ع / شهريًا", location: "الخوض، مسقط", date: "أمس", image: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80" },
  { id: "3", operation: "rent", title: "مكتب تجاري في موقع حيوي", price: "680 ر.ع / شهريًا", location: "الغبرة، مسقط", date: "14-08-2026", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80" },
  { id: "4", operation: "sale", title: "أرض سكنية قريبة من الخدمات", price: "68,000 ر.ع", location: "السيب، مسقط", date: "13-08-2026", image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80" },
];

export default function RealEstateScreen() {
  const colors = useColors();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSale = mode === "sale";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("الأحدث");
  const filtered = useMemo(() => {
    const value = query.trim();
    const scoped = listings.filter((item) => item.operation === (isSale ? "sale" : "rent"));
    if (!value) return scoped;
    return scoped.filter((item) => `${item.title} ${item.location}`.includes(value));
  }, [query, isSale]);

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.greenHeader, { backgroundColor: colors.primary }]}>
          <View style={styles.headerActions}>
            <Pressable onPress={() => Alert.alert("الإشعارات", "لا توجد إشعارات جديدة")}><IconSymbol name="bell.fill" size={25} color="#FFFFFF" /></Pressable>
            <Pressable onPress={() => Alert.alert("مشاركة", "شارك قسم العقارات مع أصدقائك.")}><IconSymbol name="square.and.arrow.up" size={25} color="#FFFFFF" /></Pressable>
          </View>
          <View style={styles.searchWrap}>
            <TextInput value={query} onChangeText={setQuery} placeholder="إبحث في عقارات" placeholderTextColor="#5F6663" style={styles.searchInput} textAlign="right" />
            <IconSymbol name="magnifyingglass" size={25} color="#4C4C4C" />
          </View>
          <Pressable onPress={() => router.back()}><IconSymbol name="chevron.right" size={29} color="#FFFFFF" /></Pressable>
        </View>

        <View style={styles.headingRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>{isSale ? "عقارات للبيع" : "عقارات للإيجار"} <Text style={styles.count}>({filtered.length})</Text></Text>
        </View>

        <View style={styles.controlsRow}>
          <Pressable onPress={() => Alert.alert("الفلاتر", "السعر، عدد الغرف، المساحة، التأثيث، ونوع العقار.")} style={styles.control}><IconSymbol name="slider.horizontal.3" size={24} color="#C53B32" /></Pressable>
          <Pressable onPress={() => setSort(sort === "الأحدث" ? "الأقل سعرًا" : "الأحدث")} style={styles.control}><IconSymbol name="arrow.up.arrow.down" size={23} color={colors.foreground} /></Pressable>
          <Pressable onPress={() => Alert.alert("الخريطة", "اختر المدينة أو المنطقة لعرض العقارات القريبة.")} style={styles.control}><IconSymbol name="location.fill" size={24} color={colors.foreground} /></Pressable>
          <Pressable onPress={() => Alert.alert("المدينة", "كل المدن • مسقط • السيب • بوشر • العامرات")} style={[styles.citySelect, { borderColor: colors.border }]}><Text style={[styles.cityText, { color: colors.foreground }]}>كل المدن</Text><IconSymbol name="location.fill" size={21} color={colors.primary} /></Pressable>
        </View>

        {!isSale && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rentalRow}>
          {["شهري", "سنوي", "مفروش", "غير مفروش", "مع تأمين"].map((label) => <Pressable key={label} onPress={() => Alert.alert(label, `تطبيق فلتر ${label} على عقارات الإيجار`)} style={[styles.rentalChip, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.rentalText, { color: colors.foreground }]}>{label}</Text></Pressable>)}
        </ScrollView>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {propertyTypes.map((type) => <Pressable key={type.label} onPress={() => Alert.alert(type.label, `عرض إعلانات العقارات ${type.label}`)} style={[styles.typeChip, { backgroundColor: colors.surface }]}><IconSymbol name={type.icon} size={27} color={colors.primary} /><Text style={[styles.typeText, { color: colors.foreground }]}>{type.label}</Text></Pressable>)}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
          <Pressable onPress={() => Alert.alert("أضف قصة", "أضف قصة لعقارك من خلال نشر إعلان جديد.")} style={styles.story}><View style={[styles.storyCircle, styles.addStory]}><IconSymbol name="plus.circle.fill" size={32} color="#E28B18" /></View><Text style={[styles.storyText, { color: colors.foreground }]}>أضف قصة</Text></Pressable>
          {stories.map((story) => <Pressable key={story.label} onPress={() => Alert.alert(story.label, "استكشف العقارات المشابهة.")} style={styles.story}><Image source={{ uri: story.image }} style={styles.storyCircle} /><Text numberOfLines={1} style={[styles.storyText, { color: colors.foreground }]}>{story.label}</Text></Pressable>)}
        </ScrollView>

        <View style={[styles.mapCard, { borderColor: colors.border }]}>
          <View style={styles.mapDots}><View style={styles.mapDot} /><View style={[styles.mapDot, styles.mapDotTwo]} /><View style={[styles.mapDot, styles.mapDotThree]} /></View>
          <View style={styles.mapCopy}><Text style={[styles.mapTitle, { color: colors.foreground }]}>إبحث على الخريطة</Text><Text style={[styles.mapSubtitle, { color: colors.muted }]}>اعثر على العقار الأقرب لموقعك</Text><Pressable onPress={() => Alert.alert("الخريطة", "سيتم فتح خريطة العقارات حسب المدينة والمنطقة.")} style={[styles.mapButton, { backgroundColor: "#1686E8" }]}><Text style={styles.mapButtonText}>فتح الخريطة</Text><IconSymbol name="location.fill" size={22} color="#FFFFFF" /></Pressable></View>
        </View>

        <View style={styles.sectionHeader}><Pressable onPress={() => Alert.alert("الترتيب", `الترتيب الحالي: ${sort}`)}><Text style={[styles.more, { color: colors.primary }]}>تغيير</Text></Pressable><Text style={[styles.sectionTitle, { color: colors.foreground }]}>أحدث العقارات</Text></View>
        <View style={styles.listings}>
          {filtered.map((item) => <Pressable key={item.id} onPress={() => router.push(`/listing/${item.id}`)} style={({ pressed }) => [styles.listingCard, { borderColor: colors.border }, pressed && { opacity: 0.75 }]}><Image source={{ uri: item.image }} style={styles.listingImage} /><View style={styles.listingInfo}><View style={styles.trustBadge}><IconSymbol name="checkmark.seal.fill" size={14} color="#1686E8" /><Text style={styles.trustText}>مستخدم موثوق</Text></View><Text numberOfLines={2} style={[styles.listingTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.price, { color: colors.primary }]}>{item.price}</Text><Text style={[styles.location, { color: colors.muted }]}>{item.location} • {item.date}</Text></View></Pressable>)}
        </View>
      </ScrollView>
      <Pressable onPress={() => router.push("/(tabs)/post")} style={({ pressed }) => [styles.floating, { backgroundColor: "#E28B18" }, pressed && { opacity: 0.82, transform: [{ scale: 0.97 }] }]}><IconSymbol name="camera.fill" size={23} color="#FFFFFF" /><Text style={styles.floatingText}>أضف إعلان</Text><IconSymbol name="plus.circle.fill" size={18} color="#FFFFFF" /></Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 110 },
  greenHeader: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between", marginHorizontal: -1, paddingHorizontal: 15, paddingVertical: 17 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 19 },
  searchWrap: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 19, flex: 1, flexDirection: "row-reverse", gap: 8, height: 56, paddingHorizontal: 14 },
  searchInput: { color: "#202522", flex: 1, fontSize: 16 },
  headingRow: { paddingHorizontal: 17, paddingTop: 22 },
  title: { fontSize: 27, fontWeight: "900", textAlign: "right" },
  count: { fontSize: 18, fontWeight: "600" },
  controlsRow: { alignItems: "center", flexDirection: "row-reverse", gap: 10, paddingHorizontal: 17, paddingTop: 23 },
  control: { alignItems: "center", height: 42, justifyContent: "center", width: 39 },
  citySelect: { alignItems: "center", borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row-reverse", gap: 7, justifyContent: "flex-end", paddingHorizontal: 10, paddingVertical: 9 },
  cityText: { fontSize: 14, fontWeight: "800" },
  rentalRow: { flexDirection: "row-reverse", gap: 8, paddingHorizontal: 17, paddingTop: 16 },
  rentalChip: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  rentalText: { fontSize: 13, fontWeight: "800" },
  typeRow: { flexDirection: "row-reverse", gap: 10, paddingHorizontal: 17, paddingTop: 18 },
  typeChip: { alignItems: "center", borderRadius: 15, flexDirection: "row-reverse", gap: 8, paddingHorizontal: 18, paddingVertical: 12 },
  typeText: { fontSize: 15, fontWeight: "800" },
  storiesRow: { flexDirection: "row-reverse", gap: 15, paddingHorizontal: 17, paddingVertical: 18 },
  story: { alignItems: "center", width: 72 },
  storyCircle: { borderColor: "#76B64D", borderRadius: 34, borderWidth: 3, height: 63, width: 63 },
  addStory: { alignItems: "center", backgroundColor: "#FFFDF7", justifyContent: "center" },
  storyText: { fontSize: 10, fontWeight: "800", marginTop: 5, textAlign: "center" },
  mapCard: { backgroundColor: "#F0F8F4", borderRadius: 20, borderWidth: 1, flexDirection: "row-reverse", marginHorizontal: 12, minHeight: 166, overflow: "hidden", padding: 17 },
  mapDots: { backgroundColor: "#DAEDE1", borderRadius: 18, flex: 1, marginLeft: 10, overflow: "hidden", position: "relative" },
  mapDot: { backgroundColor: "#1686E8", borderColor: "#FFFFFF", borderRadius: 18, borderWidth: 4, height: 36, left: 25, position: "absolute", top: 30, width: 36 },
  mapDotTwo: { left: 72, top: 92 },
  mapDotThree: { left: 112, top: 55 },
  mapCopy: { flex: 1.2, justifyContent: "center" },
  mapTitle: { fontSize: 21, fontWeight: "900", textAlign: "right" },
  mapSubtitle: { fontSize: 11, marginTop: 4, textAlign: "right" },
  mapButton: { alignItems: "center", borderRadius: 25, flexDirection: "row-reverse", gap: 7, justifyContent: "center", marginTop: 15, paddingHorizontal: 13, paddingVertical: 12 },
  mapButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginHorizontal: 17, marginTop: 25 },
  sectionTitle: { fontSize: 22, fontWeight: "900", textAlign: "right" },
  more: { fontSize: 13, fontWeight: "800" },
  listings: { gap: 12, padding: 12 },
  listingCard: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", overflow: "hidden", padding: 8 },
  listingImage: { borderRadius: 13, height: 135, width: 142 },
  listingInfo: { flex: 1, paddingHorizontal: 10, paddingVertical: 4 },
  trustBadge: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#EAF5FF", borderRadius: 8, flexDirection: "row-reverse", gap: 4, paddingHorizontal: 6, paddingVertical: 3 },
  trustText: { color: "#1686E8", fontSize: 9, fontWeight: "800" },
  listingTitle: { fontSize: 14, fontWeight: "800", lineHeight: 20, marginTop: 8, textAlign: "right" },
  price: { fontSize: 15, fontWeight: "900", marginTop: 8, textAlign: "right" },
  location: { fontSize: 10, marginTop: 4, textAlign: "right" },
  floating: { alignItems: "center", borderRadius: 28, bottom: 73, elevation: 7, flexDirection: "row-reverse", gap: 8, justifyContent: "center", left: "18%", minHeight: 55, position: "absolute", shadowColor: "#806F5B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 7, width: "64%" },
  floatingText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
});
