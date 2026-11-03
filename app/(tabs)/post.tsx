import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { prepareImageDataUrl } from "@/lib/prepare-image-data-url";

const photoScope = (value: string | null | undefined) => (value ?? "new").trim().replace(/[^\p{L}\p{N}_-]+/gu, "-") || "new";
const photoKey = (name: string, scope: string) => `dar_al_sila_${name}:${photoScope(scope)}`;

export default function PostScreen() {
  const { category: selectedCategory, photosCount, draftPublicId: routeDraftPublicId } = useLocalSearchParams<{ category?: string; photosCount?: string; draftPublicId?: string }>();
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState(selectedCategory ?? "");
  const [location, setLocation] = useState("مسقط");
  const moderation = trpc.moderation.checkListing.useMutation();
  const imageModeration = trpc.moderation.checkImage.useMutation();
  const createDraftMutation = trpc.listings.createDraft.useMutation();
  const updateDraftMutation = trpc.listings.updateDraft.useMutation();
  const submitDraftMutation = trpc.listings.submitDraft.useMutation();
  const [draftPublicId, setDraftPublicId] = useState<string | null>(routeDraftPublicId ?? null);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewPhotos, setPreviewPhotos] = useState<string[]>([]);

  useEffect(() => {
    const recoveryScope = routeDraftPublicId ?? selectedCategory ?? "new";
    Promise.all([AsyncStorage.getItem(photoKey("listing_draft", recoveryScope)), AsyncStorage.getItem(photoKey("draft_meta", recoveryScope))]).then(([value, metaValue]) => {
      if (metaValue) {
        const meta = JSON.parse(metaValue) as { publicId?: string; version?: number };
        setDraftPublicId(meta.publicId ?? null);
        setDraftVersion(typeof meta.version === "number" ? meta.version : null);
      }
      if (!value) return;
      const draft = JSON.parse(value) as Partial<{ title: string; price: string; description: string; phone: string; category: string; location: string }>;
      setTitle(draft.title ?? ""); setPrice(draft.price ?? ""); setDescription(draft.description ?? ""); setPhone(draft.phone ?? ""); setCategory(draft.category ?? selectedCategory ?? ""); setLocation(draft.location ?? "مسقط");
    }).catch(() => undefined);
  }, [routeDraftPublicId, selectedCategory]);

  const ensureDraft = async () => {
    if (draftPublicId && draftVersion !== null) return { publicId: draftPublicId, version: draftVersion };
    const scopedMetaValue = await AsyncStorage.getItem(photoKey("draft_meta", category));
    if (scopedMetaValue) {
      const scopedMeta = JSON.parse(scopedMetaValue) as { publicId?: string; version?: number };
      if (scopedMeta.publicId && typeof scopedMeta.version === "number") {
        setDraftPublicId(scopedMeta.publicId); setDraftVersion(scopedMeta.version);
        return { publicId: scopedMeta.publicId, version: scopedMeta.version };
      }
    }
    const publicId = `AD-DRAFT-${Date.now().toString(36).toUpperCase()}`;
    const created = await createDraftMutation.mutateAsync({ publicId, title, price, description, phone, category, location });
    setDraftPublicId(created.publicId); setDraftVersion(created.version);
          await AsyncStorage.setItem(photoKey("draft_meta", category), JSON.stringify({ publicId: created.publicId, version: created.version }));

    return { publicId: created.publicId, version: created.version };
  };

  const saveDraft = async () => {
    setSaveState("saving");
    try {
      const current = await ensureDraft();
      const updated = await updateDraftMutation.mutateAsync({ publicId: current.publicId, expectedVersion: current.version, title, price, description, phone, category, location });
      setDraftVersion(updated.version); setSaveState("saved");
      await AsyncStorage.multiSet([[photoKey("listing_draft", category), JSON.stringify({ title, price, description, phone, category, location })], [photoKey("draft_meta", category), JSON.stringify({ publicId: updated.publicId, version: updated.version })]]);
      return true;
    } catch (error: any) {
      setSaveState("error");
      if (error?.data?.code === "CONFLICT") Alert.alert("نسخة أحدث", "تم تحديث هذه المسودة من مكان آخر. افتحها من جديد قبل المتابعة.");
      else Alert.alert("تعذر الحفظ", "بقيت بياناتك محليًا ويمكن استعادتها لاحقًا.");
      return false;
    }
  };

  const openImagePicker = async () => {
    await AsyncStorage.setItem(photoKey("listing_draft", category), JSON.stringify({ title, price, description, phone, category, location }));
    const metaValue = await AsyncStorage.getItem(photoKey("draft_meta", category));
    const meta = metaValue ? JSON.parse(metaValue) as { publicId?: string } : undefined;
    router.push({ pathname: "/image-upload" as any, params: { category: category || "غير محدد", draftPublicId: meta?.publicId } });
  };

  const resetForm = () => {
    setTitle("");
    setPrice("");
    setDescription("");
    setPhone("");
    setCategory("");
  };

  const submitAfterPreview = async () => {
    setPreviewVisible(false);
    if (!category.trim() || !title.trim() || !price.trim() || !location.trim() || !description.trim() || !phone.trim()) {
      Alert.alert("بيانات ناقصة", "أكمل التصنيف والعنوان والسعر والموقع والوصف ورقم الهاتف قبل النشر.");
      return;
    }

    if (authLoading) {
      Alert.alert("جارٍ التحقق", "انتظر لحظة حتى نتحقق من تسجيل الدخول ثم أعد المحاولة.");
      return;
    }
    if (!isAuthenticated) {
      Alert.alert("تسجيل الدخول مطلوب", "سجّل الدخول أولًا حتى نستطيع فحص الإعلان وإرساله للمراجعة.", [
        { text: "تسجيل الدخول", onPress: () => router.push("/login" as any) },
        { text: "إلغاء", style: "cancel" },
      ]);
      return;
    }

    let stage = "بدء فحص الإعلان";
    try {
      const scope = draftPublicId ?? category;
      const storedPhotos = await AsyncStorage.getItem(photoKey("pending_listing_photos", scope));
      const photos: string[] = storedPhotos ? JSON.parse(storedPhotos) : [];
      if (!photos.length) {
        Alert.alert("أضف صورة أولًا", "يجب إرفاق صورة واحدة على الأقل وفحصها قبل نشر الإعلان.");
        return;
      }

      const statuses: Record<number, "approved" | "rejected" | "review"> = {};
      const reasons: Record<number, string> = {};
      const storedRejectionCounts = await AsyncStorage.getItem(photoKey("photo_rejection_counts", scope));
      const rejectionCounts: Record<number, number> = storedRejectionCounts ? JSON.parse(storedRejectionCounts) : {};
      for (let index = 0; index < photos.length; index += 1) {
        const uri = photos[index];
        // Normalize high-resolution phone photos before moderation. The server
        // intentionally limits data URLs; sending the original asset caused
        // ordinary camera images to fail with the generic check error.
        stage = `تجهيز الصورة ${index + 1}`;
        const dataUrl = await prepareImageDataUrl(uri);
        stage = `فحص الصورة ${index + 1}`;
        const imageResult = await imageModeration.mutateAsync({ dataUrl });
        if (!imageResult.safeToPublish) {
          statuses[index] = imageResult.verdict === "reject" ? "rejected" : "review";
          reasons[index] = imageResult.reason;
          if (imageResult.verdict === "reject") rejectionCounts[index] = (rejectionCounts[index] ?? 0) + 1;
          await AsyncStorage.multiSet([[photoKey("photo_statuses", scope), JSON.stringify(statuses)], [photoKey("photo_reasons", scope), JSON.stringify(reasons)], [photoKey("photo_rejection_counts", scope), JSON.stringify(rejectionCounts)]]);
          const label = imageResult.verdict === "reject" ? "تم رفض الصورة" : "الصورة قيد المراجعة";
          Alert.alert(label, `الصورة ${index + 1} من ${photos.length}: ${imageResult.reason}`, [{ text: "استبدال الصورة", onPress: () => router.push({ pathname: "/image-upload" as any, params: { category: category || "غير محدد", replaceIndex: String(index) } }) }, { text: "لاحقًا", style: "cancel" }]);
          return;
        }
        statuses[index] = "approved";
        delete reasons[index];
        delete rejectionCounts[index];
        await AsyncStorage.multiSet([[photoKey("photo_statuses", scope), JSON.stringify(statuses)], [photoKey("photo_reasons", scope), JSON.stringify(reasons)], [photoKey("photo_rejection_counts", scope), JSON.stringify(rejectionCounts)]]);
      }

      stage = "فحص بيانات الإعلان";
      const result = await moderation.mutateAsync({
        title,
        description,
        phone,
        price,
        category: category || "غير محدد",
        location,
      });

      if (result.verdict === "reject") {
        Alert.alert("لم يتم نشر الإعلان", `${result.reason}\n\nالتصنيف: ${result.category}`);
        return;
      }

      if (result.verdict === "review") {
        Alert.alert("الإعلان قيد المراجعة", result.reason);
        return;
      }

      stage = "حفظ المسودة";
      const current = await ensureDraft();
      stage = "إرسال الإعلان للمراجعة";
      const submitted = await submitDraftMutation.mutateAsync({ publicId: current.publicId, expectedVersion: current.version, title: title.trim(), description: description.trim(), phone: phone.trim(), price: price.trim(), category: category || "غير محدد", location });
      setDraftVersion(submitted.version);
      Alert.alert("تم إرسال الإعلان للمراجعة", "اجتاز الإعلان الفحص الآلي وأُرسل إلى لوحة المشرف للمراجعة قبل النشر.");
      const cleanupScope = draftPublicId ?? category;
      await AsyncStorage.multiRemove([photoKey("pending_listing_photos", cleanupScope), photoKey("photo_statuses", cleanupScope), photoKey("photo_reasons", cleanupScope), photoKey("photo_rejection_counts", cleanupScope), photoKey("listing_draft", cleanupScope), photoKey("draft_meta", cleanupScope), "dar_al_sila_listing_draft", "dar_al_sila_draft_meta"]);
      resetForm();
    } catch (error: any) {
      const code = typeof error?.data?.code === "string" ? error.data.code : typeof error?.shape?.data?.code === "string" ? error.shape.data.code : "";
      if (code === "UNAUTHORIZED") {
        Alert.alert("انتهت الجلسة", "سجّل الدخول مرة أخرى ثم أعد إرسال الإعلان.", [{ text: "تسجيل الدخول", onPress: () => router.push("/login" as any) }, { text: "إلغاء", style: "cancel" }]);
        return;
      }
      if (code === "CONFLICT") {
        Alert.alert("تم تحديث المسودة", "أعد فتح الإعلان ثم حاول الإرسال مرة أخرى حتى لا نفقد بياناتك.");
        return;
      }
      Alert.alert("تعذر إكمال النشر", `توقف الإجراء عند: ${stage}. لم يتم نشر الإعلان. تحقق من الاتصال وحاول مرة أخرى.`);
    }
  };

  const openPreview = async () => {
    if (!category.trim() || !title.trim() || !price.trim() || !location.trim() || !description.trim() || !phone.trim()) {
      Alert.alert("أكمل البيانات أولًا", "أكمل التصنيف والعنوان والسعر والموقع والوصف ورقم الهاتف قبل المعاينة.");
      return;
    }
    const scope = draftPublicId ?? category;
    const storedPhotos = await AsyncStorage.getItem(photoKey("pending_listing_photos", scope));
    const photos: string[] = storedPhotos ? JSON.parse(storedPhotos) : [];
    if (!photos.length) {
      Alert.alert("أضف صورة أولًا", "يجب إرفاق صورة واحدة على الأقل قبل المعاينة.");
      return;
    }
    setPreviewPhotos(photos);
    setPreviewVisible(true);
  };

  const publish = openPreview;

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>نشر إعلان جديد</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>يُفحص الإعلان تلقائيًا قبل ظهوره لحماية المشترين والبائعين</Text>
        <View style={styles.stepsRow}>
          <View style={[styles.stepPill, { backgroundColor: colors.primary }]}><Text style={styles.stepActiveText}>1 الصور</Text></View>
          <View style={[styles.stepPill, { backgroundColor: colors.primary }]}><Text style={styles.stepActiveText}>2 البيانات</Text></View>
          <View style={[styles.stepPill, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}><Text style={[styles.stepText, { color: colors.muted }]}>3 المراجعة</Text></View>
        </View>
        <Pressable onPress={openImagePicker} style={[styles.photoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="camera.fill" size={29} color={colors.primary} />
          <Text style={[styles.photoTitle, { color: colors.foreground }]}>أضف صور الإعلان</Text>
          <Text style={[styles.photoHint, { color: colors.muted }]}>{photosCount ? `تم اختيار ${photosCount} صورة` : "الصور الواضحة تزيد فرص التواصل"}</Text>
        </Pressable>
        <Text style={[styles.label, { color: colors.foreground }]}>التصنيف</Text>
        <Pressable onPress={() => router.push("/select-category")} style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.placeholder, { color: category ? colors.foreground : colors.muted }]}>{category || "اختر تصنيف الإعلان"}</Text>
          <IconSymbol name="chevron.down" size={18} color={colors.muted} />
        </Pressable>
        <Text style={[styles.label, { color: colors.foreground }]}>عنوان الإعلان</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="مثال: شقة غرفتين للإيجار في الخوض" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} textAlign="right" />
        <Text style={[styles.label, { color: colors.foreground }]}>السعر</Text>
        <TextInput value={price} onChangeText={setPrice} placeholder="أدخل السعر بالريال العماني" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} textAlign="right" />
        <Text style={[styles.label, { color: colors.foreground }]}>الموقع</Text>
        <TextInput value={location} onChangeText={setLocation} placeholder="مثال: مسقط، الخوض" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} textAlign="right" />
        <Text style={[styles.label, { color: colors.foreground }]}>الوصف</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="اكتب تفاصيل الإعلان بوضوح..." placeholderTextColor={colors.muted} multiline numberOfLines={5} style={[styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} textAlign="right" textAlignVertical="top" />
        <Text style={[styles.label, { color: colors.foreground }]}>رقم الهاتف</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="مثال: ٩٦٨ ٩XXXXXXX" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} textAlign="right" />
        <Pressable disabled={saveState === "saving"} onPress={saveDraft} style={[styles.publish, { backgroundColor: saveState === "saving" ? colors.muted : colors.surface, borderColor: colors.primary, borderWidth: 1 }]}>
          <Text style={[styles.publishText, { color: colors.primary }]}>{saveState === "saving" ? "جارٍ الحفظ..." : saveState === "saved" ? "تم الحفظ" : saveState === "error" ? "تعذر الحفظ" : "حفظ المسودة"}</Text>
        </Pressable>
        <Pressable disabled={moderation.isPending || imageModeration.isPending || submitDraftMutation.isPending} onPress={publish} style={({ pressed }) => [styles.publish, { backgroundColor: moderation.isPending || imageModeration.isPending || submitDraftMutation.isPending ? colors.muted : colors.primary }, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}>
          <Text style={styles.publishText}>{moderation.isPending || imageModeration.isPending || submitDraftMutation.isPending ? "جارٍ الفحص والإرسال..." : "فحص وإرسال للمراجعة"}</Text>
          <IconSymbol name="arrow.up.circle.fill" size={21} color="#FFFFFF" />
        </Pressable>
        <Text style={[styles.notice, { color: colors.muted }]}>لا يتم نشر الإعلان إذا احتوى على أسلحة أو مواد خطرة أو محتوى إباحي أو تحريض أو احتيال أو عروض مضللة.</Text>
      </ScrollView>
      <Modal visible={previewVisible} animationType="slide" transparent onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewBackdrop}>
          <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>معاينة الإعلان</Text>
            <Text style={[styles.previewHint, { color: colors.muted }]}>راجع التفاصيل والصورة الرئيسية قبل بدء الفحص والإرسال للمراجعة.</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {previewPhotos[0] && <Image source={{ uri: previewPhotos[0] }} style={styles.previewImage} />}
              <Text style={[styles.previewCategory, { color: colors.primary }]}>{category}</Text>
              <Text style={[styles.previewListingTitle, { color: colors.foreground }]}>{title}</Text>
              <Text style={[styles.previewPrice, { color: colors.primary }]}>{price} ر.ع</Text>
              <Text style={[styles.previewMeta, { color: colors.muted }]}>الموقع: {location}</Text>
              <Text style={[styles.previewDescription, { color: colors.foreground }]}>{description}</Text>
              <Text style={[styles.previewMeta, { color: colors.muted }]}>للتواصل: {phone}</Text>
              <Text style={[styles.previewPhotoCount, { color: colors.muted }]}>{previewPhotos.length} صورة مرفقة</Text>
            </ScrollView>
            <View style={styles.previewActions}>
              <Pressable onPress={() => setPreviewVisible(false)} style={[styles.previewEditButton, { borderColor: colors.border }]}><Text style={[styles.previewEditText, { color: colors.foreground }]}>تعديل</Text></Pressable>
              <Pressable onPress={submitAfterPreview} style={[styles.previewConfirmButton, { backgroundColor: colors.primary }]}><Text style={styles.previewConfirmText}>تأكيد وفحص الإعلان</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34 },
  title: { fontSize: 28, fontWeight: "900", marginTop: 14, textAlign: "right" },
  subtitle: { fontSize: 14, marginTop: 5, marginBottom: 20, textAlign: "right" },
  stepsRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 4 },
  stepPill: { alignItems: "center", borderRadius: 999, flex: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: 8 },
  stepActiveText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  stepText: { fontSize: 12, fontWeight: "800" },
  photoBox: { alignItems: "center", borderRadius: 18, borderStyle: "dashed", borderWidth: 1.5, justifyContent: "center", minHeight: 145, padding: 18 },
  photoTitle: { fontSize: 16, fontWeight: "800", marginTop: 9 },
  photoHint: { fontSize: 12, marginTop: 5, textAlign: "center" },
  label: { fontSize: 14, fontWeight: "800", marginBottom: 8, marginTop: 18, textAlign: "right" },
  selector: { alignItems: "center", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", minHeight: 50, paddingHorizontal: 14 },
  placeholder: { fontSize: 14 },
  input: { borderRadius: 13, borderWidth: 1, fontSize: 14, minHeight: 50, paddingHorizontal: 14 },
  textarea: { borderRadius: 13, borderWidth: 1, fontSize: 14, minHeight: 125, padding: 14 },
  publish: { alignItems: "center", borderRadius: 15, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginTop: 26, minHeight: 54 },
  publishText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  notice: { fontSize: 12, lineHeight: 19, marginTop: 12, textAlign: "right" },
  previewBackdrop: { backgroundColor: "rgba(18, 61, 51, 0.58)", flex: 1, justifyContent: "flex-end" },
  previewCard: { borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "88%", padding: 20 },
  previewTitle: { fontSize: 24, fontWeight: "900", textAlign: "right" },
  previewHint: { fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: "right" },
  previewImage: { borderRadius: 16, height: 190, marginTop: 16, width: "100%" },
  previewCategory: { fontSize: 13, fontWeight: "800", marginTop: 14, textAlign: "right" },
  previewListingTitle: { fontSize: 21, fontWeight: "900", marginTop: 6, textAlign: "right" },
  previewPrice: { fontSize: 19, fontWeight: "900", marginTop: 10, textAlign: "right" },
  previewMeta: { fontSize: 13, marginTop: 8, textAlign: "right" },
  previewDescription: { fontSize: 15, lineHeight: 24, marginTop: 16, textAlign: "right" },
  previewPhotoCount: { fontSize: 12, marginTop: 12, textAlign: "right" },
  previewActions: { flexDirection: "row-reverse", gap: 10, marginTop: 18 },
  previewEditButton: { alignItems: "center", borderRadius: 13, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 52 },
  previewEditText: { fontSize: 15, fontWeight: "800" },
  previewConfirmButton: { alignItems: "center", borderRadius: 13, flex: 2, justifyContent: "center", minHeight: 52 },
  previewConfirmText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
});
