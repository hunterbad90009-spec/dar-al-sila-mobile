import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const cards = [
  { title: "المعلومات القانونية والخصوصية", detail: "اطّلع على سياسة الخصوصية وشروط استخدام دار السلع.", icon: "lock.shield.fill" as const, route: "/privacy-policy" },
  { title: "الخدمات المدفوعة", detail: "تعرّف على خيارات تمييز الإعلان والخدمات الداخلية.", icon: "star.fill" as const, route: "/services" },
  { title: "الاحتيال والبلاغات", detail: "كيف تتعرف على الإعلان المشبوه، وكيف ترفع بلاغًا.", icon: "exclamationmark.triangle.fill" as const, route: "/safety" },
  { title: "شروط الاستخدام", detail: "القواعد التي تنظّم البيع والشراء والتواصل داخل المنصة.", icon: "doc.text.fill" as const, route: "/terms" },
];

export default function HelpCenterScreen() {
  const colors = useColors();
  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface }]}><IconSymbol name="chevron.right" size={22} color={colors.foreground} /></Pressable>
          <View style={styles.heading}><Text style={[styles.title, { color: colors.foreground }]}>مركز المساعدة</Text><Text style={[styles.subtitle, { color: colors.muted }]}>إجابات واضحة ومساندة آمنة لمستخدمي دار السلع</Text></View>
        </View>
        <View style={[styles.banner, { backgroundColor: colors.primary }]}><IconSymbol name="checkmark.shield.fill" size={31} color="#FFFFFF" /><View style={styles.bannerCopy}><Text style={styles.bannerTitle}>تسوق وتواصل بأمان</Text><Text style={styles.bannerText}>لا ترسل بيانات الدفع أو رموز التحقق لأي شخص، وتحقق من السلعة قبل الدفع.</Text></View></View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>كيف يمكننا مساعدتك؟</Text>
        <View style={styles.grid}>{cards.map((card) => <Pressable key={card.title} onPress={() => router.push(card.route as never)} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.72 }]}><View style={[styles.iconBox, { backgroundColor: `${colors.primary}18` }]}><IconSymbol name={card.icon} size={23} color={colors.primary} /></View><Text style={[styles.cardTitle, { color: colors.foreground }]}>{card.title}</Text><Text style={[styles.cardDetail, { color: colors.muted }]}>{card.detail}</Text><Text style={[styles.open, { color: colors.primary }]}>فتح القسم ←</Text></Pressable>)}</View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>أسئلة سريعة</Text>
        <View style={[styles.faq, { backgroundColor: colors.surface, borderColor: colors.border }]}>{[
          ["كيف أبلغ عن إعلان؟", "افتح تفاصيل الإعلان وتواصل مع الدعم، واذكر رقم الإعلان وسبب البلاغ."],
          ["هل أستطيع عرض سلعة دون اشتراك؟", "نعم، يستطيع المستخدم العادي نشر إعلان عادي. الاشتراك يضيف مزايا المتجر وفق الباقة."],
          ["متى يظهر إعلاني؟", "بعد اكتمال الفحص الآلي، قد يُرسل الإعلان إلى مراجعة المشرف قبل ظهوره للعامة."],
        ].map(([question, answer]) => <View key={question} style={[styles.faqRow, { borderBottomColor: colors.border }]}><Text style={[styles.question, { color: colors.foreground }]}>{question}</Text><Text style={[styles.answer, { color: colors.muted }]}>{answer}</Text></View>)}</View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { paddingBottom: 30 }, header: { alignItems: "center", flexDirection: "row-reverse", gap: 12, paddingTop: 15 }, back: { alignItems: "center", borderRadius: 21, height: 42, justifyContent: "center", width: 42 }, heading: { flex: 1 }, title: { fontSize: 27, fontWeight: "900", textAlign: "right" }, subtitle: { fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" }, banner: { alignItems: "center", borderRadius: 20, flexDirection: "row-reverse", gap: 12, marginTop: 22, padding: 17 }, bannerCopy: { flex: 1 }, bannerTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", textAlign: "right" }, bannerText: { color: "#FFFFFFDD", fontSize: 12, lineHeight: 19, marginTop: 5, textAlign: "right" }, sectionTitle: { fontSize: 19, fontWeight: "900", marginBottom: 11, marginTop: 27, textAlign: "right" }, grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 11, justifyContent: "space-between" }, card: { borderRadius: 17, borderWidth: 1, minHeight: 186, padding: 14, width: "48.5%" }, iconBox: { alignItems: "center", borderRadius: 12, height: 42, justifyContent: "center", width: 42 }, cardTitle: { fontSize: 14, fontWeight: "900", lineHeight: 20, marginTop: 13, textAlign: "right" }, cardDetail: { fontSize: 11, lineHeight: 17, marginTop: 5, textAlign: "right" }, open: { fontSize: 11, fontWeight: "900", marginTop: 13, textAlign: "right" }, faq: { borderRadius: 17, borderWidth: 1, overflow: "hidden" }, faqRow: { borderBottomWidth: 1, padding: 14 }, question: { fontSize: 14, fontWeight: "900", textAlign: "right" }, answer: { fontSize: 12, lineHeight: 19, marginTop: 6, textAlign: "right" } });
