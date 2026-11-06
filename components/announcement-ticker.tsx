import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";
import { type AnnouncementFont, useAnnouncementFont } from "@/lib/announcement-fonts";
import { isRTL } from "@/lib/i18n";

const SPEED = 45; // pixels per second

/**
 * Home announcement: the box and icon stay still, only the text scrolls, as an endless loop:
 * the sentence is repeated with a ✦ separator, so its end is followed straight by its start (no empty gap).
 * Arabic travels left -> right, English right -> left. Static when the device asks for reduced motion.
 */
export function AnnouncementTicker({ text, font }: { text: string; font: AnnouncementFont }) {
  const colors = useColors();
  const fontFamily = useAnnouncementFont(font);
  const rtl = isRTL();
  const [boxW, setBoxW] = useState(0);
  const [unitW, setUnitW] = useState(0); // one sentence + separator
  const [reduceMotion, setReduceMotion] = useState(false);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v), () => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  const moving = !reduceMotion && boxW > 0 && unitW > 0;
  // Enough copies to cover the box plus one more, so shifting by exactly one copy is seamless.
  const copies = moving ? Math.ceil(boxW / unitW) + 1 : 2;
  useEffect(() => {
    if (!moving) return;
    // Animate 0 -> 1 and map it to pixels below: Animated.loop resets the value to its
    // initial 0 on each pass, so animating the pixel offset directly breaks the RTL case.
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, {
      toValue: 1,
      duration: (unitW / SPEED) * 1000,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== "web",
    }));
    loop.start();
    return () => loop.stop();
  }, [moving, unitW, x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: rtl ? [-unitW, 0] : [0, -unitW] });

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
          <Animated.View style={{ alignItems: "flex-start", flexDirection: "row", left: 0, position: "absolute", top: 0, width: 20000, transform: [{ translateX: moving ? translateX : 0 }], opacity: moving ? 1 : 0 }}>
            {Array.from({ length: copies }, (_, i) => (
              <View key={i} style={{ flexDirection: "row" }} onLayout={i === 0 ? (e) => setUnitW(e.nativeEvent.layout.width) : undefined}>
                <Text style={textStyle}>{text}</Text>
                <Text style={[textStyle, { color: colors.accent, paddingHorizontal: 18 }]}>✦</Text>
              </View>
            ))}
          </Animated.View>
        )}
      </View>
      <MaterialIcons name="campaign" size={20} color={colors.foreground} />
    </View>
  );
}
