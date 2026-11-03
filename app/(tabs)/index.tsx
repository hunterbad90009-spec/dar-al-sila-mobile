import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { InlineAdSlot } from "@/components/inline-ad-slot";
import { trpc } from "@/lib/trpc";
import { categories, stories } from "@/lib/catalog";
import { GoldSheen } from "@/components/gold-sheen";
import { filterProducts } from "@/lib/product-filters";
import { formatOmanLocation } from "@/constants/oman-locations";

const navy = "#165B45";
const ink = "#182230";
const muted = "#7B8492";
const gold = "#D99A15";

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [locationLabel, setLocationLabel] = useState("مسقط، عُمان");
  const listingQuery = trpc.listings.list.useQuery({ limit: 30 });
  const listings = listingQuery.data;
  const filteredListings = useMemo(() => filterProducts(listings ?? [], query, activeCategory), [listings, query, activeCategory]);
  useEffect(() => {
    let mounted = true;
    const loadLocation = async () => {
      try {
        const raw = await SecureStore.getItemAsync("selected_oman_location") ?? await AsyncStorage.getItem("selected_oman_location");
        if (!mounted || !raw) return;
        const saved = JSON.parse(raw) as { governorate?: string; wilayat?: string };
        if (saved.governorate) setLocationLabel(`${formatOmanLocation(saved.governorate, saved.wilayat)}، عُمان`);
      } catch { /* keep the safe default */ }
    };
    void loadLocation();
    return () => { mounted = false; };
  }, []);

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-[#FFFCF7]">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandBlock}><View style={styles.logoMark}><MaterialIcons name="shopping-bag" size={24} color="#fff" /><MaterialIcons name="account-balance" size={10} color="#F4D27B" style={styles.logoArchitecture} /><GoldSheen width={46} height={46} /></View><View><Text style={styles.brand}>دار السلع</Text><Text style={styles.greeting}>أهلاً بك في سوقك المحلي</Text></View></View>
          <View style={styles.headerActions}><Pressable onPress={() => router.push("/(tabs)/favorites")} style={styles.iconButton}><MaterialIcons name="favorite-border" size={22} color={ink} /></Pressable><Pressable onPress={() => router.push("/notifications")} style={styles.iconButton}><MaterialIcons name="notifications-none" size={24} color={ink} /></Pressable></View>
        </View>
        <Pressable hitSlop={8} onPress={() => router.push("/location-picker")} style={({ pressed }) => [styles.locationPicker, pressed && styles.pressed]}><MaterialIcons name="keyboard-arrow-down" size={20} color={navy} /><Text style={styles.locationText}>{locationLabel}</Text><MaterialIcons name="location-on" size={19} color={navy} /></Pressable>
        <View style={styles.searchWrap}><MaterialIcons name="search" size={23} color={muted} /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث في دار السلع..." placeholderTextColor="#A7ADB5" style={styles.searchInput} textAlign="right" /><View style={styles.filterButton}><MaterialIcons name="tune" size={20} color="#fff" /></View></View>
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{["الكل", ...categories.map((item) => item.label)].map((label) => <Pressable key={label} hitSlop={4} onPress={() => setActiveCategory(label)} style={({ pressed }) => [styles.chip, activeCategory === label && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, activeCategory === label && styles.chipTextActive]}>{label}</Text></Pressable>)}</ScrollView>
        <SectionTitle title="استكشف دار السلع" action="عرض الكل" onPress={() => router.push("/categories")} />
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>{stories.map((story) => <Pressable key={story.label} hitSlop={6} onPress={() => handleStoryPress(story.label)} style={({ pressed }) => [styles.story, pressed && styles.pressed]}><View style={[styles.storyCircle, { borderColor: story.color }]}><MaterialIcons name={story.icon as keyof typeof MaterialIcons.glyphMap} size={26} color={story.color} /></View><Text style={styles.storyLabel}>{story.label}</Text></Pressable>)}</ScrollView>
        <View style={styles.banner}><GoldSheen width={500} height={152} /><View style={styles.bannerCopy}><Text style={styles.bannerKicker}>دار السلع</Text><Text style={styles.bannerTitle}>اكتشف عروضاً محلية تستحقها</Text><Text style={styles.bannerHint}>إعلانات حقيقية من مستخدمين حقيقيين</Text></View><View style={styles.bannerIcon}><MaterialIcons name="shopping-bag" size={45} color="#F0C963" /><MaterialIcons name="account-balance" size={18} color="#FFF0B0" style={styles.bannerArchitecture} /></View></View>
        <InlineAdSlot label="مساحة إعلانية معتمدة" />
        <SectionTitle title="التصنيفات" action="كل التصنيفات" onPress={() => router.push("/categories")} />
        <View style={styles.categoriesGrid}>{categories.map((item) => <Pressable key={item.label} hitSlop={4} onPress={() => setActiveCategory(item.label)} style={({ pressed }) => [styles.categoryCard, { backgroundColor: item.color }, pressed && styles.pressed]}><MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={27} color={navy} /><Text style={styles.categoryText}>{item.label}</Text></Pressable>)}</View>
        <SectionTitle title={activeCategory === "الكل" ? "أحدث الإعلانات" : `إعلانات ${activeCategory}`} action="من قاعدة البيانات" onPress={() => listingQuery.refetch()} />
        {listingQuery.isLoading ? <View style={styles.state}><ActivityIndicator color={navy} /><Text style={styles.stateText}>جارٍ تحميل الإعلانات الحقيقية...</Text></View> : listingQuery.isError ? <View style={styles.state}><MaterialIcons name="cloud-off" size={34} color="#D65D5D" /><Text style={styles.stateText}>تعذر الاتصال بقاعدة البيانات</Text></View> : filteredListings.length === 0 ? <View style={styles.state}><MaterialIcons name="inventory-2" size={34} color={muted} /><Text style={styles.stateText}>لا توجد إعلانات مطابقة حالياً</Text></View> : <View style={styles.grid}>{filteredListings.map((listing) => <Pressable key={listing.id} onPress={() => router.push({ pathname: "/listing/[id]", params: { id: String(listing.id) } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.imageWrap}>{listing.imageUrl ? <Image source={{ uri: listing.imageUrl }} style={styles.image} /> : <View style={styles.noImage}><MaterialIcons name="photo-camera" size={28} color="#9AB9DD" /><Text style={styles.noImageText}>بدون صورة</Text></View>}<View style={styles.liveTag}><Text style={styles.liveText}>نشط</Text></View></View><View style={styles.cardBody}><Text style={styles.cardTitle} numberOfLines={2}>{listing.title}</Text><Text style={styles.price}>{listing.price}</Text><View style={styles.meta}><MaterialIcons name="location-on" size={14} color={muted} /><Text style={styles.metaText}>{listing.location}</Text></View></View></Pressable>)}</View>}
      </ScrollView>
      <Pressable hitSlop={8} onPress={() => router.push("/select-category")} style={({ pressed }) => [styles.floating, pressed && styles.pressed]}><MaterialIcons name="add-a-photo" size={20} color="#fff" /><Text style={styles.floatingText}>أضف إعلان</Text></Pressable>
    </ScreenContainer>
  );
}
function handleStoryPress(label: string) {
  if (label === "قريب منك") return router.push("/location-picker");
  if (label === "عروض اليوم") return router.push("/home-section");
  Alert.alert(label, "سيظهر هذا القسم قريبًا.");
}
function SectionTitle({ title, action, onPress }: { title: string; action: string; onPress: () => void }) { return <View style={styles.sectionHeader}><Pressable onPress={onPress}><Text style={styles.action}>{action}</Text></Pressable><Text style={styles.sectionTitle}>{title}</Text></View>; }
const styles = StyleSheet.create({ content: { padding: 18, paddingBottom: 104, gap: 15 }, header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 4 }, brandBlock: { flexDirection: "row-reverse", alignItems: "center", gap: 10 }, logoMark: { backgroundColor: navy, width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-5deg" }], overflow: "hidden" }, logoArchitecture: { position: "absolute", bottom: 9, left: 18 }, brand: { color: ink, fontSize: 21, fontWeight: "900", textAlign: "right" }, greeting: { color: muted, fontSize: 11, marginTop: 2, textAlign: "right" }, headerActions: { flexDirection: "row", gap: 8 }, iconButton: { width: 43, height: 43, borderRadius: 15, borderWidth: 1, borderColor: "#EEE8DE", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, locationPicker: { flexDirection: "row-reverse", alignItems: "center", gap: 4, alignSelf: "flex-end", paddingVertical: 1 }, locationText: { color: ink, fontSize: 12, fontWeight: "800" }, searchWrap: { height: 56, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEE8DE", borderRadius: 17, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 8, marginTop: 5 }, searchInput: { flex: 1, color: ink, fontSize: 14, paddingHorizontal: 6 }, filterButton: { width: 39, height: 39, borderRadius: 12, backgroundColor: navy, alignItems: "center", justifyContent: "center" }, chips: { gap: 8, paddingVertical: 2 }, chip: { borderWidth: 1, borderColor: "#E5DED3", borderRadius: 20, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: "#fff" }, chipActive: { backgroundColor: navy, borderColor: navy }, chipText: { color: muted, fontSize: 12, fontWeight: "700" }, chipTextActive: { color: "#fff" }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }, sectionTitle: { color: ink, fontSize: 18, fontWeight: "900", textAlign: "right" }, action: { color: navy, fontSize: 12, fontWeight: "800" }, storyRow: { gap: 14, paddingVertical: 4 }, story: { alignItems: "center", width: 75 }, storyCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#fff", borderWidth: 2.5, alignItems: "center", justifyContent: "center" }, storyLabel: { color: ink, fontSize: 11, fontWeight: "700", marginTop: 7, textAlign: "center" }, banner: { minHeight: 152, borderRadius: 22, backgroundColor: navy, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, overflow: "hidden" }, bannerCopy: { flex: 1, alignItems: "flex-end" }, bannerKicker: { color: "#F4D27B", fontSize: 12, fontWeight: "800" }, bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 28, textAlign: "right", marginTop: 4 }, bannerHint: { color: "#D9EFE5", fontSize: 11, marginTop: 8, textAlign: "right" }, bannerIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#28765D", alignItems: "center", justifyContent: "center" }, bannerArchitecture: { position: "absolute", top: 30, left: 31 }, categoriesGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9 }, categoryCard: { width: "31.8%", minHeight: 86, borderRadius: 17, alignItems: "center", justifyContent: "center", gap: 5 }, categoryText: { color: ink, fontSize: 11, fontWeight: "800", textAlign: "center" }, grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 11 }, card: { backgroundColor: "#fff", borderRadius: 18, width: "48.1%", overflow: "hidden", borderWidth: 1, borderColor: "#F0EAE1" }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }, imageWrap: { height: 142, backgroundColor: "#EEF1F5", position: "relative" }, image: { width: "100%", height: "100%" }, noImage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5 }, noImageText: { color: "#8A98A8", fontSize: 10 }, liveTag: { position: "absolute", left: 9, top: 9, backgroundColor: "#2E8B67", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }, liveText: { color: "#fff", fontSize: 9, fontWeight: "900" }, cardBody: { padding: 10, gap: 5 }, cardTitle: { color: ink, fontSize: 13, fontWeight: "800", lineHeight: 19, textAlign: "right", minHeight: 38 }, price: { color: navy, fontSize: 14, fontWeight: "900", textAlign: "right" }, meta: { flexDirection: "row-reverse", alignItems: "center", gap: 2 }, metaText: { color: muted, fontSize: 10, flex: 1, textAlign: "right" }, state: { width: "100%", alignItems: "center", paddingVertical: 38, gap: 9 }, stateText: { color: muted, fontSize: 13, fontWeight: "700" }, floating: { position: "absolute", bottom: 18, alignSelf: "center", flexDirection: "row-reverse", gap: 7, alignItems: "center", backgroundColor: gold, borderRadius: 24, paddingHorizontal: 19, paddingVertical: 13, elevation: 5 }, floatingText: { color: "#fff", fontSize: 13, fontWeight: "900" } });
