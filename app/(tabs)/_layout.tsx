import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";

const icons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  index: "home",
  categories: "grid-view",
  favorites: "favorite-border",
  messages: "chat-bubble-outline",
  profile: "person-outline",
};

export default function TabLayout() {
  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: "#165B45",
      tabBarInactiveTintColor: "#9298A3",
      tabBarLabelStyle: { fontFamily: Platform.OS === "web" ? "Arial" : undefined, fontSize: 11, fontWeight: "700" },
      tabBarStyle: { height: Platform.OS === "web" ? 68 : 84, paddingTop: 8, paddingBottom: Platform.OS === "web" ? 8 : 18, backgroundColor: "#FFFCF7", borderTopColor: "#EEE8DE", borderTopWidth: 1 },
      tabBarIcon: ({ color, size }) => <MaterialIcons name={icons[route.name] ?? "circle"} color={color} size={size} />,
    })}>
      <Tabs.Screen name="index" options={{ title: "الرئيسية" }} />
      <Tabs.Screen name="categories" options={{ title: "التصنيفات" }} />
      <Tabs.Screen name="favorites" options={{ title: "المفضلة" }} />
      <Tabs.Screen name="messages" options={{ title: "الرسائل" }} />
      <Tabs.Screen name="profile" options={{ title: "حسابي" }} />
      {/* Routes reachable from other screens, not shown as tab buttons. */}
      <Tabs.Screen name="post" options={{ href: null }} />
      <Tabs.Screen name="myads" options={{ href: null }} />
    </Tabs>
  );
}
