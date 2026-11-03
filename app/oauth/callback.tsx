import { completeOAuthFromUrl, isDarAlSilaAuthUrl } from "@/constants/oauth";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { t } from "@/lib/i18n";

export default function OAuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const redirectAfterLogin = async () => {
      const returnPath = await AsyncStorage.getItem("dar_al_sila_login_return");
      if (returnPath) await AsyncStorage.removeItem("dar_al_sila_login_return");
      return returnPath || "/(tabs)";
    };

    const handleCallback = async () => {
      try {
        const url = Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : await Linking.getInitialURL();
        if (url && !isDarAlSilaAuthUrl(url)) throw new Error(t("رابط المصادقة غير تابع لتطبيق دار السلع."));
        if (url) await completeOAuthFromUrl(url);
        setStatus("success");
        setTimeout(async () => router.replace((await redirectAfterLogin()) as any), 500);
      } catch (error) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : t("تعذر إكمال تسجيل الدخول."));
      }
    };

    void handleCallback();
  }, [router]);

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <ThemedView className="flex-1 items-center justify-center gap-4 p-5">
        {status === "processing" && <><ActivityIndicator size="large" /><Text className="mt-4 text-base text-center text-foreground">{t("جارٍ إكمال تسجيل الدخول إلى دار السلع...")}</Text></>}
        {status === "success" && <Text className="text-base text-center text-foreground">{t("تم تسجيل الدخول إلى دار السلع بنجاح.")}</Text>}
        {status === "error" && <><Text className="mb-2 text-xl font-bold text-error">{t("فشل تسجيل الدخول")}</Text><Text className="text-base text-center text-foreground">{errorMessage}</Text></>}
      </ThemedView>
    </SafeAreaView>
  );
}
