import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Card, Chip, Field, Header, Input, Loading, LoginRequired, SelectField, SelectSheet, notify } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { friendlyError, getMyListings, getMyStore, listConversations, saveMyStore, type StoreType, uploadImage } from "@/lib/data";
import { formatNumber, pickName, t } from "@/lib/i18n";
import { prepareImageDataUrl } from "@/lib/prepare-image-data-url";
import { keys, useLocations } from "@/lib/queries";
import { STORE_TYPES } from "@/lib/store-types";
import { createStyles } from "@/lib/i18n/rtl";

/** Store owner dashboard (spec 4.7): profile, images, availability, products, inquiries. */
export default function ManageStoreScreen() {
  const colors = useColors();
  const client = useQueryClient();
  const { isAuthenticated, loading } = useAuth();
  const locations = useLocations();
  const store = useQuery({ queryKey: keys.myStore, queryFn: getMyStore, enabled: isAuthenticated });
  const products = useQuery({ queryKey: keys.myListings, queryFn: getMyListings, enabled: isAuthenticated });
  const inquiries = useQuery({ queryKey: keys.conversations, queryFn: listConversations, enabled: isAuthenticated });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [storeType, setStoreType] = useState<StoreType>("small_shop");
  const [locationId, setLocationId] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<null | "logo" | "cover">(null);
  const [locationSheet, setLocationSheet] = useState(false);

  useEffect(() => {
    const s = store.data;
    if (!s) return;
    setName(s.name); setDescription(s.description ?? ""); setPhone(s.phone ?? ""); setWhatsapp(s.whatsapp ?? "");
    setStoreType(s.storeType); setLocationId(s.locationId); setLogoUrl(s.logoUrl); setCoverUrl(s.coverUrl);
  }, [store.data]);

  const pick = async (kind: "logo" | "cover") => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: kind === "logo" ? [1, 1] : [16, 7], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(kind);
    try {
      const url = await uploadImage(await prepareImageDataUrl(result.assets[0].uri), "store");
      if (kind === "logo") setLogoUrl(url); else setCoverUrl(url);
    } catch (e) {
      notify(t("تعذر رفع الصورة"), friendlyError(e));
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveMyStore({ name, description, phone, whatsapp, storeType, locationId, logoUrl, coverUrl });
      await client.invalidateQueries({ queryKey: keys.myStore });
      notify(t("تم حفظ المتجر"), saved.status === "pending" ? t("سيظهر متجرك للمشترين بعد موافقة المشرف.") : undefined);
    } catch (e) {
      notify(t("تعذر حفظ المتجر"), friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const locationOptions = useMemo(() => locations.governorates.flatMap((g) => [{ value: String(g.id), label: pickName(g) }, ...locations.wilayatsOf(g.id).map((w) => ({ value: String(w.id), label: `   ${pickName(w)}`, detail: pickName(g) }))]), [locations]);
  const live = (products.data ?? []).filter((l) => l.status === "active").length;
  const paused = (products.data ?? []).filter((l) => l.status === "paused" || l.status === "sold").length;
  const storeInquiries = (inquiries.data ?? []).filter((c) => c.iAmSeller);
  const unreadInquiries = storeInquiries.reduce((n, c) => n + c.unread, 0);

  if (loading || store.isLoading) return <ScreenContainer><Loading /></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-4"><Header title={t("متجري")} /><LoginRequired /></ScreenContainer>;

  const s = store.data;
  const statusText = !s ? t("لم تنشئ متجرًا بعد") : s.status === "active" ? t("مفعّل ويظهر للمشترين") : s.status === "pending" ? t("بانتظار موافقة المشرف") : t("موقوف من الإدارة");

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Header title={s ? t("إدارة المتجر") : t("أنشئ متجرك")} subtitle={statusText} right={s?.status === "active" ? <Button small variant="outline" icon="open-in-new" label={t("عرض")} onPress={() => router.push({ pathname: "/store/[merchantId]", params: { merchantId: s.ownerId } })} /> : undefined} />

        {s ? (
          <View style={styles.stats}>
            <Stat label={t("منتجات منشورة")} value={live} onPress={() => router.push("/(tabs)/myads")} />
            <Stat label={t("موقوفة أو مباعة")} value={paused} onPress={() => router.push("/(tabs)/myads")} />
            <Stat label={t("استفسارات العملاء")} value={storeInquiries.length} badge={unreadInquiries} onPress={() => router.push("/(tabs)/messages")} />
          </View>
        ) : null}

        <Text style={[styles.section, { color: colors.foreground }]}>{t("صور المتجر")}</Text>
        <Pressable onPress={() => pick("cover")} style={[styles.cover, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} /> : <><MaterialIcons name="panorama" size={30} color={colors.muted} /><Text style={{ color: colors.muted }}>{uploading === "cover" ? t("جارٍ الرفع...") : t("صورة الغلاف")}</Text></>}
        </Pressable>
        <Pressable onPress={() => pick("logo")} style={[styles.logo, { backgroundColor: colors.accentSoft, borderColor: colors.surface }]}>
          {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImg} /> : <MaterialIcons name={uploading === "logo" ? "hourglass-empty" : "add-a-photo"} size={26} color={colors.primary} />}
        </Pressable>

        <Field label={t("اسم المتجر")} required><Input value={name} onChangeText={setName} placeholder={t("مثال: محل النور للإلكترونيات")} /></Field>
        <Field label={t("نوع المتجر")}>
          <View style={styles.chips}>{(Object.keys(STORE_TYPES) as StoreType[]).map((k) => <Chip key={k} label={t(STORE_TYPES[k])} active={storeType === k} onPress={() => setStoreType(k)} />)}</View>
        </Field>
        <Field label={t("وصف المتجر")}><Input value={description} onChangeText={setDescription} multiline multilineHeight={100} placeholder={t("ماذا تبيع؟ أوقات العمل؟ التوصيل؟")} /></Field>
        <Field label={t("الموقع")}><SelectField value={locations.label(locationId)} placeholder={t("اختر المحافظة أو الولاية")} onPress={() => setLocationSheet(true)} /></Field>
        <Field label={t("هاتف المتجر")}><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+968 9XXXXXXX" /></Field>
        <Field label={t("واتساب")}><Input value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="+968 9XXXXXXX" /></Field>
        <Button label={s ? t("حفظ التغييرات") : t("إنشاء المتجر")} loading={saving} disabled={Boolean(uploading)} onPress={save} style={{ marginTop: 20 }} />

        <Card style={{ marginTop: 20 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("المنتجات")}</Text>
          <Text style={[styles.note, { color: colors.muted }]}>{t("منتجات متجرك هي إعلاناتك. أضف منتجًا جديدًا أو أوقف المنتجات غير المتوفرة من إعلاناتي.")}</Text>
          <View style={styles.row}>
            <Button small icon="add" label={t("إضافة منتج")} onPress={() => router.push("/select-category")} style={{ flex: 1 }} />
            <Button small variant="outline" icon="inventory" label={t("إدارة المنتجات")} onPress={() => router.push("/(tabs)/myads")} style={{ flex: 1 }} />
          </View>
        </Card>
      </ScrollView>
      <SelectSheet visible={locationSheet} title={t("الموقع")} selected={locationId ? String(locationId) : null} options={locationOptions} onClose={() => setLocationSheet(false)} onSelect={(v) => { setLocationId(Number(v)); setLocationSheet(false); }} />
    </ScreenContainer>
  );
}

function Stat({ label, value, badge, onPress }: { label: string; value: number; badge?: number; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.stat, { backgroundColor: colors.surface, borderColor: badge ? colors.accent : colors.border }]}>
      <Text style={[styles.statValue, { color: colors.primary }]}>{formatNumber(value)}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
      {badge ? <Text style={[styles.statBadge, { color: colors.accent }]}>{t("{n} غير مقروءة", { n: badge })}</Text> : null}
    </Pressable>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  stats: { flexDirection: "row-reverse", gap: 8, marginTop: 6 },
  stat: { alignItems: "center", borderRadius: 14, borderWidth: 1, flex: 1, paddingVertical: 12 },
  statValue: { fontSize: 22, fontVariant: ["tabular-nums"], fontWeight: "900" },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  statBadge: { fontSize: 10, fontWeight: "900", marginTop: 2 },
  section: { fontSize: 16, fontWeight: "900", marginBottom: 10, marginTop: 22, textAlign: "right" },
  cover: { alignItems: "center", borderRadius: 16, borderWidth: 1, gap: 4, height: 130, justifyContent: "center", overflow: "hidden" },
  logo: { alignItems: "center", alignSelf: "flex-end", borderRadius: 40, borderWidth: 4, height: 80, justifyContent: "center", marginRight: 18, marginTop: -40, overflow: "hidden", width: 80 },
  logoImg: { height: "100%", width: "100%" },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "900", textAlign: "right" },
  note: { fontSize: 12, lineHeight: 19, marginTop: 6, textAlign: "right" },
  row: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
});
