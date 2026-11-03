import { useEffect, useRef } from "react";
import { Image, Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function OpeningScreen() {
  const hasNavigated = useRef(false);

  const goHome = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    router.replace("/(tabs)");
  };

  useEffect(() => {
    const fallbackTimer = setTimeout(goHome, 650);
    return () => clearTimeout(fallbackTimer);
  }, []);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="فتح دار السلع" onPress={goHome} style={styles.screen}>
      <StatusBar hidden />
      <Image source={require("@/assets/images/icon.png")} style={styles.logo} />
      <Text style={styles.brand}>دار السلع</Text>
      <Text style={styles.subtitle}>كل ما تحتاجه.. في مكان واحد</Text>
      <Text style={styles.hint}>اضغط للمتابعة</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: "center", backgroundColor: "#061C18", flex: 1, justifyContent: "center" },
  logo: { borderRadius: 28, height: 116, width: 116 },
  brand: { color: "#F8E7B9", fontSize: 34, fontWeight: "900", marginTop: 18 },
  subtitle: { color: "#D3A64F", fontSize: 15, marginTop: 8 },
  hint: { color: "#F8E7B9", fontSize: 13, marginTop: 36, opacity: 0.8 },
});
