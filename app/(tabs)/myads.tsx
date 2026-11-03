import { useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const statusKeys = ["draft", "pending", "published", "rejected", "suspended"] as const;
type ListingStatus = (typeof statusKeys)[number];
const labels: Record<ListingStatus, string> = { draft: "مسودة", pending: "قيد المراجعة", published: "منشور", rejected: "مرفوض", suspended: "معلّق" };

export default function MyAdsScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const listings = trpc.listings.myListings.useQuery(undefined, { retry: 1 });
  const deleteDraft = trpc.listings.deleteDraft.useMutation({ onSuccess: () => utils.listings.myListings.invalidate() });
  const submitDraft = trpc.listings.submitDraft.useMutation({ onSuccess: () => utils.listings.myListings.invalidate() });
  const permissions = trpc.auth.permissions.useQuery(undefined, { retry: false });
  const canManageStore = permissions.data?.canManageOwnProducts === true;
  const storeProducts = trpc.stores.myProducts.useQuery(undefined, { enabled: canManageStore, retry: false });
  const rows = useMemo(() => listings.data ?? [], [listings.data]);
  const grouped = useMemo(() => {
    const result: Partial<Record<ListingStatus, typeof rows>> = {};
    for (const row of rows) { const status = row.status as ListingStatus; (result[status] ??= []).push(row); }
    return result;
  }, [rows]);

  const resume = async (row: (typeof rows)[number]) => {
    if (row.status !== "draft") return;
    const scope = (row.category ?? "new").trim().replace(/[^\p{L}\p{N}_-]+/gu, "-") || "new";
    await AsyncStorage.multiSet([
      [`dar_al_sila_draft_meta:${scope}`, JSON.stringify({ publicId: row.publicId, version: row.version })],
      [`dar_al_sila_listing_draft:${scope}`, JSON.stringify({ title: row.title ?? "", description: row.description ?? "", price: row.price ?? "", category: row.category ?? "", location: row.location ?? "", phone: row.phone ?? "" })],
    ]);
    router.push({ pathname: "/(tabs)/post", params: { category: row.category ?? "", draftPublicId: row.publicId } });
  };

  const submit = (row: (typeof rows)[number]) => {
    if (row.status !== "draft") return;
    if (!row.title || !row.description || !row.category || !row.location || !row.phone) { resume(row); Alert.alert("بيانات ناقصة", "أكمل بيانات المسودة قبل الإرسال."); return; }
    submitDraft.mutate({ publicId: row.publicId, expectedVersion: row.version, title: row.title, description: row.description, category: row.category, location: row.location, phone: row.phone, price: row.price ?? "" }, { onError: (error) => Alert.alert(error.data?.code === "CONFLICT" ? "نسخة أحدث" : "تعذر الإرسال", "لم يتم تغيير المسودة.") });
  };

  return <ScreenContainer className="px-4"><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><Text style={[styles.title, { color: colors.foreground }]}>إعلاناتي</Text><Pressable onPress={() => router.push("/select-category")} style={[styles.add, { backgroundColor: colors.primary }]}><Text style={styles.addText}>أضف إعلان</Text></Pressable></View>
    {listings.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
    {listings.isError && <Text style={[styles.message, { color: colors.error }]}>تعذر تحميل إعلاناتك. تحقق من الاتصال.</Text>}
    {canManageStore && <View style={[styles.storePanel, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.storePanelHead}><Pressable onPress={() => router.push("/store/manage" as any)} style={[styles.storeButton, { backgroundColor: colors.primary }]}><Text style={styles.storeButtonText}>إدارة المتجر</Text></Pressable><View style={styles.storeCopy}><Text style={[styles.storeTitle, { color: colors.foreground }]}>متجر مسقط</Text><Text style={[styles.storeMeta, { color: colors.muted }]}>{storeProducts.isLoading ? "جارٍ تحميل المنتجات..." : `${storeProducts.data?.length ?? 0} منتجًا في المتجر`}</Text></View></View><Text style={[styles.storeHint, { color: colors.muted }]}>يمكنك إضافة منتجات المتجر وتعديلها وحذفها، وتبقى قرارات النشر للمراجعة.</Text></View>}
    {!listings.isLoading && !listings.isError && rows.length === 0 && <Text style={[styles.message, { color: colors.muted }]}>لا توجد إعلانات أو مسودات محفوظة.</Text>}
    {statusKeys.map((status) => <View key={status} style={styles.section}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{labels[status]} ({grouped[status]?.length ?? 0})</Text>{(grouped[status] ?? []).map((row) => <View key={row.publicId} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.cardHead}><Text style={[styles.status, { color: status === "published" ? colors.success : colors.primary }]}>{labels[status]}</Text><Text style={[styles.cardTitle, { color: colors.foreground }]}>{row.title || "مسودة بلا عنوان"}</Text></View><Text style={[styles.meta, { color: colors.muted }]}>{row.category || "غير محدد"} · {row.location || "دون موقع"}</Text>{status === "draft" && <View style={styles.actions}><Pressable onPress={() => resume(row)} style={[styles.action, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>متابعة</Text></Pressable><Pressable onPress={() => submit(row)} style={[styles.action, { backgroundColor: colors.primary }]}><Text style={styles.actionLight}>إرسال</Text></Pressable><Pressable onPress={() => Alert.alert("حذف المسودة", "سيتم إخفاؤها نهائيًا من قائمتك.", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => deleteDraft.mutate({ publicId: row.publicId }) }])} style={styles.action}><Text style={{ color: colors.error }}>حذف</Text></Pressable></View>}</View>)}</View>)}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ storePanel: { borderRadius: 16, borderWidth: 1, marginTop: 18, padding: 14 }, storePanelHead: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, storeCopy: { flex: 1 }, storeTitle: { fontSize: 17, fontWeight: "900", textAlign: "right" }, storeMeta: { fontSize: 12, marginTop: 4, textAlign: "right" }, storeHint: { fontSize: 12, lineHeight: 19, marginTop: 10, textAlign: "right" }, storeButton: { borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10 }, storeButtonText: { color: "#FFF", fontSize: 12, fontWeight: "900" }, content: { paddingBottom: 36 }, header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", paddingTop: 12 }, title: { fontSize: 29, fontWeight: "900" }, add: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }, addText: { color: "#FFF", fontWeight: "900" }, loader: { marginTop: 30 }, message: { marginTop: 30, textAlign: "right" }, section: { marginTop: 24 }, sectionTitle: { fontSize: 18, fontWeight: "900", marginBottom: 10, textAlign: "right" }, card: { borderRadius: 16, borderWidth: 1, marginBottom: 10, padding: 14 }, cardHead: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, cardTitle: { flex: 1, fontSize: 16, fontWeight: "800", textAlign: "right" }, status: { fontSize: 12, fontWeight: "900", marginLeft: 10 }, meta: { fontSize: 12, marginTop: 8, textAlign: "right" }, actions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 }, action: { alignItems: "center", borderColor: "transparent", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, actionLight: { color: "#FFF", fontWeight: "800" } });
