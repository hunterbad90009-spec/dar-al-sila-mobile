import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Linking, ScrollView, StyleSheet, Text, View , Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Card, EmptyState, Header, ListingGrid, ListingStrip, Loading, SectionHeader } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { friendlyError, getStore } from "@/lib/data";
import { formatDate, formatNumber, t , isRTL } from "@/lib/i18n";
import { useLocations } from "@/lib/queries";
import { STORE_TYPES } from "@/lib/store-types";
import { createStyles } from "@/lib/i18n/rtl";

/** Public storefront (spec 4.7). */
export default function StoreScreen() {
  const { merchantId } = useLocalSearchParams<{ merchantId: string }>();
  const colors = useColors();
  const { user } = useAuth();
  const locations = useLocations();
  const store = useQuery({ queryKey: ["store", merchantId], queryFn: () => getStore({ merchantId: merchantId! }), enabled: Boolean(merchantId) });

  if (store.isLoading) return <ScreenContainer><Loading /></ScreenContainer>;
  if (store.isError || !store.data) return <ScreenContainer className="px-4"><Header title={t("المتجر")} /><EmptyState icon="storefront" title={t("المتجر غير متاح")} text={friendlyError(store.error, "المتجر غير موجود أو غير مفعّل.")} /></ScreenContainer>;

  const { store: s, products, featured } = store.data;
  const isOwner = user?.id === s.ownerId;
  const phone = s.phone || s.whatsapp;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.cover, { backgroundColor: colors.primary }]}>
          {s.coverUrl ? <Image source={{ uri: s.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <Pressable accessibilityLabel={t("رجوع")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={[styles.back, { backgroundColor: colors.surface }]}>
            <MaterialIcons name={isRTL() ? "arrow-forward" : "arrow-back"} size={22} color={colors.foreground} />
          </Pressable>
          {isOwner ? <View style={styles.manage}><Button small variant="accent" icon="edit" label={t("إدارة المتجر")} onPress={() => router.push("/store/manage")} /></View> : null}
        </View>
        <View style={styles.body}>
          <View style={styles.identity}>
            {s.logoUrl ? <Image source={{ uri: s.logoUrl }} style={[styles.logo, { borderColor: colors.surface }]} /> : <View style={[styles.logo, styles.logoEmpty, { backgroundColor: colors.accentSoft, borderColor: colors.surface }]}><MaterialIcons name="storefront" size={34} color={colors.primary} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>{s.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{t(STORE_TYPES[s.storeType])} · {t("{n} منتج", { n: formatNumber(products.length) })}</Text>
              {s.isFeatured ? <Text style={[styles.featured, { color: colors.accent }]}>★ {t("متجر مميز")}</Text> : null}
            </View>
          </View>
          {s.description ? <Text style={[styles.description, { marginTop: 14, color: colors.foreground }]}>{s.description}</Text> : null}
          <Card style={{ marginTop: 12 }}>
            {s.locationId ? <Row icon="location-on" text={locations.label(s.locationId) ?? ""} /> : null}
            {s.phone ? <Row icon="call" text={s.phone} /> : null}
            {s.whatsapp ? <Row icon="chat" text={`${t("واتساب")}: ${s.whatsapp}`} /> : null}
            <Row icon="verified" text={t("في دار السلع منذ {date}", { date: formatDate(s.createdAt, { month: "long", year: "numeric" }) })} />
            {phone && !isOwner ? (
              <View style={styles.contact}>
                {s.phone ? <Button small icon="call" label={t("اتصال")} onPress={() => Linking.openURL(`tel:${s.phone!.replace(/\s/g, "")}`).catch(() => undefined)} style={{ flex: 1 }} /> : null}
                {s.whatsapp ? <Button small variant="accent" icon="chat-bubble" label={t("واتساب")} onPress={() => Linking.openURL(`https://wa.me/${s.whatsapp!.replace(/[^\d]/g, "").replace(/^(?!968)/, "968")}`).catch(() => undefined)} style={{ flex: 1 }} /> : null}
              </View>
            ) : null}
          </Card>
          {featured.length ? <><SectionHeader title={t("منتجات مميزة")} /><ListingStrip items={featured} /></> : null}
          <SectionHeader title={t("كل المنتجات")} />
          {products.length ? <ListingGrid items={products} /> : <EmptyState title={t("لا توجد منتجات منشورة بعد")} />}
          {!isOwner ? <Button variant="ghost" icon="flag" label={t("الإبلاغ عن المتجر")} onPress={() => router.push({ pathname: "/report", params: { userId: s.ownerId } })} style={{ marginTop: 18 }} /> : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  const colors = useColors();
  return <View style={styles.row}><MaterialIcons name={icon} size={17} color={colors.primary} /><Text style={[styles.rowText, { color: colors.foreground }]}>{text}</Text></View>;
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  cover: { height: 150, overflow: "hidden" },
  back: { alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", position: "absolute", right: 14, top: 12, width: 40 },
  manage: { left: 14, position: "absolute", top: 12 },
  body: { marginTop: -42, paddingHorizontal: 16 },
  identity: { alignItems: "flex-end", flexDirection: "row-reverse", gap: 12 },
  logo: { borderRadius: 42, borderWidth: 4, height: 84, width: 84 },
  logoEmpty: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 21, fontWeight: "900", textAlign: "right" },
  meta: { fontSize: 12, marginTop: 3, textAlign: "right" },
  featured: { fontSize: 11, fontWeight: "900", marginTop: 3, textAlign: "right" },
  description: { fontSize: 14, lineHeight: 22, textAlign: "right" },
  row: { alignItems: "center", flexDirection: "row-reverse", gap: 8, paddingVertical: 5 },
  rowText: { flex: 1, fontSize: 13, textAlign: "right" },
  contact: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
});
