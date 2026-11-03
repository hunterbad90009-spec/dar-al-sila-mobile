import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/** Per-device notification preferences. They control which in-app alerts are shown and counted. */
export type NotificationPrefs = { messages: boolean; moderation: boolean; announcements: boolean };
const KEY = "dar_al_sila_notification_prefs";
const DEFAULTS: NotificationPrefs = { messages: true, moderation: true, announcements: true };
let current: NotificationPrefs = DEFAULTS;
const listeners = new Set<(p: NotificationPrefs) => void>();
let loaded: Promise<void> | null = null;

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => { if (raw) { current = { ...DEFAULTS, ...JSON.parse(raw) }; listeners.forEach((l) => l(current)); } })
    .catch(() => undefined);
  return loaded;
}

export function saveNotificationPrefs(next: NotificationPrefs) {
  current = next;
  listeners.forEach((l) => l(current));
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState(current);
  useEffect(() => {
    listeners.add(setPrefs);
    void load().then(() => setPrefs(current));
    return () => { listeners.delete(setPrefs); };
  }, []);
  return prefs;
}

/** Which preference a notification type belongs to. */
export function allowsNotification(prefs: NotificationPrefs, type: string) {
  if (type === "chat_message") return prefs.messages;
  if (type.startsWith("listing_")) return prefs.moderation;
  return true; // security alerts are always shown
}
