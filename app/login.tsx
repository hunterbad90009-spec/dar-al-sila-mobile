import { Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { startFacebookLogin } from "@/constants/oauth";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState<"signin" | "signup" | null>(null);

  const finishLogin = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  const loginWithEmail = async (mode: "signin" | "signup") => {
    if (!email.trim() || password.length < 6) {
      Alert.alert("بيانات ناقصة", "أدخل البريد الإلكتروني وكلمة مرور لا تقل عن 6 أحرف.");
      return;
    }
    try {
      setEmailLoading(mode);
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        finishLogin();
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(error.message);
        if (data.session) finishLogin();
        else Alert.alert("تحقق من بريدك", "أرسلنا رابط تفعيل إلى بريدك الإلكتروني. افتحه ثم سجّل الدخول.");
      }
    } catch (error) {
      Alert.alert("تعذر تسجيل الدخول", error instanceof Error ? error.message : "حاول مرة أخرى.");
    } finally {
      setEmailLoading(null);
    }
  };

  const loginWithFacebook = async () => {
    try {
      setLoading(true);
      await startFacebookLogin();
      if (Platform.OS !== "web") finishLogin();
    } catch (error) {
      Alert.alert(
        "تعذر تسجيل الدخول",
        error instanceof Error ? error.message : "تحقق من اتصال الإنترنت ثم حاول مرة أخرى.",
      );
      setLoading(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.closeButton}>
              <IconSymbol name="xmark" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>تسجيل الدخول</Text>
            <View style={styles.spacer} />
          </View>

          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <IconSymbol name="lock.shield.fill" size={40} color="#D5B36A" />
          </View>
          <Text style={[styles.heading, { color: colors.foreground }]}>مرحبًا بك في دار السلع</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>سجّل الدخول بحسابك في دار السلع لحفظ إعلاناتك والتواصل مع المستخدمين.</Text>

          <View style={[styles.secureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="checkmark.seal.fill" size={25} color={colors.primary} />
            <View style={styles.secureCopy}>
              <Text style={[styles.secureTitle, { color: colors.foreground }]}>مصادقة دار السلع</Text>
              <Text style={[styles.secureText, { color: colors.muted }]}>يتم تسجيل الدخول عبر Supabase بأمان، ولا نطلب كلمة مرور Facebook داخل التطبيق.</Text>
            </View>
          </View>

          <Pressable onPress={loginWithFacebook} disabled={loading} style={({ pressed }) => [styles.facebookButton, { backgroundColor: "#1877F2" }, pressed && styles.pressed]}>
            {loading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.facebookText}>المتابعة باستخدام Facebook</Text><Text style={styles.facebookF}>f</Text></>}
          </Pressable>

          <Pressable onPress={() => Alert.alert("Google", "تسجيل الدخول عبر Google قيد الإعداد وسيُفعّل بعد اكتمال إعدادات Google الرسمية.")} style={({ pressed }) => [styles.googleButton, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}>
            <Text style={[styles.googleText, { color: colors.muted }]}>Google — قيد الإعداد</Text>
          </Pressable>

          <View style={styles.dividerRow}><View style={[styles.dividerLine, { backgroundColor: colors.border }]} /><Text style={[styles.dividerText, { color: colors.muted }]}>أو بالبريد الإلكتروني</Text><View style={[styles.dividerLine, { backgroundColor: colors.border }]} /></View>
          <TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" textAlign="right" style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
          <TextInput value={password} onChangeText={setPassword} placeholder="كلمة المرور" placeholderTextColor={colors.muted} secureTextEntry textAlign="right" style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
          <Pressable onPress={() => loginWithEmail("signin")} disabled={emailLoading !== null} style={({ pressed }) => [styles.emailButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
            {emailLoading === "signin" ? <ActivityIndicator color="#fff" /> : <Text style={styles.emailButtonText}>تسجيل الدخول</Text>}
          </Pressable>
          <Pressable onPress={() => loginWithEmail("signup")} disabled={emailLoading !== null} style={({ pressed }) => [styles.signupButton, { borderColor: colors.primary }, pressed && styles.pressed]}>
            {emailLoading === "signup" ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.signupText, { color: colors.primary }]}>إنشاء حساب جديد</Text>}
          </Pressable>

          <Text style={[styles.flowText, { color: colors.muted }]}>بعد الموافقة في Facebook ستعود تلقائيًا إلى تطبيق دار السلع، وتُحفظ جلسة دار السلع فقط.</Text>
          <Text style={[styles.privacy, { color: colors.muted }]}>بالمتابعة، توافق على شروط الاستخدام وسياسة الخصوصية.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 42 },
  header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  closeButton: { alignItems: "center", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  spacer: { width: 36 },
  title: { fontSize: 19, fontWeight: "900" },
  logo: { alignItems: "center", alignSelf: "center", borderRadius: 28, height: 82, justifyContent: "center", marginTop: 36, width: 82 },
  heading: { fontSize: 24, fontWeight: "900", marginTop: 18, textAlign: "center" },
  subtitle: { fontSize: 13, lineHeight: 21, marginTop: 8, textAlign: "center" },
  secureCard: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginTop: 28, padding: 15 },
  secureCopy: { flex: 1 },
  secureTitle: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  secureText: { fontSize: 11, lineHeight: 18, marginTop: 4, textAlign: "right" },
  facebookButton: { alignItems: "center", borderRadius: 14, flexDirection: "row-reverse", height: 56, justifyContent: "center", marginTop: 22, paddingHorizontal: 18 },
  facebookText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  facebookF: { color: "#fff", fontSize: 25, fontWeight: "900", marginLeft: 12 },
  googleButton: { alignItems: "center", borderRadius: 14, borderWidth: 1, height: 52, justifyContent: "center", marginTop: 12, paddingHorizontal: 18 },
  googleText: { fontSize: 14, fontWeight: "700" },
  flowText: { fontSize: 12, lineHeight: 20, marginTop: 20, textAlign: "center" },
  privacy: { fontSize: 10, lineHeight: 17, marginTop: 18, textAlign: "center" },
  dividerRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 22 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "700" },
  input: { borderRadius: 14, borderWidth: 1, fontSize: 15, height: 52, marginTop: 12, paddingHorizontal: 16 },
  emailButton: { alignItems: "center", borderRadius: 14, height: 54, justifyContent: "center", marginTop: 14 },
  emailButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  signupButton: { alignItems: "center", borderRadius: 14, borderWidth: 1.5, height: 50, justifyContent: "center", marginTop: 10 },
  signupText: { fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
