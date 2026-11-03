import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { GoldSheen } from "@/components/gold-sheen";
import { EmptyState, ErrorState, ListingGrid, ListingStrip, Loading, SectionHeader } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNotificationPrefs } from "@/lib/notification-prefs";
import { getAnnouncement, listStores, searchListings } from "@/lib/data";
import { getLang, pickName, t } from "@/lib/i18n";
import { categoryStyle } from "@/lib/category-icons";
import { useCategories, useLocations, useUnreadCounts } from "@/lib/queries";
import { useSelectedLocation } from "@/lib/user-location";
import { createStyles } from "@/lib/i18n/rtl";

export default function HomeScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const categories = useCategories();
  const locations = useLocations();
  const { locationId } = useSelectedLocation();
  const unread = useUnreadCounts();

  const announcement = useQuery({ queryKey: ["announcement"], queryFn: getAnnouncement, staleTime: 5 * 60 * 1000 });
  const featured = useQuery({ queryKey: ["home", "featured", locationId], queryFn: () => searchListings({ featured: true, locationId, pageSize: 10 }) });
  const latest = useQuery({ queryKey: ["home", "latest", locationId], queryFn: () => searchListings({ sort: "newest", locationId, pageSize: 12 }) });
  const popular = useQuery({ queryKey: ["home", "popular"], queryFn: () => searchListings({ sort: "popular", pageSize: 10 }) });
  const stores = useQuery({ queryKey: ["home", "stores"], queryFn: () => listStores({ limit: 12 }) });

  const prefs = useNotificationPrefs();
  const announcementText = prefs.announcements && announcement.data ? (getLang() === "en" ? announcement.data.en || announcement.data.ar : announcement.data.ar || announcement.data.en) : "";
  const locationText = locationId ? locations.label(locationId) : t("كل عُمان");
  const openSearch = (params: Record<string, string> = {}) => router.push({ pathname: "/search", params });

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="shopping-bag" size={24} color={colors.accent} />
              <GoldSheen width={46} height={46} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.brand, { color: colors.foreground }]}>{t("دار السلع")}</Text>
              <Text numberOfLines={1} style={[styles.greeting, { color: colors.muted }]}>{t("سوق عُمان لكل ما تحتاجه")}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityLabel={t("المفضلة")} onPress={() => router.push("/(tabs)/favorites")} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="favorite-border" size={22} color={colors.foreground} />
            </Pressable>
            <Pressable accessibilityLabel={t("الإشعارات")} onPress={() => router.push("/notifications")} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="notifications-none" size={24} color={colors.foreground} />
              {unread.notifications > 0 ? <View style={[styles.badge, { backgroundColor: colors.accent }]}><Text style={styles.badgeText}>{unread.notifications > 9 ? "9+" : unread.notifications}</Text></View> : null}
            </Pressable>
          </View>
        </View>

        <Pressable hitSlop={8} onPress={() => router.push("/location-picker")} style={styles.locationPicker}>
          <MaterialIcons name="location-on" size={19} color={colors.primary} />
          <Text style={[styles.locationText, { color: colors.foreground }]}>{locationText}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.primary} />
        </Pressable>

        <Pressable onPress={() => openSearch()} style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="search" size={23} color={colors.muted} />
          <Text style={[styles.searchPlaceholder, { color: colors.muted }]}>{t("ابحث عن منتج أو إعلان أو متجر...")}</Text>
          <View style={[styles.filterButton, { backgroundColor: colors.primary }]}><MaterialIcons name="tune" size={20} color={colors.primaryText} /></View>
        </Pressable>

        {announcementText ? (
          <View style={[styles.announcement, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <MaterialIcons name="campaign" size={20} color={colors.foreground} />
            <Text style={[styles.announcementText, { color: colors.foreground }]}>{announcementText}</Text>
          </View>
        ) : null}

        <SectionHeader title={t("التصنيفات")} action={t("كل التصنيفات")} onAction={() => router.push("/(tabs)/categories")} />
        {categories.isLoading ? <Loading /> : categories.isError ? <ErrorState onRetry={() => categories.refetch()} /> : (
          <View style={styles.categoriesGrid}>
            {categories.top.slice(0, 12).map((cat) => {
              const style = categoryStyle(cat.slug);
              return (
                <Pressable key={cat.id} onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: cat.slug } })} style={({ pressed }) => [styles.categoryCard, { backgroundColor: scheme === "dark" ? colors.surfaceAlt : style.tint, opacity: pressed ? 0.8 : 1 }]}>
                  <MaterialIcons name={style.icon} size={27} color={colors.primary} />
                  <Text style={[styles.categoryText, { color: colors.foreground }]} numberOfLines={2}>{pickName(cat)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={[styles.banner, { backgroundColor: colors.primary }]}>
          <GoldSheen width={500} height={152} />
          <View style={styles.bannerCopy}>
            <Text style={[styles.bannerKicker, { color: colors.accent }]}>{t("دار السلع")}</Text>
            <Text style={styles.bannerTitle}>{t("بِع واشترِ بسهولة في كل عُمان")}</Text>
            <Text style={styles.bannerHint}>{t("أعلن مجانًا وتواصل مباشرة مع المشترين")}</Text>
          </View>
          <Pressable onPress={() => router.push("/select-category")} style={[styles.bannerButton, { backgroundColor: colors.accent }]}>
            <Text style={styles.bannerButtonText}>{t("أضف إعلانك")}</Text>
          </Pressable>
        </View>

        {(featured.data?.items.length ?? 0) > 0 ? (
          <>
            <SectionHeader title={t("إعلانات مميزة")} action={t("عرض الكل")} onAction={() => openSearch({ featured: "1" })} />
            <ListingStrip items={featured.data!.items} />
          </>
        ) : null}

        {(stores.data?.length ?? 0) > 0 ? (
          <>
            <SectionHeader title={t("متاجر في دار السلع")} action={t("كل المتاجر")} onAction={() => router.push("/stores")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeRow}>
              {stores.data!.map((store) => (
                <Pressable key={store.id} onPress={() => router.push({ pathname: "/store/[merchantId]", params: { merchantId: store.ownerId } })} style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: store.isFeatured ? colors.accent : colors.border }]}>
                  {store.logoUrl ? <Image source={{ uri: store.logoUrl }} style={styles.storeLogo} /> : <View style={[styles.storeLogo, styles.storeLogoEmpty, { backgroundColor: colors.accentSoft }]}><MaterialIcons name="storefront" size={26} color={colors.primary} /></View>}
                  <Text style={[styles.storeName, { color: colors.foreground }]} numberOfLines={2}>{store.name}</Text>
                  {store.isFeatured ? <Text style={[styles.storeBadge, { color: colors.accent }]}>{t("متجر مميز")}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <SectionHeader title={locationId ? t("أحدث الإعلانات في منطقتك") : t("أحدث الإعلانات")} action={t("عرض الكل")} onAction={() => openSearch(locationId ? { locationId: String(locationId) } : {})} />
        {latest.isLoading ? <Loading label={t("جارٍ تحميل الإعلانات...")} /> : latest.isError ? <ErrorState onRetry={() => latest.refetch()} /> : latest.data!.items.length === 0 ? (
          <EmptyState title={t("لا توجد إعلانات بعد")} text={locationId ? t("لا توجد إعلانات في هذه المنطقة. جرّب كل عُمان.") : t("كن أول من يضيف إعلانًا.")} actionLabel={t("أضف إعلانك")} onAction={() => router.push("/select-category")} />
        ) : <ListingGrid items={latest.data!.items} />}

        {(popular.data?.items.length ?? 0) > 0 ? (
          <>
            <SectionHeader title={t("الأكثر مشاهدة")} action={t("عرض الكل")} onAction={() => openSearch({ sort: "popular" })} />
            <ListingStrip items={popular.data!.items} />
          </>
        ) : null}
      </ScrollView>
      <Pressable hitSlop={8} onPress={() => router.push("/select-category")} style={({ pressed }) => [styles.floating, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
        <MaterialIcons name="add-a-photo" size={20} color="#0B1F17" />
        <Text style={styles.floatingText}>{t("أضف إعلان")}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { padding: 18, paddingBottom: 110 },
  header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 4 },
  brandBlock: { alignItems: "center", flex: 1, flexDirection: "row-reverse", gap: 10, minWidth: 0 },
  logoMark: { alignItems: "center", borderRadius: 15, height: 46, justifyContent: "center", overflow: "hidden", transform: [{ rotate: "-5deg" }], width: 46 },
  brand: { fontSize: 21, fontWeight: "900", textAlign: "right" },
  greeting: { fontSize: 11, marginTop: 2, textAlign: "right" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: { alignItems: "center", borderRadius: 15, borderWidth: 1, height: 43, justifyContent: "center", width: 43 },
  badge: { alignItems: "center", borderRadius: 9, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 4, position: "absolute", right: 4, top: 4 },
  badgeText: { color: "#0B1F17", fontSize: 10, fontWeight: "900" },
  locationPicker: { alignItems: "center", alignSelf: "flex-end", flexDirection: "row-reverse", gap: 4, marginTop: 12 },
  locationText: { fontSize: 12, fontWeight: "800" },
  searchWrap: { alignItems: "center", borderRadius: 17, borderWidth: 1, flexDirection: "row-reverse", gap: 8, height: 56, marginTop: 12, paddingHorizontal: 10 },
  searchPlaceholder: { flex: 1, fontSize: 14, paddingHorizontal: 6, textAlign: "right" },
  filterButton: { alignItems: "center", borderRadius: 12, height: 39, justifyContent: "center", width: 39 },
  announcement: { alignItems: "center", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 14, padding: 12 },
  announcementText: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 20, textAlign: "right" },
  categoriesGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9 },
  categoryCard: { alignItems: "center", borderRadius: 17, gap: 5, justifyContent: "center", minHeight: 92, paddingHorizontal: 6, width: "31.8%" },
  categoryText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  banner: { alignItems: "center", borderRadius: 22, flexDirection: "row-reverse", gap: 12, justifyContent: "space-between", marginTop: 22, minHeight: 140, overflow: "hidden", paddingHorizontal: 18, paddingVertical: 16 },
  bannerCopy: { flex: 1 },
  bannerKicker: { fontSize: 12, fontWeight: "800", textAlign: "right" },
  bannerTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "900", lineHeight: 27, marginTop: 4, textAlign: "right" },
  bannerHint: { color: "#D9E7DF", fontSize: 11, marginTop: 6, textAlign: "right" },
  bannerButton: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  bannerButtonText: { color: "#0B1F17", fontSize: 13, fontWeight: "900" },
  storeRow: { flexDirection: "row-reverse", gap: 10, paddingVertical: 2 },
  storeCard: { alignItems: "center", borderRadius: 16, borderWidth: 1, gap: 6, padding: 12, width: 112 },
  storeLogo: { borderRadius: 26, height: 52, width: 52 },
  storeLogoEmpty: { alignItems: "center", justifyContent: "center" },
  storeName: { fontSize: 12, fontWeight: "800", textAlign: "center" },
  storeBadge: { fontSize: 10, fontWeight: "900" },
  floating: { alignItems: "center", alignSelf: "center", borderRadius: 24, bottom: 18, elevation: 5, flexDirection: "row-reverse", gap: 7, paddingHorizontal: 19, paddingVertical: 13, position: "absolute" },
  floatingText: { color: "#0B1F17", fontSize: 13, fontWeight: "900" },
});
