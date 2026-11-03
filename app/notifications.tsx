import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, EmptyState, ErrorState, Header, Loading, LoginRequired } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { type AppNotification, friendlyError, getAnnouncement, getNotifications, markNotificationsRead } from "@/lib/data";
import { getLang, t, timeAgo } from "@/lib/i18n";
import { keys } from "@/lib/queries";
import { allowsNotification, useNotificationPrefs } from "@/lib/notification-prefs";
import { createStyles } from "@/lib/i18n/rtl";

type IconName = keyof typeof MaterialIcons.glyphMap;

/** Titles are stored as type keys by database triggers and translated here. */
const TYPES: Record<string, { title: string; icon: IconName }> = {
  chat_message: { title: "رسالة جديدة", icon: "chat" },
  listing_approved: { title: "تمت الموافقة على إعلانك", icon: "check-circle" },
  listing_rejected: { title: "تم رفض إعلانك", icon: "cancel" },
  listing_suspended: { title: "تم إيقاف إعلانك", icon: "pause-circle" },
  listing_expired: { title: "انتهت صلاحية إعلانك", icon: "schedule" },
  security: { title: "تنبيه أمني", icon: "security" },
};

export default function NotificationsScreen() {
  const colors = useColors();
  const client = useQueryClient();
  const { isAuthenticated, loading } = useAuth();
  const prefs = useNotificationPrefs();
  const list = useQuery({ queryKey: keys.notifications, queryFn: getNotifications, enabled: isAuthenticated });
  const announcement = useQuery({ queryKey: ["announcement"], queryFn: getAnnouncement });
  const markAll = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => { void client.invalidateQueries({ queryKey: keys.notifications }); void client.invalidateQueries({ queryKey: keys.unread }); },
  });

  const open = (n: AppNotification) => {
    if (!n.readAt) void markNotificationsRead([n.id]).then(() => { void client.invalidateQueries({ queryKey: keys.notifications }); void client.invalidateQueries({ queryKey: keys.unread }); });
    if (n.type === "chat_message") router.push("/(tabs)/messages");
    else if (n.listingId) router.push(n.type === "listing_approved" ? { pathname: "/listing/[id]", params: { id: n.listingId } } : "/(tabs)/myads");
  };

  const items = (list.data ?? []).filter((n) => allowsNotification(prefs, n.type));
  const hasUnread = items.some((n) => !n.readAt);
  const announcementText = prefs.announcements && announcement.data ? (getLang() === "en" ? announcement.data.en || announcement.data.ar : announcement.data.ar || announcement.data.en) : "";

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header title={t("الإشعارات")} right={hasUnread ? <Button small variant="ghost" label={t("تعليم الكل كمقروء")} loading={markAll.isPending} onPress={() => markAll.mutate()} /> : undefined} />
        {announcementText ? (
          <View style={[styles.item, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <MaterialIcons name="campaign" size={24} color={colors.foreground} />
            <View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.foreground }]}>{t("إعلان من دار السلع")}</Text><Text style={[styles.body, { color: colors.foreground }]}>{announcementText}</Text></View>
          </View>
        ) : null}
        {loading ? <Loading /> : !isAuthenticated ? <LoginRequired /> : list.isLoading ? <Loading /> : list.isError ? <ErrorState message={friendlyError(list.error)} onRetry={() => list.refetch()} /> : items.length === 0 ? (
          <EmptyState icon="notifications-none" title={t("لا توجد إشعارات")} text={t("ستصلك هنا الرسائل الجديدة وقرارات مراجعة إعلاناتك.")} />
        ) : items.map((n) => {
          const meta = TYPES[n.type] ?? { title: n.title, icon: "notifications" as IconName };
          return (
            <Pressable key={n.id} onPress={() => open(n)} style={({ pressed }) => [styles.item, { backgroundColor: colors.surface, borderColor: n.readAt ? colors.border : colors.accent, opacity: pressed ? 0.8 : 1 }]}>
              <MaterialIcons name={meta.icon} size={24} color={n.type === "listing_rejected" || n.type === "listing_suspended" ? colors.error : colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground }]}>{TYPES[n.type] ? t(meta.title) : n.title}</Text>
                {n.body ? <Text style={[styles.body, { color: colors.muted }]} numberOfLines={3}>{n.body}</Text> : null}
                <Text style={[styles.time, { color: colors.muted }]}>{timeAgo(n.createdAt)}</Text>
              </View>
              {!n.readAt ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 30 },
  item: { alignItems: "flex-start", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginTop: 10, padding: 14 },
  title: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  body: { fontSize: 13, lineHeight: 20, marginTop: 4, textAlign: "right" },
  time: { fontSize: 11, marginTop: 6, textAlign: "right" },
  dot: { borderRadius: 5, height: 10, marginTop: 6, width: 10 },
});
