import { router } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Field, Header, Input, notify } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { startFacebookLogin, startGoogleLogin } from "@/constants/oauth";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";

export default function LoginScreen() {
  const colors = useColors();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "email" | "facebook" | "google">(null);
  const [error, setError] = useState<string | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  const submit = async () => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setError(t("اكتب بريدًا إلكترونيًا صحيحًا.")); return; }
    if (mode !== "reset" && password.length < (mode === "signup" ? 8 : 6)) { setError(mode === "signup" ? t("كلمة المرور يجب أن تكون 8 أحرف على الأقل.") : t("اكتب كلمة المرور.")); return; }
    if (mode === "signup" && name.trim().length < 2) { setError(t("اكتب اسمك.")); return; }
    setBusy("email");
    try {
      if (mode === "signin") {
        const { error: e } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (e) throw new Error(t("البريد الإلكتروني أو كلمة المرور غير صحيحة."));
        done();
      } else if (mode === "signup") {
        const { data, error: e } = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: { full_name: name.trim() } } });
        if (e) throw new Error(/registered/i.test(e.message) ? t("هذا البريد مسجّل مسبقًا. سجّل الدخول.") : t("تعذر إنشاء الحساب. حاول مرة أخرى."));
        if (data.session) done();
        else { notify(t("تحقق من بريدك"), t("أرسلنا رابط تفعيل إلى بريدك الإلكتروني. افتحه ثم سجّل الدخول.")); setMode("signin"); }
      } else {
        const { error: e } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (e) throw new Error(t("تعذر إرسال رابط الاستعادة."));
        notify(t("تحقق من بريدك"), t("إذا كان البريد مسجّلًا ستصلك رسالة لإعادة تعيين كلمة المرور."));
        setMode("signin");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("حاول مرة أخرى."));
    } finally {
      setBusy(null);
    }
  };

  const social = async (provider: "facebook" | "google") => {
    setBusy(provider);
    setError(null);
    try {
      await (provider === "google" ? startGoogleLogin() : startFacebookLogin());
      if (Platform.OS !== "web") done();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("تحقق من اتصال الإنترنت ثم حاول مرة أخرى."));
    } finally {
      setBusy(null);
    }
  };

  const title = mode === "signin" ? t("تسجيل الدخول") : mode === "signup" ? t("إنشاء حساب جديد") : t("استعادة كلمة المرور");

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="px-4">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Header title={title} />
          <Image source={require("@/assets/images/dar-al-sila-logo.png")} style={styles.logo} resizeMode="contain" accessibilityLabel={t("دار السلع")} />
          <Text style={[styles.heading, { color: colors.foreground }]}>{t("مرحبًا بك في دار السلع")}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{t("سجّل الدخول لحفظ إعلاناتك ومراسلة البائعين وإدارة متجرك.")}</Text>

          {mode === "signup" ? <Field label={t("الاسم")} required><Input value={name} onChangeText={setName} autoComplete="name" /></Field> : null}
          <Field label={t("البريد الإلكتروني")} required><Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" /></Field>
          {mode !== "reset" ? <Field label={t("كلمة المرور")} required hint={mode === "signup" ? t("8 أحرف على الأقل.") : undefined}><Input value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "signup" ? "new-password" : "password"} onSubmitEditing={submit} /></Field> : null}
          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
          <Button label={mode === "signin" ? t("تسجيل الدخول") : mode === "signup" ? t("إنشاء الحساب") : t("إرسال رابط الاستعادة")} loading={busy === "email"} disabled={Boolean(busy)} onPress={submit} style={{ marginTop: 18 }} />

          <View style={styles.switchRow}>
            {mode === "signin" ? (
              <>
                <Pressable onPress={() => { setMode("signup"); setError(null); }}><Text style={[styles.switchText, { color: colors.primary }]}>{t("إنشاء حساب جديد")}</Text></Pressable>
                <Pressable onPress={() => { setMode("reset"); setError(null); }}><Text style={[styles.switchText, { color: colors.muted }]}>{t("نسيت كلمة المرور؟")}</Text></Pressable>
              </>
            ) : <Pressable onPress={() => { setMode("signin"); setError(null); }}><Text style={[styles.switchText, { color: colors.primary }]}>{t("لديك حساب؟ سجّل الدخول")}</Text></Pressable>}
          </View>

          <View style={styles.divider}><View style={[styles.line, { backgroundColor: colors.border }]} /><Text style={[styles.dividerText, { color: colors.muted }]}>{t("أو")}</Text><View style={[styles.line, { backgroundColor: colors.border }]} /></View>
          <Button icon="facebook" label={t("المتابعة باستخدام Facebook")} loading={busy === "facebook"} disabled={Boolean(busy)} onPress={() => social("facebook")} style={{ backgroundColor: "#1877F2", borderColor: "#1877F2" }} />
          <Button variant="outline" icon="account-circle" label={t("المتابعة باستخدام Google")} loading={busy === "google"} disabled={Boolean(busy)} onPress={() => social("google")} style={{ marginTop: 10 }} />
          <Text style={[styles.privacy, { color: colors.muted }]}>{t("بالمتابعة، توافق على شروط الاستخدام وسياسة الخصوصية.")}</Text>
          <View style={styles.legalRow}>
            <Pressable onPress={() => router.push("/terms")}><Text style={[styles.legal, { color: colors.primary }]}>{t("شروط الاستخدام")}</Text></Pressable>
            <Pressable onPress={() => router.push("/privacy-policy")}><Text style={[styles.legal, { color: colors.primary }]}>{t("سياسة الخصوصية")}</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  logo: { alignSelf: "center", height: 104, marginTop: 12, width: 104 },
  heading: { fontSize: 23, fontWeight: "900", marginTop: 16, textAlign: "center" },
  subtitle: { fontSize: 13, lineHeight: 21, marginTop: 6, textAlign: "center" },
  error: { fontSize: 13, fontWeight: "700", marginTop: 12, textAlign: "right" },
  switchRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 14 },
  switchText: { fontSize: 13, fontWeight: "800" },
  divider: { alignItems: "center", flexDirection: "row", gap: 10, marginVertical: 20 },
  line: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "700" },
  privacy: { fontSize: 11, lineHeight: 17, marginTop: 18, textAlign: "center" },
  legalRow: { flexDirection: "row", gap: 18, justifyContent: "center", marginTop: 6 },
  legal: { fontSize: 12, fontWeight: "800" },
});
