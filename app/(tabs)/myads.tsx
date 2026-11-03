import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Chip, EmptyState, ErrorState, Header, Loading, LoginRequired, StatusPill, confirmAction, notify } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { type DbStatus, deleteListing, friendlyError, getMyListings, getMyStore, type Listing, setListingStatus } from "@/lib/data";
import { formatNumber, t, timeAgo } from "@/lib/i18n";
import { keys } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

type Tab = "active" | "pending" | "rejected" | "paused" | "draft" | "closed";
const TABS: { key: Tab; label: string; statuses: DbStatus[] }[] = [
  { key: "active", label: "النشطة", statuses: ["active", "reserved"] },
  { key: "pending", label: "قيد المراجعة", statuses: ["pending"] },
  { key: "rejected", label: "المرفوضة", statuses: ["rejected"] },
  { key: "paused", label: "الموقوفة", statuses: ["paused"] },
  { key: "draft", label: "المسودات", statuses: ["draft"] },
  { key: "closed", label: "المنتهية والمباعة", statuses: ["expired", "sold", "archived"] },
];

/** Seller dashboard (spec 4.6): every listing status, with owner actions. */
export default function MyAdsScreen() {
  const colors = useColors();
  const client = useQueryClient();
  const { isAuthenticated, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("active");
  const listings = useQuery({ queryKey: keys.myListings, queryFn: getMyListings, enabled: isAuthenticated });
  const store = useQuery({ queryKey: keys.myStore, queryFn: getMyStore, enabled: isAuthenticated });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: keys.myListings });
    void client.invalidateQueries({ queryKey: ["home"] });
  };
  const status = useMutation({ mutationFn: setListingStatus, onSuccess: refresh, onError: (e) => notify(t("تعذر تغيير الحالة"), friendlyError(e)) });
  const remove = useMutation({ mutationFn: deleteListing, onSuccess: refresh, onError: (e) => notify(t("تعذر الحذف"), friendlyError(e)) });

  const counts = useMemo(() => Object.fromEntries(TABS.map((tb) => [tb.key, (listings.data ?? []).filter((l) => tb.statuses.includes(l.status)).length])) as Record<Tab, number>, [listings.data]);
  const rows = (listings.data ?? []).filter((l) => TABS.find((tb) => tb.key === tab)!.statuses.includes(l.status));

  if (loading) return <ScreenContainer><Loading /></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-4"><Header title={t("إعلاناتي")} /><LoginRequired /></ScreenContainer>;

  const actionsFor = (l: Listing) => {
    const edit = <Button key="edit" small variant="ghost" icon="edit" label={t("تعديل")} onPress={() => router.push({ pathname: "/(tabs)/post", params: { listingId: l.id } })} />;
    const view = <Button key="view" small variant="ghost" icon="visibility" label={t("عرض")} onPress={() => router.push({ pathname: "/listing/[id]", params: { id: l.id } })} />;
    const del = <Button key="del" small variant="danger" icon="delete-outline" label={t("حذف")} onPress={() => confirmAction(t("حذف الإعلان"), t("سيُحذف الإعلان وصوره نهائيًا. لا يمكن التراجع."), t("حذف"), () => remove.mutate({ id: l.id }), true)} />;
    switch (l.status) {
      case "active":
      case "reserved":
        return [view, edit, <Button key="pause" small variant="ghost" icon="pause" label={t("إيقاف")} onPress={() => status.mutate({ id: l.id, status: "paused" })} />, <Button key="sold" small variant="ghost" icon="sell" label={t("تم البيع")} onPress={() => status.mutate({ id: l.id, status: "sold" })} />, del];
      case "paused":
      case "expired":
      case "sold":
        return [<Button key="re" small icon="play-arrow" label={t("إعادة تفعيل")} onPress={() => status.mutate({ id: l.id, status: "active" })} />, edit, del];
      case "draft":
        return [<Button key="cont" small icon="edit-note" label={t("إكمال ونشر")} onPress={() => router.push({ pathname: "/(tabs)/post", params: { listingId: l.id } })} />, del];
      case "pending":
        return [view, <Button key="wd" small variant="ghost" icon="undo" label={t("سحب للمسودات")} onPress={() => status.mutate({ id: l.id, status: "draft" })} />, del];
      default:
        return [view, del];
    }
  };

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header back={false} title={t("إعلاناتي")} right={<Button small icon="add" label={t("أضف إعلان")} onPress={() => router.push("/select-category")} />} />

        <Pressable onPress={() => router.push("/store/manage")} style={[styles.storePanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="storefront" size={26} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.storeTitle, { color: colors.foreground }]}>{store.data ? store.data.name : t("أنشئ متجرك")}</Text>
            <Text style={[styles.storeMeta, { color: colors.muted }]}>{store.data ? (store.data.status === "active" ? t("المتجر مفعّل ويظهر للمشترين") : store.data.status === "pending" ? t("المتجر بانتظار موافقة المشرف") : t("المتجر موقوف")) : t("واجهة خاصة بشعارك ومنتجاتك")}</Text>
          </View>
          <Text style={[styles.storeLink, { color: colors.primary }]}>{store.data ? t("إدارة") : t("ابدأ")}</Text>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((tb) => <Chip key={tb.key} label={`${t(tb.label)} (${formatNumber(counts[tb.key] ?? 0)})`} active={tab === tb.key} onPress={() => setTab(tb.key)} />)}
        </ScrollView>

        {listings.isLoading ? <Loading /> : listings.isError ? <ErrorState message={friendlyError(listings.error)} onRetry={() => listings.refetch()} /> : rows.length === 0 ? (
          <EmptyState title={t("لا توجد إعلانات في هذا القسم")} actionLabel={tab === "active" ? t("أضف إعلان") : undefined} onAction={() => router.push("/select-category")} />
        ) : rows.map((l) => (
          <View key={l.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardRow}>
              {l.imageUrl ? <Image source={{ uri: l.imageUrl }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.surfaceAlt }]}><MaterialIcons name="photo" size={22} color={colors.muted} /></View>}
              <View style={{ flex: 1 }}>
                <View style={styles.cardHead}><Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{l.title}</Text><StatusPill status={l.status} /></View>
                <Text style={[styles.price, { color: colors.primary }]}>{l.price}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{t("{n} مشاهدة", { n: formatNumber(l.views) })} · {t("آخر تحديث {when}", { when: timeAgo(l.updatedAt) })}</Text>
              </View>
            </View>
            {l.moderationReason && (l.status === "rejected" || l.status === "pending") ? <Text style={[styles.reason, { color: colors.error }]}>{t("ملاحظة المشرف")}: {l.moderationReason}</Text> : null}
            {l.status === "rejected" ? <Text style={[styles.meta, { color: colors.muted }]}>{t("لإعادة النظر في القرار تواصل مع الدعم من مركز المساعدة.")}</Text> : null}
            <View style={styles.actions}>{actionsFor(l)}</View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 36 },
  storePanel: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginTop: 8, padding: 14 },
  storeTitle: { fontSize: 15, fontWeight: "900", textAlign: "right" },
  storeMeta: { fontSize: 12, marginTop: 3, textAlign: "right" },
  storeLink: { fontSize: 13, fontWeight: "900" },
  tabs: { flexDirection: "row-reverse", gap: 8, paddingVertical: 14 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 10, padding: 12 },
  cardRow: { flexDirection: "row-reverse", gap: 12 },
  thumb: { borderRadius: 12, height: 76, width: 76 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardHead: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", textAlign: "right" },
  price: { fontSize: 14, fontWeight: "900", marginTop: 4, textAlign: "right" },
  meta: { fontSize: 11, marginTop: 4, textAlign: "right" },
  reason: { fontSize: 12, fontWeight: "700", marginTop: 8, textAlign: "right" },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 10 },
});
