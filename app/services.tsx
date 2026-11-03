import { useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const paidServices = [
  { title: "تمييز الإعلان", detail: "إظهار إعلانك في أعلى النتائج لمدة محددة", price: "يبدأ من 1 ر.ع" },
  { title: "إعلان مميز", detail: "بطاقة بارزة مع أولوية ظهور في القسم", price: "يبدأ من 3 ر.ع" },
  { title: "رفع الإعلان", detail: "تحديث ترتيب إعلانك المنشور مرة واحدة", price: "يبدأ من 2 ر.ع" },
];

const serviceTypes = [
  { label: "تدريس وتدريب", icon: "briefcase.fill" as const },
  { label: "نقل وتوصيل", icon: "truck.box.fill" as const },
  { label: "صيانة يدوية", icon: "wrench.and.screwdriver.fill" as const },
  { label: "تنظيف وغسيل", icon: "sparkles" as const },
  { label: "صحة وجمال", icon: "heart.fill" as const },
  { label: "فعاليات ومناسبات", icon: "megaphone.fill" as const },
  { label: "إعلانات ومقاولات", icon: "building.2.fill" as const },
  { label: "رعاية منزلية", icon: "house.fill" as const },
];

const stories = [
  { label: "خدمات منزلية", image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=180&q=80" },
  { label: "نقل وتوصيل", image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d8?auto=format&fit=crop&w=180&q=80" },
  { label: "صحة وجمال", image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=180&q=80" },
  { label: "مناسبات", image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=180&q=80" },
];

const listings = [
  { id: "1", title: "تنظيف منازل وتعقيم شامل", price: "ابتداءً من 10 ر.ع", location: "مسقط، جميع المناطق", date: "اليوم", image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80" },
  { id: "2", title: "نقل أثاث وتوصيل داخل مسقط", price: "حسب الطلب", location: "السيب، مسقط", date: "أمس", image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d8?auto=format&fit=crop&w=800&q=80" },
  { id: "3", title: "صيانة مكيفات وأجهزة منزلية", price: "5 ر.ع للزيارة", location: "بوشر، مسقط", date: "13-08-2026", image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80" },
  { id: "4", title: "تصوير مناسبات وفعاليات", price: "من 80 ر.ع", location: "الخوض، مسقط", date: "12-08-2026", image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80" },
];

export default function ServicesScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("الأحدث");
  const filtered = useMemo(() => {
    const value = query.trim();
    if (!value) return listings;
    return listings.filter((item) => `${item.title} ${item.location}`.includes(value));
  }, [query]);

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerActions}><Pressable onPress={() => Alert.alert("الإشعارات", "لا توجد إشعارات جديدة")}><IconSymbol name="bell.fill" size={25} color="#FFFFFF" /></Pressable><Pressable onPress={() => Alert.alert("مشاركة", "شارك قسم الخدمات مع أصدقائك.")}><IconSymbol name="square.and.arrow.up" size={25} color="#FFFFFF" /></Pressable></View>
          <View style={styles.searchWrap}><TextInput value={query} onChangeText={setQuery} placeholder="إبحث في خدمات" placeholderTextColor="#6B5454" style={styles.searchInput} textAlign="right" /><IconSymbol name="magnifyingglass" size={25} color="#4C4C4C" /></View>
          <Pressable onPress={() => router.back()}><IconSymbol name="chevron.right" size={29} color="#FFFFFF" /></Pressable>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>الخدمات <Text style={styles.count}>({filtered.length})</Text></Text>
        <Text style={[styles.paidHeading, { color: colors.foreground }]}>خدمات دار السلع المدفوعة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paidRow}>{paidServices.map((service) => <Pressable key={service.title} onPress={() => Alert.alert("الدفع الإلكتروني", `سيتم تجهيز طلب «${service.title}» بعد اختيار الإعلان. لا تُخصم أي مبالغ في هذه المرحلة.`)} style={[styles.paidCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.paidTitle, { color: colors.foreground }]}>{service.title}</Text><Text style={[styles.paidDetail, { color: colors.muted }]}>{service.detail}</Text><Text style={[styles.paidPrice, { color: "#D52F37" }]}>{service.price}</Text></Pressable>)}</ScrollView>
        <View style={styles.controlsRow}><Pressable onPress={() => Alert.alert("الفلاتر", "السعر، نوع الخدمة، التقييم، والموعد.")} style={styles.control}><IconSymbol name="slider.horizontal.3" size={24} color="#D52F37" /></Pressable><Pressable onPress={() => setSort(sort === "الأحدث" ? "الأعلى تقييمًا" : "الأحدث")} style={styles.control}><IconSymbol name="arrow.up.arrow.down" size={23} color={colors.foreground} /></Pressable><Pressable onPress={() => Alert.alert("المدينة", "كل المدن • مسقط • السيب • بوشر • العامرات")} style={[styles.citySelect, { borderColor: colors.border }]}><Text style={[styles.cityText, { color: colors.foreground }]}>كل المدن</Text><IconSymbol name="location.fill" size={22} color="#D52F37" /></Pressable></View>

        <View style={styles.serviceGrid}>{serviceTypes.map((type) => <Pressable key={type.label} onPress={() => Alert.alert(type.label, `عرض خدمات ${type.label}`)} style={[styles.serviceChip, { backgroundColor: colors.surface }]}><IconSymbol name={type.icon} size={25} color="#D52F37" /><Text style={[styles.serviceText, { color: colors.foreground }]}>{type.label}</Text></Pressable>)}</View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}><Pressable onPress={() => Alert.alert("أضف قصة", "أضف قصة لخدمتك من خلال نشر إعلان جديد.")} style={styles.story}><View style={styles.addStory}><IconSymbol name="plus.circle.fill" size={32} color="#E28B18" /></View><Text style={[styles.storyText, { color: colors.foreground }]}>أضف قصة</Text></Pressable>{stories.map((story) => <Pressable key={story.label} onPress={() => Alert.alert(story.label, "استكشف مقدمي الخدمة.")} style={styles.story}><Image source={{ uri: story.image }} style={styles.storyImage} /><Text numberOfLines={1} style={[styles.storyText, { color: colors.foreground }]}>{story.label}</Text></Pressable>)}</ScrollView>

        <View style={styles.sectionHeader}><Pressable onPress={() => Alert.alert("الترتيب", `الترتيب الحالي: ${sort}`)}><Text style={[styles.more, { color: "#D52F37" }]}>تغيير</Text></Pressable><Text style={[styles.sectionTitle, { color: colors.foreground }]}>خدمات موثوقة بالقرب منك</Text></View>
        <View style={styles.listings}>{filtered.map((item) => <Pressable key={item.id} onPress={() => router.push(`/listing/${item.id}`)} style={({ pressed }) => [styles.listingCard, { borderColor: colors.border }, pressed && { opacity: 0.75 }]}><Image source={{ uri: item.image }} style={styles.listingImage} /><View style={styles.listingInfo}><View style={styles.trustBadge}><IconSymbol name="checkmark.seal.fill" size={14} color="#2E9B43" /><Text style={styles.trustText}>نشاط تجاري موثوق</Text></View><Text numberOfLines={2} style={[styles.listingTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={styles.price}>{item.price}</Text><Text style={[styles.location, { color: colors.muted }]}>{item.location} • {item.date}</Text></View></Pressable>)}</View>
      </ScrollView>
      <Pressable onPress={() => router.push("/(tabs)/post")} style={({ pressed }) => [styles.floating, pressed && { opacity: 0.82, transform: [{ scale: 0.97 }] }]}><IconSymbol name="camera.fill" size={23} color="#FFFFFF" /><Text style={styles.floatingText}>أضف إعلان</Text><IconSymbol name="plus.circle.fill" size={18} color="#FFFFFF" /></Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 110 },
  header: { alignItems: "center", backgroundColor: "#D52F37", flexDirection: "row", gap: 12, justifyContent: "space-between", paddingHorizontal: 15, paddingVertical: 17 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 19 },
  searchWrap: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 19, flex: 1, flexDirection: "row-reverse", gap: 8, height: 56, paddingHorizontal: 14 },
  searchInput: { color: "#202522", flex: 1, fontSize: 16 },
  title: { fontSize: 28, fontWeight: "900", paddingHorizontal: 17, paddingTop: 23, textAlign: "right" },
  paidHeading: { fontSize: 18, fontWeight: "900", paddingHorizontal: 17, paddingTop: 20, textAlign: "right" },
  paidRow: { gap: 10, paddingHorizontal: 17, paddingVertical: 12 },
  paidCard: { borderRadius: 15, borderWidth: 1, minHeight: 125, padding: 13, width: 205 },
  paidTitle: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  paidDetail: { fontSize: 11, lineHeight: 17, marginTop: 7, textAlign: "right" },
  paidPrice: { fontSize: 12, fontWeight: "900", marginTop: 8, textAlign: "right" },
  count: { fontSize: 18, fontWeight: "600" },
  controlsRow: { alignItems: "center", flexDirection: "row-reverse", gap: 10, paddingHorizontal: 17, paddingTop: 23 },
  control: { alignItems: "center", height: 42, justifyContent: "center", width: 40 },
  citySelect: { alignItems: "center", borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row-reverse", gap: 7, justifyContent: "flex-end", paddingHorizontal: 10, paddingVertical: 9 },
  cityText: { fontSize: 14, fontWeight: "800" },
  serviceGrid: { columnGap: 0, flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 17, paddingTop: 18, rowGap: 10 },
  serviceChip: { alignItems: "center", borderRadius: 15, flexDirection: "row-reverse", gap: 8, justifyContent: "flex-end", minHeight: 55, paddingHorizontal: 12, width: "48%" },
  serviceText: { flex: 1, fontSize: 13, fontWeight: "800", textAlign: "right" },
  storiesRow: { flexDirection: "row-reverse", gap: 15, paddingHorizontal: 17, paddingVertical: 19 },
  story: { alignItems: "center", width: 76 },
  storyImage: { borderColor: "#76B64D", borderRadius: 34, borderWidth: 3, height: 63, width: 63 },
  addStory: { alignItems: "center", backgroundColor: "#FFFDF7", borderColor: "#E28B18", borderRadius: 34, borderStyle: "dashed", borderWidth: 3, height: 63, justifyContent: "center", width: 63 },
  storyText: { fontSize: 10, fontWeight: "800", marginTop: 5, textAlign: "center" },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginHorizontal: 17, marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: "900", textAlign: "right" },
  more: { fontSize: 13, fontWeight: "800" },
  listings: { gap: 12, padding: 12 },
  listingCard: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", overflow: "hidden", padding: 8 },
  listingImage: { borderRadius: 13, height: 135, width: 142 },
  listingInfo: { flex: 1, paddingHorizontal: 10, paddingVertical: 4 },
  trustBadge: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#E8F7E9", borderRadius: 8, flexDirection: "row-reverse", gap: 4, paddingHorizontal: 6, paddingVertical: 3 },
  trustText: { color: "#2E9B43", fontSize: 9, fontWeight: "800" },
  listingTitle: { fontSize: 14, fontWeight: "800", lineHeight: 20, marginTop: 8, textAlign: "right" },
  price: { color: "#D52F37", fontSize: 15, fontWeight: "900", marginTop: 8, textAlign: "right" },
  location: { fontSize: 10, marginTop: 4, textAlign: "right" },
  floating: { alignItems: "center", backgroundColor: "#E28B18", borderRadius: 28, bottom: 73, elevation: 7, flexDirection: "row-reverse", gap: 8, justifyContent: "center", left: "18%", minHeight: 55, position: "absolute", shadowColor: "#806F5B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 7, width: "64%" },
  floatingText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
});
