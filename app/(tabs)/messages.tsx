import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, ErrorState, Header, Loading, LoginRequired } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { friendlyError, listConversations } from "@/lib/data";
import { t, timeAgo } from "@/lib/i18n";
import { keys } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

export default function MessagesScreen() {
  const colors = useColors();
  const { isAuthenticated, loading } = useAuth();
  const conversations = useQuery({ queryKey: keys.conversations, queryFn: listConversations, enabled: isAuthenticated, refetchInterval: 20_000 });
  useFocusEffect(useCallback(() => { if (isAuthenticated) void conversations.refetch(); }, [isAuthenticated])); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header back={false} title={t("الرسائل")} subtitle={t("محادثاتك مع البائعين والمشترين")} />
        {loading ? <Loading /> : !isAuthenticated ? <LoginRequired text={t("سجّل الدخول لمراسلة البائعين.")} /> : conversations.isLoading ? <Loading /> : conversations.isError ? <ErrorState message={friendlyError(conversations.error)} onRetry={() => conversations.refetch()} /> : (conversations.data ?? []).length === 0 ? (
          <EmptyState icon="chat-bubble-outline" title={t("لا توجد محادثات بعد")} text={t("افتح أي إعلان واضغط «مراسلة» لبدء محادثة مع البائع.")} />
        ) : conversations.data!.map((c) => (
          <Pressable key={c.id} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: c.id } })} style={({ pressed }) => [styles.item, { backgroundColor: colors.surface, borderColor: c.unread ? colors.accent : colors.border, opacity: pressed ? 0.8 : 1 }]}>
            {c.listingImage ? <Image source={{ uri: c.listingImage }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.accentSoft }]}><MaterialIcons name="person" size={24} color={colors.primary} /></View>}
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{c.otherName}</Text>
                {c.lastAt ? <Text style={[styles.time, { color: colors.muted }]}>{timeAgo(c.lastAt)}</Text> : null}
              </View>
              {c.listingTitle ? <Text style={[styles.listing, { color: colors.primary }]} numberOfLines={1}>{c.listingTitle}</Text> : null}
              <View style={styles.row}>
                <Text style={[styles.last, { color: c.unread ? colors.foreground : colors.muted, fontWeight: c.unread ? "800" : "400" }]} numberOfLines={1}>{c.lastMessage ?? t("لا توجد رسائل بعد")}</Text>
                {c.unread ? <View style={[styles.badge, { backgroundColor: colors.accent }]}><Text style={styles.badgeText}>{c.unread}</Text></View> : null}
              </View>
              <Text style={[styles.role, { color: colors.muted }]}>{c.iAmSeller ? t("استفسار عن إعلانك") : t("محادثة مع البائع")}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 30 },
  item: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginTop: 10, padding: 12 },
  thumb: { borderRadius: 12, height: 58, width: 58 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  row: { alignItems: "center", flexDirection: "row-reverse", gap: 8, justifyContent: "space-between" },
  name: { flex: 1, fontSize: 15, fontWeight: "900", textAlign: "right" },
  time: { fontSize: 11 },
  listing: { fontSize: 12, fontWeight: "700", marginTop: 2, textAlign: "right" },
  last: { flex: 1, fontSize: 13, marginTop: 3, textAlign: "right" },
  badge: { alignItems: "center", borderRadius: 10, height: 20, justifyContent: "center", minWidth: 20, paddingHorizontal: 5 },
  badgeText: { color: "#0B1F17", fontSize: 11, fontWeight: "900" },
  role: { fontSize: 10, marginTop: 3, textAlign: "right" },
});
