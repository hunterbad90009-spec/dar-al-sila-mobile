import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text , View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Chip, Field, Header, Input, LoginRequired, Loading, notify } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { createReport, friendlyError, type ReportReason } from "@/lib/data";
import { t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "fraud", label: "احتيال أو نصب" },
  { value: "misleading", label: "معلومات مضللة" },
  { value: "inappropriate", label: "محتوى غير لائق" },
  { value: "suspicious_seller", label: "بائع مشبوه" },
  { value: "prohibited", label: "منتج ممنوع" },
  { value: "abuse", label: "إساءة أو تحرش" },
  { value: "other", label: "سبب آخر" },
];

/** Report a listing, a user or a conversation (spec 4.13). */
export default function ReportScreen() {
  const params = useLocalSearchParams<{ listingId?: string; userId?: string; conversationId?: string }>();
  const colors = useColors();
  const { isAuthenticated, loading } = useAuth();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  const report = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      notify(t("تم استلام البلاغ"), t("سيراجع فريق دار السلع البلاغ ويتخذ الإجراء المناسب."));
      if (router.canGoBack()) router.back(); else router.replace("/(tabs)");
    },
    onError: (e) => notify(t("تعذر إرسال البلاغ"), friendlyError(e)),
  });

  if (loading) return <ScreenContainer><Loading /></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-4"><Header title={t("الإبلاغ")} /><LoginRequired /></ScreenContainer>;

  const target = params.conversationId ? t("محادثة") : params.listingId ? t("إعلان") : params.userId ? t("مستخدم") : t("مشكلة في التطبيق");

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Header title={t("الإبلاغ عن {target}", { target })} subtitle={t("بلاغك سري، ويراجعه فريق الإشراف.")} />
        <Field label={t("سبب البلاغ")} required>
          <View style={styles.chips}>{REPORT_REASONS.map((r) => <Chip key={r.value} label={t(r.label)} active={reason === r.value} onPress={() => setReason(r.value)} />)}</View>
        </Field>
        <Field label={t("التفاصيل")} required hint={t("اذكر ما حدث بوضوح. لا تكتب كلمات مرور أو بيانات بطاقات.")}>
          <Input value={details} onChangeText={setDetails} multiline placeholder={t("اكتب تفاصيل البلاغ...")} />
        </Field>
        <Button label={t("إرسال البلاغ")} disabled={!reason || details.trim().length < 10} loading={report.isPending} onPress={() => report.mutate({ reason: reason!, details, listingId: params.listingId || null, reportedUserId: params.userId || null, conversationId: params.conversationId || null })} style={{ marginTop: 20 }} />
        <Text style={[styles.note, { color: colors.muted }]}>{t("في حالات الخطر أو الاحتيال المالي تواصل أيضًا مع شرطة عُمان السلطانية.")}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  note: { fontSize: 12, lineHeight: 19, marginTop: 14, textAlign: "right" },
});
