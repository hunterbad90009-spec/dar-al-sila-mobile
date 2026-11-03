import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Image, Linking, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { prepareImageDataUrl } from "@/lib/prepare-image-data-url";
import { trpc } from "@/lib/trpc";
import { router, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { replacePhotoAtIndex } from "@/lib/photo-replacement";

type PhotoStatus = "approved" | "rejected" | "review";
type CropRect = { x: number; y: number; width: number; height: number };
type ImageDimensions = { width: number; height: number };


export default function ImageUploadScreen() {
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { category, replaceIndex, draftPublicId } = useLocalSearchParams<{ category?: string; replaceIndex?: string; draftPublicId?: string }>();
  const replacingIndex = replaceIndex !== undefined ? Number(replaceIndex) : null;
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoStatuses, setPhotoStatuses] = useState<Record<number, PhotoStatus>>({});
  const [photoReasons, setPhotoReasons] = useState<Record<number, string>>({});
  const [rejectionCounts, setRejectionCounts] = useState<Record<number, number>>({});
  const [mediaLinks, setMediaLinks] = useState<Record<number, string>>({});
  const [hidePlate, setHidePlate] = useState(false);
  const storageScope = (draftPublicId ?? category ?? "new").trim().replace(/[^\p{L}\p{N}_-]+/gu, "-") || "new";
  const storageKeys = useMemo(() => ({
    photos: `dar_al_sila_pending_listing_photos:${storageScope}`,
    statuses: `dar_al_sila_photo_statuses:${storageScope}`,
    reasons: `dar_al_sila_photo_reasons:${storageScope}`,
    counts: `dar_al_sila_photo_rejection_counts:${storageScope}`,
    links: `dar_al_sila_media_links:${storageScope}`,
    meta: `dar_al_sila_draft_meta:${storageScope}`,
  }), [storageScope]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDimensions, setEditDimensions] = useState<ImageDimensions | null>(null);
  const [editorSize, setEditorSize] = useState({ width: 0, height: 0 });
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const cropRectRef = useRef<CropRect | null>(null);
  const gestureStartRef = useRef<CropRect | null>(null);
  const createDraftMutation = trpc.listings.createDraft.useMutation();
  const uploadDraftMedia = trpc.media.uploadForDraft.useMutation();
  const detachMedia = trpc.media.detachFromDraft.useMutation();

  const ensureDraftForPhotos = async () => {
    if (!isAuthenticated) return null;
    const existingValue = await AsyncStorage.getItem(storageKeys.meta);
    if (existingValue) {
      const existing = JSON.parse(existingValue) as { publicId?: string; version?: number };
      if (existing.publicId) return existing;
    }
    const publicId = `AD-DRAFT-${Date.now().toString(36).toUpperCase()}`;
    const created = await createDraftMutation.mutateAsync({ publicId, category: category ?? "غير محدد", location: "مسقط" });
    const meta = { publicId: created.publicId, version: created.version };
    await AsyncStorage.setItem(storageKeys.meta, JSON.stringify(meta));
    return meta;
  };

  useEffect(() => {
    setPhotos([]);
    setPhotoStatuses({});
    setPhotoReasons({});
    setRejectionCounts({});
    setMediaLinks({});
    AsyncStorage.multiGet(Object.values(storageKeys))
      .then(([photosEntry, statusesEntry, reasonsEntry, countsEntry, linksEntry]) => {
        if (photosEntry[1]) setPhotos(JSON.parse(photosEntry[1]));
        if (statusesEntry[1]) setPhotoStatuses(JSON.parse(statusesEntry[1]));
        if (reasonsEntry[1]) setPhotoReasons(JSON.parse(reasonsEntry[1]));
        if (countsEntry[1]) setRejectionCounts(JSON.parse(countsEntry[1]));
        if (linksEntry[1]) setMediaLinks(JSON.parse(linksEntry[1]));
      })
      .catch(() => undefined);
  }, [storageKeys]);

  const addPhotos = async () => {
    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, 30 - photos.length),
        quality: 0.85,
      });
      if (!result.canceled) {
        const selected = result.assets.map((asset) => asset.uri);
        try { await ensureDraftForPhotos(); } catch { /* keep local recovery available if server draft creation is unavailable */ }
        setPhotos((current) => {
          if (replacingIndex !== null && Number.isInteger(replacingIndex) && replacingIndex >= 0 && replacingIndex < current.length) {
            return replacePhotoAtIndex(current, replacingIndex, selected[0]);
          }
          return [...current, ...selected].slice(0, 30);
        });
        if (replacingIndex !== null) {
          setPhotoStatuses((current) => {
            const next = { ...current };
            delete next[replacingIndex];
            return next;
          });
          setPhotoReasons((current) => {
            const next = { ...current };
            delete next[replacingIndex];
            return next;
          });
          setRejectionCounts((current) => {
            const next = { ...current };
            delete next[replacingIndex];
            return next;
          });
        }
      }
    } catch {
      Alert.alert("تعذر اختيار الصور", "حاول مرة أخرى أو تحقق من صلاحية الوصول إلى الصور.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextState) => {
      if (nextState !== "active") return;
      const pending = await ImagePicker.getPendingResultAsync();
      if (pending && "canceled" in pending && !pending.canceled) setPhotos((current) => [...current, ...pending.assets.map((asset) => asset.uri)].slice(0, 30));
    });
    return () => subscription.remove();
  }, []);

  const editorSizeRef = useRef(editorSize);
  editorSizeRef.current = editorSize;
  const editDimensionsRef = useRef<ImageDimensions | null>(editDimensions);
  editDimensionsRef.current = editDimensions;
  cropRectRef.current = cropRect;

  const getImageBounds = (dimensions: ImageDimensions, size: { width: number; height: number }) => {
    const scale = Math.min(size.width / dimensions.width, size.height / dimensions.height);
    const width = dimensions.width * scale;
    const height = dimensions.height * scale;
    return { x: (size.width - width) / 2, y: (size.height - height) / 2, width, height };
  };

  const clampCrop = (rect: CropRect) => {
    const dimensions = editDimensionsRef.current;
    const size = editorSizeRef.current;
    if (!dimensions || !size.width || !size.height) return rect;
    const bounds = getImageBounds(dimensions, size);
    const width = Math.max(70, Math.min(rect.width, bounds.width));
    const height = Math.max(70, Math.min(rect.height, bounds.height));
    return {
      x: Math.max(bounds.x, Math.min(rect.x, bounds.x + bounds.width - width)),
      y: Math.max(bounds.y, Math.min(rect.y, bounds.y + bounds.height - height)),
      width,
      height,
    };
  };

  const createDefaultCrop = (dimensions: ImageDimensions, size: { width: number; height: number }) => {
    const bounds = getImageBounds(dimensions, size);
    const width = bounds.width * 0.82;
    const height = bounds.height * 0.82;
    return { x: bounds.x + (bounds.width - width) / 2, y: bounds.y + (bounds.height - height) / 2, width, height };
  };

  const openEditor = (index: number) => {
    const uri = photos[index];
    if (!uri) return;
    Image.getSize(uri, (width, height) => {
      setEditDimensions({ width, height });
      setCropRect(editorSize.width ? createDefaultCrop({ width, height }, editorSize) : null);
      setEditingIndex(index);
    }, () => Alert.alert("تعذر تعديل الصورة", "لم نتمكن من قراءة أبعاد الصورة."));
  };

  const onEditorLayout = (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const size = event.nativeEvent.layout;
    setEditorSize(size);
    if (editDimensionsRef.current && !cropRectRef.current) setCropRect(createDefaultCrop(editDimensionsRef.current, size));
  };

  const cropPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { gestureStartRef.current = cropRectRef.current; },
    onPanResponderMove: (_, gesture) => {
      const start = gestureStartRef.current;
      if (!start) return;
      setCropRect(clampCrop({ ...start, x: start.x + gesture.dx, y: start.y + gesture.dy }));
    },
    onPanResponderRelease: () => { gestureStartRef.current = null; },
  })).current;

  const resizePanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { gestureStartRef.current = cropRectRef.current; },
    onPanResponderMove: (_, gesture) => {
      const start = gestureStartRef.current;
      if (!start) return;
      setCropRect(clampCrop({ ...start, width: start.width + gesture.dx, height: start.height + gesture.dy }));
    },
    onPanResponderRelease: () => { gestureStartRef.current = null; },
  })).current;

  const applyEdit = async () => {
    if (editingIndex === null || !photos[editingIndex] || !editDimensions) return;
    setEditBusy(true);
    try {
      const bounds = getImageBounds(editDimensions, editorSize);
      const selected = cropRect ?? createDefaultCrop(editDimensions, editorSize);
      const scaleX = editDimensions.width / bounds.width;
      const scaleY = editDimensions.height / bounds.height;
      const originX = Math.max(0, Math.round((selected.x - bounds.x) * scaleX));
      const originY = Math.max(0, Math.round((selected.y - bounds.y) * scaleY));
      const cropWidth = Math.max(1, Math.min(editDimensions.width - originX, Math.round(selected.width * scaleX)));
      const cropHeight = Math.max(1, Math.min(editDimensions.height - originY, Math.round(selected.height * scaleY)));
      const result = await ImageManipulator.manipulateAsync(photos[editingIndex], [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }, { resize: { width: 1200 } }], { compress: 0.84, format: ImageManipulator.SaveFormat.JPEG });
      setPhotos((current) => replacePhotoAtIndex(current, editingIndex, result.uri));
      setPhotoStatuses((current) => { const next = { ...current }; delete next[editingIndex]; return next; });
      setPhotoReasons((current) => { const next = { ...current }; delete next[editingIndex]; return next; });
      setEditingIndex(null);
      setCropRect(null);
      setEditDimensions(null);
    } catch {
      Alert.alert("تعذر تعديل الصورة", "لم يتم قص الصورة. حرّك إطار القص وحاول مرة أخرى.");
    } finally {
      setEditBusy(false);
    }
  };

  const deletePhoto = async (index: number) => {
    const linkId = mediaLinks[index];
    if (linkId) {
      try { await detachMedia.mutateAsync({ listingMediaId: linkId }); }
      catch { Alert.alert("تعذر حذف الصورة", "لم يتم حذف الرابط الخادمي. حاول مرة أخرى."); return; }
    }
    const nextPhotos = photos.filter((_, photoIndex) => photoIndex !== index);
    const reindex = <T,>(source: Record<number, T>) => Object.entries(source).reduce<Record<number, T>>((next, [key, value]) => {
      const photoIndex = Number(key);
      if (photoIndex < index) next[photoIndex] = value;
      if (photoIndex > index) next[photoIndex - 1] = value;
      return next;
    }, {});
    const nextStatuses = reindex(photoStatuses);
    const nextReasons = reindex(photoReasons);
    const nextCounts = reindex(rejectionCounts);
    setPhotos(nextPhotos);
    setPhotoStatuses(nextStatuses);
    setPhotoReasons(nextReasons);
    const nextLinks = reindex(mediaLinks);
    setRejectionCounts(nextCounts);
    setMediaLinks(nextLinks);
    setEditingIndex((current) => current === index ? null : current !== null && current > index ? current - 1 : current);
    void AsyncStorage.multiSet([
      [storageKeys.photos, JSON.stringify(nextPhotos)],
      [storageKeys.statuses, JSON.stringify(nextStatuses)],
      [storageKeys.reasons, JSON.stringify(nextReasons)],
      [storageKeys.counts, JSON.stringify(nextCounts)],
      [storageKeys.links, JSON.stringify(nextLinks)],
    ]);
  };

  const persistPhotoState = async (statuses = photoStatuses, reasons = photoReasons, links = mediaLinks) => {
    await AsyncStorage.multiSet([
      [storageKeys.photos, JSON.stringify(photos)],
      [storageKeys.statuses, JSON.stringify(statuses)],
      [storageKeys.reasons, JSON.stringify(reasons)],
      [storageKeys.counts, JSON.stringify(rejectionCounts)],
      [storageKeys.links, JSON.stringify(links)],
    ]);
  };

  const syncDraftMedia = async () => {
    if (!isAuthenticated || !photos.length) return;
    try {
      let publicId = draftPublicId;
      if (!publicId) {
        const meta = await ensureDraftForPhotos();
        publicId = meta?.publicId;
      }
      if (!publicId) return;
      const nextStatuses = { ...photoStatuses };
      const nextReasons = { ...photoReasons };
      const nextLinks = { ...mediaLinks };
      for (let index = 0; index < photos.length; index += 1) {
        if (nextStatuses[index] === "approved" && nextLinks[index]) continue;
        const dataUrl = await prepareImageDataUrl(photos[index]);
        const result = await uploadDraftMedia.mutateAsync({ publicId, dataUrl });
        if (result.status === "approved") { nextStatuses[index] = "approved"; delete nextReasons[index]; if (result.listingMediaId) nextLinks[index] = result.listingMediaId; }
        else { nextStatuses[index] = result.status === "rejected" ? "rejected" : "review"; nextReasons[index] = result.reason; }
      }
      setPhotoStatuses(nextStatuses); setPhotoReasons(nextReasons); setMediaLinks(nextLinks);
      await persistPhotoState(nextStatuses, nextReasons, nextLinks);
    } catch {
      await AsyncStorage.setItem("dar_al_sila_media_sync_state", "error");
    }
  };

  const next = async () => {
    if (!photos.length) {
      Alert.alert("أضف صورة أولًا", "اختر صورة واحدة على الأقل قبل الانتقال إلى بيانات الإعلان.");
      return;
    }
    if (authLoading) {
      Alert.alert("جارٍ التحقق", "انتظر لحظة حتى نتحقق من تسجيل الدخول.");
      return;
    }
    const draft = await ensureDraftForPhotos().catch(() => null);
    await persistPhotoState();
    await AsyncStorage.setItem("dar_al_sila_media_sync_state", isAuthenticated ? "pending" : "login_required");
    router.push({ pathname: "/(tabs)/post", params: { category: category ?? "غير محدد", photosCount: String(photos.length), hidePlate: hidePlate ? "true" : "false", draftPublicId: draft?.publicId } });
    if (isAuthenticated) void syncDraftMedia();
  };

  return <ScreenContainer className="px-4"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.topBar}><Pressable onPress={() => router.back()}><IconSymbol name="xmark" size={30} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>أضف صور للإعلان</Text><Pressable onPress={() => router.back()}><IconSymbol name="chevron.right" size={29} color={colors.foreground} /></Pressable></View><Text style={[styles.subtitle, { color: colors.muted }]}>الفئة: {category ?? "غير محدد"}</Text><View style={[styles.info, { backgroundColor: "#EAF4FF", borderColor: "#B7D8FF" }]}><IconSymbol name="info.circle.fill" size={25} color="#1686E8" /><View style={styles.infoCopy}><Text style={styles.infoTitle}>أضف حتى 30 صورة</Text><Text style={styles.infoText}>الصور الواضحة تزيد المشاهدات. اجعل الصورة الأولى أفضل صورة للإعلان.</Text></View></View><Pressable onPress={() => setHidePlate((value) => !value)} style={styles.checkboxRow}><View style={[styles.checkbox, hidePlate && { backgroundColor: colors.primary, borderColor: colors.primary }]}>{hidePlate && <IconSymbol name="checkmark" size={16} color="#FFFFFF" />}</View><Text style={[styles.checkboxText, { color: colors.foreground }]}>إخفاء رقم اللوحة</Text></Pressable><Pressable onPress={photos[0] ? () => openEditor(0) : addPhotos} style={[styles.featuredUpload, { backgroundColor: colors.surface, borderColor: photos[0] ? colors.primary : colors.border }]}>{photos[0] ? <><Image source={{ uri: photos[0] }} resizeMode="cover" style={styles.featuredImage} /><View pointerEvents="none" style={styles.featuredShade} /><View pointerEvents="none" style={styles.featuredCaption}><Text style={styles.featuredTitle}>الصورة الرئيسية</Text><Text style={styles.featuredHint}>اضغط على الصورة للقص والتعديل</Text></View><View style={styles.featuredActions}><Pressable accessibilityLabel="تعديل الصورة الرئيسية" onPress={() => openEditor(0)} style={[styles.actionButton, styles.editButton]}><Text style={styles.actionText}>تعديل</Text></Pressable><Pressable accessibilityLabel="حذف الصورة الرئيسية" onPress={() => deletePhoto(0)} style={[styles.actionButton, styles.deleteButton]}><Text style={styles.actionText}>حذف</Text></Pressable></View></> : <><IconSymbol name="camera.fill" size={34} color={colors.primary} /><Text style={[styles.uploadTitle, { color: colors.foreground }]}>أضف صور الإعلان</Text><Text style={[styles.uploadHint, { color: colors.muted }]}>اضغط هنا لاختيار الصور من جهازك</Text></>}</Pressable><View style={styles.photoGrid}>{Array.from({ length: 9 }).map((_, index) => { const uri = photos[index]; const status = photoStatuses[index]; const reason = photoReasons[index]; const rejectionCount = rejectionCounts[index] ?? 0; const needsReplacement = status === "rejected" || status === "review"; return <Pressable key={index} onPress={uri ? () => openEditor(index) : addPhotos} style={[styles.photoSlot, { backgroundColor: colors.surface, borderColor: needsReplacement ? "#D94A4A" : colors.border }]}>{uri ? <><Image source={{ uri }} style={styles.photo} /><View style={styles.photoActions}><Pressable accessibilityLabel={`تعديل الصورة ${index + 1}`} onPress={() => openEditor(index)} style={[styles.actionButton, styles.editButton]}><Text style={styles.actionText}>تعديل</Text></Pressable><Pressable accessibilityLabel={`حذف الصورة ${index + 1}`} onPress={() => deletePhoto(index)} style={[styles.actionButton, styles.deleteButton]}><Text style={styles.actionText}>حذف</Text></Pressable></View></> : <><IconSymbol name="camera.fill" size={28} color={colors.primary} /><IconSymbol name="plus.circle.fill" size={17} color={colors.primary} /></>}{needsReplacement && <View pointerEvents="none" style={styles.replaceBadge}><Text style={styles.replaceText}>{status === "rejected" ? "مرفوضة — اضغط للاستبدال" : "غير واضحة — اضغط للاستبدال"}</Text>{reason && <Text style={styles.reasonText}>{reason}</Text>}<Text style={styles.fixHint}>عدّل الصورة أو اختر بديلًا ثم أعد الفحص.</Text>{rejectionCount >= 3 && <Pressable onPress={() => Linking.openURL("mailto:support@daralsila.om?subject=مساعدة في فحص صورة الإعلان").catch(() => Alert.alert("تواصل مع الدعم", "أرسل رسالة إلى support@daralsila.om مع ذكر رقم الصورة وسبب الرفض."))} style={styles.supportButton}><Text style={styles.supportText}>تواصل مع الدعم الفني</Text></Pressable>}</View>}{status === "approved" && <Text pointerEvents="none" style={styles.approvedBadge}>تم الفحص</Text>}{index === 0 && <Text style={[styles.mainLabel, { color: colors.foreground }]}>الرئيسية</Text>}</Pressable>; })}</View><Text style={[styles.count, { color: colors.muted }]}>{photos.length} من 30 صورة</Text><Pressable disabled={!photos.length || loading} onPress={next} style={[styles.next, { backgroundColor: photos.length && !loading ? "#1686E8" : colors.border }]}><Text style={styles.nextText}>{loading ? "جارٍ فتح الصور..." : "التالي"}</Text><IconSymbol name="chevron.left" size={22} color="#FFFFFF" /></Pressable></ScrollView><Modal visible={editingIndex !== null} transparent animationType="slide" onRequestClose={() => !editBusy && setEditingIndex(null)}><View style={styles.modalBackdrop}><View style={[styles.editorCard, { backgroundColor: colors.surface }]}><Text style={[styles.editorTitle, { color: colors.foreground }]}>تعديل الصورة</Text><Text style={[styles.editorHint, { color: colors.muted }]}>حرّك الإطار داخل الصورة، واسحب الزاوية لتحديد الجزء الذي تريد الاحتفاظ به.</Text><View style={styles.editorCanvas} onLayout={onEditorLayout}>{editingIndex !== null && photos[editingIndex] && <Image source={{ uri: photos[editingIndex] }} resizeMode="contain" style={styles.editorImage} />}{cropRect && <><View {...cropPanResponder.panHandlers} style={[styles.cropFrame, { left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height }]}><View style={styles.cropGridVertical} /><View style={styles.cropGridHorizontal} /><View {...resizePanResponder.panHandlers} style={styles.cropHandle}><Text style={styles.cropHandleText}>↘</Text></View></View></>}</View><View style={styles.editorActions}><Pressable disabled={editBusy} onPress={() => setEditingIndex(null)} style={[styles.cancelButton, { borderColor: colors.border }]}><Text style={{ color: colors.foreground, fontWeight: "800" }}>إلغاء</Text></Pressable><Pressable disabled={editBusy} onPress={applyEdit} style={[styles.saveEditButton, { backgroundColor: colors.primary }]}><Text style={{ color: "#FFFFFF", fontWeight: "900" }}>{editBusy ? "جارٍ التعديل..." : "حفظ وإعادة الفحص"}</Text></Pressable></View></View></View></Modal></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 35 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 9 }, topTitle: { flex: 1, fontSize: 22, fontWeight: "900", marginHorizontal: 10, textAlign: "center" }, subtitle: { fontSize: 13, marginTop: 14, textAlign: "right" }, info: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 18, padding: 14 }, infoCopy: { flex: 1 }, infoTitle: { color: "#126AC1", fontSize: 16, fontWeight: "900", textAlign: "right" }, infoText: { color: "#3D6386", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" }, checkboxRow: { alignItems: "center", flexDirection: "row-reverse", gap: 9, marginTop: 18 }, checkbox: { alignItems: "center", borderColor: "#9BA1A6", borderRadius: 5, borderWidth: 1.5, height: 24, justifyContent: "center", width: 24 }, checkboxText: { fontSize: 14, fontWeight: "700" }, featuredUpload: { borderRadius: 18, borderStyle: "dashed", borderWidth: 1.5, height: 190, marginTop: 18, overflow: "hidden", position: "relative", width: "100%" }, featuredImage: { height: "100%", width: "100%" }, featuredShade: { backgroundColor: "rgba(0,0,0,0.28)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }, featuredCaption: { bottom: 13, left: 14, position: "absolute", right: 14 }, featuredTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", textAlign: "right" }, featuredHint: { color: "#FFFFFF", fontSize: 12, marginTop: 3, textAlign: "right" }, featuredActions: { flexDirection: "row", gap: 6, left: 8, position: "absolute", top: 8, zIndex: 30 }, uploadTitle: { fontSize: 17, fontWeight: "900", marginTop: 9 }, uploadHint: { fontSize: 12, marginTop: 4 }, photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 }, photoSlot: { alignItems: "center", borderRadius: 13, borderStyle: "dashed", borderWidth: 1.5, height: 96, justifyContent: "center", overflow: "hidden", position: "relative", width: "31.8%" }, photo: { height: "100%", width: "100%" }, photoActions: { flexDirection: "row", gap: 5, left: 4, position: "absolute", right: 4, top: 4, zIndex: 30, elevation: 8 }, actionButton: { borderRadius: 7, minWidth: 39, paddingHorizontal: 6, paddingVertical: 5, zIndex: 31 }, editButton: { backgroundColor: "rgba(11, 74, 59, 0.92)" }, deleteButton: { backgroundColor: "rgba(185, 76, 69, 0.95)" }, actionText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", textAlign: "center" }, replaceBadge: { backgroundColor: "rgba(150, 24, 24, 0.9)", bottom: 4, left: 4, paddingHorizontal: 5, paddingVertical: 3, position: "absolute", right: 4 }, replaceText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", textAlign: "center" }, reasonText: { color: "#FFF4D6", fontSize: 9, lineHeight: 13, marginTop: 3, textAlign: "right" }, fixHint: { color: "#FFFFFF", fontSize: 8, lineHeight: 12, marginTop: 3, textAlign: "right" }, supportButton: { alignItems: "center", backgroundColor: "#D9A441", borderRadius: 8, marginTop: 6, paddingHorizontal: 7, paddingVertical: 6 }, supportText: { color: "#1B241D", fontSize: 10, fontWeight: "900" }, approvedBadge: { backgroundColor: "rgba(13, 112, 61, 0.9)", bottom: 4, color: "#FFFFFF", fontSize: 9, fontWeight: "900", left: 4, paddingHorizontal: 5, paddingVertical: 3, position: "absolute", right: 4, textAlign: "center" }, mainLabel: { backgroundColor: "rgba(255,255,255,0.9)", bottom: 5, fontSize: 10, fontWeight: "900", paddingHorizontal: 5, position: "absolute" }, count: { fontSize: 12, marginTop: 12, textAlign: "right" }, next: { alignItems: "center", borderRadius: 15, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginTop: 24, minHeight: 56 }, nextText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" }, modalBackdrop: { backgroundColor: "rgba(0,0,0,0.58)", flex: 1, justifyContent: "flex-end" }, editorCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }, editorTitle: { fontSize: 22, fontWeight: "900", textAlign: "right" }, editorHint: { fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: "right" }, editorCanvas: { alignItems: "center", backgroundColor: "#101512", borderRadius: 16, height: 300, justifyContent: "center", marginTop: 16, overflow: "hidden", position: "relative", width: "100%" }, editorImage: { height: "100%", width: "100%" }, cropFrame: { borderColor: "#FFFFFF", borderWidth: 2, position: "absolute" }, cropGridVertical: { borderColor: "#FFFFFF88", borderLeftWidth: 1, borderRightWidth: 1, bottom: 0, left: "33.33%", position: "absolute", top: 0, width: "33.33%" }, cropGridHorizontal: { borderBottomWidth: 1, borderColor: "#FFFFFF88", borderTopWidth: 1, left: 0, position: "absolute", right: 0, top: "33.33%", height: "33.33%" }, cropHandle: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, bottom: -12, height: 24, justifyContent: "center", position: "absolute", right: -12, width: 24 }, cropHandleText: { color: "#123D2B", fontSize: 16, fontWeight: "900" }, editorActions: { flexDirection: "row-reverse", gap: 10, marginTop: 22 }, cancelButton: { alignItems: "center", borderRadius: 13, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 50 }, saveEditButton: { alignItems: "center", borderRadius: 13, flex: 2, justifyContent: "center", minHeight: 50 } });
