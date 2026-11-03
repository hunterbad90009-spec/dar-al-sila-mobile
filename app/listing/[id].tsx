import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Linking, Platform, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Card, EmptyState, FavoriteButton, ListingStrip, Loading, SectionHeader, StatusPill, notify } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { CONDITIONS, fieldsForCategory } from "@/lib/category-fields";
import { friendlyError, getListing, getRelatedListings, getSellerRating, listStores, rateListing, recordView, startConversation } from "@/lib/data";
import { formatDate, formatNumber, isRTL, pickName, t, timeAgo } from "@/lib/i18n";
import { useCategories, useLocations } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

export default function ListingDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { user, isAuthenticated } = useAuth();
  const categories = useCategories();
  const locations = useLocations();
  const [imageIndex, setImageIndex] = useState(0);
  const [rating, setRating] = useState(0);

  const listing = useQuery({ queryKey: ["listing", id], queryFn: () => getListing({ publicId: id! }), enabled: Boolean(id) });
  const item = listing.data;
  const related = useQuery({ queryKey: ["related", id], queryFn: () => getRelatedListings(item!), enabled: Boolean(item) });
  const sellerRating = useQuery({ queryKey: ["seller-rating", item?.sellerId], queryFn: () => getSellerRating(item!.sellerId), enabled: Boolean(item) });
  const sellerStore = useQuery({ queryKey: ["seller-store", item?.sellerId], queryFn: async () => (await listStores({ limit: 100 })).find((s) => s.ownerId === item!.sellerId) ?? null, enabled: Boolean(item) });

  const isOwner = Boolean(user && item && user.id === item.sellerId);
  const chat = useMutation({ mutationFn: startConversation, onSuccess: (conversationId) => router.push({ pathname: "/chat/[id]", params: { id: conversationId } }), onError: (e) => notify(t("تعذر بدء المحادثة"), friendlyError(e)) });
  const rate = useMutation({ mutationFn: rateListing, onSuccess: () => { notify(t("تم التقييم"), t("شكرًا لمشاركتك تقييمك.")); void sellerRating.refetch(); }, onError: (e) => notify(t("تعذر التقييم"), friendlyError(e)) });

  const loaded = Boolean(item);
  useEffect(() => {
    if (loaded && id && isAuthenticated && !isOwner) void recordView({ publicId: id });
  }, [id, isAuthenticated, isOwner, loaded]);

  if (listing.isLoading) return <ScreenContainer><Loading label={t("جارٍ تحميل الإعلان...")} /></ScreenContainer>;
  if (listing.isError || !item) {
    return <ScreenContainer className="px-4"><EmptyState icon="search-off" title={t("تعذر العثور على الإعلان")} text={t("ربما حُذف الإعلان أو انتهت صلاحيته.")} actionLabel={t("العودة")} onAction={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} /></ScreenContainer>;
  }

  const images = item.images.map((i) => i.url);
  const topSlug = categories.topOf(item.categoryId)?.slug;
  const fields = fieldsForCategory(topSlug).filter((f) => String(item.attributes[f.key] ?? "").trim());
  const categoryPath = [categories.byId(item.categoryId), item.subcategoryId !== item.categoryId ? categories.byId(item.subcategoryId) : undefined].filter(Boolean).map((c) => pickName(c)).join(" › ");
  const condition = CONDITIONS.find((c) => c.value === item.condition);

  const share = async () => {
    const url = Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : `daralsila://listing/${item.id}`;
    const message = `${item.title} — ${item.price}\n${url}`;
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ title: item.title, url });
        else { await navigator.clipboard.writeText(url); notify(t("تم نسخ الرابط")); }
      } else await Share.share({ message });
    } catch {
      /* the user cancelled */
    }
  };

  const call = () => {
    if (!item.phone) { notify(t("رقم الاتصال غير متاح"), t("لم يحدد المعلن رقم اتصال لهذا الإعلان.")); return; }
    Linking.openURL(`tel:${item.phone.replace(/\s/g, "")}`).catch(() => notify(t("تعذر الاتصال"), item.phone!));
  };
  const whatsapp = () => {
    const number = (item.whatsapp || item.phone || "").replace(/[^\d]/g, "");
    if (!number) return;
    const full = number.startsWith("968") ? number : `968${number}`;
    Linking.openURL(`https://wa.me/${full}?text=${encodeURIComponent(`${t("مرحبًا، بخصوص إعلانك في دار السلع:")} ${item.title}`)}`).catch(() => undefined);
  };
  const contact = () => {
    if (!isAuthenticated) { router.push("/login"); return; }
    chat.mutate(item.id);
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel={t("رجوع")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={[styles.circle, { backgroundColor: colors.surface }]}>
            <MaterialIcons name={isRTL() ? "arrow-forward" : "arrow-back"} size={22} color={colors.foreground} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable accessibilityLabel={t("مشاركة")} onPress={share} style={[styles.circle, { backgroundColor: colors.surface }]}><MaterialIcons name="share" size={20} color={colors.foreground} /></Pressable>
            <FavoriteButton listingId={item.id} size={22} />
          </View>
        </View>

        <View style={[styles.gallery, { backgroundColor: colors.surfaceAlt }]}>
          {images.length ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
              {images.map((uri) => <Image key={uri} source={{ uri }} style={[styles.galleryImage, { width }]} resizeMode="cover" />)}
            </ScrollView>
          ) : <View style={styles.noImage}><MaterialIcons name="photo-camera" size={44} color={colors.muted} /><Text style={{ color: colors.muted }}>{t("بدون صور")}</Text></View>}
          {images.length > 1 ? <View style={styles.dots}>{images.map((uri, index) => <View key={uri} style={[styles.dot, { backgroundColor: index === imageIndex ? colors.accent : "#FFFFFF99" }]} />)}</View> : null}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
            {item.status !== "active" ? <StatusPill status={item.status} /> : null}
          </View>
          <Text style={[styles.price, { color: colors.primary }]}>{item.price}</Text>
          {item.isFeatured ? <View style={[styles.featured, { backgroundColor: colors.accentSoft }]}><MaterialIcons name="star" size={14} color={colors.accent} /><Text style={[styles.featuredText, { color: colors.foreground }]}>{t("إعلان مميز")}</Text></View> : null}

          <View style={styles.metaGrid}>
            {categoryPath ? <Meta icon="category" text={categoryPath} /> : null}
            <Meta icon="location-on" text={locations.label(item.locationId) ?? t("عُمان")} />
            <Meta icon="schedule" text={`${timeAgo(item.createdAt)} · ${formatDate(item.createdAt)}`} />
            {condition ? <Meta icon="verified" text={t(condition.label)} /> : null}
            <Meta icon="visibility" text={t("{n} مشاهدة", { n: formatNumber(item.views) })} />
          </View>

          {isOwner && item.moderationReason && (item.status === "rejected" || item.status === "pending") ? (
            <Card style={{ borderColor: colors.error, marginTop: 14 }}><Text style={[styles.reasonTitle, { color: colors.error }]}>{t("ملاحظة المشرف")}</Text><Text style={[styles.reasonText, { color: colors.foreground }]}>{item.moderationReason}</Text></Card>
          ) : null}

          {fields.length ? (
            <>
              <SectionHeader title={t("التفاصيل")} />
              <Card>
                {fields.map((field, index) => {
                  const raw = String(item.attributes[field.key]);
                  const option = field.options?.find((o) => o.value === raw);
                  const value = option ? t(option.label) : field.type === "number" ? `${formatNumber(Number(raw))}${field.unit ? ` ${t(field.unit)}` : ""}` : raw;
                  return (
                    <View key={field.key} style={[styles.detailRow, index < fields.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                      <Text style={[styles.detailLabel, { color: colors.muted }]}>{t(field.label)}</Text>
                      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
                    </View>
                  );
                })}
              </Card>
            </>
          ) : null}

          <SectionHeader title={t("الوصف")} />
          <Text style={[styles.description, { color: colors.foreground }]}>{item.description || t("لا يوجد وصف.")}</Text>

          <SectionHeader title={t("البائع")} />
          <Card>
            <View style={styles.sellerRow}>
              {item.sellerAvatar ? <Image source={{ uri: item.sellerAvatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: colors.accentSoft }]}><MaterialIcons name="person" size={26} color={colors.primary} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={[styles.sellerName, { color: colors.foreground }]}>{item.sellerName}</Text>
                {item.sellerSince ? <Text style={[styles.sellerMeta, { color: colors.muted }]}>{t("عضو منذ {date}", { date: formatDate(item.sellerSince, { month: "long", year: "numeric" }) })}</Text> : null}
                {sellerRating.data?.count ? <Text style={[styles.sellerMeta, { color: colors.muted }]}>★ {formatNumber(sellerRating.data.average, { maximumFractionDigits: 1 })} · {t("{n} تقييم", { n: sellerRating.data.count })}</Text> : null}
              </View>
            </View>
            <View style={styles.sellerLinks}>
              {sellerStore.data ? <Button small variant="outline" icon="storefront" label={t("زيارة المتجر")} onPress={() => router.push({ pathname: "/store/[merchantId]", params: { merchantId: item.sellerId } })} style={{ flex: 1 }} /> : null}
              <Button small variant="ghost" icon="list" label={t("إعلانات البائع")} onPress={() => router.push({ pathname: "/seller/[id]", params: { id: item.sellerId } })} style={{ flex: 1 }} />
            </View>
          </Card>

          {isAuthenticated && !isOwner ? (
            <Card style={{ marginTop: 14 }}>
              <Text style={[styles.reasonTitle, { color: colors.foreground }]}>{t("قيّم تجربتك مع البائع")}</Text>
              <View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} hitSlop={6} onPress={() => setRating(value)}><MaterialIcons name={value <= rating ? "star" : "star-border"} size={30} color={colors.accent} /></Pressable>)}</View>
              <Button small label={t("إرسال التقييم")} disabled={!rating} loading={rate.isPending} onPress={() => rate.mutate({ publicId: item.id, rating })} />
            </Card>
          ) : null}

          {!isOwner ? (
            <Pressable onPress={() => (isAuthenticated ? router.push({ pathname: "/report", params: { listingId: item.id, userId: item.sellerId } }) : router.push("/login"))} style={styles.reportLink}>
              <MaterialIcons name="flag" size={17} color={colors.error} />
              <Text style={[styles.reportText, { color: colors.error }]}>{t("الإبلاغ عن هذا الإعلان")}</Text>
            </Pressable>
          ) : null}

          {(related.data?.length ?? 0) > 0 ? (<><SectionHeader title={t("إعلانات مشابهة")} /><ListingStrip items={related.data!} /></>) : null}
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {isOwner ? (
          <>
            <Button icon="edit" label={t("تعديل الإعلان")} onPress={() => router.push({ pathname: "/(tabs)/post", params: { listingId: item.id } })} style={{ flex: 1 }} />
            <Button variant="outline" icon="list-alt" label={t("إعلاناتي")} onPress={() => router.push("/(tabs)/myads")} style={{ flex: 1 }} />
          </>
        ) : (
          <>
            <Button icon="chat" label={t("مراسلة")} loading={chat.isPending} onPress={contact} style={{ flex: 1.2 }} />
            {item.phone ? <Button variant="outline" icon="call" label={t("اتصال")} onPress={call} style={{ flex: 1 }} /> : null}
            {item.whatsapp || item.phone ? <Button variant="accent" icon="chat-bubble" label={t("واتساب")} onPress={whatsapp} style={{ flex: 1 }} /> : null}
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function Meta({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  const colors = useColors();
  return <View style={styles.meta}><MaterialIcons name={icon} size={16} color={colors.muted} /><Text style={[styles.metaText, { color: colors.muted }]}>{text}</Text></View>;
}

const styles = createStyles({
  content: { paddingBottom: 110 },
  topBar: { flexDirection: "row-reverse", justifyContent: "space-between", left: 14, position: "absolute", right: 14, top: 10, zIndex: 3 },
  topActions: { flexDirection: "row-reverse", gap: 8 },
  circle: { alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  gallery: { height: 320 },
  galleryImage: { height: 320 },
  noImage: { alignItems: "center", flex: 1, gap: 8, justifyContent: "center" },
  dots: { bottom: 12, flexDirection: "row", gap: 6, justifyContent: "center", left: 0, position: "absolute", right: 0 },
  dot: { borderRadius: 4, height: 8, width: 8 },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  titleRow: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 10 },
  title: { flex: 1, fontSize: 22, fontWeight: "900", lineHeight: 31, textAlign: "right" },
  price: { fontSize: 22, fontWeight: "900", marginTop: 8, textAlign: "right" },
  featured: { alignItems: "center", alignSelf: "flex-end", borderRadius: 10, flexDirection: "row-reverse", gap: 4, marginTop: 8, paddingHorizontal: 9, paddingVertical: 4 },
  featuredText: { fontSize: 11, fontWeight: "900" },
  metaGrid: { gap: 8, marginTop: 14 },
  meta: { alignItems: "center", flexDirection: "row-reverse", gap: 6 },
  metaText: { flex: 1, fontSize: 13, textAlign: "right" },
  reasonTitle: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  reasonText: { fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: "right" },
  detailRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 10 },
  detailLabel: { fontSize: 13, textAlign: "right" },
  detailValue: { fontSize: 13, fontWeight: "800", textAlign: "left" },
  description: { fontSize: 15, lineHeight: 25, textAlign: "right" },
  sellerRow: { alignItems: "center", flexDirection: "row-reverse", gap: 12 },
  avatar: { borderRadius: 26, height: 52, width: 52 },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  sellerName: { fontSize: 16, fontWeight: "900", textAlign: "right" },
  sellerMeta: { fontSize: 12, marginTop: 3, textAlign: "right" },
  sellerLinks: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  stars: { flexDirection: "row-reverse", gap: 4, justifyContent: "center", marginVertical: 10 },
  reportLink: { alignItems: "center", alignSelf: "flex-end", flexDirection: "row-reverse", gap: 6, marginTop: 18 },
  reportText: { fontSize: 13, fontWeight: "800" },
  actionBar: { borderTopWidth: 1, bottom: 0, flexDirection: "row-reverse", gap: 8, left: 0, padding: 12, position: "absolute", right: 0 },
});
