import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, ErrorState, Header, ListingGrid, Loading, LoginRequired } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { friendlyError, getSavedListings } from "@/lib/data";
import { t } from "@/lib/i18n";
import { keys, useFavorites } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

export default function FavoritesScreen() {
  const colors = useColors();
  const { isAuthenticated, loading } = useAuth();
  const { toggle } = useFavorites();
  const saved = useQuery({ queryKey: keys.saved, queryFn: getSavedListings, enabled: isAuthenticated });
  const available = (saved.data ?? []).filter((s) => s.available && s.listing).map((s) => s.listing!);
  const unavailable = (saved.data ?? []).filter((s) => !s.available);

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header back={false} title={t("المفضلة")} subtitle={t("الإعلانات التي تريد الرجوع إليها لاحقًا")} />
        {loading ? <Loading /> : !isAuthenticated ? <LoginRequired text={t("المفضلة مرتبطة بحسابك وتظهر بعد تسجيل الدخول.")} /> : saved.isLoading ? <Loading /> : saved.isError ? <ErrorState message={friendlyError(saved.error)} onRetry={() => saved.refetch()} /> : (saved.data ?? []).length === 0 ? (
          <EmptyState icon="favorite-border" title={t("لا توجد إعلانات محفوظة")} text={t("اضغط على رمز القلب في أي إعلان لحفظه هنا.")} actionLabel={t("تصفح الإعلانات")} onAction={() => router.push("/search")} />
        ) : (
          <>
            <ListingGrid items={available} />
            {unavailable.length ? (
              <>
                <Text style={[styles.subhead, { color: colors.foreground }]}>{t("لم تعد متاحة")}</Text>
                {unavailable.map((s) => (
                  <View key={s.listingId} style={[styles.gone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialIcons name="block" size={20} color={colors.muted} />
                    <Text style={[styles.goneText, { color: colors.muted }]} numberOfLines={1}>{s.listing?.title ?? t("إعلان محذوف")}</Text>
                    <Pressable hitSlop={8} onPress={() => toggle.mutate({ listingId: s.listingId, save: false })}><Text style={[styles.remove, { color: colors.error }]}>{t("إزالة")}</Text></Pressable>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 30 },
  subhead: { fontSize: 15, fontWeight: "900", marginBottom: 8, marginTop: 22, textAlign: "right" },
  gone: { alignItems: "center", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginBottom: 8, padding: 12 },
  goneText: { flex: 1, fontSize: 13, textAlign: "right" },
  remove: { fontSize: 13, fontWeight: "800" },
});
