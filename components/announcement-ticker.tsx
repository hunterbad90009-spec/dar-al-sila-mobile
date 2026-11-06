import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";
import { type AnnouncementFont, useAnnouncementFont } from "@/lib/announcement-fonts";
import { isRTL } from "@/lib/i18n";

const SPEED = 45; // pixels per second

/**
 * Home announcement: the box and icon stay still, only the text scrolls across like a news ticker.
 * Arabic text travels left -> right, English right -> left. Static when the device asks for reduced motion.
 */
export function AnnouncementTicker({ text, font }: { text: string; font: AnnouncementFont }) {
  const colors = useColors();
  const fontFamily = useAnnouncementFont(font);
  const rtl = isRTL();
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v), () => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  const moving = !reduceMotion && boxW > 0 && textW > 0;
  useEffect(() => {
    if (!moving) return;
    // Start just outside one edge, travel until fully past the other edge.
    const from = rtl ? -textW : boxW;
    const to = rtl ? boxW : -textW;
    x.setValue(from);
    const loop = Animated.loop(Animated.timing(x, {
      toValue: to,
      duration: ((boxW + textW) / SPEED) * 1000,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== "web",
    }));
    loop.start();
    return () => loop.stop();
  }, [moving, rtl, boxW, textW, x]);

  const textStyle = { color: colors.foreground, fontFamily, fontSize: 14, fontWeight: (fontFamily ? "normal" : "700") as "normal" | "700", lineHeight: 22 };

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
      style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 14, borderWidth: 1, flexDirection: rtl ? "row" : "row-reverse", gap: 8, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10 }}
    >
      <View style={{ flex: 1, height: 22, overflow: "hidden" }} onLayout={(e) => setBoxW(Math.round(e.nativeEvent.layout.width))}>
        {reduceMotion ? (
          <Text numberOfLines={1} style={[textStyle, { textAlign: rtl ? "right" : "left" }]}>{text}</Text>
        ) : (
          // A very wide strip so the text never wraps; its real width is measured below.
          <Animated.View style={{ flexDirection: "row", left: 0, position: "absolute", top: 0, width: 10000, transform: [{ translateX: moving ? x : rtl ? boxW : 0 }], opacity: moving ? 1 : 0 }}>
            <Text style={textStyle} onLayout={(e) => setTextW(Math.ceil(e.nativeEvent.layout.width))}>{text}</Text>
          </Animated.View>
        )}
      </View>
      <MaterialIcons name="campaign" size={20} color={colors.foreground} />
    </View>
  );
}
