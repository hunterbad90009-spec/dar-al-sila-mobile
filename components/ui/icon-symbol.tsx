// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";
import { isRTL } from "@/lib/i18n";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "car.fill": "directions-car",
  "briefcase.fill": "work",
  "desktopcomputer": "devices",
  "wrench.and.screwdriver.fill": "handyman",
  "chair.fill": "chair",
  "location.fill": "location-on",
  "magnifyingglass": "search",
  "slider.horizontal.3": "tune",
  "heart.fill": "favorite",
  "heart": "favorite-border",
  "square.grid.2x2.fill": "apps",
  "plus.circle.fill": "add-circle",
  "person.fill": "person",
  "camera.fill": "camera-alt",
  "chevron.down": "keyboard-arrow-down",
  "arrow.up.circle.fill": "publish",
  "list.bullet.rectangle.fill": "view-list",
  "doc.text.fill": "description",
  "bubble.left.and.bubble.right.fill": "chat",
  "bell.fill": "notifications",
  "gearshape.fill": "settings",
  "building.2.fill": "account-balance",
  "bag.fill": "shopping-bag",
  "headphones": "headphones",
  "phone.fill": "phone-iphone",
  "gamecontroller.fill": "sports-esports",
  "watch.analog": "watch",
  "megaphone.fill": "campaign",
  "key.fill": "vpn-key",
  "sparkles": "auto-awesome",
  "fork.knife": "restaurant",
  "pawprint.fill": "pets",
  "checkmark.seal.fill": "verified",
  "shippingbox.fill": "local-shipping",
  "medal.fill": "workspace-premium",
  "storefront.fill": "storefront",
  "tag.fill": "local-offer",
  "square.and.arrow.up": "share",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "xmark": "close",
  "lock.shield.fill": "verified-user",
  "info.circle.fill": "info",
  "checkmark": "check",
  "gift.fill": "card-giftcard",
  "play.rectangle.fill": "play-circle-outline",
  "creditcard.fill": "credit-card",
  "person.crop.circle.fill": "account-circle",
  "circle.fill": "circle",
  "bicycle": "directions-bike",
  "truck.box.fill": "local-shipping",
  "hammer.fill": "construction",
  "steeringwheel": "drive-eta",
  "drop.fill": "water-drop",
  "star.fill": "star",
  "arrow.up.arrow.down": "swap-vert",
  "fuelpump.fill": "local-gas-station",
  "photo.fill": "photo",
  "message.fill": "chat-bubble",
  "eye.fill": "visibility",
} as IconMapping;

const MIRRORED: Partial<Record<IconSymbolName, IconSymbolName>> = {
  "chevron.left": "chevron.right",
  "chevron.right": "chevron.left",
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // Directional icons were chosen for the Arabic (RTL) layout; mirror them in English.
  const resolved = isRTL() ? name : (MIRRORED[name] ?? name);
  return <MaterialIcons color={color} size={size} name={MAPPING[resolved]} style={style} />;
}
