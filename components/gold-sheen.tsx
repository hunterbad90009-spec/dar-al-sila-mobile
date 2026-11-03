import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { createStyles } from "@/lib/i18n/rtl";

export function GoldSheen({ width = 150, height = 70 }: { width?: number; height?: number }) {
  const progress = useRef(new Animated.Value(-width)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.timing(progress, { toValue: width * 1.6, duration: 1500, useNativeDriver: true }),
      Animated.timing(progress, { toValue: -width, duration: 0, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [progress, width]);
  return <View pointerEvents="none" style={[styles.clip, { width, height }]}><Animated.View style={[styles.sheen, { transform: [{ translateX: progress }, { rotate: "18deg" }] }]} /></View>;
}
const styles = createStyles({ clip: { position: "absolute", overflow: "hidden", top: 0, left: 0 }, sheen: { width: 30, height: "180%", backgroundColor: "rgba(255,239,170,0.30)" } });
