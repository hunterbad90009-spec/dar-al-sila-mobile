import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, Header, Input, Loading, LoginRequired, confirmAction, notify } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { friendlyError, getBlockedIds, getMessages, listConversations, markConversationRead, sendMessage, setBlocked } from "@/lib/data";
import { formatDate, t } from "@/lib/i18n";
import { prepareImageDataUrl } from "@/lib/prepare-image-data-url";
import { keys } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

/** One conversation (spec 4.8): only its two participants can read it (enforced by RLS). */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const client = useQueryClient();
  const { user, isAuthenticated, loading } = useAuth();
  const [body, setBody] = useState("");
  const scroll = useRef<ScrollView>(null);

  const conversations = useQuery({ queryKey: keys.conversations, queryFn: listConversations, enabled: isAuthenticated });
  const conversation = conversations.data?.find((c) => c.id === id);
  const messages = useQuery({ queryKey: keys.messages(id!), queryFn: () => getMessages(id!), enabled: isAuthenticated && Boolean(id), refetchInterval: 8_000 });
  const blocked = useQuery({ queryKey: ["blocked"], queryFn: getBlockedIds, enabled: isAuthenticated });
  const isBlocked = Boolean(conversation && blocked.data?.has(conversation.otherUserId));

  const unreadFromOther = (messages.data ?? []).some((m) => m.senderId !== user?.id && !m.readAt);
  useEffect(() => {
    if (!unreadFromOther || !id) return;
    markConversationRead(id).then(() => {
      void client.invalidateQueries({ queryKey: keys.conversations });
      void client.invalidateQueries({ queryKey: keys.unread });
    }).catch(() => undefined);
  }, [client, id, unreadFromOther]);

  const send = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      setBody("");
      void client.invalidateQueries({ queryKey: keys.messages(id!) });
      void client.invalidateQueries({ queryKey: keys.conversations });
    },
    onError: (e) => notify(t("تعذر إرسال الرسالة"), friendlyError(e)),
  });
  const block = useMutation({ mutationFn: setBlocked, onSuccess: () => void client.invalidateQueries({ queryKey: ["blocked"] }), onError: (e) => notify(t("تعذر تنفيذ الإجراء"), friendlyError(e)) });

  const sendImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    try {
      const dataUrl = await prepareImageDataUrl(result.assets[0].uri);
      send.mutate({ conversationId: id!, body: "", imageDataUrl: dataUrl });
    } catch (e) {
      notify(t("تعذر تجهيز الصورة"), friendlyError(e));
    }
  };

  if (loading) return <ScreenContainer><Loading /></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-4"><Header title={t("المحادثة")} /><LoginRequired /></ScreenContainer>;
  if (conversations.isSuccess && !conversation) return <ScreenContainer className="px-4"><Header title={t("المحادثة")} /><EmptyState icon="lock" title={t("لا يمكن فتح هذه المحادثة")} text={t("المحادثة غير موجودة أو لا تخصك.")} /></ScreenContainer>;

  return (
    <ScreenContainer className="px-4" edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Header
          title={conversation?.otherName ?? t("المحادثة")}
          subtitle={conversation?.listingTitle ?? undefined}
          right={conversation ? (
            <View style={styles.headerActions}>
              <Pressable accessibilityLabel={t("الإبلاغ عن المحادثة")} hitSlop={8} onPress={() => router.push({ pathname: "/report", params: { conversationId: id, userId: conversation.otherUserId, listingId: conversation.listingId ?? "" } })}><MaterialIcons name="flag" size={22} color={colors.error} /></Pressable>
              <Pressable accessibilityLabel={isBlocked ? t("إلغاء الحظر") : t("حظر المستخدم")} hitSlop={8} onPress={() => isBlocked ? block.mutate({ userId: conversation.otherUserId, blocked: false }) : confirmAction(t("حظر المستخدم"), t("لن يتمكن أي منكما من إرسال رسائل في هذه المحادثة."), t("حظر"), () => block.mutate({ userId: conversation.otherUserId, blocked: true }), true)}><MaterialIcons name={isBlocked ? "lock-open" : "block"} size={22} color={colors.foreground} /></Pressable>
            </View>
          ) : undefined}
        />
        {conversation?.listingId ? (
          <Pressable onPress={() => router.push({ pathname: "/listing/[id]", params: { id: conversation.listingId! } })} style={[styles.listingRef, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {conversation.listingImage ? <Image source={{ uri: conversation.listingImage }} style={styles.refThumb} /> : <MaterialIcons name="sell" size={22} color={colors.primary} />}
            <Text style={[styles.refText, { color: colors.foreground }]} numberOfLines={1}>{conversation.listingTitle}</Text>
            <Text style={[styles.refLink, { color: colors.primary }]}>{t("عرض الإعلان")}</Text>
          </Pressable>
        ) : null}
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.messages} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          {messages.isLoading ? <Loading /> : (messages.data ?? []).length === 0 ? <Text style={[styles.hint, { color: colors.muted }]}>{t("ابدأ المحادثة بالسؤال عن المنتج. لا ترسل مبالغ قبل معاينة المنتج.")}</Text> : messages.data!.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? colors.primary : colors.surface, borderColor: colors.border }]}>
                {m.imageUrl ? <Image source={{ uri: m.imageUrl }} style={styles.msgImage} /> : null}
                {m.body ? <Text style={[styles.msgText, { color: mine ? colors.primaryText : colors.foreground }]}>{m.body}</Text> : null}
                <Text style={[styles.msgTime, { color: mine ? "#FFFFFFAA" : colors.muted }]}>{formatDate(m.createdAt, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}{mine && m.readAt ? ` · ${t("مقروءة")}` : ""}</Text>
              </View>
            );
          })}
        </ScrollView>
        {isBlocked ? <Text style={[styles.blocked, { color: colors.error }]}>{t("حظرت هذا المستخدم. ألغِ الحظر لإرسال الرسائل.")}</Text> : conversation?.status === "closed" ? <Text style={[styles.blocked, { color: colors.muted }]}>{t("هذه المحادثة مغلقة.")}</Text> : (
          <View style={styles.composer}>
            <Pressable accessibilityLabel={t("إرسال صورة")} onPress={sendImage} style={[styles.round, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialIcons name="photo-camera" size={20} color={colors.primary} /></Pressable>
            <Input value={body} onChangeText={setBody} placeholder={t("اكتب رسالتك...")} style={{ flex: 1 }} onSubmitEditing={() => body.trim() && send.mutate({ conversationId: id!, body })} />
            <Pressable accessibilityLabel={t("إرسال")} disabled={!body.trim() || send.isPending} onPress={() => send.mutate({ conversationId: id!, body })} style={[styles.round, { backgroundColor: colors.primary, opacity: body.trim() ? 1 : 0.5 }]}><MaterialIcons name="send" size={20} color={colors.primaryText} /></Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  headerActions: { flexDirection: "row-reverse", gap: 14 },
  listingRef: { alignItems: "center", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 10, padding: 8 },
  refThumb: { borderRadius: 8, height: 40, width: 40 },
  refText: { flex: 1, fontSize: 13, fontWeight: "800", textAlign: "right" },
  refLink: { fontSize: 12, fontWeight: "800" },
  messages: { gap: 8, paddingVertical: 12 },
  hint: { fontSize: 13, lineHeight: 20, marginTop: 30, textAlign: "center" },
  bubble: { borderRadius: 16, borderWidth: 1, maxWidth: "82%", padding: 10 },
  mine: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  theirs: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  msgImage: { borderRadius: 10, height: 180, marginBottom: 6, width: 220 },
  msgText: { fontSize: 15, lineHeight: 22, textAlign: "right" },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: "right" },
  blocked: { fontSize: 13, fontWeight: "700", paddingVertical: 14, textAlign: "center" },
  composer: { alignItems: "center", flexDirection: "row-reverse", gap: 8, paddingVertical: 10 },
  round: { alignItems: "center", borderRadius: 25, borderWidth: 1, height: 50, justifyContent: "center", width: 50 },
});
