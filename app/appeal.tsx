import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Card, EmptyState, ErrorState, Field, Header, Input, Loading, LoginRequired, notify } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { type Appeal, type AppealKind, fileAppeal, friendlyError, getListing, getMyAppeals } from "@/lib/data";
import { formatDate, t, timeAgo } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";
import { useMyRestriction } from "@/lib/queries";

const STATUS: Record<Appeal["status"], { label: string; icon: "hourglass-top" | "check-circle" | "cancel" }> = {
  open: { label: "قيد المراجعة", icon: "hourglass-top" },
  accepted: { label: "مقبول", icon: "check-circle" },
  rejected: { label: "مرفوض", icon: "cancel" },
};

/** Appeal an admin decision: a rejected/suspended listing, or an account suspension. */
export default function AppealScreen() {
  const colors = useColors();
  const client = useQueryClient();
  const { isAuthenticated, loading } = useAuth();
  const params = useLocalSearchParams<{ kind?: string; listingId?: string }>();
  const kind: AppealKind = params.kind === "listing" ? "listing" : "account";
  const listingId = kind === "listing" ? params.listingId ?? null : null;
  const [statement, setStatement] = useState("");

  const restriction = useMyRestriction();
  const listing = useQuery({ queryKey: ["listing", listingId], queryFn: () => getListing({ publicId: listingId! }), enabled: Boolean(listingId) && isAuthenticated });
  const appeals = useQuery({ queryKey: ["my-appeals", kind, listingId], queryFn: () => getMyAppeals({ kind, listingId }), enabled: isAuthenticated });
  const submit = useMutation({
    mutationFn: () => fileAppeal({ kind, listingId, statement }),
    onSuccess: () => {
      setStatement("");
      void client.invalidateQueries({ queryKey: ["my-appeals"] });
      notify(t("تم إرسال اعتراضك"), t("سيراجعه فريق دار السلع ويصلك إشعار بالقرار."));
    },
    onError: (e) => notify(t("تعذر إرسال الاعتراض"), friendlyError(e)),
  });

  if (loading) return <ScreenContainer><Loading /></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-4"><Header title={t("اعتراض على القرار")} /><LoginRequired /></ScreenContainer>;

  const subjectReason = kind === "listing" ? listing.data?.moderationReason : restriction.data?.reason;
  const subjectTitle = kind === "listing" ? listing.data?.title : restriction.data ? (restriction.data.until ? t("حسابك موقوف حتى {date}", { date: formatDate(restriction.data.until) }) : t("حسابك موقوف بشكل دائم")) : null;
  const open = appeals.data?.find((a) => a.status === "open");
  const canAppeal = kind === "listing"
    ? listing.data?.status === "rejected" && listing.data.moderationStatus !== "auto_rejected"
    : Boolean(restriction.data);
  const tooShort = statement.trim().length < 10;

  return (
    <ScreenContainer className="px-4">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header title={t("اعتراض على القرار")} subtitle={t("يراجع فريق دار السلع كل اعتراض ويرد عليك بقرار مكتوب")} />

        {appeals.isLoading || restriction.isLoading || listing.isLoading ? <Loading /> : appeals.isError ? <ErrorState message={friendlyError(appeals.error)} onRetry={() => appeals.refetch()} /> : (
          <>
            {subjectTitle ? (
              <Card>
                <Text style={[styles.label, { color: colors.muted }]}>{kind === "listing" ? t("الإعلان") : t("الحساب")}</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>{subjectTitle}</Text>
                {subjectReason ? <Text style={[styles.text, { color: colors.error }]}>{t("سبب القرار")}: {t(subjectReason)}</Text> : null}
              </Card>
            ) : null}

            {open ? (
              <Card style={{ marginTop: 12 }}>
                <View style={styles.row}><MaterialIcons name="hourglass-top" size={20} color={colors.warning} /><Text style={[styles.title, { color: colors.foreground }]}>{t("اعتراضك قيد المراجعة")}</Text></View>
                <Text style={[styles.text, { color: colors.muted }]}>{t("أُرسل {when}. سيصلك إشعار عند صدور القرار.", { when: timeAgo(open.createdAt) })}</Text>
              </Card>
            ) : canAppeal ? (
              <Card style={{ marginTop: 12 }}>
                <Field label={t("لماذا ترى أن القرار خطأ؟")} required hint={t("اكتب بوضوح وباختصار. لا تكتب كلمات مرور أو أرقام بطاقات.")}>
                  <Input value={statement} onChangeText={setStatement} multiline maxLength={1000} placeholder={t("مثال: الإعلان لا يحتوي على مواد ممنوعة، والصور لمنتجي الحقيقي…")} />
                </Field>
                <Text style={[styles.counter, { color: colors.muted }]}>{statement.trim().length}/1000</Text>
                <Button icon="send" label={t("إرسال الاعتراض")} disabled={tooShort} loading={submit.isPending} onPress={() => submit.mutate()} style={{ marginTop: 10 }} />
              </Card>
            ) : !appeals.data?.length ? (
              <EmptyState icon="gavel" title={t("لا يوجد قرار يمكن الاعتراض عليه")} actionLabel={t("رجوع")} onAction={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} />
            ) : null}

            {appeals.data?.length ? <Text style={[styles.section, { color: colors.foreground }]}>{t("اعتراضاتك السابقة")}</Text> : null}
            {appeals.data?.map((a) => (
              <Card key={a.id} style={{ marginTop: 8 }}>
                <View style={styles.row}>
                  <MaterialIcons name={STATUS[a.status].icon} size={20} color={a.status === "accepted" ? colors.success : a.status === "rejected" ? colors.error : colors.warning} />
                  <Text style={[styles.title, { color: colors.foreground }]}>{t(STATUS[a.status].label)}</Text>
                  <Text style={[styles.label, { color: colors.muted }]}>{formatDate(a.createdAt)}</Text>
                </View>
                <Text style={[styles.text, { color: colors.muted }]}>{a.statement}</Text>
                {a.decisionNote ? <Text style={[styles.text, { color: colors.foreground }]}>{t("رد فريق دار السلع")}: {a.decisionNote}</Text> : null}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  row: { alignItems: "center", flexDirection: "row-reverse", gap: 8 },
  label: { fontSize: 12, fontWeight: "700", textAlign: "right" },
  title: { flex: 1, fontSize: 15, fontWeight: "900", marginTop: 2, textAlign: "right" },
  text: { fontSize: 13, lineHeight: 21, marginTop: 6, textAlign: "right" },
  counter: { fontSize: 11, marginTop: 4, textAlign: "left" },
  section: { fontSize: 16, fontWeight: "900", marginTop: 20, textAlign: "right" },
});
