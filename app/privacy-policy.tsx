import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  return (
    <ScreenContainer className="px-4" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="رجوع"><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>سياسة الخصوصية</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.updated, { color: colors.muted }]}>آخر تحديث: 23 أغسطس 2026</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>خصوصيتك مهمة لدينا</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>تجمع دار السلع الحد الأدنى من المعلومات اللازمة لتشغيل الحساب، مثل الاسم والبريد الإلكتروني ومعرّف الحساب الذي ترسله Google بعد موافقتك.</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>تسجيل الدخول عبر Google</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>تتم المصادقة في صفحة Google الرسمية. لا يطلب التطبيق كلمة مرور Google ولا يراها ولا يخزنها. يحتفظ التطبيق برمز جلسة خاص به وبيانات الملف الأساسية اللازمة لعرض الحساب.</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>الإعلانات والاتصالات</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>تُستخدم بيانات الإعلان لعرضه للمستخدمين وفق حالته وصلاحياته. لا نعرض لمالك الإعلان هويات الأشخاص الذين شاهدوه. لا تُكشف وسائط المسودات للعامة.</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>حماية البيانات</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>نستخدم جلسات محمية وصلاحيات خادمية، ولا نسمح للعميل بتجاوز ملكية الإعلان أو حالة الفحص. يمكنك طلب حذف حسابك من صفحة الملف الشخصي.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", paddingTop: 14 },
  back: { alignItems: "center", height: 38, justifyContent: "center", width: 38 },
  spacer: { width: 38 },
  title: { fontSize: 20, fontWeight: "900" },
  content: { paddingBottom: 40, paddingTop: 24 },
  updated: { fontSize: 12, textAlign: "right" },
  heading: { fontSize: 17, fontWeight: "900", marginTop: 24, textAlign: "right" },
  body: { fontSize: 14, lineHeight: 25, marginTop: 8, textAlign: "right" },
});
