import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
const menu = [
  { label: "إعلاناتي", icon: "list.bullet.rectangle.fill" as const, detail: "إدارة إعلاناتك" },
  { label: "المسودات", icon: "doc.text.fill" as const, detail: "استئناف المسودات المحفوظة" },
  { label: "الإعلانات المفضلة", icon: "heart.fill" as const, detail: "الإعلانات المحفوظة في حسابك" },
  { label: "آخر المشاهدات", icon: "clock.fill" as const, detail: "الإعلانات التي فتحتها مؤخرًا" },
  { label: "الرسائل", icon: "bubble.left.and.bubble.right.fill" as const, detail: "تواصل مع المعلنين" },
  { label: "الإشعارات", icon: "bell.fill" as const, detail: "آخر التنبيهات" },
  { label: "الإعدادات", icon: "gearshape.fill" as const, detail: "الحساب والخصوصية" },
  { label: "مركز المساعدة", icon: "questionmark.circle.fill" as const, detail: "الدعم والبلاغات ونصائح الأمان" },
];
export default function ProfileScreen() {
  const colors = useColors();
  const { user, isAuthenticated, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();
  const handleLogout = () => {
    Alert.alert("إدارة الجلسة", "هل تريد تسجيل الخروج من هذا الحساب على هذا الجهاز؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "تسجيل الخروج", style: "destructive", onPress: logout },
    ]);
  };
  const handleDeleteAccount = () => {
    Alert.alert(
      "حذف الحساب",
      "سيتم إخفاء بيانات حسابك وإعلاناتك العامة وإلغاء اشتراكاتك. لا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف الحساب",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteAccountMutation.mutateAsync();
              await logout();
              router.replace("/login");
            } catch {
              Alert.alert("تعذر حذف الحساب", "حاول مرة أخرى بعد التحقق من اتصال الإنترنت.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };
  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>حسابي</Text>
        <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
          <View style={styles.avatar}><IconSymbol name="person.fill" size={30} color={colors.primary} /></View>
          <View style={styles.profileText}><Text style={styles.welcome}>{isAuthenticated ? `مرحبًا ${user?.name || "بك"}` : "مرحبًا بك في دار السلع"}</Text><Text style={styles.profileHint}>{isAuthenticated ? user?.email || "حسابك موثّق" : "سجّل الدخول لإدارة إعلاناتك"}</Text></View>
          <Pressable onPress={() => isAuthenticated ? logout() : router.push("/login")} style={styles.loginButton}><Text style={[styles.loginText, { color: colors.primary }]}>{isAuthenticated ? "خروج" : "دخول"}</Text></Pressable>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>إدارة الحساب</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>{menu.map((item) => <Pressable key={item.label} onPress={() => item.label === "إعلاناتي" || item.label === "المسودات" ? router.push("/(tabs)/myads") : item.label === "الإعلانات المفضلة" ? router.push("/(tabs)/favorites") : item.label === "آخر المشاهدات" ? router.push("/recent-views" as never) : item.label === "الإشعارات" ? router.push("/notifications" as never) : item.label === "مركز المساعدة" ? router.push("/help-center" as never) : Alert.alert(item.label, item.detail)} style={({ pressed }) => [styles.menuItem, { borderBottomColor: colors.border }, pressed && { opacity: 0.65 }]}><IconSymbol name={item.icon} size={22} color={colors.primary} /><View style={styles.menuCopy}><Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text><Text style={[styles.menuDetail, { color: colors.muted }]}>{item.detail}</Text></View><IconSymbol name="chevron.right" size={18} color={colors.muted} /></Pressable>)}</View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الخصوصية والحساب</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable onPress={() => router.push("/privacy-policy" as never)} style={({ pressed }) => [styles.menuItem, { borderBottomColor: colors.border }, pressed && { opacity: 0.65 }]}>
            <IconSymbol name="lock.shield.fill" size={22} color={colors.primary} /><View style={styles.menuCopy}><Text style={[styles.menuLabel, { color: colors.foreground }]}>سياسة الخصوصية</Text><Text style={[styles.menuDetail, { color: colors.muted }]}>كيف نحمي بياناتك</Text></View><IconSymbol name="chevron.right" size={18} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => router.push("/terms" as never)} style={({ pressed }) => [styles.menuItem, { borderBottomColor: colors.border }, pressed && { opacity: 0.65 }]}>
            <IconSymbol name="doc.text.fill" size={22} color={colors.primary} /><View style={styles.menuCopy}><Text style={[styles.menuLabel, { color: colors.foreground }]}>شروط الاستخدام</Text><Text style={[styles.menuDetail, { color: colors.muted }]}>قواعد استخدام دار السلع</Text></View><IconSymbol name="chevron.right" size={18} color={colors.muted} />
          </Pressable>
        </View>
        {isAuthenticated && <Pressable onPress={handleLogout} style={({ pressed }) => [styles.sessionButton, pressed && { opacity: 0.65 }]}><Text style={[styles.sessionText, { color: colors.primary }]}>إدارة الجلسة الحالية • تسجيل الخروج</Text></Pressable>}
        {isAuthenticated && <Pressable disabled={deleting} onPress={handleDeleteAccount} style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.65 }]}><Text style={styles.deleteText}>{deleting ? "جارٍ حذف الحساب..." : "حذف الحساب"}</Text></Pressable>}
        <Text style={[styles.version, { color: colors.muted }]}>دار السلع • الإصدار 1.0.0</Text>
      </ScrollView>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({ content: { paddingBottom: 30 }, title: { fontSize: 28, fontWeight: "900", marginTop: 14, textAlign: "right" }, profileCard: { alignItems: "center", borderRadius: 20, flexDirection: "row-reverse", marginTop: 20, padding: 16 }, avatar: { alignItems: "center", backgroundColor: "#FFF9F4", borderRadius: 28, height: 56, justifyContent: "center", width: 56 }, profileText: { flex: 1, marginHorizontal: 12 }, welcome: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", textAlign: "right" }, profileHint: { color: "#FFFFFFCC", fontSize: 11, marginTop: 5, textAlign: "right" }, loginButton: { backgroundColor: "#FFF9F4", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }, loginText: { fontSize: 13, fontWeight: "900" }, sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 10, marginTop: 28, textAlign: "right" }, menuCard: { borderRadius: 17, borderWidth: 1, overflow: "hidden" }, menuItem: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", gap: 12, minHeight: 67, paddingHorizontal: 14 }, menuCopy: { flex: 1 }, menuLabel: { fontSize: 14, fontWeight: "800", textAlign: "right" }, menuDetail: { fontSize: 11, marginTop: 4, textAlign: "right" },   sessionButton: { alignItems: "center", borderColor: "#D5B36A", borderRadius: 13, borderWidth: 1, marginTop: 22, paddingVertical: 13 },
  sessionText: { fontSize: 13, fontWeight: "800" },
  deleteButton: { alignItems: "center", borderColor: "#C2413B", borderRadius: 13, borderWidth: 1, marginTop: 12, paddingVertical: 13 },
  deleteText: { color: "#C2413B", fontSize: 14, fontWeight: "900" },
  version: { fontSize: 11, marginTop: 25, textAlign: "center" }, });
