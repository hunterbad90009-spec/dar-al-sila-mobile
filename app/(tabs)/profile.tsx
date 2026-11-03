import { useState } from "react";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Header, confirmAction, notify } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { deleteAccount, friendlyError } from "@/lib/data";
import { isRTL, t, useLanguage } from "@/lib/i18n";
import { useUnreadCounts } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

type IconName = keyof typeof MaterialIcons.glyphMap;
type Item = { label: string; detail: string; icon: IconName; route: string; badge?: number; auth?: boolean };

export default function ProfileScreen() {
  const colors = useColors();
  const { user, isAuthenticated, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const unread = useUnreadCounts();
  const [deleting, setDeleting] = useState(false);

  const account: Item[] = [
    { label: "إعلاناتي", detail: "النشطة والمسودات والمراجعة", icon: "view-list", route: "/(tabs)/myads", auth: true },
    { label: "متجري", detail: "واجهة المتجر والمنتجات", icon: "storefront", route: "/store/manage", auth: true },
    { label: "الرسائل", detail: "محادثاتك مع البائعين والمشترين", icon: "chat", route: "/(tabs)/messages", badge: unread.messages, auth: true },
    { label: "الإشعارات", detail: "الرسائل وقرارات المراجعة", icon: "notifications", route: "/notifications", badge: unread.notifications, auth: true },
    { label: "المفضلة", detail: "الإعلانات المحفوظة", icon: "favorite", route: "/(tabs)/favorites", auth: true },
    { label: "آخر المشاهدات", detail: "الإعلانات التي فتحتها مؤخرًا", icon: "history", route: "/recent-views", auth: true },
    { label: "الملف الشخصي والأمان", detail: "الاسم والهاتف وكلمة المرور", icon: "manage-accounts", route: "/settings", auth: true },
  ];
  const help: Item[] = [
    { label: "مركز المساعدة", detail: "الأسئلة الشائعة والتواصل مع الدعم", icon: "help-outline", route: "/help-center" },
    { label: "نصائح الأمان", detail: "كيف تبيع وتشتري بأمان", icon: "shield", route: "/safety" },
    { label: "شروط الاستخدام", detail: "قواعد استخدام دار السلع", icon: "description", route: "/terms" },
    { label: "سياسة الخصوصية", detail: "كيف نحمي بياناتك", icon: "lock", route: "/privacy-policy" },
  ];
  if (user?.role === "admin") account.unshift({ label: "لوحة المشرف", detail: "الإدارة والمراجعة والبلاغات", icon: "admin-panel-settings", route: "/admin", auth: true });

  const handleDelete = () => confirmAction(
    t("طلب حذف الحساب"),
    t("ستُحذف إعلاناتك وصورك ومفضلتك وتُمسح بيانات ملفك، ثم تُسجَّل خروجك. لا يمكن التراجع."),
    t("حذف الحساب"),
    async () => {
      try {
        setDeleting(true);
        await deleteAccount();
        router.replace("/(tabs)");
        notify(t("تم حذف بيانات حسابك"), t("لإزالة بيانات الدخول نهائيًا تواصل مع الدعم."));
      } catch (e) {
        notify(t("تعذر حذف الحساب"), friendlyError(e));
      } finally {
        setDeleting(false);
      }
    },
    true,
  );

  const renderItems = (items: Item[]) => (
    <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.filter((i) => !i.auth || isAuthenticated).map((item) => (
        <Pressable key={item.label} onPress={() => router.push(item.route as never)} style={({ pressed }) => [styles.menuItem, { borderBottomColor: colors.border, opacity: pressed ? 0.65 : 1 }]}>
          <MaterialIcons name={item.icon} size={22} color={colors.primary} />
          <View style={styles.menuCopy}><Text style={[styles.menuLabel, { color: colors.foreground }]}>{t(item.label)}</Text><Text style={[styles.menuDetail, { color: colors.muted }]}>{t(item.detail)}</Text></View>
          {item.badge ? <View style={[styles.badge, { backgroundColor: colors.accent }]}><Text style={styles.badgeText}>{item.badge}</Text></View> : null}
          <MaterialIcons name={isRTL() ? "chevron-left" : "chevron-right"} size={20} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header back={false} title={t("حسابي")} />
        <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
          {user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.surface }]}><MaterialIcons name="person" size={30} color={colors.primary} /></View>}
          <View style={styles.profileText}>
            <Text style={styles.welcome}>{isAuthenticated ? t("مرحبًا {name}", { name: user?.name || "" }) : t("مرحبًا بك في دار السلع")}</Text>
            <Text style={styles.profileHint}>{isAuthenticated ? user?.email || user?.phone || "" : t("سجّل الدخول لإدارة إعلاناتك")}</Text>
          </View>
          <Pressable onPress={() => (isAuthenticated ? router.push("/settings") : router.push("/login"))} style={[styles.loginButton, { backgroundColor: colors.accent }]}>
            <Text style={styles.loginText}>{isAuthenticated ? t("تعديل") : t("دخول")}</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("اللغة")}</Text>
        <View style={[styles.langRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(["ar", "en"] as const).map((code) => (
            <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: lang === code }} onPress={() => void setLang(code)} style={[styles.langOption, lang === code && { backgroundColor: colors.primary }]}>
              <Text style={[styles.langText, { color: lang === code ? colors.primaryText : colors.foreground }]}>{code === "ar" ? "العربية" : "English"}</Text>
            </Pressable>
          ))}
        </View>

        {isAuthenticated ? <><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("إدارة الحساب")}</Text>{renderItems(account)}</> : null}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("المساعدة والقوانين")}</Text>
        {renderItems(help)}

        {isAuthenticated ? (
          <>
            <Pressable onPress={() => confirmAction(t("تسجيل الخروج"), t("هل تريد تسجيل الخروج من هذا الجهاز؟"), t("تسجيل الخروج"), () => void logout())} style={[styles.sessionButton, { borderColor: colors.accent }]}><Text style={[styles.sessionText, { color: colors.primary }]}>{t("تسجيل الخروج")}</Text></Pressable>
            <Pressable disabled={deleting} onPress={handleDelete} style={[styles.deleteButton, { borderColor: colors.error }]}><Text style={[styles.deleteText, { color: colors.error }]}>{deleting ? t("جارٍ الحذف...") : t("طلب حذف الحساب")}</Text></Pressable>
          </>
        ) : null}
        <Text style={[styles.version, { color: colors.muted }]}>{t("دار السلع • الإصدار 1.1.0")}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 30 },
  profileCard: { alignItems: "center", borderRadius: 20, flexDirection: "row-reverse", marginTop: 8, padding: 16 },
  avatar: { alignItems: "center", borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  profileText: { flex: 1, marginHorizontal: 12 },
  welcome: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", textAlign: "right" },
  profileHint: { color: "#FFFFFFCC", fontSize: 11, marginTop: 5, textAlign: "right" },
  loginButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  loginText: { color: "#0B1F17", fontSize: 13, fontWeight: "900" },
  sectionTitle: { fontSize: 17, fontWeight: "900", marginBottom: 10, marginTop: 24, textAlign: "right" },
  langRow: { borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 6, padding: 5 },
  langOption: { alignItems: "center", borderRadius: 10, flex: 1, paddingVertical: 11 },
  langText: { fontSize: 14, fontWeight: "900" },
  menuCard: { borderRadius: 17, borderWidth: 1, overflow: "hidden" },
  menuItem: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row-reverse", gap: 12, minHeight: 64, paddingHorizontal: 14 },
  menuCopy: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: "800", textAlign: "right" },
  menuDetail: { fontSize: 11, marginTop: 3, textAlign: "right" },
  badge: { alignItems: "center", borderRadius: 10, height: 20, justifyContent: "center", minWidth: 20, paddingHorizontal: 5 },
  badgeText: { color: "#0B1F17", fontSize: 11, fontWeight: "900" },
  sessionButton: { alignItems: "center", borderRadius: 13, borderWidth: 1, marginTop: 22, paddingVertical: 13 },
  sessionText: { fontSize: 14, fontWeight: "800" },
  deleteButton: { alignItems: "center", borderRadius: 13, borderWidth: 1, marginTop: 10, paddingVertical: 13 },
  deleteText: { fontSize: 14, fontWeight: "900" },
  version: { fontSize: 11, marginTop: 25, textAlign: "center" },
});
