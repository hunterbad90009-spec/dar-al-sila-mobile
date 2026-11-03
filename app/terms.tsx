import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function TermsScreen() {
  const colors = useColors();
  return (
    <ScreenContainer className="px-4" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="رجوع"><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>شروط الاستخدام</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.updated, { color: colors.muted }]}>آخر تحديث: 23 أغسطس 2026</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>استخدام دار السلع</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>دار السلع منصة إعلانات ومعلومات اتصال بين المستخدمين. يتحمل المعلن مسؤولية صحة وصف السلعة وسعرها ورقم الاتصال وحقه في عرضها.</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>الإعلانات والمحتوى</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>يُمنع نشر المحتوى غير القانوني أو المضلل أو المنتهك لحقوق الآخرين. قد تُراجع الإعلانات والصور، وقد يُرفض أو يُعلّق الإعلان المخالف.</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>المشتري والتاجر</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>يستطيع المستخدم العادي التصفح والشراء ونشر إعلان عادي. أما إدارة متجر عام ومنتجاته ومزايا المحادثة الخاصة بالمتجر فتتطلب اشتراك تاجر نشطًا واعتمادًا مناسبًا.</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>التواصل والسلامة</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>استخدم المحادثة والاتصال بحذر، وتحقق من السلعة والبائع قبل أي دفع أو تسليم. لا تطلب من المستخدمين مشاركة كلمات مرورهم أو رموز Google.</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>الحساب</Text>
        <Text style={[styles.body, { color: colors.foreground }]}>يجوز لك تسجيل الخروج أو طلب حذف حسابك من الملف الشخصي. عند حذف الحساب تُخفى بياناته وتُوقف إعلاناته العامة وتُلغى مزايا الاشتراك المرتبطة به.</Text>
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
