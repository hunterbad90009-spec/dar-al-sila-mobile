import * as Linking from "expo-linking";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";

export const APP_SCHEME = "daralsila";

/** Where Supabase sends the user back after the provider login. Add it to Supabase → Auth → URL Configuration → Redirect URLs. */
export function getAppRedirectUri(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/oauth/callback`;
  }
  return Linking.createURL("/oauth/callback", { scheme: APP_SCHEME });
}

/** Completes a PKCE OAuth redirect URL (…/oauth/callback?code=…) into a Supabase session. */
export async function completeOAuthFromUrl(url: string): Promise<void> {
  const parsed = new URL(url.replace(`${APP_SCHEME}://`, "https://app.local/"));
  const errorDescription = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
  if (errorDescription) throw new Error("تم إلغاء تسجيل الدخول أو رفضه.");
  const code = parsed.searchParams.get("code");
  if (!code) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    throw new Error("لم تصل جلسة دار السلع من خادم المصادقة.");
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new Error("تعذر إكمال تسجيل الدخول.");
}

async function startProviderLogin(provider: "facebook" | "google", cancelMessage: string): Promise<void> {
  const redirectTo = getAppRedirectUri();
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw new Error(error.message);
    return;
  }
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) throw new Error(error?.message ?? t("تعذر بدء تسجيل الدخول."));
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") throw new Error(cancelMessage);
  await completeOAuthFromUrl(result.url);
}

export function startFacebookLogin(): Promise<void> {
  return startProviderLogin("facebook", t("تم إلغاء تسجيل الدخول عبر Facebook."));
}

export function startGoogleLogin(): Promise<void> {
  return startProviderLogin("google", t("تم إلغاء تسجيل الدخول عبر Google."));
}

export function isDarAlSilaAuthUrl(url: string): boolean {
  return url.startsWith(`${APP_SCHEME}://`) || url.includes("/oauth/callback");
}

export { WebBrowser };
