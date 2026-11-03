import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Card, Field, Header, Input, Loading, LoginRequired, notify } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { changePassword, friendlyError, updateProfile, uploadImage } from "@/lib/data";
import { t, useLanguage } from "@/lib/i18n";
import { prepareImageDataUrl } from "@/lib/prepare-image-data-url";
import { saveNotificationPrefs, useNotificationPrefs } from "@/lib/notification-prefs";
import { createStyles } from "@/lib/i18n/rtl";


/** Profile, language, notification preferences and password (spec 4.12). */
export default function SettingsScreen() {
  const colors = useColors();
  const { user, isAuthenticated, loading, refresh } = useAuth();
  const { lang, setLang } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const prefs = useNotificationPrefs();

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? ""); setPhone(user.phone ?? ""); setCity(user.city ?? ""); setBio(user.bio ?? ""); setAvatar(user.avatarUrl);
  }, [user]);
  const savePrefs = saveNotificationPrefs;

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    try {
      const url = await uploadImage(await prepareImageDataUrl(result.assets[0].uri), "avatar");
      setAvatar(url);
    } catch (e) {
      notify(t("تعذر رفع الصورة"), friendlyError(e));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ fullName: name, phone, city, bio, avatarUrl: avatar });
      await refresh();
      notify(t("تم حفظ الملف الشخصي"));
    } catch (e) {
      notify(t("تعذر الحفظ"), friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async () => {
    setChanging(true);
    try {
      await changePassword(password);
      setPassword("");
      notify(t("تم تغيير كلمة المرور"));
    } catch (e) {
      notify(t("تعذر تغيير كلمة المرور"), friendlyError(e));
    } finally {
      setChanging(false);
    }
  };

  if (loading) return <ScreenContainer><Loading /></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-4"><Header title={t("الإعدادات")} /><LoginRequired /></ScreenContainer>;

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Header title={t("الملف الشخصي والأمان")} />
        <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }]}><MaterialIcons name="person" size={44} color={colors.primary} /></View>}
          <Text style={[styles.avatarText, { color: colors.primary }]}>{t("تغيير الصورة")}</Text>
        </Pressable>
        <Field label={t("الاسم")} required><Input value={name} onChangeText={setName} /></Field>
        <Field label={t("البريد الإلكتروني")}><Input value={user?.email ?? ""} editable={false} style={{ opacity: 0.7 }} /></Field>
        <Field label={t("رقم الهاتف")} hint={t("يُستخدم افتراضيًا في إعلاناتك الجديدة.")}><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+968 9XXXXXXX" /></Field>
        <Field label={t("المدينة")}><Input value={city} onChangeText={setCity} /></Field>
        <Field label={t("نبذة")}><Input value={bio} onChangeText={setBio} multiline multilineHeight={90} /></Field>
        <Button label={t("حفظ")} loading={saving} onPress={save} style={{ marginTop: 18 }} />

        <Text style={[styles.section, { color: colors.foreground }]}>{t("اللغة")}</Text>
        <View style={styles.row}>
          <Button small variant={lang === "ar" ? "primary" : "ghost"} label="العربية" onPress={() => void setLang("ar")} style={{ flex: 1 }} />
          <Button small variant={lang === "en" ? "primary" : "ghost"} label="English" onPress={() => void setLang("en")} style={{ flex: 1 }} />
        </View>

        <Text style={[styles.section, { color: colors.foreground }]}>{t("تفضيلات الإشعارات")}</Text>
        <Card>
          {([["messages", "الرسائل الجديدة"], ["moderation", "قرارات مراجعة الإعلانات"], ["announcements", "إعلانات المنصة"]] as const).map(([key, label]) => (
            <View key={key} style={styles.prefRow}>
              <Text style={[styles.prefText, { color: colors.foreground }]}>{t(label)}</Text>
              <Switch value={prefs[key]} onValueChange={(v) => savePrefs({ ...prefs, [key]: v })} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>
          ))}
          <Text style={[styles.note, { color: colors.muted }]}>{t("تُحفظ على هذا الجهاز وتتحكم في التنبيهات داخل التطبيق.")}</Text>
        </Card>

        <Text style={[styles.section, { color: colors.foreground }]}>{t("كلمة المرور والأمان")}</Text>
        {user?.loginMethod && user.loginMethod !== "email" ? (
          <Text style={[styles.note, { color: colors.muted }]}>{t("تسجّل الدخول عبر {provider}، وكلمة المرور تُدار هناك.", { provider: user.loginMethod })}</Text>
        ) : (
          <>
            <Field label={t("كلمة مرور جديدة")} hint={t("8 أحرف على الأقل.")}><Input value={password} onChangeText={setPassword} secureTextEntry /></Field>
            <Button variant="outline" label={t("تغيير كلمة المرور")} disabled={password.length < 8} loading={changing} onPress={updatePassword} style={{ marginTop: 12 }} />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  avatarWrap: { alignItems: "center", gap: 8, marginTop: 6 },
  avatar: { borderRadius: 46, height: 92, width: 92 },
  avatarText: { fontSize: 13, fontWeight: "800" },
  section: { fontSize: 17, fontWeight: "900", marginBottom: 10, marginTop: 28, textAlign: "right" },
  row: { flexDirection: "row-reverse", gap: 10 },
  prefRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 8 },
  prefText: { flex: 1, fontSize: 14, fontWeight: "700", textAlign: "right" },
  note: { fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "right" },
});
