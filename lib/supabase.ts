import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

/**
 * Supabase client for دار السلع.
 * Only the public (publishable/anon) key lives in the app. Never put a service_role key here.
 * Values come from .env (EXPO_PUBLIC_*). Point them at the TEST project while developing.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

const isServer = typeof window === "undefined" && Platform.OS === "web";

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder", {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: Platform.OS === "web" && !isServer,
    flowType: "pkce",
  },
});

export const LISTING_MEDIA_BUCKET = "listing-media";
