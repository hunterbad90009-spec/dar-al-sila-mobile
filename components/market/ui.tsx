/**
 * دار السلع design system: the shared building blocks every screen uses, so spacing,
 * type, colors and states stay consistent (spec §6). Layouts are written right-to-left
 * and mirrored automatically for English (lib/i18n/rtl.ts).
 */
import { router } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";
import { isRTL, t, timeAgo } from "@/lib/i18n";
import { startAlign } from "@/lib/i18n/rtl";
import type { DbStatus, Listing } from "@/lib/data";
import { useFavorites, useLocations } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

type IconName = keyof typeof MaterialIcons.glyphMap;

// ---------------------------------------------------------------------------
// Dialogs that work on phones and on the web (Alert.alert is silent in browsers)
// ---------------------------------------------------------------------------

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void, destructive = false) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: t("إلغاء"), style: "cancel" },
    { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}

// ---------------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------------

export function Header({ title, subtitle, back = true, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t("رجوع")} hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name={isRTL() ? "arrow-forward" : "arrow-back"} size={22} color={colors.foreground} />
          </Pressable>
        ) : null}
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={[styles.headerSubtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action && onAction ? <Pressable hitSlop={8} onPress={onAction}><Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function Loading({ label }: { label?: string }) {
  const colors = useColors();
  return <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.muted }]}>{label ?? t("جارٍ التحميل...")}</Text></View>;
}

export function EmptyState({ icon = "inventory-2", title, text, actionLabel, onAction }: { icon?: IconName; title: string; text?: string; actionLabel?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}><MaterialIcons name={icon} size={30} color={colors.primary} /></View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      {text ? <Text style={[styles.emptyText, { color: colors.muted }]}>{text}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: 16, alignSelf: "stretch" }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return <EmptyState icon="cloud-off" title={t("حدث خطأ")} text={message ?? t("تعذر تحميل البيانات. تحقق من الاتصال.")} actionLabel={onRetry ? t("إعادة المحاولة") : undefined} onAction={onRetry} />;
}

export function LoginRequired({ text }: { text?: string }) {
  return <EmptyState icon="lock-outline" title={t("سجّل الدخول أولًا")} text={text ?? t("هذه الصفحة مرتبطة بحسابك.")} actionLabel={t("تسجيل الدخول")} onAction={() => router.push("/login")} />;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "outline" | "danger" | "ghost" | "accent";

export function Button({ label, onPress, variant = "primary", loading, disabled, icon, style, small }: { label: string; onPress: () => void; variant?: ButtonVariant; loading?: boolean; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const colors = useColors();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    accent: { bg: colors.accent, fg: "#0B1F17", border: colors.accent },
    outline: { bg: "transparent", fg: colors.primary, border: colors.primary },
    danger: { bg: "transparent", fg: colors.error, border: colors.error },
    ghost: { bg: "transparent", fg: colors.foreground, border: colors.border },
  };
  const p = palette[variant];
  const off = disabled || loading;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: off }} disabled={off} onPress={onPress} style={({ pressed }) => [styles.button, small && styles.buttonSmall, { backgroundColor: p.bg, borderColor: p.border, opacity: off ? 0.55 : pressed ? 0.8 : 1 }, style]}>
      {loading ? <ActivityIndicator color={p.fg} /> : <>{icon ? <MaterialIcons name={icon} size={small ? 16 : 19} color={p.fg} /> : null}<Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: p.fg }]}>{label}</Text></>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  const colors = useColors();
  return (
    <Pressable hitSlop={4} onPress={onPress} style={({ pressed }) => [styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border, opacity: pressed ? 0.8 : 1 }]}>
      {icon ? <MaterialIcons name={icon} size={15} color={active ? colors.primaryText : colors.muted} /> : null}
      <Text style={[styles.chipText, { color: active ? colors.primaryText : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}{required ? <Text style={{ color: colors.error }}> *</Text> : null}</Text>
      {children}
      {hint ? <Text style={[styles.fieldHint, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps & { multilineHeight?: number }) {
  const colors = useColors();
  const { style, multilineHeight, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      textAlign={startAlign()}
      textAlignVertical={rest.multiline ? "top" : "center"}
      {...rest}
      style={[styles.input, rest.multiline && { minHeight: multilineHeight ?? 120, paddingTop: 12 }, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }, style]}
    />
  );
}

/** Tappable field that opens a SelectSheet. */
export function SelectField({ value, placeholder, onPress }: { value?: string | null; placeholder: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.input, styles.select, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.selectText, { color: value ? colors.foreground : colors.muted }]} numberOfLines={1}>{value || placeholder}</Text>
      <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.muted} />
    </Pressable>
  );
}

export type SheetOption = { value: string; label: string; detail?: string; drill?: boolean };

/** Bottom sheet list picker with search; used for categories, locations and options. */
export function SelectSheet({ visible, title, options, onSelect, onClose, selected, searchable = true, footer }: { visible: boolean; title: string; options: SheetOption[]; onSelect: (value: string) => void; onClose: () => void; selected?: string | null; searchable?: boolean; footer?: ReactNode }) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const filtered = query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{title}</Text>
          <Pressable hitSlop={10} onPress={onClose}><MaterialIcons name="close" size={24} color={colors.foreground} /></Pressable>
        </View>
        {searchable && options.length > 8 ? <Input value={query} onChangeText={setQuery} placeholder={t("ابحث...")} style={{ marginBottom: 10 }} /> : null}
        <ScrollView keyboardShouldPersistTaps="handled">
          {filtered.map((o) => (
            <Pressable key={o.value} onPress={() => { setQuery(""); onSelect(o.value); }} style={({ pressed }) => [styles.sheetItem, { borderBottomColor: colors.border, backgroundColor: o.value === selected ? colors.accentSoft : "transparent", opacity: pressed ? 0.7 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetItemText, { color: colors.foreground }]}>{o.label}</Text>
                {o.detail ? <Text style={[styles.sheetItemDetail, { color: colors.muted }]}>{o.detail}</Text> : null}
              </View>
              {o.drill ? <MaterialIcons name={isRTL() ? "chevron-left" : "chevron-right"} size={22} color={colors.muted} /> : o.value === selected ? <MaterialIcons name="check" size={20} color={colors.primary} /> : null}
            </Pressable>
          ))}
          {filtered.length === 0 ? <Text style={[styles.stateText, { color: colors.muted, textAlign: "center", marginTop: 20 }]}>{t("لا توجد نتائج")}</Text> : null}
        </ScrollView>
        {footer}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<DbStatus, string> = {
  draft: "مسودة", pending: "قيد المراجعة", active: "منشور", paused: "موقوف مؤقتًا", rejected: "مرفوض",
  sold: "تم البيع", reserved: "محجوز", expired: "منتهي", archived: "مؤرشف",
};

export function StatusPill({ status }: { status: DbStatus }) {
  const colors = useColors();
  const tone = status === "active" ? colors.success : status === "rejected" ? colors.error : status === "pending" || status === "paused" ? colors.warning : colors.muted;
  return <View style={[styles.pill, { borderColor: tone }]}><Text style={[styles.pillText, { color: tone }]}>{t(STATUS_LABELS[status])}</Text></View>;
}

export function FavoriteButton({ listingId, size = 20 }: { listingId: string; size?: number }) {
  const colors = useColors();
  const { isSaved, toggle, isAuthenticated } = useFavorites();
  const saved = isSaved(listingId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? t("إزالة من المفضلة") : t("حفظ في المفضلة")}
      hitSlop={8}
      onPress={() => {
        if (!isAuthenticated) { router.push("/login"); return; }
        toggle.mutate({ listingId, save: !saved });
      }}
      style={[styles.favButton, { backgroundColor: colors.surface }]}
    >
      <MaterialIcons name={saved ? "favorite" : "favorite-border"} size={size} color={saved ? colors.error : colors.foreground} />
    </Pressable>
  );
}

export function ListingCard({ listing, width = "48.4%" }: { listing: Listing; width?: ViewStyle["width"] }) {
  const colors = useColors();
  const locations = useLocations();
  return (
    <Pressable onPress={() => router.push({ pathname: "/listing/[id]", params: { id: listing.id } })} style={({ pressed }) => [styles.listingCard, { width, backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.listingImageWrap, { backgroundColor: colors.surfaceAlt }]}>
        {listing.imageUrl ? <Image source={{ uri: listing.imageUrl }} style={styles.listingImage} /> : <View style={styles.noImage}><MaterialIcons name="photo-camera" size={28} color={colors.muted} /></View>}
        {listing.isFeatured ? <View style={[styles.featuredTag, { backgroundColor: colors.accent }]}><MaterialIcons name="star" size={11} color="#0B1F17" /><Text style={styles.featuredText}>{t("مميز")}</Text></View> : null}
        <View style={styles.favSlot}><FavoriteButton listingId={listing.id} size={18} /></View>
      </View>
      <View style={styles.listingBody}>
        <Text style={[styles.listingTitle, { color: colors.foreground }]} numberOfLines={2}>{listing.title}</Text>
        <Text style={[styles.listingPrice, { color: colors.primary }]} numberOfLines={1}>{listing.price}</Text>
        <View style={styles.listingMeta}>
          <MaterialIcons name="location-on" size={13} color={colors.muted} />
          <Text style={[styles.listingMetaText, { color: colors.muted }]} numberOfLines={1}>{locations.label(listing.locationId) ?? t("عُمان")}</Text>
        </View>
        <Text style={[styles.listingTime, { color: colors.muted }]}>{timeAgo(listing.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Exact item widths for wrapping grids. Percent widths plus `gap` can add up to a hair
 * over 100% on Android, which pushes the last item to a new row and leaves an empty gap.
 * Here the grid measures its real width and gives every item a whole-pixel width instead.
 * Pass `columns` for a fixed count, or `minItemWidth` to fit as many columns as the screen allows.
 */
export function useGrid({ gap, columns, minItemWidth = 150, maxColumns = 4, sidePadding = 32 }: { gap: number; columns?: number; minItemWidth?: number; maxColumns?: number; sidePadding?: number }) {
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setMeasured((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
  }, []);
  const width = measured || Math.max(0, window.width - sidePadding); // estimate until measured
  const cols = columns ?? Math.max(1, Math.min(maxColumns, Math.floor((width + gap) / (minItemWidth + gap))));
  const itemWidth = Math.max(0, Math.floor((width - gap * (cols - 1)) / cols));
  return { onLayout, itemWidth, columns: cols };
}

export function ListingGrid({ items }: { items: Listing[] }) {
  const grid = useGrid({ gap: 11, minItemWidth: 155 });
  return <View onLayout={grid.onLayout} style={styles.grid}>{items.map((item) => <ListingCard key={item.id} listing={item} width={grid.itemWidth} />)}</View>;
}

/** Horizontal strip of listing cards (featured, related, recommended). */
export function ListingStrip({ items }: { items: Listing[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {items.map((item) => <ListingCard key={item.id} listing={item} width={168} />)}
    </ScrollView>
  );
}

const styles = createStyles({
  header: { paddingBottom: 8, paddingTop: 10 },
  headerRow: { alignItems: "center", flexDirection: "row-reverse", gap: 12 },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: "900", textAlign: "right" },
  headerSubtitle: { fontSize: 13, lineHeight: 20, marginTop: 4, textAlign: "right" },
  iconButton: { alignItems: "center", borderRadius: 14, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  sectionHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 10, marginTop: 22 },
  sectionTitle: { fontSize: 18, fontWeight: "900", textAlign: "right" },
  sectionAction: { fontSize: 13, fontWeight: "800" },
  card: { borderRadius: 18, borderWidth: 1, padding: 14 },
  state: { alignItems: "center", gap: 10, paddingVertical: 36 },
  stateText: { fontSize: 13, fontWeight: "700" },
  empty: { alignItems: "center", borderRadius: 20, borderWidth: 1, marginTop: 24, padding: 22 },
  emptyIcon: { alignItems: "center", borderRadius: 30, height: 60, justifyContent: "center", width: 60 },
  emptyTitle: { fontSize: 17, fontWeight: "900", marginTop: 14, textAlign: "center" },
  emptyText: { fontSize: 13, lineHeight: 21, marginTop: 7, textAlign: "center" },
  button: { alignItems: "center", borderRadius: 14, borderWidth: 1.5, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 52, paddingHorizontal: 16 },
  buttonSmall: { borderRadius: 11, minHeight: 38, paddingHorizontal: 12 },
  buttonText: { fontSize: 15, fontWeight: "900" },
  buttonTextSmall: { fontSize: 13 },
  chip: { alignItems: "center", borderRadius: 20, borderWidth: 1, flexDirection: "row-reverse", gap: 5, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: "800" },
  field: { marginTop: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "800", marginBottom: 8, textAlign: "right" },
  fieldHint: { fontSize: 11, lineHeight: 17, marginTop: 6, textAlign: "right" },
  input: { borderRadius: 13, borderWidth: 1, fontSize: 15, minHeight: 50, paddingHorizontal: 14 },
  select: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  selectText: { flex: 1, fontSize: 15, textAlign: "right" },
  sheetBackdrop: { backgroundColor: "rgba(11,31,23,0.5)", flex: 1 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", padding: 18, paddingBottom: 28 },
  sheetHead: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 12 },
  sheetTitle: { fontSize: 19, fontWeight: "900", textAlign: "right" },
  sheetItem: { alignItems: "center", borderBottomWidth: 1, borderRadius: 10, flexDirection: "row-reverse", gap: 10, minHeight: 54, paddingHorizontal: 8 },
  sheetItemText: { fontSize: 15, fontWeight: "700", textAlign: "right" },
  sheetItemDetail: { fontSize: 11, marginTop: 3, textAlign: "right" },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "900" },
  favButton: { alignItems: "center", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  listingCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  listingImageWrap: { aspectRatio: 1.05, position: "relative" },
  listingImage: { height: "100%", width: "100%" },
  noImage: { alignItems: "center", flex: 1, justifyContent: "center" },
  featuredTag: { alignItems: "center", borderRadius: 8, flexDirection: "row-reverse", gap: 3, paddingHorizontal: 7, paddingVertical: 3, position: "absolute", right: 8, top: 8 },
  featuredText: { color: "#0B1F17", fontSize: 10, fontWeight: "900" },
  favSlot: { left: 8, position: "absolute", top: 8 },
  listingBody: { gap: 4, padding: 10 },
  listingTitle: { fontSize: 13, fontWeight: "800", lineHeight: 19, minHeight: 38, textAlign: "right" },
  listingPrice: { fontSize: 15, fontWeight: "900", textAlign: "right" },
  listingMeta: { alignItems: "center", flexDirection: "row-reverse", gap: 2 },
  listingMetaText: { flex: 1, fontSize: 11, textAlign: "right" },
  listingTime: { fontSize: 10, textAlign: "right" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 11 },
  strip: { flexDirection: "row-reverse", gap: 11, paddingVertical: 2 },
});
