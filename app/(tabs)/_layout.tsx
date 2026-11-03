import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { isRTL, t } from "@/lib/i18n";
import { useUnreadCounts } from "@/lib/queries";

const icons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  index: "home",
  categories: "grid-view",
  favorites: "favorite-border",
  messages: "chat-bubble-outline",
  profile: "person-outline",
};

const TAB_ORDER = ["index", "categories", "favorites", "messages", "profile"] as const;
const TAB_TITLES: Record<(typeof TAB_ORDER)[number], string> = {
  index: "الرئيسية",
  categories: "التصنيفات",
  favorites: "المفضلة",
  messages: "الرسائل",
  profile: "حسابي",
};

export default function TabLayout() {
  const colors = useColors();
  const unread = useUnreadCounts();
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: Platform.OS === "web" ? "Arial" : undefined, fontSize: 11, fontWeight: "700" },
        tabBarStyle: { height: Platform.OS === "web" ? 68 : 84, paddingTop: 8, paddingBottom: Platform.OS === "web" ? 8 : 18, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarBadgeStyle: { backgroundColor: colors.accent, color: "#0B1F17", fontSize: 10, fontWeight: "900" },
        tabBarIcon: ({ color, size }) => <MaterialIcons name={icons[route.name] ?? "circle"} color={color} size={size} />,
      })}
    >
      {/* Tab buttons follow the reading direction: Home sits at the start (right in Arabic). */}
      {(isRTL() ? [...TAB_ORDER].reverse() : TAB_ORDER).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(TAB_TITLES[name]),
            tabBarBadge: name === "messages" && unread.messages > 0 ? unread.messages : name === "profile" && unread.notifications > 0 ? unread.notifications : undefined,
          }}
        />
      ))}
      {/* Routes reachable from other screens, not shown as tab buttons. */}
      <Tabs.Screen name="post" options={{ href: null }} />
      <Tabs.Screen name="myads" options={{ href: null }} />
    </Tabs>
  );
}
