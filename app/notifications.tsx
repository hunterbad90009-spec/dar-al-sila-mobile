import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function NotificationsScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const notifications = trpc.account.notifications.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const markRead = trpc.account.markNotificationRead.useMutation({ onSuccess: () => utils.account.notifications.invalidate() });
  return <ScreenContainer className="px-4"><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Pressable onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>رجوع</Text></Pressable><Text style={[styles.title, { color: colors.foreground }]}>الإشعارات</Text></View>{!isAuthenticated && <Text style={[styles.message, { color: colors.muted }]}>سجّل الدخول لعرض إشعارات حسابك.</Text>}{isAuthenticated && notifications.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}{isAuthenticated && notifications.isError && <Text style={[styles.message, { color: colors.error }]}>تعذر تحميل الإشعارات.</Text>}{isAuthenticated && !notifications.isLoading && !notifications.isError && notifications.data?.length === 0 && <Text style={[styles.message, { color: colors.muted }]}>لا توجد إشعارات جديدة.</Text>}{(notifications.data ?? []).map((item) => <Pressable key={item.id} onPress={() => { if (!item.readAt) markRead.mutate({ notificationId: item.id }); if (item.listingId) router.push(`/listing/${item.listingId}`); }} style={[styles.card, { backgroundColor: item.readAt ? colors.surface : colors.primary + "18", borderColor: colors.border }]}><View style={styles.copy}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.body, { color: colors.muted }]}>{item.body}</Text><Text style={[styles.date, { color: colors.muted }]}>{new Date(item.createdAt).toLocaleString("ar-OM")}</Text></View>{!item.readAt && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}</Pressable>)}</ScrollView></ScreenContainer>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 30 }, header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", paddingTop: 14 }, title: { fontSize: 25, fontWeight: "900" }, back: { fontSize: 13, fontWeight: "800" }, loader: { marginTop: 50 }, message: { fontSize: 14, marginTop: 50, textAlign: "center" }, card: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", marginTop: 12, padding: 14 }, copy: { flex: 1 }, cardTitle: { fontSize: 15, fontWeight: "900", textAlign: "right" }, body: { fontSize: 13, lineHeight: 20, marginTop: 5, textAlign: "right" }, date: { fontSize: 10, marginTop: 7, textAlign: "right" }, dot: { borderRadius: 5, height: 10, marginRight: 8, width: 10 } });
