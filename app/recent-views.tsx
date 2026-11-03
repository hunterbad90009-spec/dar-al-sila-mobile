import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function RecentViewsScreen() {
  const colors = useColors();
  const views = trpc.listings.recentViews.useQuery(undefined, { retry: false });
  return <ScreenContainer className="px-4"><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Pressable onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>رجوع</Text></Pressable><Text style={[styles.title, { color: colors.foreground }]}>آخر المشاهدات</Text></View>{views.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}{views.isError && <Text style={[styles.message, { color: colors.error }]}>سجّل الدخول لعرض سجل المشاهدة.</Text>}{!views.isLoading && !views.isError && views.data?.length === 0 && <Text style={[styles.message, { color: colors.muted }]}>لا توجد إعلانات شاهَدتها مؤخرًا.</Text>}{(views.data ?? []).map((item) => <Pressable key={item.publicId} onPress={() => router.push(`/listing/${item.publicId}`)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.copy}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title || "إعلان بلا عنوان"}</Text><Text style={[styles.meta, { color: colors.muted }]}>{new Date(item.viewedAt).toLocaleString("ar-OM")}</Text></View><Text style={[styles.open, { color: colors.primary }]}>فتح</Text></Pressable>)}</ScrollView></ScreenContainer>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 30 }, header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", paddingTop: 14 }, title: { fontSize: 25, fontWeight: "900" }, back: { fontSize: 13, fontWeight: "800" }, loader: { marginTop: 50 }, message: { fontSize: 14, marginTop: 50, textAlign: "center" }, card: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", marginTop: 12, padding: 14 }, copy: { flex: 1 }, cardTitle: { fontSize: 15, fontWeight: "800", textAlign: "right" }, meta: { fontSize: 11, marginTop: 5, textAlign: "right" }, open: { fontSize: 12, fontWeight: "800", marginRight: 12 } });
