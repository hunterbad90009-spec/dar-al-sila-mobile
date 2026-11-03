import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Card, Chip, EmptyState, ErrorState, Field, Header, Input, Loading, StatusPill, notify } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import * as data from "@/lib/data";
import { formatDate, formatNumber, pickName, t, timeAgo } from "@/lib/i18n";
import { STORE_TYPES } from "@/lib/store-types";
import { createStyles } from "@/lib/i18n/rtl";

type Section = "overview" | "queue" | "listings" | "users" | "stores" | "categories" | "reports" | "audit" | "settings";
const SECTIONS: { key: Section; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: "overview", label: "نظرة عامة", icon: "dashboard" },
  { key: "queue", label: "قائمة المراجعة", icon: "fact-check" },
  { key: "listings", label: "الإعلانات", icon: "view-list" },
  { key: "users", label: "المستخدمون والأدوار", icon: "people" },
  { key: "stores", label: "المتاجر", icon: "storefront" },
  { key: "categories", label: "التصنيفات", icon: "category" },
  { key: "reports", label: "البلاغات", icon: "flag" },
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

  return (
    <ScreenContainer className="px-4">
      <Header title={t("لوحة المشرف")} subtitle={t("كل إجراء هنا يُسجَّل في سجل الإجراءات")} />
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
        {section === "audit" && <AuditPanel />}
        {section === "settings" && <SettingsPanel />}
        <View style={{ height: 30 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

function Overview({ go }: { go: (s: Section) => void }) {
    const colors = useColors();
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
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <Pressable key={tile.label} onPress={() => go(tile.section)} style={[styles.tile, { backgroundColor: colors.surface, borderColor: tile.alert ? colors.accent : colors.border }]}>
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
    const list = useQuery({ queryKey: ["admin", "users", q], queryFn: () => data.adminUsers({ q }) });
    const setRole = useMutation({ mutationFn: data.adminSetRole, onSuccess: () => void client.invalidateQueries({ queryKey: ["admin", "users"] }), onError: (e) => notify(t("تعذر تغيير الدور"), data.friendlyError(e)) });
    const ROLE_TEXT = { user: "مستخدم", merchant: "تاجر", admin: "مشرف" } as const;
    return (
      <>
        <Input value={q} onChangeText={setQ} placeholder={t("ابحث بالاسم أو اسم المستخدم")} />
        {list.isLoading ? <Loading /> : list.isError ? <ErrorState message={data.friendlyError(list.error)} /> : list.data!.map((u) => (
          <Card key={u.id} style={styles.item}>
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>{u.name}</Text>
            <Text style={[styles.meta, { color: colors.muted }]}>{u.username ? `@${u.username} · ` : ""}{t("انضم {date}", { date: formatDate(u.createdAt) })}</Text>
            <View style={styles.actions}>
              {(["user", "merchant", "admin"] as const).map((r) => <Chip key={r} label={t(ROLE_TEXT[r])} active={u.role === r} onPress={() => u.role !== r && (u.id === user?.id ? notify(t("لا يمكنك تغيير دورك بنفسك.")) : setRole.mutate({ userId: u.id, role: r }))} />)}
              <Button small variant="ghost" icon="list" label={t("إعلاناته")} onPress={() => router.push({ pathname: "/seller/[id]", params: { id: u.id } })} />
            </View>
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

function AuditPanel() {
    const colors = useColors();
    const list = useQuery({ queryKey: ["admin", "audit"], queryFn: data.adminAuditLog });
    if (list.isLoading) return <Loading />;
    if (list.isError) return <ErrorState message={data.friendlyError(list.error)} />;
    if (!list.data!.length) return <EmptyState icon="history" title={t("لا توجد إجراءات مسجلة بعد")} />;
    const TABLES: Record<string, string> = { listings: "إعلان", stores: "متجر", profiles: "مستخدم", report_cases: "بلاغ", categories: "تصنيف", platform_settings: "إعداد", merchant_subscriptions: "اشتراك" };
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
    const save = useMutation({ mutationFn: data.adminSaveSettings, onSuccess: () => { notify(t("تم حفظ الإعدادات")); void client.invalidateQueries({ queryKey: ["admin", "settings"] }); void client.invalidateQueries({ queryKey: ["announcement"] }); }, onError: (e) => notify(t("تعذر حفظ الإعدادات"), data.friendlyError(e)) });
    if (settings.isLoading) return <Loading />;
    if (settings.isError) return <ErrorState message={data.friendlyError(settings.error)} />;
    const s = settings.data!;
    const vAr = ar ?? s.announcement.ar; const vEn = en ?? s.announcement.en; const vAuto = auto ?? s.autoPublish;
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
        <Button label={t("حفظ الإعدادات")} loading={save.isPending} onPress={() => save.mutate({ announcement: { ar: vAr, en: vEn }, autoPublish: vAuto })} style={{ marginTop: 18 }} />
      </Card>
    );
}

const STATUS_TEXT: Record<data.DbStatus, string> = {
  draft: "مسودة", pending: "قيد المراجعة", active: "منشور", paused: "موقوف مؤقتًا", rejected: "مرفوض",
  sold: "تم البيع", reserved: "محجوز", expired: "منتهي", archived: "مؤرشف",
};

const styles = createStyles({
  tabs: { flexDirection: "row-reverse", gap: 8, paddingVertical: 10 },
  content: { paddingBottom: 30 },
  tiles: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  tile: { borderRadius: 16, borderWidth: 1, minHeight: 92, padding: 14, width: "48%" },
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
