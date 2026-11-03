import { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const content = {
  story: {
    title: "قصتك",
    subtitle: "شارك لحظتك ومنتجك مع مجتمع دار السلع",
    icon: "camera.fill" as const,
    cards: ["أضف صورة أو لحظة جديدة", "عرّف الناس بمنتجك", "تابع قصص البائعين الموثوقين"],
  },
  new: {
    title: "الجديد في السوق",
    subtitle: "أحدث الإعلانات المضافة في مسقط",
    icon: "sparkles" as const,
    cards: ["إعلانات أضيفت اليوم", "منتجات محلية جديدة", "فرص مميزة بالقرب منك"],
  },
  stores: {
    title: "متاجر مسقط",
    subtitle: "اكتشف المتاجر والبائعين المحليين",
    icon: "storefront.fill" as const,
    cards: ["متاجر موثوقة", "عروض المتاجر المحلية", "تصفح حسب النشاط والموقع"],
  },
} as const;

type SectionKind = keyof typeof content;

export default function HomeSectionScreen() {
  const colors = useColors();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const section = useMemo(() => content[(kind as SectionKind) ?? "new"] ?? content.new, [kind]);
  const storesQuery = trpc.stores.list.useQuery(undefined, { enabled: kind === "stores" });
  const stores = storesQuery.data ?? [];

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="رجوع" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}>
            <IconSymbol name="chevron.right" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>{section.title}</Text>
          <View style={styles.iconButton} />
        </View>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.heroIcon}><IconSymbol name={section.icon} size={34} color="#D9A441" /></View>
          <Text style={styles.heroTitle}>{section.title}</Text>
          <Text style={styles.heroSubtitle}>{section.subtitle}</Text>
          {kind === "story" && <Pressable onPress={() => router.push("/image-upload" as any)} style={styles.goldButton}><Text style={styles.goldButtonText}>أضف قصتك</Text></Pressable>}
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{kind === "stores" ? "المتاجر النشطة" : "استكشف"}</Text>
        {kind === "stores" ? (
          <View style={styles.cards}>
            {storesQuery.isLoading && <Text style={[styles.emptyText, { color: colors.muted }]}>جارٍ تحميل المتاجر...</Text>}
            {!storesQuery.isLoading && stores.length === 0 && <Text style={[styles.emptyText, { color: colors.muted }]}>لا توجد متاجر نشطة حاليًا.</Text>}
            {stores.map((store) => (
              <Pressable key={store.merchantId} onPress={() => router.push({ pathname: "/store/[merchantId]" as any, params: { merchantId: String(store.merchantId) } })} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.storeCopy}><Text style={[styles.cardText, { color: colors.foreground }]}>{store.name}</Text><Text style={[styles.storeSubtitle, { color: colors.muted }]}>متجر مشترك نشط في مسقط</Text></View>
                <IconSymbol name="storefront.fill" size={22} color={colors.primary} />
              </Pressable>
            ))}
          </View>
        ) : <View style={styles.cards}>{section.cards.map((label) => <Pressable key={label} onPress={() => Alert.alert(label, "سيتم تفعيل هذا القسم مع توفر بياناته.")} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardText, { color: colors.foreground }]}>{label}</Text><IconSymbol name="chevron.left" size={22} color={colors.primary} /></Pressable>)}</View>}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 35 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  iconButton: { alignItems: "center", borderRadius: 21, height: 42, justifyContent: "center", width: 42 },
  title: { fontSize: 22, fontWeight: "900" },
  hero: { alignItems: "center", borderRadius: 22, marginTop: 22, padding: 26 },
  heroIcon: { alignItems: "center", backgroundColor: "#123D2B", borderRadius: 32, height: 64, justifyContent: "center", width: 64 },
  heroTitle: { color: "#FFFFFF", fontSize: 27, fontWeight: "900", marginTop: 14 },
  heroSubtitle: { color: "#E7F0E9", fontSize: 14, marginTop: 7, textAlign: "center" },
  goldButton: { backgroundColor: "#D9A441", borderRadius: 12, marginTop: 18, paddingHorizontal: 20, paddingVertical: 11 },
  goldButtonText: { color: "#123D2B", fontSize: 14, fontWeight: "900" },
  sectionTitle: { fontSize: 21, fontWeight: "900", marginTop: 28, textAlign: "right" },
  cards: { gap: 11, marginTop: 13 },
  card: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", minHeight: 62, paddingHorizontal: 16 },
  cardText: { fontSize: 14, fontWeight: "800" },
  emptyText: { fontSize: 14, paddingVertical: 18, textAlign: "center" },
  storeCopy: { flex: 1, gap: 3 },
  storeSubtitle: { fontSize: 11, textAlign: "right" },
});
