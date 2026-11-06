import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Chip, Field, Header, Input, Loading, LoginRequired, SelectField, SelectSheet, notify } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { CONDITIONS, type Condition, NO_CONDITION_SLUGS, fieldsForCategory } from "@/lib/category-fields";
import { addListingImage, checkListingText, friendlyError, getListing, type ListingInput, removeListingImage, saveListing, validateListing } from "@/lib/data";
import { formatPrice, pickName, t } from "@/lib/i18n";
import { prepareImageDataUrl } from "@/lib/prepare-image-data-url";
import { keys, useCategories, useLocations, useMyRestriction } from "@/lib/queries";
import { SuspensionNotice } from "@/components/suspension-notice";
import { useSelectedLocation } from "@/lib/user-location";
import { createStyles } from "@/lib/i18n/rtl";

const MAX_PHOTOS = 10;
const DRAFT_KEY = "dar_al_sila_new_listing_form";

type Photo = { mediaId?: string; uri: string };
type Form = Omit<ListingInput, "id">;
type Sheet = null | "category" | "location" | "condition";

const emptyForm: Form = { categoryId: null, subcategoryId: null, title: "", description: "", price: "", condition: null, locationId: null, phone: "", whatsapp: "", attributes: {} };

/** Guided create/edit listing (spec 4.5). One screen, saved locally while typing. */
export default function PostScreen() {
  const params = useLocalSearchParams<{ categoryId?: string; listingId?: string }>();
  const editingId = params.listingId || null;
  const colors = useColors();
  const client = useQueryClient();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const restriction = useMyRestriction();
  const categories = useCategories();
  const locations = useLocations();
  const { locationId: preferredLocation } = useSelectedLocation();

  const [form, setForm] = useState<Form>(emptyForm);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [removedMedia, setRemovedMedia] = useState<string[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(editingId));
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [categoryPath, setCategoryPath] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "publish">(null);
  const [progress, setProgress] = useState("");
  const restored = useRef(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setAttr = (key: string, value: string) => setForm((f) => ({ ...f, attributes: { ...f.attributes, [key]: value } }));

  const applyCategory = (id: number | null) => {
    const top = categories.topOf(id);
    setForm((f) => ({ ...f, categoryId: top?.id ?? null, subcategoryId: id && top && id !== top.id ? id : null }));
  };

  // Load an existing listing (edit) or restore the unsaved new-listing form.
  useEffect(() => {
    if (editingId) {
      getListing({ publicId: editingId })
        .then((l) => {
          setForm({ categoryId: l.categoryId, subcategoryId: l.subcategoryId, title: l.title, description: l.description, price: l.priceValue != null ? String(l.priceValue) : "", condition: l.condition, locationId: l.locationId, phone: l.phone ?? "", whatsapp: l.whatsapp ?? "", attributes: Object.fromEntries(Object.entries(l.attributes).filter(([, v]) => typeof v === "string" || typeof v === "number").map(([k, v]) => [k, String(v)])) });
          setPhotos(l.images.map((i) => ({ mediaId: i.id, uri: i.url })));
          setExistingStatus(l.status);
        })
        .catch((e) => notify(t("تعذر فتح الإعلان"), friendlyError(e)))
        .finally(() => setLoadingExisting(false));
      return;
    }
    if (restored.current) return;
    restored.current = true;
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      const saved = raw ? (JSON.parse(raw) as { form?: Form; photos?: Photo[] }) : null;
      if (saved?.form) setForm({ ...emptyForm, ...saved.form });
      if (saved?.photos) setPhotos(saved.photos.filter((p) => !p.mediaId));
    }).catch(() => undefined);
  }, [editingId]);

  // A category chosen on the previous screen wins over a restored one.
  useEffect(() => {
    if (params.categoryId && categories.all.length) applyCategory(Number(params.categoryId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.categoryId, categories.all.length]);

  // Sensible defaults from the profile and the chosen area.
  useEffect(() => {
    if (editingId) return;
    setForm((f) => ({ ...f, phone: f.phone || user?.phone || "", locationId: f.locationId ?? preferredLocation }));
  }, [editingId, user?.phone, preferredLocation]);

  // Keep the unsaved new-listing form so nothing is lost when leaving the screen.
  useEffect(() => {
    if (editingId || !restored.current) return;
    const timer = setTimeout(() => { AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ form, photos })).catch(() => undefined); }, 400);
    return () => clearTimeout(timer);
  }, [editingId, form, photos]);

  const topSlug = categories.topOf(form.categoryId)?.slug;
  const fields = useMemo(() => fieldsForCategory(topSlug), [topSlug]);
  const showCondition = !NO_CONDITION_SLUGS.has(topSlug ?? "");
  const categoryLabel = [categories.byId(form.categoryId), categories.byId(form.subcategoryId)].filter(Boolean).map((c) => pickName(c)).join(" › ");

  const pickPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) { notify(t("الحد الأقصى {n} صور", { n: MAX_PHOTOS })); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { notify(t("السماح بالصور مطلوب"), t("اسمح للتطبيق بالوصول إلى الصور من إعدادات الجهاز.")); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length, quality: 0.85 });
    if (result.canceled) return;
    setPhotos((p) => [...p, ...result.assets.map((a) => ({ uri: a.uri }))].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (index: number) => {
    const photo = photos[index];
    if (photo.mediaId) setRemovedMedia((r) => [...r, photo.mediaId!]);
    setPhotos((p) => p.filter((_, i) => i !== index));
  };

  const makeMain = (index: number) => setPhotos((p) => [p[index], ...p.filter((_, i) => i !== index)]);

  const validate = (publish: boolean) => {
    const list = validateListing({ ...form }, { requireAll: publish, fieldsRequired: publish ? fields.filter((f) => f.required) : [] });
    if (publish && showCondition && !form.condition) list.push(t("اختر حالة المنتج."));
    if (publish && photos.length === 0) list.push(t("أضف صورة واحدة على الأقل."));
    const blocked = publish ? checkListingText(form.title, form.description) : null;
    if (blocked) list.push(blocked);
    setErrors(list);
    return list.length === 0;
  };

  const persist = async (publish: boolean) => {
    if (!isAuthenticated) { router.push("/login"); return; }
    if (!validate(publish)) return;
    setBusy(publish ? "publish" : "draft");
    try {
      setProgress(t("جارٍ حفظ البيانات..."));
      // 1) Save fields first so images have a listing to attach to (kept as draft until photos are in).
      let saved = await saveListing({ ...form, id: editingId, condition: showCondition ? form.condition : null }, false);
      // 2) Images: remove deleted, upload new ones in order.
      for (const mediaId of removedMedia) await removeListingImage(mediaId).catch(() => undefined);
      let order = 0;
      for (let i = 0; i < photos.length; i += 1) {
        const photo = photos[i];
        if (photo.mediaId) { order += 1; continue; }
        setProgress(t("جارٍ رفع الصورة {n} من {total}...", { n: i + 1, total: photos.length }));
        const dataUrl = await prepareImageDataUrl(photo.uri);
        await addListingImage(saved.id, dataUrl, order);
        order += 1;
      }
      // 3) Publish (active, or pending when the platform requires review).
      if (publish && (saved.status === "draft" || (saved.status === "rejected" && saved.moderationStatus === "auto_rejected") || !editingId)) {
        setProgress(t("جارٍ النشر..."));
        saved = await saveListing({ ...form, id: saved.id, condition: showCondition ? form.condition : null }, true);
      }
      if (!editingId) await AsyncStorage.removeItem(DRAFT_KEY).catch(() => undefined);
      void client.invalidateQueries({ queryKey: keys.myListings });
      void client.invalidateQueries({ queryKey: ["home"] });
      void client.invalidateQueries({ queryKey: ["listing", saved.id] });
      setPreview(false);
      setForm(emptyForm); setPhotos([]); setRemovedMedia([]);
      // The server checks every published or edited listing; report what it decided.
      const reason = saved.moderationReason ? t(saved.moderationReason) : null;
      if (saved.status === "rejected") notify(t("تعذر نشر إعلانك"), reason ?? t("حاول مرة أخرى."));
      else if (saved.status === "pending") notify(t("أُرسل إعلانك للمراجعة"), reason ?? t("سيظهر بعد موافقة المشرف، وسيصلك إشعار."));
      else if (!publish && saved.status === "draft") notify(t("تم حفظ المسودة"), t("يمكنك إكمالها من إعلاناتي."));
      else notify(editingId ? t("تم حفظ التعديلات") : t("تم نشر إعلانك"), t("إعلانك ظاهر الآن للمشترين."));
      router.replace(saved.status === "active" ? { pathname: "/listing/[id]", params: { id: saved.id } } : "/(tabs)/myads");
    } catch (error) {
      notify(t("تعذر حفظ الإعلان"), friendlyError(error));
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const categoryOptions = useMemo(() => {
    const list = categories.childrenOf(categoryPath);
    const head = categoryPath ? [{ value: `pick:${categoryPath}`, label: t("أضف في: {name}", { name: pickName(categories.byId(categoryPath)) }) }] : [];
    return [...head, ...list.map((c) => ({ value: String(c.id), label: pickName(c), drill: categories.childrenOf(c.id).length > 0 }))];
  }, [categories, categoryPath]);

  const locationOptions = useMemo(() => locations.governorates.flatMap((g) => [
    { value: String(g.id), label: pickName(g) },
    ...locations.wilayatsOf(g.id).map((w) => ({ value: String(w.id), label: `   ${pickName(w)}`, detail: pickName(g) })),
  ]), [locations]);

  if (authLoading || loadingExisting) return <ScreenContainer><Loading /></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-4"><Header title={t("أضف إعلان")} /><LoginRequired text={t("سجّل الدخول لنشر إعلانك وإدارته.")} /></ScreenContainer>;
  if (restriction.data) return <ScreenContainer className="px-4"><Header title={t("أضف إعلان")} /><SuspensionNotice /></ScreenContainer>;

  const publishLabel = editingId && existingStatus && existingStatus !== "draft" ? t("حفظ التعديلات") : t("معاينة ونشر");

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Header title={editingId ? t("تعديل الإعلان") : t("نشر إعلان جديد")} subtitle={t("يُفحص الإعلان تلقائيًا قبل ظهوره لحماية المشترين والبائعين")} />

        <Field label={t("1. التصنيف")} required>
          <SelectField value={categoryLabel} placeholder={t("اختر تصنيف الإعلان")} onPress={() => { setCategoryPath(null); setSheet("category"); }} />
        </Field>

        <Field label={t("2. عنوان الإعلان")} required hint={t("{n}/140", { n: form.title.length })}>
          <Input value={form.title} onChangeText={(v) => set("title", v.slice(0, 140))} placeholder={t("مثال: تويوتا لاندكروزر 2020 بحالة ممتازة")} />
        </Field>

        <Field label={t("3. الوصف")} required>
          <Input value={form.description} onChangeText={(v) => set("description", v.slice(0, 4000))} placeholder={t("اكتب تفاصيل الإعلان بوضوح...")} multiline />
        </Field>

        <Field label={t("4. الصور")} required hint={t("حتى {n} صور. الصورة الأولى هي الرئيسية؛ اضغط على صورة لجعلها رئيسية.", { n: MAX_PHOTOS })}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            <Pressable onPress={pickPhotos} style={[styles.addPhoto, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
              <MaterialIcons name="add-a-photo" size={28} color={colors.primary} />
              <Text style={[styles.addPhotoText, { color: colors.primary }]}>{t("أضف صور")}</Text>
              <Text style={[styles.addPhotoText, { color: colors.muted }]}>{photos.length}/{MAX_PHOTOS}</Text>
            </Pressable>
            {photos.map((photo, index) => (
              <Pressable key={photo.uri} onPress={() => makeMain(index)} style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={[styles.photo, index === 0 && { borderColor: colors.accent, borderWidth: 3 }]} />
                {index === 0 ? <View style={[styles.mainTag, { backgroundColor: colors.accent }]}><Text style={styles.mainTagText}>{t("رئيسية")}</Text></View> : null}
                <Pressable accessibilityLabel={t("حذف الصورة")} hitSlop={6} onPress={() => removePhoto(index)} style={styles.removePhoto}><MaterialIcons name="close" size={16} color="#FFFFFF" /></Pressable>
              </Pressable>
            ))}
          </ScrollView>
        </Field>

        <Field label={t("5. السعر (ر.ع.)")} hint={t("اتركه فارغًا إذا كان السعر عند التواصل.")}>
          <Input value={form.price} onChangeText={(v) => set("price", v)} placeholder={t("مثال: 250")} keyboardType="decimal-pad" />
        </Field>

        {showCondition ? (
          <Field label={t("6. الحالة")} required>
            <View style={styles.chips}>{CONDITIONS.map((c) => <Chip key={c.value} label={t(c.label)} active={form.condition === c.value} onPress={() => set("condition", c.value as Condition)} />)}</View>
          </Field>
        ) : null}

        <Field label={t("7. الموقع")} required>
          <SelectField value={locations.label(form.locationId)} placeholder={t("اختر المحافظة أو الولاية")} onPress={() => setSheet("location")} />
        </Field>

        {fields.length ? <Text style={[styles.groupTitle, { color: colors.foreground }]}>{t("8. تفاصيل خاصة بالقسم")}</Text> : null}
        {fields.map((field) => (
          <Field key={field.key} label={`${t(field.label)}${field.unit ? ` (${t(field.unit)})` : ""}`} required={field.required}>
            {field.options ? (
              <View style={styles.chips}>{field.options.map((o) => <Chip key={o.value} label={t(o.label)} active={form.attributes[field.key] === o.value} onPress={() => setAttr(field.key, o.value)} />)}</View>
            ) : (
              <Input value={form.attributes[field.key] ?? ""} onChangeText={(v) => setAttr(field.key, v)} keyboardType={field.type === "number" ? "numeric" : "default"} />
            )}
          </Field>
        ))}

        <Field label={t("رقم الهاتف للتواصل")} required>
          <Input value={form.phone} onChangeText={(v) => set("phone", v)} placeholder="+968 9XXXXXXX" keyboardType="phone-pad" />
        </Field>
        <Field label={t("رقم واتساب (اختياري)")}>
          <Input value={form.whatsapp ?? ""} onChangeText={(v) => set("whatsapp", v)} placeholder="+968 9XXXXXXX" keyboardType="phone-pad" />
        </Field>

        {errors.length ? (
          <View style={[styles.errors, { borderColor: colors.error }]}>
            {errors.map((e) => <Text key={e} style={[styles.errorText, { color: colors.error }]}>• {e}</Text>)}
          </View>
        ) : null}

        <Button label={busy === "draft" ? progress || t("جارٍ الحفظ...") : t("حفظ كمسودة")} variant="outline" loading={busy === "draft"} disabled={Boolean(busy)} onPress={() => persist(false)} style={{ marginTop: 22 }} />
        <Button icon="visibility" label={publishLabel} disabled={Boolean(busy)} onPress={() => { if (validate(true)) setPreview(true); }} style={{ marginTop: 10 }} />
        <Text style={[styles.notice, { color: colors.muted }]}>{t("يُمنع نشر الأسلحة والمواد الخطرة والمحتوى الإباحي والاحتيال والعروض المضللة. راجع سياسة المواد الممنوعة.")}</Text>
      </ScrollView>

      <Modal visible={preview} animationType="slide" transparent onRequestClose={() => setPreview(false)}>
        <View style={styles.previewBackdrop}>
          <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>{t("9. معاينة الإعلان")}</Text>
            <Text style={[styles.previewHint, { color: colors.muted }]}>{t("هكذا سيظهر إعلانك للمشترين.")}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {photos[0] ? <Image source={{ uri: photos[0].uri }} style={styles.previewImage} /> : null}
              <Text style={[styles.previewCategory, { color: colors.primary }]}>{categoryLabel}</Text>
              <Text style={[styles.previewListingTitle, { color: colors.foreground }]}>{form.title}</Text>
              <Text style={[styles.previewPrice, { color: colors.primary }]}>{form.price.trim() ? formatPrice(Number(form.price.replace(/[^\d.]/g, ""))) : t("السعر عند التواصل")}</Text>
              <Text style={[styles.previewMeta, { color: colors.muted }]}>{locations.label(form.locationId)}{form.condition ? ` · ${t(CONDITIONS.find((c) => c.value === form.condition)!.label)}` : ""}</Text>
              {fields.filter((f) => form.attributes[f.key]).map((f) => <Text key={f.key} style={[styles.previewMeta, { color: colors.foreground }]}>{t(f.label)}: {f.options ? t(f.options.find((o) => o.value === form.attributes[f.key])?.label ?? "") : form.attributes[f.key]}</Text>)}
              <Text style={[styles.previewDescription, { color: colors.foreground }]}>{form.description}</Text>
              <Text style={[styles.previewMeta, { color: colors.muted }]}>{t("{n} صورة · للتواصل: {phone}", { n: photos.length, phone: form.phone })}</Text>
            </ScrollView>
            {busy === "publish" ? <Text style={[styles.previewHint, { color: colors.primary, textAlign: "center" }]}>{progress}</Text> : null}
            <View style={styles.previewActions}>
              <Button variant="ghost" label={t("تعديل")} disabled={Boolean(busy)} onPress={() => setPreview(false)} style={{ flex: 1 }} />
              <Button label={t("10. تأكيد ونشر")} loading={busy === "publish"} onPress={() => persist(true)} style={{ flex: 2 }} />
            </View>
          </View>
        </View>
      </Modal>

      <SelectSheet visible={sheet === "location"} title={t("الموقع")} selected={form.locationId ? String(form.locationId) : null} options={locationOptions} onClose={() => setSheet(null)} onSelect={(v) => { set("locationId", Number(v)); setSheet(null); }} />
      <SelectSheet
        visible={sheet === "category"}
        title={categoryPath ? pickName(categories.byId(categoryPath)) : t("التصنيف")}
        options={categoryOptions}
        selected={form.subcategoryId ? String(form.subcategoryId) : form.categoryId ? String(form.categoryId) : null}
        onClose={() => setSheet(null)}
        onSelect={(v) => {
          if (v.startsWith("pick:")) { applyCategory(Number(v.slice(5))); setSheet(null); return; }
          const id = Number(v);
          if (categories.childrenOf(id).length) { setCategoryPath(id); return; }
          applyCategory(id);
          setSheet(null);
        }}
      />
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  groupTitle: { fontSize: 16, fontWeight: "900", marginTop: 24, textAlign: "right" },
  photos: { flexDirection: "row-reverse", gap: 10, paddingVertical: 4 },
  addPhoto: { alignItems: "center", borderRadius: 16, borderStyle: "dashed", borderWidth: 1.5, gap: 3, height: 104, justifyContent: "center", width: 104 },
  addPhotoText: { fontSize: 11, fontWeight: "800" },
  photoWrap: { height: 104, position: "relative", width: 104 },
  photo: { borderRadius: 16, height: 104, width: 104 },
  mainTag: { borderRadius: 8, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, position: "absolute", right: 6 },
  mainTagText: { color: "#0B1F17", fontSize: 10, fontWeight: "900" },
  removePhoto: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, height: 24, justifyContent: "center", left: 6, position: "absolute", top: 6, width: 24 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  errors: { borderRadius: 14, borderWidth: 1, gap: 4, marginTop: 18, padding: 12 },
  errorText: { fontSize: 13, fontWeight: "700", textAlign: "right" },
  notice: { fontSize: 12, lineHeight: 19, marginTop: 12, textAlign: "right" },
  previewBackdrop: { backgroundColor: "rgba(11, 31, 23, 0.58)", flex: 1, justifyContent: "flex-end" },
  previewCard: { borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "90%", padding: 20 },
  previewTitle: { fontSize: 22, fontWeight: "900", textAlign: "right" },
  previewHint: { fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: "right" },
  previewImage: { borderRadius: 16, height: 200, marginTop: 14, width: "100%" },
  previewCategory: { fontSize: 13, fontWeight: "800", marginTop: 14, textAlign: "right" },
  previewListingTitle: { fontSize: 20, fontWeight: "900", marginTop: 6, textAlign: "right" },
  previewPrice: { fontSize: 19, fontWeight: "900", marginTop: 8, textAlign: "right" },
  previewMeta: { fontSize: 13, marginTop: 6, textAlign: "right" },
  previewDescription: { fontSize: 15, lineHeight: 24, marginTop: 14, textAlign: "right" },
  previewActions: { flexDirection: "row-reverse", gap: 10, marginTop: 16 },
});
