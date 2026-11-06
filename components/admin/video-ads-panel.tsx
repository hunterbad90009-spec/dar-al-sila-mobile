import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Linking, Switch, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Button, Card, EmptyState, ErrorState, Field, Input, Loading, notify } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { formatDate, formatNumber, t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";
import {
  type AdminVideoAd, type PickedVideo, type VideoAdState, AD_VIDEO_MAX_BYTES,
  adminDeleteVideoAd, adminSaveVideoAd, adminSetVideoAdActive, adminVideoAds, toMuscatDay,
} from "@/lib/video-ads";

const STATE: Record<VideoAdState, { label: string; tone: "success" | "warning" | "muted" | "error" }> = {
  live: { label: "يعمل الآن", tone: "success" },
  scheduled: { label: "لم يبدأ بعد", tone: "warning" },
  ended: { label: "منتهٍ", tone: "muted" },
  paused: { label: "موقوف", tone: "warning" },
  unpaid: { label: "بانتظار تأكيد الدفع", tone: "error" },
};

type Draft = {
  id?: string; previousPath?: string; companyName: string; contact: string; startDay: string; endDay: string;
  isActive: boolean; paymentConfirmed: boolean; amountOmr: string; paymentNote: string; video: PickedVideo | null; videoName: string;
};

const today = () => toMuscatDay(new Date().toISOString());
const plusDays = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const emptyDraft = (): Draft => ({ companyName: "", contact: "", startDay: today(), endDay: plusDays(today(), 29), isActive: true, paymentConfirmed: false, amountOmr: "", paymentNote: "", video: null, videoName: "" });
const draftFrom = (a: AdminVideoAd): Draft => ({
  id: a.id, previousPath: a.videoPath, companyName: a.companyName,
  contact: a.contactUrl?.replace(/^mailto:/, "").replace(/^https:\/\/wa\.me\//, "+") ?? "",
  startDay: toMuscatDay(a.startsAt), endDay: toMuscatDay(a.endsAt, 1), isActive: a.isActive, paymentConfirmed: a.paymentConfirmed,
  amountOmr: a.amountOmr === null ? "" : String(a.amountOmr), paymentNote: a.paymentNote, video: null, videoName: "",
});

/** Admin: paid video ads for the home banner (company pays outside the app, admin confirms and uploads). */
export function VideoAdsPanel() {
  const colors = useColors();
  const client = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "video-ads"], queryFn: adminVideoAds });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const refresh = () => { void client.invalidateQueries({ queryKey: ["admin", "video-ads"] }); void client.invalidateQueries({ queryKey: ["video-ads"] }); };

  const save = useMutation({
    mutationFn: (d: Draft) => adminSaveVideoAd(d, d.previousPath),
    onSuccess: (_, d) => {
      setDraft(null);
      refresh();
      if (!d.paymentConfirmed) notify(t("حُفظ الإعلان لكنه لن يظهر"), t("لن يظهر الفيديو في الصفحة الرئيسية حتى تؤكد «تم استلام المبلغ»."));
      else if (!d.isActive) notify(t("حُفظ الإعلان لكنه لن يظهر"), t("الإعلان موقوف. فعّله ليظهر في الصفحة الرئيسية."));
      else notify(t("تم حفظ إعلان الفيديو"));
    },
    onError: (e) => notify(t("تعذر حفظ الإعلان"), e instanceof Error ? e.message : t("حاول مرة أخرى.")),
  });
  const toggle = useMutation({ mutationFn: (a: AdminVideoAd) => adminSetVideoAdActive(a.id, !a.isActive), onSuccess: refresh, onError: () => notify(t("تعذر تنفيذ الإجراء")) });
  const remove = useMutation({ mutationFn: adminDeleteVideoAd, onSuccess: () => { setConfirmDelete(null); refresh(); notify(t("تم حذف الإعلان")); }, onError: () => notify(t("تعذر حذف الإعلان")) });

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    if (a.fileSize && a.fileSize > AD_VIDEO_MAX_BYTES) { notify(t("الفيديو كبير جدًا"), t("حجم الفيديو أكبر من 50 ميجابايت. اضغطه أو قصّره ثم حاول مرة أخرى.")); return; }
    const sizeMb = a.fileSize ? ` · ${(a.fileSize / 1024 / 1024).toFixed(1)} MB` : "";
    const secs = a.duration ? ` · ${Math.round(a.duration / 1000)}s` : "";
    setDraft((d) => d && ({ ...d, video: { uri: a.uri, mimeType: a.mimeType, fileSize: a.fileSize, file: (a as { file?: Blob }).file ?? null }, videoName: `${a.fileName ?? t("فيديو")}${sizeMb}${secs}` }));
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => d && ({ ...d, [k]: v }));

  if (draft) {
    return (
      <Card>
        <Text style={[styles.title, { color: colors.foreground }]}>{draft.id ? t("تعديل إعلان الفيديو") : t("إعلان فيديو جديد")}</Text>
        <Field label={t("اسم الشركة")} required><Input value={draft.companyName} onChangeText={(v) => set("companyName", v)} maxLength={80} /></Field>
        <Field label={t("رابط التواصل")} hint={t("رقم واتساب (مثل 9xxxxxxx) أو بريد إلكتروني أو رابط موقع. يُفتح عند الضغط على الإعلان.")}>
          <Input value={draft.contact} onChangeText={(v) => set("contact", v)} autoCapitalize="none" />
        </Field>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}><Field label={t("تاريخ البداية")} required><Input value={draft.startDay} onChangeText={(v) => set("startDay", v)} placeholder="2026-11-07" autoCapitalize="none" /></Field></View>
          <View style={{ flex: 1 }}><Field label={t("تاريخ النهاية")} required><Input value={draft.endDay} onChangeText={(v) => set("endDay", v)} placeholder="2026-12-06" autoCapitalize="none" /></Field></View>
        </View>
        <Text style={[styles.meta, { color: colors.muted }]}>{t("يعمل الإعلان من بداية يوم البداية حتى نهاية يوم النهاية بتوقيت مسقط.")}</Text>

        <Field label={draft.id ? t("استبدال الفيديو") : t("الفيديو")} required={!draft.id} hint={t("MP4 أو MOV أو WebM، حتى 50 ميجابايت. يفضَّل فيديو أفقي قصير (10–30 ثانية).")}>
          <Button variant="outline" icon="video-library" label={draft.videoName || (draft.id ? t("اختر فيديو جديدًا (اختياري)") : t("اختر الفيديو"))} onPress={pickVideo} />
        </Field>

        <View style={[styles.switchRow, { borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.foreground }]}>{t("تم استلام المبلغ")}</Text>
            <Text style={[styles.meta, { color: draft.paymentConfirmed ? colors.muted : colors.error }]}>{t("لا يظهر الإعلان قبل تأكيد الدفع.")}</Text>
          </View>
          <Switch value={draft.paymentConfirmed} onValueChange={(v) => set("paymentConfirmed", v)} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}><Field label={t("المبلغ (ر.ع.)")}><Input value={draft.amountOmr} onChangeText={(v) => set("amountOmr", v)} keyboardType="decimal-pad" /></Field></View>
          <View style={{ flex: 2 }}><Field label={t("ملاحظة الدفع")}><Input value={draft.paymentNote} onChangeText={(v) => set("paymentNote", v)} placeholder={t("مثال: تحويل بنكي رقم…")} maxLength={500} /></Field></View>
        </View>
        <View style={[styles.switchRow, { borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground, flex: 1 }]}>{t("الإعلان مفعّل")}</Text>
          <Switch value={draft.isActive} onValueChange={(v) => set("isActive", v)} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>

        <View style={styles.actions}>
          <Button icon="save" label={save.isPending ? t("جارٍ الرفع والحفظ…") : t("حفظ")} loading={save.isPending} onPress={() => save.mutate(draft)} />
          <Button variant="ghost" label={t("إلغاء")} disabled={save.isPending} onPress={() => setDraft(null)} />
        </View>
      </Card>
    );
  }

  return (
    <>
      <Text style={[styles.meta, { color: colors.muted }]}>{t("تظهر في المستطيل الأخضر بالصفحة الرئيسية. يظهر الإعلان فقط إذا كان مفعّلًا ومدفوعًا وداخل مدته، وإذا وُجد أكثر من إعلان تتبدّل بالدور.")}</Text>
      <Button icon="add" label={t("إعلان فيديو جديد")} onPress={() => setDraft(emptyDraft())} style={{ marginTop: 10 }} />
      {list.isLoading ? <Loading /> : list.isError ? <ErrorState message={list.error instanceof Error ? list.error.message : t("تعذر تحميل البيانات.")} onRetry={() => list.refetch()} /> : !list.data!.length ? (
        <EmptyState icon="smart-display" title={t("لا توجد إعلانات فيديو")} text={t("بعد استلام المبلغ من الشركة أضف إعلانها من الزر أعلاه.")} />
      ) : list.data!.map((a) => {
        const st = STATE[a.state];
        const tone = colors[st.tone];
        return (
          <Card key={a.id} style={styles.item}>
            <View style={styles.head}>
              <MaterialIcons name="smart-display" size={22} color={colors.primary} />
              <Text style={[styles.title, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>{a.companyName}</Text>
              <View style={[styles.pill, { borderColor: tone }]}><Text style={[styles.pillText, { color: tone }]}>{t(st.label)}</Text></View>
            </View>
            <Text style={[styles.meta, { color: colors.muted }]}>{t("من {from} إلى {to}", { from: formatDate(a.startsAt), to: formatDate(toMuscatDay(a.endsAt, 1)) })}</Text>
            {a.contactUrl ? <Text style={[styles.meta, { color: colors.primary }]} numberOfLines={1}>{a.contactUrl}</Text> : null}
            <Text style={[styles.meta, { color: colors.foreground }]}>
              {t("المشاهدات: {v} · النقرات: {c}", { v: formatNumber(a.views), c: formatNumber(a.clicks) })}
              {a.amountOmr !== null ? ` · ${t("المبلغ: {n} ر.ع.", { n: formatNumber(a.amountOmr) })}` : ""}
            </Text>
            {a.paymentNote ? <Text style={[styles.meta, { color: colors.muted }]}>{a.paymentNote}</Text> : null}
            <View style={styles.actions}>
              <Button small icon="edit" label={t("تعديل / استبدال")} onPress={() => setDraft(draftFrom(a))} />
              <Button small variant="outline" icon={a.isActive ? "pause" : "play-arrow"} label={a.isActive ? t("إيقاف") : t("تشغيل")} loading={toggle.isPending && toggle.variables?.id === a.id} onPress={() => toggle.mutate(a)} />
              <Button small variant="ghost" icon="open-in-new" label={t("مشاهدة الفيديو")} onPress={() => void Linking.openURL(a.videoUrl)} />
              {confirmDelete === a.id ? (
                <>
                  <Button small variant="danger" icon="delete-forever" label={t("تأكيد الحذف")} loading={remove.isPending} onPress={() => remove.mutate(a)} />
                  <Button small variant="ghost" label={t("إلغاء")} onPress={() => setConfirmDelete(null)} />
                </>
              ) : <Button small variant="danger" icon="delete" label={t("حذف")} onPress={() => setConfirmDelete(a.id)} />}
            </View>
          </Card>
        );
      })}
    </>
  );
}

const styles = createStyles({
  item: { marginTop: 10 },
  head: { alignItems: "center", flexDirection: "row-reverse", gap: 8 },
  title: { fontSize: 15, fontWeight: "900", textAlign: "right" },
  label: { fontSize: 14, fontWeight: "800", textAlign: "right" },
  meta: { fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: "800" },
  row2: { flexDirection: "row-reverse", gap: 10 },
  switchRow: { alignItems: "center", borderTopWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 14, paddingTop: 12 },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 12 },
});
