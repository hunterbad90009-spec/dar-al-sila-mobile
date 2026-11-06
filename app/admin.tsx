import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { VideoAdsPanel } from "@/components/admin/video-ads-panel";
import { Button, Card, Chip, EmptyState, ErrorState, Field, Header, Input, Loading, StatusPill, notify, useGrid } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import * as data from "@/lib/data";
import { formatDate, formatNumber, pickName, t, timeAgo } from "@/lib/i18n";
import { STORE_TYPES } from "@/lib/store-types";
import { createStyles } from "@/lib/i18n/rtl";

type Section = "overview" | "queue" | "listings" | "users" | "stores" | "categories" | "reports" | "appeals" | "reviews" | "videoAds" | "audit" | "settings";
const SECTIONS: { key: Section; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: "overview", label: "نظرة عامة", icon: "dashboard" },
  { key: "queue", label: "قائمة المراجعة", icon: "fact-check" },
  { key: "listings", label: "الإعلانات", icon: "view-list" },
  { key: "users", label: "المستخدمون والأدوار", icon: "people" },
  { key: "stores", label: "المتاجر", icon: "storefront" },
  { key: "categories", label: "التصنيفات", icon: "category" },
  { key: "reports", label: "البلاغات", icon: "flag" },
  { key: "appeals", label: "الاعتراضات", icon: "gavel" },
  { key: "reviews", label: "تعليقات التقييم", icon: "rate-review" },
  { key: "videoAds", label: "إعلانات الفيديو", icon: "smart-display" },
  { key: "audit", label: "سجل الإجراءات", icon: "history" },
  { key: "settings", label: "إعدادات المنصة", icon: "settings" },
];

const REASON_LABELS: Record<data.ReportReason, string> = {
  fraud: "احتيال أو نصب", misleading: "معلومات مضللة", inappropriate: "محتوى غير لائق", suspicious_seller: "بائع مشبوه",
  prohibited: "منتج ممنوع", abuse: "إساءة أو تحرش", other: "سبب آخر",
};

/**
 * Protected administration area (spec 4.15). The role check here only decides what to
 * show; every read and write is enforced again in the database (is_admin() RLS) and
 * logged to admin_audit_logs by a trigger.
 */
export default function AdminScreen() {
  const colors = useColors();
  const { user, loading } = useAuth();
  const [section, setSection] = useState<Section>("overview");

  if (loading) return <ScreenContainer><Loading /></ScreenContainer>;
  if (user?.role !== "admin") {
    return <ScreenContainer className="px-4"><Header title={t("لوحة المشرف")} /><EmptyState icon="lock" title={t("غير مصرح")} text={t("هذه الصفحة لفريق إدارة دار السلع فقط.")} actionLabel={t("العودة للرئيسية")} onAction={() => router.replace("/(tabs)")} /></ScreenContainer>;
  }

  return <AdminLockGate>{(lock) => (
    <ScreenContainer className="px-4">
      <Header title={t("لوحة المشرف")} subtitle={t("كل إجراء هنا يُسجَّل في سجل الإجراءات")} />
      <Button small variant="ghost" icon="lock" label={t("قفل اللوحة")} onPress={lock} style={{ alignSelf: "flex-start", marginBottom: 6 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ flexGrow: 0 }}>
        {SECTIONS.map((s) => <Chip key={s.key} icon={s.icon} label={t(s.label)} active={section === s.key} onPress={() => setSection(s.key)} />)}
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {section === "overview" && <Overview go={setSection} />}
        {section === "queue" && <ListingsPanel fixedStatus="pending" />}
        {section === "listings" && <ListingsPanel />}
        {section === "users" && <UsersPanel />}
        {section === "stores" && <StoresPanel />}
        {section === "categories" && <CategoriesPanel />}
        {section === "reports" && <ReportsPanel />}
        {section === "appeals" && <AppealsPanel />}
        {section === "reviews" && <ReviewsPanel />}
        {section === "videoAds" && <VideoAdsPanel />}
        {section === "audit" && <AuditPanel />}
        {section === "settings" && <SettingsPanel />}
        <View style={{ height: 30 }} />
      </ScrollView>
    </ScreenContainer>
  )}</AdminLockGate>;
}

/**
 * Password lock in front of the panel. The server enforces it too: while locked,
 * is_admin() is false, so every admin read/write is refused even if this screen is bypassed.
 */
function AdminLockGate({ children }: { children: (lock: () => void) => React.ReactNode }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["admin", "unlock"], queryFn: data.adminUnlockStatus, refetchInterval: 60_000 });
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const until = status.data ? new Date(status.data).getTime() : 0;

  // Re-lock on screen when the 30 minutes run out.
  useEffect(() => {
    if (!until) return;
    const timer = setTimeout(() => queryClient.setQueryData(["admin", "unlock"], null), Math.max(0, until - Date.now()));
    return () => clearTimeout(timer);
  }, [until, queryClient]);

  const unlock = async () => {
    if (!password) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await data.adminUnlock(password);
      setPassword("");
      if (r.ok) {
        queryClient.setQueryData(["admin", "unlock"], r.until);
        queryClient.invalidateQueries({ queryKey: ["admin"], predicate: (q) => q.queryKey[1] !== "unlock" });
      } else if (r.reason === "locked") setMessage(t("محاولات كثيرة خاطئة. حاول بعد 15 دقيقة."));
      else if (r.reason === "not_configured") setMessage(t("لم تُضبط كلمة مرور اللوحة بعد."));
      else if (r.reason === "not_admin") setMessage(t("هذه الصفحة لفريق إدارة دار السلع فقط."));
      else setMessage(t("كلمة المرور غير صحيحة. المحاولات المتبقية: {n}", { n: r.remaining ?? 0 }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("حاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    await data.adminLock();
    queryClient.setQueryData(["admin", "unlock"], null);
    queryClient.removeQueries({ queryKey: ["admin"], predicate: (q) => q.queryKey[1] !== "unlock" });
  };

  if (status.isLoading) return <ScreenContainer><Loading /></ScreenContainer>;
  if (until > Date.now()) return <>{children(lock)}</>;

  return (
    <ScreenContainer className="px-4">
      <Header title={t("لوحة المشرف")} />
      <View style={[styles.lockIcon, { backgroundColor: colors.primary }]}><MaterialIcons name="lock" size={34} color={colors.accent} /></View>
      <Text style={[styles.lockTitle, { color: colors.foreground }]}>{t("اللوحة مقفلة")}</Text>
      <Text style={[styles.lockText, { color: colors.muted }]}>{t("أدخل كلمة مرور لوحة المشرف. تبقى مفتوحة 30 دقيقة ثم تُقفل تلقائيًا.")}</Text>
      <Field label={t("كلمة مرور اللوحة")}><Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} onSubmitEditing={unlock} /></Field>
      {message ? <Text style={[styles.lockError, { color: colors.error }]}>{message}</Text> : null}
      <Button icon="lock-open" label={t("فتح اللوحة")} loading={busy} disabled={!password || busy} onPress={unlock} style={{ marginTop: 14 }} />
    </ScreenContainer>
  );
}

function Overview({ go }: { go: (s: Section) => void }) {
    const colors = useColors();
    const tileGrid = useGrid({ gap: 10, columns: 2 });
    const q = useQuery({ queryKey: ["admin", "overview"], queryFn: data.adminOverview });
    if (q.isLoading) return <Loading />;
    if (q.isError) return <ErrorState message={data.friendlyError(q.error)} onRetry={() => q.refetch()} />;
    const o = q.data!;
    const tiles: { label: string; value: number; section: Section; alert?: boolean }[] = [
      { label: "بانتظار المراجعة", value: o.listings.pending, section: "queue", alert: o.listings.pending > 0 },
      { label: "بلاغات مفتوحة", value: o.reportsOpen, section: "reports", alert: o.reportsOpen > 0 },
      { label: "متاجر بانتظار التفعيل", value: o.stores.pending, section: "stores", alert: o.stores.pending > 0 },
      { label: "إعلانات منشورة", value: o.listings.active, section: "listings" },
      { label: "إعلانات مرفوضة", value: o.listings.rejected, section: "listings" },
      { label: "إعلانات موقوفة", value: o.listings.paused, section: "listings" },
      { label: "المستخدمون", value: o.users, section: "users" },
      { label: "متاجر مفعّلة", value: o.stores.active, section: "stores" },
      { label: "المحادثات", value: o.conversations, section: "overview" },
    ];
    return (
      <View onLayout={tileGrid.onLayout} style={styles.tiles}>
        {tiles.map((tile) => (
          <Pressable key={tile.label} onPress={() => go(tile.section)} style={[styles.tile, { width: tileGrid.itemWidth, backgroundColor: colors.surface, borderColor: tile.alert ? colors.accent : colors.border }]}>
            <Text style={[styles.tileValue, { color: tile.alert ? colors.warning : colors.primary }]}>{formatNumber(tile.value)}</Text>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{t(tile.label)}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

function ListingsPanel({ fixedStatus }: { fixedStatus?: data.DbStatus }) {
    const colors = useColors();
    const client = useQueryClient();
    const [status, setStatus] = useState<data.DbStatus | "all">(fixedStatus ?? "all");
    const [q, setQ] = useState("");
    const [reasons, setReasons] = useState<Record<string, string>>({});
    const list = useQuery({ queryKey: ["admin", "listings", status, q], queryFn: () => data.adminListings({ status, q }) });
    const act = useMutation({
      mutationFn: data.moderateListing,
      onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin"] }); },
      onError: (e) => notify(t("تعذر تنفيذ الإجراء"), data.friendlyError(e)),
    });
    return (
      <>
        {!fixedStatus ? (
          <>
            <Input value={q} onChangeText={setQ} placeholder={t("ابحث بعنوان الإعلان")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {(["all", "active", "pending", "rejected", "paused", "draft", "sold"] as const).map((s) => <Chip key={s} label={s === "all" ? t("الكل") : t(STATUS_TEXT[s])} active={status === s} onPress={() => setStatus(s)} />)}
            </ScrollView>
          </>
        ) : <Text style={[styles.note, { color: colors.muted }]}>{t("الإعلانات التي تنتظر الموافقة قبل ظهورها (عند تفعيل المراجعة المسبقة من الإعدادات).")}</Text>}
        {list.isLoading ? <Loading /> : list.isError ? <ErrorState message={data.friendlyError(list.error)} onRetry={() => list.refetch()} /> : (list.data ?? []).length === 0 ? <EmptyState title={t("لا توجد إعلانات")} /> : list.data!.map((l) => (
          <Card key={l.id} style={styles.item}>
            <Pressable onPress={() => router.push({ pathname: "/listing/[id]", params: { id: l.id } })} style={styles.itemHead}>
              {l.imageUrl ? <Image source={{ uri: l.imageUrl }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: colors.foreground }]} numberOfLines={2}>{l.title}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{l.sellerName} · {l.price} · {timeAgo(l.createdAt)}</Text>
                {l.ai ? (
                  <Text style={[styles.meta, { color: l.ai.verdict === "ok" ? colors.success : l.ai.verdict === "error" ? colors.muted : colors.error, fontWeight: "800" }]}>
                    {t("رأي الذكاء الاصطناعي")}: {t(AI_VERDICT[l.ai.verdict])}{l.ai.confidence !== null && l.ai.verdict !== "error" ? ` (${Math.round(l.ai.confidence * 100)}%)` : ""}{l.ai.reason ? ` · ${l.ai.reason}` : ""}{l.ai.applied ? ` · ${t("نُقل للمراجعة")}` : ""}
                  </Text>
                ) : null}
                {l.moderationReason && (l.status === "pending" || l.status === "rejected") ? (
                  <Text style={[styles.meta, { color: colors.warning, fontWeight: "800" }]}>{data.isAutomaticDecision(l.moderationStatus) ? t("الفحص التلقائي") : t("ملاحظة المشرف")}: {t(l.moderationReason)}</Text>
                ) : null}
              </View>
              <StatusPill status={l.status} />
            </Pressable>
            <Input value={reasons[l.id] ?? ""} onChangeText={(v) => setReasons((r) => ({ ...r, [l.id]: v }))} placeholder={t("سبب الرفض أو الإيقاف (يُرسل للمعلن)")} style={{ marginTop: 10 }} />
            <View style={styles.actions}>
              {l.status !== "active" ? <Button small icon="check" label={t("موافقة")} onPress={() => act.mutate({ id: l.id, action: "approve" })} /> : null}
              {l.status === "pending" ? <Button small variant="danger" icon="close" label={t("رفض")} onPress={() => act.mutate({ id: l.id, action: "reject", reason: reasons[l.id] })} /> : null}
              {l.status === "active" ? <Button small variant="danger" icon="block" label={t("إيقاف")} onPress={() => act.mutate({ id: l.id, action: "suspend", reason: reasons[l.id] })} /> : null}
              <Button small variant="ghost" icon={l.isFeatured ? "star" : "star-border"} label={l.isFeatured ? t("إلغاء التمييز") : t("تمييز")} onPress={() => act.mutate({ id: l.id, action: l.isFeatured ? "unfeature" : "feature" })} />
            </View>
          </Card>
        ))}
      </>
    );
  }

function UsersPanel() {
    const colors = useColors();
    const { user } = useAuth();
    const client = useQueryClient();
    const [q, setQ] = useState("");
    const [suspending, setSuspending] = useState<string | null>(null);
    const [days, setDays] = useState<number | null>(7);
    const [reason, setReason] = useState("");
    const list = useQuery({ queryKey: ["admin", "users", q], queryFn: () => data.adminUsers({ q }) });
    const refresh = () => void client.invalidateQueries({ queryKey: ["admin"] });
    const setRole = useMutation({ mutationFn: data.adminSetRole, onSuccess: refresh, onError: (e) => notify(t("تعذر تغيير الدور"), data.friendlyError(e)) });
    const suspend = useMutation({
      mutationFn: data.adminSuspendUser,
      onSuccess: () => { setSuspending(null); setReason(""); refresh(); notify(t("تم إيقاف الحساب")); },
      onError: (e) => notify(t("تعذر إيقاف الحساب"), data.friendlyError(e)),
    });
    const lift = useMutation({ mutationFn: data.adminLiftSuspension, onSuccess: () => { refresh(); notify(t("تم رفع الإيقاف")); }, onError: (e) => notify(t("تعذر رفع الإيقاف"), data.friendlyError(e)) });
    const ROLE_TEXT = { user: "مستخدم", merchant: "تاجر", admin: "مشرف" } as const;
    const DURATIONS: { days: number | null; label: string }[] = [
      { days: 1, label: "يوم" }, { days: 7, label: "أسبوع" }, { days: 30, label: "شهر" }, { days: null, label: "دائم" },
    ];
    return (
      <>
        <Input value={q} onChangeText={setQ} placeholder={t("ابحث بالاسم أو اسم المستخدم")} />
        {list.isLoading ? <Loading /> : list.isError ? <ErrorState message={data.friendlyError(list.error)} /> : list.data!.map((u) => (
          <Card key={u.id} style={styles.item}>
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>{u.name}</Text>
            <Text style={[styles.meta, { color: colors.muted }]}>{u.username ? `@${u.username} · ` : ""}{t("انضم {date}", { date: formatDate(u.createdAt) })}</Text>
            {u.restriction ? (
              <Text style={[styles.meta, { color: colors.error, fontWeight: "800" }]}>
                {u.restriction.until ? t("موقوف حتى {date}", { date: formatDate(u.restriction.until) }) : t("موقوف بشكل دائم")} · {u.restriction.reason}
              </Text>
            ) : null}
            <View style={styles.actions}>
              {(["user", "merchant", "admin"] as const).map((r) => <Chip key={r} label={t(ROLE_TEXT[r])} active={u.role === r} onPress={() => u.role !== r && (u.id === user?.id ? notify(t("لا يمكنك تغيير دورك بنفسك.")) : setRole.mutate({ userId: u.id, role: r }))} />)}
              <Button small variant="ghost" icon="list" label={t("إعلاناته")} onPress={() => router.push({ pathname: "/seller/[id]", params: { id: u.id } })} />
              {u.id !== user?.id ? (u.restriction
                ? <Button small variant="outline" icon="lock-open" label={t("رفع الإيقاف")} loading={lift.isPending && lift.variables === u.id} onPress={() => lift.mutate(u.id)} />
                : <Button small variant="danger" icon="block" label={t("إيقاف الحساب")} onPress={() => { setSuspending(suspending === u.id ? null : u.id); setReason(""); setDays(7); }} />) : null}
            </View>
            {suspending === u.id ? (
              <View style={[styles.suspendBox, { borderColor: colors.error }]}>
                <Text style={[styles.meta, { color: colors.foreground, fontWeight: "800" }]}>{t("مدة الإيقاف")}</Text>
                <View style={styles.actions}>{DURATIONS.map((d) => <Chip key={d.label} label={t(d.label)} active={days === d.days} onPress={() => setDays(d.days)} />)}</View>
                <Field label={t("السبب (يظهر للمستخدم)")} required><Input value={reason} onChangeText={setReason} multiline placeholder={t("مثال: بلاغات احتيال مؤكدة على المشترين")} /></Field>
                <Text style={[styles.meta, { color: colors.muted }]}>{t("لن يستطيع النشر أو المراسلة، وستُخفى إعلاناته عن الناس حتى انتهاء المدة.")}</Text>
                <View style={styles.actions}>
                  <Button small variant="danger" icon="block" label={t("تأكيد الإيقاف")} disabled={reason.trim().length < 3} loading={suspend.isPending} onPress={() => suspend.mutate({ userId: u.id, days, reason: reason.trim() })} />
                  <Button small variant="ghost" label={t("إلغاء")} onPress={() => setSuspending(null)} />
                </View>
              </View>
            ) : null}
          </Card>
        ))}
      </>
    );
  }

function StoresPanel() {
    const colors = useColors();
    const client = useQueryClient();
    const list = useQuery({ queryKey: ["admin", "stores"], queryFn: data.adminStores });
    const update = useMutation({ mutationFn: data.adminUpdateStore, onSuccess: () => void client.invalidateQueries({ queryKey: ["admin"] }), onError: (e) => notify(t("تعذر تحديث المتجر"), data.friendlyError(e)) });
    if (list.isLoading) return <Loading />;
    if (list.isError) return <ErrorState message={data.friendlyError(list.error)} />;
    if (!list.data!.length) return <EmptyState icon="storefront" title={t("لا توجد متاجر بعد")} />;
    return <>{list.data!.map((s) => (
      <Card key={s.id} style={styles.item}>
        <View style={styles.itemHead}>
          {s.logoUrl ? <Image source={{ uri: s.logoUrl }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]} />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>{s.name}</Text>
            <Text style={[styles.meta, { color: colors.muted }]}>{t(STORE_TYPES[s.storeType])} · {s.ownerName} · {t(s.status === "active" ? "مفعّل" : s.status === "pending" ? "بانتظار التفعيل" : "موقوف")}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {s.status !== "active" ? <Button small icon="check" label={t("تفعيل")} onPress={() => update.mutate({ id: s.id, status: "active" })} /> : <Button small variant="danger" icon="block" label={t("إيقاف")} onPress={() => update.mutate({ id: s.id, status: "suspended" })} />}
          <Button small variant="ghost" icon={s.isFeatured ? "star" : "star-border"} label={s.isFeatured ? t("إلغاء التمييز") : t("تمييز")} onPress={() => update.mutate({ id: s.id, isFeatured: !s.isFeatured })} />
          <Button small variant="ghost" icon="open-in-new" label={t("عرض")} onPress={() => router.push({ pathname: "/store/[merchantId]", params: { merchantId: s.ownerId } })} />
        </View>
      </Card>
    ))}</>;
  }

function CategoriesPanel() {
    const colors = useColors();
    const client = useQueryClient();
    const list = useQuery({ queryKey: ["admin", "categories"], queryFn: data.adminCategories });
    const [parent, setParent] = useState<number | null>(null);
    const [editing, setEditing] = useState<{ id?: number; name: string; name_ar: string } | null>(null);
    const save = useMutation({
      mutationFn: data.adminSaveCategory,
      onSuccess: () => { setEditing(null); void client.invalidateQueries({ queryKey: ["admin", "categories"] }); void client.invalidateQueries({ queryKey: ["categories"] }); },
      onError: (e) => notify(t("تعذر حفظ التصنيف"), data.friendlyError(e)),
    });
    if (list.isLoading) return <Loading />;
    if (list.isError) return <ErrorState message={data.friendlyError(list.error)} />;
    const rows = list.data!.filter((c) => c.parent_id === parent);
    const parentRow = list.data!.find((c) => c.id === parent);
    return (
      <>
        <View style={styles.actions}>
          {parent ? <Button small variant="ghost" icon="arrow-upward" label={t("المستوى الأعلى")} onPress={() => setParent(parentRow?.parent_id ?? null)} /> : null}
          <Button small icon="add" label={t("إضافة تصنيف هنا")} onPress={() => setEditing({ name: "", name_ar: "" })} />
        </View>
        {parentRow ? <Text style={[styles.note, { color: colors.muted }]}>{t("داخل: {name}", { name: pickName(parentRow) })}</Text> : null}
        {editing ? (
          <Card style={styles.item}>
            <Field label={t("الاسم بالعربية")} required><Input value={editing.name_ar} onChangeText={(v) => setEditing({ ...editing, name_ar: v })} /></Field>
            <Field label={t("الاسم بالإنجليزية")} required><Input value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} /></Field>
            <View style={styles.actions}>
              <Button small label={t("حفظ")} loading={save.isPending} onPress={() => save.mutate({ id: editing.id, name: editing.name, name_ar: editing.name_ar, parent_id: parent })} />
              <Button small variant="ghost" label={t("إلغاء")} onPress={() => setEditing(null)} />
            </View>
          </Card>
        ) : null}
        {rows.map((c) => (
          <Card key={c.id} style={[styles.item, !c.is_active && { opacity: 0.55 }]}>
            <Pressable onPress={() => setParent(c.id)} style={styles.itemHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: colors.foreground }]}>{c.name_ar}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{c.name} · {t("{n} فرعي", { n: list.data!.filter((x) => x.parent_id === c.id).length })}</Text>
              </View>
              <MaterialIcons name="chevron-left" size={22} color={colors.muted} />
            </Pressable>
            <View style={styles.actions}>
              <Button small variant="ghost" icon="edit" label={t("تعديل")} onPress={() => setEditing({ id: c.id, name: c.name, name_ar: c.name_ar })} />
              <Button small variant={c.is_active ? "danger" : "outline"} label={c.is_active ? t("إخفاء") : t("إظهار")} onPress={() => save.mutate({ id: c.id, name: c.name, name_ar: c.name_ar, parent_id: c.parent_id, is_active: !c.is_active })} />
            </View>
          </Card>
        ))}
      </>
    );
  }

function ReportsPanel() {
    const colors = useColors();
    const client = useQueryClient();
    const list = useQuery({ queryKey: ["admin", "reports"], queryFn: data.adminReports });
    const [notes, setNotes] = useState<Record<string, string>>({});
    const update = useMutation({ mutationFn: data.adminUpdateReport, onSuccess: () => void client.invalidateQueries({ queryKey: ["admin"] }), onError: (e) => notify(t("تعذر تحديث البلاغ"), data.friendlyError(e)) });
    if (list.isLoading) return <Loading />;
    if (list.isError) return <ErrorState message={data.friendlyError(list.error)} />;
    if (!list.data!.length) return <EmptyState icon="flag" title={t("لا توجد بلاغات")} />;
    const STATUS = { open: "جديد", reviewing: "قيد المراجعة", resolved: "تم الحل", dismissed: "مرفوض" } as const;
    return <>{list.data!.map((r) => (
      <Card key={r.id} style={[styles.item, r.priority === "high" && r.status === "open" ? { borderColor: colors.error } : null]}>
        <View style={styles.itemHead}>
          <MaterialIcons name="flag" size={20} color={r.priority === "high" ? colors.error : colors.warning} />
          <Text style={[styles.itemTitle, { color: colors.foreground, flex: 1 }]}>{t(REASON_LABELS[r.reason] ?? "سبب آخر")}</Text>
          <Text style={[styles.meta, { color: colors.primary }]}>{t(STATUS[r.status])}</Text>
        </View>
        <Text style={[styles.body, { color: colors.foreground }]}>{r.details}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{t("المُبلِّغ: {name}", { name: r.reporterName ?? "—" })} · {timeAgo(r.createdAt)}</Text>
        {r.listingTitle ? <Pressable onPress={() => router.push({ pathname: "/listing/[id]", params: { id: r.listingId! } })}><Text style={[styles.link, { color: colors.primary }]}>{t("الإعلان: {title}", { title: r.listingTitle })}</Text></Pressable> : null}
        {r.reportedName ? <Pressable onPress={() => router.push({ pathname: "/seller/[id]", params: { id: r.reportedUserId! } })}><Text style={[styles.link, { color: colors.primary }]}>{t("المستخدم المبلَّغ عنه: {name}", { name: r.reportedName })}</Text></Pressable> : null}
        {r.conversationId ? <Text style={[styles.meta, { color: colors.muted }]}>{t("البلاغ مرتبط بمحادثة.")}</Text> : null}
        {r.resolution ? <Text style={[styles.meta, { color: colors.muted }]}>{t("القرار: {text}", { text: r.resolution })}</Text> : null}
        {r.status === "open" || r.status === "reviewing" ? (
          <>
            <Input value={notes[r.id] ?? ""} onChangeText={(v) => setNotes((n) => ({ ...n, [r.id]: v }))} placeholder={t("ملاحظة القرار (مطلوبة للحل أو الرفض)")} style={{ marginTop: 10 }} />
            <View style={styles.actions}>
              {r.status === "open" ? <Button small variant="ghost" label={t("بدء المراجعة")} onPress={() => update.mutate({ id: r.id, status: "reviewing" })} /> : null}
              <Button small icon="check" label={t("تم الحل")} onPress={() => update.mutate({ id: r.id, status: "resolved", resolution: notes[r.id] })} />
              <Button small variant="danger" label={t("رفض البلاغ")} onPress={() => update.mutate({ id: r.id, status: "dismissed", resolution: notes[r.id] })} />
            </View>
          </>
        ) : null}
      </Card>
    ))}</>;
  }

function AppealsPanel() {
    const colors = useColors();
    const client = useQueryClient();
    const [view, setView] = useState<"open" | "decided">("open");
    const [notes, setNotes] = useState<Record<number, string>>({});
    const list = useQuery({ queryKey: ["admin", "appeals", view], queryFn: () => data.adminAppeals(view) });
    const decide = useMutation({
      mutationFn: data.adminDecideAppeal,
      onSuccess: (_r, v) => { void client.invalidateQueries({ queryKey: ["admin"] }); notify(v.accept ? t("قُبل الاعتراض") : t("رُفض الاعتراض"), t("وصل إشعار بالقرار إلى المستخدم.")); },
      onError: (e) => notify(t("تعذر تنفيذ الإجراء"), data.friendlyError(e)),
    });
    const STATUS = { open: "قيد المراجعة", accepted: "مقبول", rejected: "مرفوض" } as const;
    return (
      <>
        <View style={styles.actions}>
          <Chip label={t("بانتظار القرار")} active={view === "open"} onPress={() => setView("open")} />
          <Chip label={t("تم البت فيها")} active={view === "decided"} onPress={() => setView("decided")} />
        </View>
        <Text style={[styles.meta, { color: colors.muted, marginTop: 8 }]}>{t("راجع القرار الأصلي بعين جديدة. قبول الاعتراض يعيد الإعلان أو يرفع الإيقاف فورًا.")}</Text>
        {list.isLoading ? <Loading /> : list.isError ? <ErrorState message={data.friendlyError(list.error)} /> : !list.data!.length ? <EmptyState icon="gavel" title={t("لا توجد اعتراضات")} /> : list.data!.map((a) => (
          <Card key={a.id} style={styles.item}>
            <View style={styles.itemHead}>
              <MaterialIcons name={a.kind === "account" ? "person-off" : "article"} size={20} color={colors.primary} />
              <Text style={[styles.itemTitle, { color: colors.foreground, flex: 1 }]}>{a.kind === "account" ? t("اعتراض على إيقاف حساب") : t("اعتراض على قرار إعلان")}</Text>
              <Text style={[styles.meta, { color: colors.primary }]}>{t(STATUS[a.status])}</Text>
            </View>
            <Text style={[styles.meta, { color: colors.muted }]}>{a.userName} · {timeAgo(a.createdAt)}</Text>
            {a.listingTitle ? <Pressable onPress={() => router.push({ pathname: "/listing/[id]", params: { id: a.listingId! } })}><Text style={[styles.link, { color: colors.primary }]}>{t("الإعلان: {title}", { title: a.listingTitle })}</Text></Pressable> : null}
            {a.originalReason ? <Text style={[styles.meta, { color: colors.error }]}>{t("القرار الأصلي")}: {t(a.originalReason)}</Text> : null}
            <Text style={[styles.body, { color: colors.foreground }]}>{a.statement}</Text>
            {a.decisionNote ? <Text style={[styles.meta, { color: colors.muted }]}>{t("القرار: {text}", { text: a.decisionNote })}</Text> : null}
            {a.status === "open" ? (
              <>
                <Input value={notes[a.id] ?? ""} onChangeText={(v) => setNotes((n) => ({ ...n, [a.id]: v }))} placeholder={t("سبب القرار (يظهر للمستخدم)")} style={{ marginTop: 10 }} />
                <View style={styles.actions}>
                  <Button small icon="check" label={t("قبول الاعتراض")} disabled={(notes[a.id] ?? "").trim().length < 3} onPress={() => decide.mutate({ id: a.id, accept: true, note: notes[a.id] ?? "" })} />
                  <Button small variant="danger" icon="close" label={t("رفض الاعتراض")} disabled={(notes[a.id] ?? "").trim().length < 3} onPress={() => decide.mutate({ id: a.id, accept: false, note: notes[a.id] ?? "" })} />
                </View>
              </>
            ) : null}
          </Card>
        ))}
      </>
    );
  }

function ReviewsPanel() {
    const colors = useColors();
    const client = useQueryClient();
    const [view, setView] = useState<"review" | "visible" | "hidden">("review");
    const list = useQuery({ queryKey: ["admin", "reviews", view], queryFn: () => data.adminRatingComments(view) });
    const act = useMutation({ mutationFn: data.adminModerateRating, onSuccess: () => void client.invalidateQueries({ queryKey: ["admin", "reviews"] }), onError: (e) => notify(t("تعذر تنفيذ الإجراء"), data.friendlyError(e)) });
    return (
      <>
        <View style={styles.actions}>
          <Chip label={t("بانتظار المراجعة")} active={view === "review"} onPress={() => setView("review")} />
          <Chip label={t("ظاهرة")} active={view === "visible"} onPress={() => setView("visible")} />
          <Chip label={t("مخفية")} active={view === "hidden"} onPress={() => setView("hidden")} />
        </View>
        <Text style={[styles.meta, { color: colors.muted, marginTop: 8 }]}>{t("التقييم السلبي مسموح. أخفِ فقط الإساءة أو التهديد أو المعلومات الشخصية، لا الرأي السلبي.")}</Text>
        {list.isLoading ? <Loading /> : list.isError ? <ErrorState message={data.friendlyError(list.error)} /> : !list.data!.length ? <EmptyState icon="rate-review" title={t("لا توجد تعليقات هنا")} /> : list.data!.map((r) => (
          <Card key={`${r.listingId}:${r.reviewerId}`} style={styles.item}>
            <Text style={[styles.itemTitle, { color: colors.accent }]}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text>
            <Text style={[styles.body, { color: colors.foreground }]}>{r.text}</Text>
            <Text style={[styles.meta, { color: colors.muted }]}>{t("من {from} إلى {to}", { from: r.reviewerName, to: r.sellerName })}{r.listingTitle ? ` · ${r.listingTitle}` : ""} · {timeAgo(r.createdAt)}</Text>
            <View style={styles.actions}>
              {r.status !== "visible" ? <Button small icon="visibility" label={t("إظهار")} onPress={() => act.mutate({ listingId: r.listingId, reviewerId: r.reviewerId, action: "approve" })} /> : null}
              {r.status !== "hidden" ? <Button small variant="danger" icon="visibility-off" label={t("إخفاء")} onPress={() => act.mutate({ listingId: r.listingId, reviewerId: r.reviewerId, action: "hide" })} /> : null}
            </View>
          </Card>
        ))}
      </>
    );
  }

function AuditPanel() {
    const colors = useColors();
    const list = useQuery({ queryKey: ["admin", "audit"], queryFn: data.adminAuditLog });
    if (list.isLoading) return <Loading />;
    if (list.isError) return <ErrorState message={data.friendlyError(list.error)} />;
    if (!list.data!.length) return <EmptyState icon="history" title={t("لا توجد إجراءات مسجلة بعد")} />;
    const TABLES: Record<string, string> = { video_ads: "إعلان فيديو", listings: "إعلان", stores: "متجر", profiles: "مستخدم", report_cases: "بلاغ", categories: "تصنيف", platform_settings: "إعداد", merchant_subscriptions: "اشتراك" };
    const ACTIONS: Record<string, string> = { insert: "إضافة", update: "تعديل", delete: "حذف" };
    return <>{list.data!.map((e) => (
      <Card key={e.id} style={styles.item}>
        <Text style={[styles.itemTitle, { color: colors.foreground }]}>{t(ACTIONS[e.action] ?? e.action)} · {t(TABLES[e.table] ?? e.table)}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{e.adminName} · {formatDate(e.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
        {e.changes.slice(0, 4).map((c) => <Text key={c} style={[styles.code, { color: colors.foreground }]} numberOfLines={2}>{c}</Text>)}
      </Card>
    ))}</>;
  }

function SettingsPanel() {
    const colors = useColors();
    const client = useQueryClient();
    const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: data.adminSettings });
    const [ar, setAr] = useState<string | null>(null);
    const [en, setEn] = useState<string | null>(null);
    const [auto, setAuto] = useState<boolean | null>(null);
    const [aiMode, setAiMode] = useState<data.AiMode | null>(null);
    const save = useMutation({ mutationFn: data.adminSaveSettings, onSuccess: () => { notify(t("تم حفظ الإعدادات")); void client.invalidateQueries({ queryKey: ["admin", "settings"] }); void client.invalidateQueries({ queryKey: ["announcement"] }); }, onError: (e) => notify(t("تعذر حفظ الإعدادات"), data.friendlyError(e)) });
    if (settings.isLoading) return <Loading />;
    if (settings.isError) return <ErrorState message={data.friendlyError(settings.error)} />;
    const s = settings.data!;
    const vAr = ar ?? s.announcement.ar; const vEn = en ?? s.announcement.en; const vAuto = auto ?? s.autoPublish; const vAi = aiMode ?? s.aiMode;
    return (
      <Card>
        <Field label={t("إعلان المنصة بالعربية")} hint={t("يظهر في الرئيسية والإشعارات. اتركه فارغًا لإخفائه.")}><Input value={vAr} onChangeText={setAr} multiline multilineHeight={80} /></Field>
        <Field label={t("إعلان المنصة بالإنجليزية")}><Input value={vEn} onChangeText={setEn} multiline multilineHeight={80} /></Field>
        <View style={[styles.itemHead, { marginTop: 18 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>{t("النشر الفوري للإعلانات")}</Text>
            <Text style={[styles.meta, { color: colors.muted }]}>{vAuto ? t("تُنشر الإعلانات مباشرة بعد الفحص الآلي، ويمكن إيقافها لاحقًا.") : t("كل إعلان جديد ينتظر موافقة المشرف قبل الظهور.")}</Text>
          </View>
          <Switch value={vAuto} onValueChange={setAuto} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        <Text style={[styles.itemTitle, { color: colors.foreground, marginTop: 18 }]}>{t("فحص الإعلانات بالذكاء الاصطناعي")}</Text>
        <View style={styles.actions}>{AI_MODES.map((m) => <Chip key={m.key} label={t(m.label)} active={vAi === m.key} onPress={() => setAiMode(m.key)} />)}</View>
        <Text style={[styles.meta, { color: colors.muted }]}>{t(AI_MODES.find((m) => m.key === vAi)!.hint)}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{t("يحتاج مفتاح Anthropic في أسرار دوال Supabase باسم ANTHROPIC_API_KEY.")}</Text>
        <Button label={t("حفظ الإعدادات")} loading={save.isPending} onPress={() => save.mutate({ announcement: { ar: vAr, en: vEn }, autoPublish: vAuto, aiMode: vAi })} style={{ marginTop: 18 }} />
      </Card>
    );
}

const AI_VERDICT: Record<data.AiVerdict["verdict"], string> = { ok: "سليم", review: "يحتاج مراجعة", reject: "مخالف", error: "تعذر الفحص" };
const AI_MODES: { key: data.AiMode; label: string; hint: string }[] = [
  { key: "off", label: "متوقف", hint: "لا يُرسل أي إعلان للفحص بالذكاء الاصطناعي." },
  { key: "shadow", label: "مراقبة فقط", hint: "يسجّل رأيه في قائمة المراجعة دون أن يغيّر شيئًا. ابدأ بهذا لتتأكد من دقته." },
  { key: "enforce", label: "تفعيل", hint: "الإعلان المنشور الذي يشتبه به يُنقل إلى قائمة المراجعة. لا يرفض أي إعلان بنفسه." },
];

const STATUS_TEXT: Record<data.DbStatus, string> = {
  draft: "مسودة", pending: "قيد المراجعة", active: "منشور", paused: "موقوف مؤقتًا", rejected: "مرفوض",
  sold: "تم البيع", reserved: "محجوز", expired: "منتهي", archived: "مؤرشف",
};

const styles = createStyles({
  suspendBox: { borderRadius: 12, borderWidth: 1, gap: 6, marginTop: 10, padding: 10 },
  lockIcon: { alignItems: "center", alignSelf: "center", borderRadius: 26, height: 76, justifyContent: "center", marginTop: 30, width: 76 },
  lockTitle: { fontSize: 20, fontWeight: "900", marginTop: 14, textAlign: "center" },
  lockText: { fontSize: 13, lineHeight: 21, marginBottom: 10, marginTop: 6, textAlign: "center" },
  lockError: { fontSize: 13, fontWeight: "700", marginTop: 10, textAlign: "right" },
  tabs: { flexDirection: "row-reverse", gap: 8, paddingVertical: 10 },
  content: { paddingBottom: 30 },
  tiles: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  tile: { borderRadius: 16, borderWidth: 1, minHeight: 92, padding: 14 },
  tileValue: { fontSize: 26, fontVariant: ["tabular-nums"], fontWeight: "900", textAlign: "right" },
  tileLabel: { fontSize: 12, marginTop: 4, textAlign: "right" },
  item: { marginTop: 10 },
  itemHead: { alignItems: "center", flexDirection: "row-reverse", gap: 10 },
  thumb: { borderRadius: 10, height: 52, width: 52 },
  itemTitle: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  meta: { fontSize: 12, marginTop: 3, textAlign: "right" },
  body: { fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: "right" },
  link: { fontSize: 12, fontWeight: "800", marginTop: 6, textAlign: "right" },
  note: { fontSize: 12, lineHeight: 18, marginBottom: 6, textAlign: "right" },
  code: { fontFamily: "monospace", fontSize: 11, marginTop: 4, textAlign: "left" },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 10 },
});
