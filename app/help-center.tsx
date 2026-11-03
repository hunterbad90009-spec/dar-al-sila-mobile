import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Card, Header, SectionHeader, notify } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { FAQ, PAGES, SUPPORT_EMAIL, pick } from "@/lib/content";
import { isRTL, t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";

type IconName = keyof typeof MaterialIcons.glyphMap;
const LINKS: { key: string; icon: IconName }[] = [
  { key: "safety", icon: "shield" },
  { key: "seller-guidelines", icon: "sell" },
  { key: "buyer-guidelines", icon: "shopping-cart" },
  { key: "prohibited-items", icon: "block" },
  { key: "terms", icon: "description" },
  { key: "privacy-policy", icon: "lock" },
];

/** Help center (spec 4.14): FAQ, guidelines, policies, contact support, report a problem. */
export default function HelpCenterScreen() {
  const colors = useColors();
  const [open, setOpen] = useState<number | null>(0);

  const email = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("مساعدة دار السلع"))}`).catch(() => notify(t("راسلنا على"), SUPPORT_EMAIL));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(SUPPORT_EMAIL); notify(t("تم نسخ البريد")); } catch { notify(t("راسلنا على"), SUPPORT_EMAIL); }
  };

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header title={t("مركز المساعدة")} subtitle={t("إجابات واضحة ومساندة آمنة لمستخدمي دار السلع")} />

        <SectionHeader title={t("الأسئلة الشائعة")} />
        <Card style={{ paddingVertical: 4 }}>
          {FAQ.map((item, index) => (
            <Pressable key={item.q.ar} onPress={() => setOpen(open === index ? null : index)} style={[styles.faq, index < FAQ.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <View style={styles.faqHead}>
                <Text style={[styles.question, { color: colors.foreground }]}>{pick(item.q)}</Text>
                <MaterialIcons name={open === index ? "expand-less" : "expand-more"} size={22} color={colors.muted} />
              </View>
              {open === index ? <Text style={[styles.answer, { color: colors.muted }]}>{pick(item.a)}</Text> : null}
            </Pressable>
          ))}
        </Card>

        <SectionHeader title={t("الأدلة والسياسات")} />
        <Card style={{ paddingVertical: 4 }}>
          {LINKS.map((link, index) => (
            <Pressable key={link.key} onPress={() => router.push(`/${link.key}` as never)} style={[styles.link, index < LINKS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <MaterialIcons name={link.icon} size={21} color={colors.primary} />
              <Text style={[styles.linkText, { color: colors.foreground }]}>{pick(PAGES[link.key].title)}</Text>
              <MaterialIcons name={isRTL() ? "chevron-left" : "chevron-right"} size={20} color={colors.muted} />
            </Pressable>
          ))}
        </Card>

        <SectionHeader title={t("تواصل مع الدعم")} />
        <Card>
          <Text style={[styles.answer, { color: colors.muted, marginTop: 0 }]}>{t("راسلنا وسنرد خلال يوم عمل. اذكر رقم الإعلان إن وجد.")}</Text>
          <Text selectable style={[styles.email, { color: colors.foreground }]}>{SUPPORT_EMAIL}</Text>
          <View style={styles.row}>
            <Button small icon="email" label={t("إرسال بريد")} onPress={email} style={{ flex: 1 }} />
            <Button small variant="ghost" icon="content-copy" label={t("نسخ البريد")} onPress={copy} style={{ flex: 1 }} />
          </View>
        </Card>

        <Button variant="outline" icon="report-problem" label={t("الإبلاغ عن مشكلة")} onPress={() => router.push("/report")} style={{ marginTop: 18 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  faq: { paddingVertical: 12 },
  faqHead: { alignItems: "center", flexDirection: "row-reverse", gap: 8 },
  question: { flex: 1, fontSize: 14, fontWeight: "800", textAlign: "right" },
  answer: { fontSize: 13, lineHeight: 21, marginTop: 8, textAlign: "right" },
  link: { alignItems: "center", flexDirection: "row-reverse", gap: 10, paddingVertical: 13 },
  linkText: { flex: 1, fontSize: 14, fontWeight: "700", textAlign: "right" },
  email: { fontSize: 16, fontWeight: "900", marginVertical: 10, textAlign: "center" },
  row: { flexDirection: "row-reverse", gap: 8 },
});
