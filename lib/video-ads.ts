import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";

/**
 * Paid video ads shown in the home banner (migration 0011).
 * Visitors only reach live_video_ads(); the full rows (payment details) are admin-only.
 */
export const AD_VIDEOS_BUCKET = "ad-videos";
export const AD_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export type LiveVideoAd = { id: string; companyName: string; contactUrl: string | null; videoUrl: string };

export type VideoAdState = "live" | "scheduled" | "ended" | "paused" | "unpaid";

export type AdminVideoAd = LiveVideoAd & {
  videoPath: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  paymentConfirmed: boolean;
  amountOmr: number | null;
  paymentNote: string;
  views: number;
  clicks: number;
  state: VideoAdState;
};

export type VideoAdInput = {
  id?: string;
  companyName: string;
  contact: string;
  startDay: string; // YYYY-MM-DD (Muscat)
  endDay: string; // YYYY-MM-DD (Muscat), inclusive
  isActive: boolean;
  paymentConfirmed: boolean;
  amountOmr: string;
  paymentNote: string;
  video?: PickedVideo | null;
};

export type PickedVideo = { uri: string; mimeType?: string | null; fileSize?: number | null; file?: Blob | null };

export async function getLiveVideoAds(): Promise<LiveVideoAd[]> {
  const { data, error } = await supabase.rpc("live_video_ads");
  if (error) return []; // the banner falls back to the default green box
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: r.id, companyName: r.company_name, contactUrl: r.contact_url, videoUrl: r.video_url }));
}

/** Count once per ad per app visit (the server ignores ads that are not live). */
const counted = new Set<string>();
export function recordVideoAdEvent(adId: string, kind: "view" | "click") {
  const key = `${kind}:${adId}`;
  if (counted.has(key)) return;
  counted.add(key);
  void supabase.rpc("record_video_ad_event", { p_ad: adId, p_kind: kind }).then(() => undefined, () => undefined);
}

function stateOf(r: { is_active: boolean; payment_confirmed: boolean; starts_at: string; ends_at: string }): VideoAdState {
  const now = Date.now();
  if (!r.payment_confirmed) return "unpaid";
  if (!r.is_active) return "paused";
  if (now < new Date(r.starts_at).getTime()) return "scheduled";
  if (now >= new Date(r.ends_at).getTime()) return "ended";
  return "live";
}

export async function adminVideoAds(): Promise<AdminVideoAd[]> {
  const [{ data, error }, { data: stats }] = await Promise.all([
    supabase.from("video_ads").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("video_ad_stats").select("ad_id, views, clicks"),
  ]);
  if (error) throw new Error(error.message || t("تعذر تحميل البيانات."));
  const totals = new Map<string, { views: number; clicks: number }>();
  for (const s of stats ?? []) {
    const cur = totals.get(s.ad_id) ?? { views: 0, clicks: 0 };
    totals.set(s.ad_id, { views: cur.views + Number(s.views), clicks: cur.clicks + Number(s.clicks) });
  }
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    id: r.id, companyName: r.company_name, contactUrl: r.contact_url, videoUrl: r.video_url, videoPath: r.video_path,
    startsAt: r.starts_at, endsAt: r.ends_at, isActive: r.is_active, paymentConfirmed: r.payment_confirmed,
    amountOmr: r.amount_omr === null ? null : Number(r.amount_omr), paymentNote: r.payment_note ?? "",
    views: totals.get(r.id)?.views ?? 0, clicks: totals.get(r.id)?.clicks ?? 0, state: stateOf(r as Parameters<typeof stateOf>[0]),
  }));
}

/**
 * Turns what the admin typed into a safe link:
 * an Omani number (8 digits, or with 968) -> WhatsApp; an email -> mailto; https links as they are.
 */
export function normalizeContact(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const digits = v.replace(/[\s()-]/g, "");
  if (/^\+?\d{8,15}$/.test(digits)) {
    const n = digits.replace(/^\+/, "").replace(/^00/, "");
    return `https://wa.me/${n.length === 8 ? `968${n}` : n}`;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^https:\/\/[^\s]+\.[^\s]+$/i.test(v)) return v;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return `https://${v}`;
  throw new Error(t("رابط التواصل غير صحيح. اكتب رقم واتساب أو بريدًا أو رابطًا يبدأ بـ https."));
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Muscat midnight at the start of `day` (end dates are inclusive, so the end is the next midnight). */
function muscatStart(day: string, plusDays = 0) {
  const d = new Date(`${day}T00:00:00+04:00`);
  if (Number.isNaN(d.getTime())) throw new Error(t("اكتب التاريخ بالشكل 2026-11-30."));
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d.toISOString();
}
export function toMuscatDay(iso: string, minusDays = 0) {
  const d = new Date(new Date(iso).getTime() + 4 * 3600_000 - minusDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

function videoKind(bytes: Uint8Array): { mime: string; ext: string } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length > 12 && ascii(4, 8) === "ftyp") {
    return ascii(8, 10) === "qt" ? { mime: "video/quicktime", ext: "mov" } : { mime: "video/mp4", ext: "mp4" };
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { mime: "video/webm", ext: "webm" };
  return null;
}

async function readBytes(video: PickedVideo): Promise<Uint8Array> {
  if (Platform.OS === "web") {
    const blob = video.file ?? (await (await fetch(video.uri)).blob());
    return new Uint8Array(await blob.arrayBuffer());
  }
  const { File: FsFile } = await import("expo-file-system");
  return new FsFile(video.uri).bytes();
}

async function uploadVideo(video: PickedVideo): Promise<{ url: string; path: string }> {
  if (video.fileSize && video.fileSize > AD_VIDEO_MAX_BYTES) throw new Error(t("حجم الفيديو أكبر من 50 ميجابايت. اضغطه أو قصّره ثم حاول مرة أخرى."));
  const bytes = await readBytes(video);
  if (!bytes.length) throw new Error(t("تعذر قراءة الفيديو."));
  if (bytes.length > AD_VIDEO_MAX_BYTES) throw new Error(t("حجم الفيديو أكبر من 50 ميجابايت. اضغطه أو قصّره ثم حاول مرة أخرى."));
  const kind = videoKind(bytes);
  if (!kind) throw new Error(t("صيغة الفيديو غير مدعومة. استخدم MP4 أو MOV أو WebM."));
  const path = `${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${kind.ext}`;
  const { error } = await supabase.storage.from(AD_VIDEOS_BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (error) throw new Error(/exceeded|too large|413/i.test(error.message) ? t("حجم الفيديو أكبر من 50 ميجابايت. اضغطه أو قصّره ثم حاول مرة أخرى.") : t("تعذر رفع الفيديو. حاول مرة أخرى."));
  return { url: supabase.storage.from(AD_VIDEOS_BUCKET).getPublicUrl(path).data.publicUrl, path };
}

export async function adminSaveVideoAd(input: VideoAdInput, previousPath?: string) {
  const company = input.companyName.trim();
  if (company.length < 2) throw new Error(t("اكتب اسم الشركة."));
  if (!DAY.test(input.startDay.trim()) || !DAY.test(input.endDay.trim())) throw new Error(t("اكتب التاريخ بالشكل 2026-11-30."));
  const startsAt = muscatStart(input.startDay.trim());
  const endsAt = muscatStart(input.endDay.trim(), 1);
  if (endsAt <= startsAt) throw new Error(t("تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مثله."));
  const amount = input.amountOmr.trim() ? Number(input.amountOmr.replace(",", ".")) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new Error(t("المبلغ غير صحيح."));
  if (!input.id && !input.video) throw new Error(t("اختر فيديو الإعلان."));

  const row: Record<string, unknown> = {
    company_name: company, contact_url: normalizeContact(input.contact), starts_at: startsAt, ends_at: endsAt,
    is_active: input.isActive, payment_confirmed: input.paymentConfirmed, amount_omr: amount,
    payment_note: input.paymentNote.trim().slice(0, 500) || null,
  };
  const uploaded = input.video ? await uploadVideo(input.video) : null;
  if (uploaded) Object.assign(row, { video_url: uploaded.url, video_path: uploaded.path });

  const { error } = input.id
    ? await supabase.from("video_ads").update(row).eq("id", input.id)
    : await supabase.from("video_ads").insert(row);
  if (error) {
    if (uploaded) await supabase.storage.from(AD_VIDEOS_BUCKET).remove([uploaded.path]);
    throw new Error(/row-level|permission/i.test(error.message) ? t("لا تملك صلاحية لهذا الإجراء.") : t("تعذر حفظ الإعلان."));
  }
  // The old file is no longer used once the new video is saved.
  if (uploaded && previousPath) await supabase.storage.from(AD_VIDEOS_BUCKET).remove([previousPath]);
  return true;
}

export async function adminSetVideoAdActive(id: string, isActive: boolean) {
  const { error } = await supabase.from("video_ads").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(t("تعذر تنفيذ الإجراء."));
  return true;
}

export async function adminDeleteVideoAd(ad: { id: string; videoPath: string }) {
  const { error } = await supabase.from("video_ads").delete().eq("id", ad.id);
  if (error) throw new Error(t("تعذر حذف الإعلان."));
  await supabase.storage.from(AD_VIDEOS_BUCKET).remove([ad.videoPath]);
  return true;
}
