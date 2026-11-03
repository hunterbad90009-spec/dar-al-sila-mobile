import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function StoreScreen() {
  const colors = useColors();
  const { merchantId } = useLocalSearchParams<{ merchantId?: string }>();
  const parsedMerchantId = merchantId ?? "";
  const { isAuthenticated } = useAuth();
  const followed = trpc.account.followedUsers.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const follow = trpc.account.follow.useMutation({ onSuccess: () => followed.refetch() });
  const unfollow = trpc.account.unfollow.useMutation({ onSuccess: () => followed.refetch() });
  const isFollowing = followed.data?.some((item) => item.userId === parsedMerchantId) ?? false;
  const storeQuery = trpc.stores.get.useQuery(
    { merchantId: parsedMerchantId },
    { enabled: parsedMerchantId.length > 0 },
  );

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="رجوع" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.surface }]}>
            <IconSymbol name="chevron.right" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>متجر مسقط</Text>
          <View style={styles.iconButton} />
        </View>
        {storeQuery.isLoading && <Text style={[styles.status, { color: colors.muted }]}>جارٍ تحميل المتجر...</Text>}
        {storeQuery.isError && <Text style={[styles.status, { color: colors.error }]}>تعذر تحميل المتجر حاليًا.</Text>}
        {storeQuery.data && (
          <>
            <View style={[styles.hero, { backgroundColor: colors.primary }]}>
              <View style={styles.storeIcon}><IconSymbol name="storefront.fill" size={35} color="#D9A441" /></View>
              <Text style={styles.heroTitle}>{storeQuery.data.name}</Text>
              <Text style={styles.heroSubtitle}>تاجر مشترك نشط — منتجات منشورة ومعتمدة</Text>
            </View>
            {isAuthenticated && <Pressable onPress={() => isFollowing ? unfollow.mutate({ userId: parsedMerchantId }) : follow.mutate({ userId: parsedMerchantId })} style={[styles.followButton, { borderColor: colors.primary }]}><Text style={[styles.followText, { color: colors.primary }]}>{isFollowing ? "إلغاء المتابعة" : "متابعة المتجر"}</Text></Pressable>}
            {storeQuery.data.products.find((product) => product.phone) && <Pressable onPress={() => { const phone = storeQuery.data?.products.find((product) => product.phone)?.phone; if (phone) Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("تعذر الاتصال", "تحقق من إعدادات الاتصال في جهازك.")); }} style={[styles.contactButton, { backgroundColor: colors.primary }]}><Text style={styles.contactText}>اتصال بالمتجر</Text></Pressable>}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>منتجات المتجر</Text>
            <View style={styles.products}>
              {storeQuery.data.products.length === 0 && <Text style={[styles.status, { color: colors.muted }]}>لا توجد منتجات منشورة حاليًا.</Text>}
              {storeQuery.data.products.map((product) => (
                <Pressable key={product.publicId} onPress={() => router.push({ pathname: "/listing/[id]" as any, params: { id: product.publicId } })} style={[styles.product, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.productCopy}>
                    <Text style={[styles.productTitle, { color: colors.foreground }]} numberOfLines={2}>{product.title ?? "منتج من المتجر"}</Text>
                    <Text style={[styles.productMeta, { color: colors.muted }]}>{product.price ?? "السعر عند التواصل"} · {product.location ?? "مسقط"}</Text>
                  </View>
                  <IconSymbol name="chevron.left" size={21} color={colors.primary} />
                </Pressable>
              ))}
            </View>
          </>
        )}
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
  storeIcon: { alignItems: "center", backgroundColor: "#123D2B", borderRadius: 34, height: 68, justifyContent: "center", width: 68 },
  heroTitle: { color: "#FFFFFF", fontSize: 25, fontWeight: "900", marginTop: 14 },
  heroSubtitle: { color: "#E7F0E9", fontSize: 13, marginTop: 7, textAlign: "center" },
  followButton: { alignItems: "center", borderRadius: 12, borderWidth: 1, marginTop: 10, paddingVertical: 11 }, followText: { fontSize: 13, fontWeight: "900" }, contactButton: { alignItems: "center", borderRadius: 12, marginTop: 15, paddingVertical: 12 }, contactText: { color: "#FFF", fontSize: 13, fontWeight: "900" }, sectionTitle: { fontSize: 21, fontWeight: "900", marginTop: 28, textAlign: "right" },
  products: { gap: 11, marginTop: 13 },
  product: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", minHeight: 74, paddingHorizontal: 16 },
  productCopy: { flex: 1, gap: 5 },
  productTitle: { fontSize: 15, fontWeight: "800", textAlign: "right" },
  productMeta: { fontSize: 12, textAlign: "right" },
  status: { fontSize: 14, paddingVertical: 26, textAlign: "center" },
});
