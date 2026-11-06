/**
 * Supabase data layer for دار السلع.
 *
 * Every read and write runs with the signed-in user's session and is checked by Row Level
 * Security in the database (supabase/migrations). Hiding a button is never the only guard.
 * Error messages are Arabic source strings passed through t().
 */
import { LISTING_MEDIA_BUCKET, supabase } from "@/lib/supabase";
import { isSupportedImageDataUrl } from "@/lib/image-moderation";
import { getMarketplacePermissions } from "@/shared/marketplace-permissions";
import { formatPrice, pickName, t } from "@/lib/i18n";
import type { Condition } from "@/lib/category-fields";

// ---------------------------------------------------------------------------
// Errors & helpers
// ---------------------------------------------------------------------------

type PgError = { code?: string; message?: string } | null;

function isMissingTable(error: PgError) {
  return Boolean(error && (error.code === "PGRST205" || error.code === "42P01" || error.code === "PGRST204" || error.code === "42703"));
}

/** Turn database / RLS errors into a safe, translated message (never raw SQL). */
export function friendlyError(error: unknown, fallback = "تعذر إكمال الطلب."): string {
  const message = error instanceof Error ? error.message : typeof (error as PgError)?.message === "string" ? (error as PgError)!.message! : "";
  const known: Record<string, string> = {
    LISTING_STATUS_LOCKED: "لا يمكن تغيير حالة هذا الإعلان قبل مراجعة المشرف.",
    LISTING_STATUS_ADMIN_ONLY: "هذا الإجراء للمشرف فقط.",
    STORE_FIELD_ADMIN_ONLY: "تفعيل المتجر وتمييزه من صلاحيات المشرف.",
    ROLE_CHANGE_FORBIDDEN: "لا تملك صلاحية تغيير الأدوار.",
    MESSAGE_IMMUTABLE: "لا يمكن تعديل الرسائل بعد إرسالها.",
    LISTING_NOT_FOUND: "تعذر العثور على الإعلان.",
    STORE_NOT_FOUND: "المتجر غير موجود أو غير مفعّل.",
    DRAFT_NOT_EDITABLE: "تم تحديث هذا الإعلان من مكان آخر. افتحه من جديد.",
    INVALID_IMAGE_BYTES: "صيغة الصورة غير مدعومة.",
    MEDIA_SIZE_INVALID: "حجم الصورة كبير جدًا.",
    LOGIN_REQUIRED: "يجب تسجيل الدخول أولًا.",
    CANNOT_SUSPEND_SELF: "لا يمكنك إيقاف حسابك.",
    REASON_REQUIRED: "اكتب سبب القرار.",
    ADMIN_ONLY: "هذا الإجراء للمشرف فقط.",
    APPEAL_TOO_SHORT: "اشرح اعتراضك في 10 أحرف على الأقل.",
    APPEAL_ALREADY_OPEN: "لديك اعتراض مفتوح على هذا القرار، وسيصلك الرد قريبًا.",
    APPEAL_TOO_SOON: "رُفض اعتراضك مؤخرًا. يمكنك الاعتراض مرة أخرى بعد 7 أيام من القرار.",
    NOTHING_TO_APPEAL: "لا يوجد قرار يمكن الاعتراض عليه.",
    APPEAL_NOT_OPEN: "تم البت في هذا الاعتراض مسبقًا.",
    RATING_NOT_FOUND: "التقييم غير موجود.",
  };
  for (const [code, text] of Object.entries(known)) if (message.includes(code)) return t(text);
  if (/row-level security|permission denied|violates row-level/i.test(message)) return t("لا تملك صلاحية لهذا الإجراء. إن كان حسابك موقوفًا تجد السبب في «حسابي».");
  if (/Failed to fetch|Network|fetch failed|ERR_/i.test(message)) return t("تعذر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.");
  if (message && /[؀-ۿ]/.test(message)) return message;
  return t(fallback);
}

function fail(error: PgError, fallback = "تعذر إكمال الطلب."): never {
  throw new Error(isMissingTable(error) ? t("هذه الميزة غير متاحة حاليًا.") : (error?.message || t(fallback)));
}

function rowsOrEmpty<T>(data: T[] | null, error: PgError): T[] {
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message || t("تعذر تحميل البيانات."));
  }
  return data ?? [];
}

/** Throws an error tagged like a tRPC CONFLICT so screens show "نسخة أحدث". */
function conflict(message: string): never {
  throw Object.assign(new Error(message), { data: { code: "CONFLICT" } });
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error("LOGIN_REQUIRED");
  return id;
}

/** Escape user text for a PostgREST `or=(...)` / ilike filter. */
function likeTerm(value: string) {
  return `%${value.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ").trim()}%`;
}

// ---------------------------------------------------------------------------
// Taxonomy (categories & locations) — bilingual rows from the database
// ---------------------------------------------------------------------------

export type Category = { id: number; slug: string; name: string; name_ar: string; icon: string | null; parent_id: number | null; sort_order: number };
export type Location = { id: number; name: string; name_ar: string; kind: "governorate" | "wilayat" | null; parent_id: number | null; latitude: number | null; longitude: number | null };

let categoryCache: Promise<Category[]> | null = null;
let locationCache: Promise<Location[]> | null = null;

export function getCategories(): Promise<Category[]> {
  categoryCache ??= (async () => {
    const { data, error } = await supabase.from("categories").select("id, slug, name, name_ar, icon, parent_id, sort_order").eq("is_active", true).order("sort_order").order("id");
    if (error) { categoryCache = null; throw new Error(error.message); }
    return (data ?? []) as Category[];
  })();
  return categoryCache;
}

export function invalidateCategoryCache() {
  categoryCache = null;
}

export function getLocations(): Promise<Location[]> {
  locationCache ??= (async () => {
    const { data, error } = await supabase.from("locations").select("id, name, name_ar, kind, parent_id, latitude, longitude").eq("is_active", true).order("id");
    if (error) { locationCache = null; throw new Error(error.message); }
    return (data ?? []) as Location[];
  })();
  return locationCache;
}

/** Walk up to the top-level category. */
export function topCategory(categories: Category[], id: number | null | undefined): Category | undefined {
  let node = categories.find((c) => c.id === id);
  while (node?.parent_id) node = categories.find((c) => c.id === node!.parent_id);
  return node;
}

export function descendantIds(categories: Category[], id: number): number[] {
  const out: number[] = [id];
  for (let i = 0; i < out.length; i += 1) for (const c of categories) if (c.parent_id === out[i]) out.push(c.id);
  return out;
}

function locationIdsWithin(locations: Location[], id: number): number[] {
  return [id, ...locations.filter((l) => l.parent_id === id).map((l) => l.id)];
}

export function locationLabel(locations: Location[], id: number | null | undefined): string | null {
  const loc = locations.find((l) => l.id === id);
  if (!loc) return null;
  const parent = locations.find((l) => l.id === loc.parent_id);
  const strip = (s: string) => s.replace(/^محافظة\s+/, "").replace(/\s+Governorate$/, "");
  return parent ? `${pickName(loc)}، ${strip(pickName(parent))}` : strip(pickName(loc));
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/** Raw database statuses. UI labels live in components/market (statusLabel). */
export type AiVerdict = { verdict: "ok" | "review" | "reject" | "error"; confidence: number | null; reason: string | null; categories: string[]; mode: string; applied: boolean; createdAt: string };
export type AiMode = "off" | "shadow" | "enforce";

export type DbStatus = "draft" | "pending" | "active" | "paused" | "rejected" | "sold" | "reserved" | "expired" | "archived";

const LISTING_SELECT =
  "id, user_id, title, description, price, currency, status, condition, phone, whatsapp, views_count, is_featured, created_at, updated_at, attributes, category_id, subcategory_id, location_id," +
  " seller:profiles!listings_user_id_fkey(id, full_name, username, avatar_url, created_at)," +
  " media:listing_media(id, media_url, sort_order)";

type RawListing = {
  id: string; user_id: string; title: string | null; description: string | null; price: number | string | null; currency: string | null;
  status: DbStatus; condition: Condition | null; phone: string | null; whatsapp: string | null; views_count: number | null; is_featured: boolean | null;
  created_at: string; updated_at: string; attributes: Record<string, unknown> | null;
  category_id: number | null; subcategory_id: number | null; location_id: number | null;
  seller: { id: string; full_name: string | null; username: string | null; avatar_url: string | null; created_at: string } | null;
  media: { id: string; media_url: string; sort_order: number }[] | null;
};

export type Listing = {
  id: string;
  /** Same as id; kept for screens written against the original API. */
  publicId: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
  sellerSince: string | null;
  title: string;
  description: string;
  priceValue: number | null;
  /** Display price in the active language, or the seller's own text (e.g. "على السوم"). */
  price: string;
  status: DbStatus;
  condition: Condition | null;
  phone: string | null;
  whatsapp: string | null;
  views: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  categoryId: number | null;
  subcategoryId: number | null;
  locationId: number | null;
  attributes: Record<string, unknown>;
  images: { id: string; url: string }[];
  imageUrl: string | null;
  moderationReason: string | null;
  /** auto_rejected / auto_review / ai_review = automatic checks; rejected / suspended / approved = admin. */
  moderationStatus: string | null;
  /** Latest AI review (admin lists only). */
  ai?: AiVerdict | null;
  version: number;
};

function toListing(row: RawListing): Listing {
  const attrs = row.attributes ?? {};
  const images = [...(row.media ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((m) => ({ id: m.id, url: m.media_url }));
  const priceValue = row.price === null || row.price === "" ? null : Number(row.price);
  const priceText = typeof attrs.price_text === "string" && attrs.price_text.trim() && Number.isNaN(Number(attrs.price_text.replace(/[^\d.]/g, "") || "x")) ? attrs.price_text : null;
  return {
    id: row.id,
    publicId: row.id,
    sellerId: row.user_id,
    sellerName: row.seller?.full_name || row.seller?.username || t("معلن دار السلع"),
    sellerAvatar: row.seller?.avatar_url ?? null,
    sellerSince: row.seller?.created_at ?? null,
    title: row.title?.trim() || t("إعلان بدون عنوان"),
    description: row.description ?? "",
    priceValue,
    price: priceText ?? formatPrice(priceValue) ?? t("السعر عند التواصل"),
    status: row.status,
    condition: row.condition,
    phone: row.phone,
    whatsapp: row.whatsapp,
    views: row.views_count ?? 0,
    isFeatured: Boolean(row.is_featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    locationId: row.location_id,
    attributes: attrs,
    images,
    imageUrl: images[0]?.url ?? null,
    moderationReason: typeof attrs.moderation_reason === "string" ? attrs.moderation_reason : null,
    moderationStatus: typeof attrs.moderation_status === "string" ? attrs.moderation_status : null,
    version: typeof attrs.version === "number" ? attrs.version : 1,
  };
}

const toListings = (rows: unknown) => ((rows ?? []) as RawListing[]).map(toListing);

export type SortKey = "relevance" | "newest" | "oldest" | "price_asc" | "price_desc" | "popular";

export type ListingFilters = {
  q?: string;
  categoryId?: number | null;
  locationId?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  condition?: Condition | null;
  sellerId?: string | null;
  featured?: boolean;
  attrs?: Record<string, string>;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  excludeId?: string;
};

export const PAGE_SIZE = 20;

/** Server-side search, filters, sorting and pagination over active listings (spec 4.3). */
export async function searchListings(filters: ListingFilters = {}): Promise<{ items: Listing[]; hasMore: boolean }> {
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = filters.page ?? 0;
  let query = supabase.from("listings").select(LISTING_SELECT).eq("status", "active");

  if (filters.categoryId) {
    const categories = await getCategories();
    const node = categories.find((c) => c.id === filters.categoryId);
    if (node && !node.parent_id) query = query.eq("category_id", node.id);
    else query = query.in("subcategory_id", descendantIds(categories, filters.categoryId));
  }
  if (filters.locationId) {
    const locations = await getLocations();
    query = query.in("location_id", locationIdsWithin(locations, filters.locationId));
  }
  if (filters.minPrice != null) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice != null) query = query.lte("price", filters.maxPrice);
  if (filters.condition) query = query.eq("condition", filters.condition);
  if (filters.sellerId) query = query.eq("user_id", filters.sellerId);
  if (filters.featured) query = query.eq("is_featured", true);
  if (filters.excludeId) query = query.neq("id", filters.excludeId);
  for (const [key, value] of Object.entries(filters.attrs ?? {})) {
    if (value && /^[a-z_]{2,30}$/.test(key)) query = query.ilike(`attributes->>${key}`, likeTerm(value));
  }
  const q = filters.q?.trim();
  if (q) {
    const term = likeTerm(q);
    query = query.or(`title.ilike.${term},description.ilike.${term}`);
  }

  switch (filters.sort ?? (q ? "relevance" : "newest")) {
    case "oldest": query = query.order("created_at", { ascending: true }); break;
    case "price_asc": query = query.order("price", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }); break;
    case "price_desc": query = query.order("price", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }); break;
    case "relevance": query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false }); break;
    case "popular": query = query.order("views_count", { ascending: false }).order("created_at", { ascending: false }); break;
    default: query = query.order("created_at", { ascending: false });
  }

  const from = page * pageSize;
  const { data, error } = await query.range(from, from + pageSize);
  if (error) throw new Error(error.message);
  const rows = toListings(data);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

/** Backwards-compatible list used by older screens. */
export async function listPublicListings(input?: { limit?: number }): Promise<Listing[]> {
  return (await searchListings({ pageSize: Math.max(1, Math.min(input?.limit ?? 30, 100)) })).items;
}

/** Public listing; the owner (and admins, through RLS) also see their non-active listings. */
export async function getListing(input: { publicId: string }): Promise<Listing> {
  const { data, error } = await supabase.from("listings").select(LISTING_SELECT).eq("id", input.publicId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("LISTING_NOT_FOUND");
  return toListing(data as unknown as RawListing);
}
export const getPublicListing = getListing;

export async function getRelatedListings(listing: Listing): Promise<Listing[]> {
  const categoryId = listing.subcategoryId ?? listing.categoryId;
  if (!categoryId) return [];
  return (await searchListings({ categoryId, excludeId: listing.id, pageSize: 8 })).items;
}

export async function getMyListings(): Promise<Listing[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("listings").select(LISTING_SELECT).eq("user_id", userId).order("updated_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return toListings(data);
}

export type ListingInput = {
  id?: string | null;
  categoryId: number | null;
  subcategoryId: number | null;
  title: string;
  description: string;
  price: string;
  condition: Condition | null;
  locationId: number | null;
  phone: string;
  whatsapp?: string;
  attributes: Record<string, string>;
};

function parsePrice(text: string): number | null {
  const western = text.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[٬,\s]/g, "").replace(/٫/g, ".");
  const match = /\d+(\.\d+)?/.exec(western);
  return match ? Number(match[0]) : null;
}

/** Validate a listing before saving. Returns translated messages, empty when valid. */
export function validateListing(input: ListingInput, options: { requireAll: boolean; fieldsRequired?: { key: string; label: string }[] }): string[] {
  const errors: string[] = [];
  if (!input.categoryId) errors.push(t("اختر التصنيف."));
  if (input.title.trim().length < 3) errors.push(t("العنوان قصير جدًا (3 أحرف على الأقل)."));
  if (input.title.trim().length > 140) errors.push(t("العنوان طويل جدًا (140 حرفًا كحد أقصى)."));
  if (!options.requireAll) return errors;
  if (input.description.trim().length < 10) errors.push(t("الوصف قصير جدًا (10 أحرف على الأقل)."));
  if (input.price.trim() && parsePrice(input.price) === null) errors.push(t("اكتب السعر بالأرقام."));
  if (!input.locationId) errors.push(t("اختر الموقع."));
  if (!/^[+\d\s٠-٩-]{8,20}$/.test(input.phone.trim())) errors.push(t("رقم الهاتف غير صحيح."));
  for (const field of options.fieldsRequired ?? []) if (!String(input.attributes[field.key] ?? "").trim()) errors.push(t("أكمل حقل: {field}", { field: t(field.label) }));
  return errors;
}

function listingColumns(input: ListingInput, existingAttributes: Record<string, unknown> = {}) {
  const cleanAttrs: Record<string, unknown> = { ...existingAttributes };
  for (const [key, value] of Object.entries(input.attributes)) {
    if (/^[a-z_]{2,30}$/.test(key)) cleanAttrs[key] = typeof value === "string" ? value.trim().slice(0, 120) : value;
  }
  delete cleanAttrs.price_text;
  return {
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    title: input.title.trim().slice(0, 140) || t("مسودة إعلان"),
    description: input.description.trim().slice(0, 4000) || null,
    price: input.price.trim() ? parsePrice(input.price) : null,
    condition: input.condition,
    location_id: input.locationId,
    phone: input.phone.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    attributes: cleanAttrs,
  };
}

async function autoPublish(): Promise<boolean> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "listing_auto_publish").maybeSingle();
  return data?.value !== false;
}

/** Create or update the user's own listing. `publish` submits it (active or pending per platform rules). */
export async function saveListing(input: ListingInput, publish: boolean): Promise<Listing> {
  const userId = await requireUserId();
  let existing: { status: DbStatus; attributes: Record<string, unknown> | null } | null = null;
  if (input.id) {
    const { data, error } = await supabase.from("listings").select("status, attributes, user_id").eq("id", input.id).maybeSingle();
    if (error) fail(error);
    if (!data || data.user_id !== userId) throw new Error("LISTING_NOT_FOUND");
    existing = data as { status: DbStatus; attributes: Record<string, unknown> | null };
  }
  const columns = listingColumns(input, existing?.attributes ?? {});
  const version = (typeof existing?.attributes?.version === "number" ? existing.attributes.version : 0) + 1;
  (columns.attributes as Record<string, unknown>).version = version;

  let status: DbStatus = existing?.status ?? "draft";
  const autoRejected = status === "rejected" && existing?.attributes?.moderation_status === "auto_rejected";
  if (publish && (status === "draft" || autoRejected || !existing)) status = (await autoPublish()) ? "active" : "pending";

  if (existing && input.id) {
    const { data, error } = await supabase.from("listings").update({ ...columns, status }).eq("id", input.id).eq("user_id", userId).select(LISTING_SELECT).single();
    if (error) fail(error, "تعذر حفظ الإعلان.");
    return toListing(data as unknown as RawListing);
  }
  const { data, error } = await supabase.from("listings").insert({ ...columns, status, user_id: userId }).select(LISTING_SELECT).single();
  if (error) fail(error, "تعذر حفظ الإعلان.");
  return toListing(data as unknown as RawListing);
}

/** Owner actions: pause, reactivate, mark sold, move back to draft. */
export async function setListingStatus(input: { id: string; status: "active" | "paused" | "sold" | "draft" }) {
  const userId = await requireUserId();
  const { error, count } = await supabase.from("listings").update({ status: input.status }, { count: "exact" }).eq("id", input.id).eq("user_id", userId);
  if (error) fail(error);
  if (!count) throw new Error("LISTING_NOT_FOUND");
  return { success: true } as const;
}

export async function deleteListing(input: { id: string }) {
  const userId = await requireUserId();
  const { data: media } = await supabase.from("listing_media").select("media_url").eq("listing_id", input.id);
  await supabase.from("listing_media").delete().eq("listing_id", input.id);
  await supabase.from("favorites").delete().eq("listing_id", input.id);
  const { error, count } = await supabase.from("listings").delete({ count: "exact" }).eq("id", input.id).eq("user_id", userId);
  if (error) fail(error, "تعذر حذف الإعلان.");
  if (!count) throw new Error("LISTING_NOT_FOUND");
  await removeStorageFiles((media ?? []).map((m) => m.media_url as string));
  return { success: true } as const;
}

// ---------------------------------------------------------------------------
// Media (Supabase Storage bucket "listing-media"; first folder = user id, enforced by policy)
// ---------------------------------------------------------------------------

function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${LISTING_MEDIA_BUCKET}/`;
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
}

async function removeStorageFiles(urls: string[]) {
  const paths = urls.map(storagePathFromUrl).filter((p): p is string => Boolean(p));
  if (paths.length) await supabase.storage.from(LISTING_MEDIA_BUCKET).remove(paths);
}

function dataUrlToBytes(dataUrl: string) {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("INVALID_IMAGE_BYTES");
  const extension = match[1] === "jpg" ? "jpeg" : match[1];
  const binary = globalThis.atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, mimeType: `image/${extension}`, extension };
}

/** Validates type, magic bytes and size, then uploads into the user's own folder. */
export async function uploadImage(dataUrl: string, folder: string): Promise<string> {
  const userId = await requireUserId();
  if (!isSupportedImageDataUrl(dataUrl)) throw new Error("INVALID_IMAGE_BYTES");
  const { bytes, mimeType, extension } = dataUrlToBytes(dataUrl);
  if (bytes.length === 0 || bytes.length > 1_500_000) throw new Error("MEDIA_SIZE_INVALID");
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "misc";
  const path = `${userId}/${safeFolder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from(LISTING_MEDIA_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(LISTING_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function addListingImage(listingId: string, dataUrl: string, sortOrder: number) {
  const url = await uploadImage(dataUrl, listingId);
  const { data, error } = await supabase.from("listing_media").insert({ listing_id: listingId, media_url: url, media_type: "image", sort_order: sortOrder }).select("id").single();
  if (error) {
    await removeStorageFiles([url]);
    fail(error, "تعذر رفع الصورة.");
  }
  return { id: data.id as string, url };
}

export async function removeListingImage(mediaId: string) {
  const { data } = await supabase.from("listing_media").select("media_url").eq("id", mediaId).maybeSingle();
  const { error, count } = await supabase.from("listing_media").delete({ count: "exact" }).eq("id", mediaId);
  if (error || !count) throw new Error(t("تعذر حذف الصورة."));
  if (data?.media_url) await removeStorageFiles([data.media_url as string]);
  return { success: true } as const;
}

// ---------------------------------------------------------------------------
// Moderation (local checks; an AI check can move to an Edge Function later)
// ---------------------------------------------------------------------------

const BLOCKED_TERMS = ["سلاح", "أسلحة", "اسلحة", "ذخيرة", "مسدس", "بندقية", "مخدرات", "حشيش", "كوكايين", "هيروين", "حبوب مخدرة", "إباحي", "اباحي", "دعارة", "تزوير", "جواز سفر للبيع", "بطاقات ائتمان مسروقة", "weapon", "firearm", "ammo", "cocaine", "heroin", "porn", "escort"];

export function checkListingText(title: string, description: string): string | null {
  const haystack = ` ${title} ${description} `.toLowerCase();
  const hit = BLOCKED_TERMS.find((term) => new RegExp(`(^|[\\s،,.!؟?])${term.toLowerCase()}`).test(haystack));
  return hit ? t("يحتوي الإعلان على كلمات مرتبطة بمواد ممنوعة ولا يمكن نشره.") : null;
}

// ---------------------------------------------------------------------------
// Favorites, views, ratings
// ---------------------------------------------------------------------------

export async function getFavoriteIds(): Promise<Set<string>> {
  const userId = await currentUserId();
  if (!userId) return new Set();
  const { data } = await supabase.from("favorites").select("listing_id").eq("user_id", userId);
  return new Set((data ?? []).map((row) => row.listing_id as string));
}

export async function toggleFavorite(input: { listingId: string; save: boolean }) {
  const userId = await requireUserId();
  const { error } = input.save
    ? await supabase.from("favorites").upsert({ user_id: userId, listing_id: input.listingId }, { onConflict: "user_id,listing_id" })
    : await supabase.from("favorites").delete().eq("user_id", userId).eq("listing_id", input.listingId);
  if (error) fail(error);
  return input.save;
}

export type SavedListing = { listing: Listing | null; listingId: string; savedAt: string; available: boolean };

/** Saved listings, including ones that were removed or are no longer active (spec 4.9). */
export async function getSavedListings(): Promise<SavedListing[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("favorites").select(`listing_id, created_at, listing:listings(${LISTING_SELECT})`).eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
  type Row = { listing_id: string; created_at: string; listing: RawListing | null };
  return rowsOrEmpty(data as unknown as Row[], error).map((row) => ({
    listingId: row.listing_id,
    savedAt: row.created_at,
    listing: row.listing ? toListing(row.listing) : null,
    available: row.listing?.status === "active",
  }));
}

export async function recordView(input: { publicId: string }) {
  const userId = await currentUserId();
  if (!userId) return null;
  await supabase.rpc("increment_listing_views", { p_listing_id: input.publicId }).then(() => undefined, () => undefined);
  await supabase.from("listing_views").upsert({ listing_id: input.publicId, viewer_user_id: userId, viewed_at: new Date().toISOString() }, { onConflict: "listing_id,viewer_user_id" });
  return true;
}

export async function getRecentViews() {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("listing_views").select(`viewed_at, listing:listings(${LISTING_SELECT})`).eq("viewer_user_id", userId).order("viewed_at", { ascending: false }).limit(100);
  type Row = { viewed_at: string; listing: RawListing | null };
  return rowsOrEmpty(data as unknown as Row[], error)
    .filter((row) => row.listing?.status === "active")
    .map((row) => ({ listing: toListing(row.listing!), viewedAt: row.viewed_at }));
}

export async function rateListing(input: { publicId: string; rating: number; comment?: string }) {
  const userId = await requireUserId();
  const { data: listing } = await supabase.from("listings").select("user_id").eq("id", input.publicId).maybeSingle();
  if (!listing || listing.user_id === userId) throw new Error(t("لا يمكنك تقييم إعلانك."));
  const { error } = await supabase.from("listing_ratings").upsert({ listing_id: input.publicId, reviewer_user_id: userId, seller_id: listing.user_id, rating: input.rating, comment: input.comment?.trim() || null }, { onConflict: "listing_id,reviewer_user_id" });
  if (error) fail(error, "افتح الإعلان أولًا ثم قيّمه.");
  // The server checks the comment; tell the user if it waits for review.
  const { data: saved } = await supabase.from("listing_ratings").select("comment_status").eq("listing_id", input.publicId).eq("reviewer_user_id", userId).maybeSingle();
  return { commentStatus: (saved?.comment_status as "none" | "visible" | "review" | "hidden" | undefined) ?? "none" };
}

export type SellerReview = { rating: number; comment: string | null; createdAt: string; reviewerName: string; listingTitle: string | null };

/** Public reviews of a seller (comments waiting for review are never returned). */
export async function getSellerReviews(sellerId: string): Promise<SellerReview[]> {
  const { data, error } = await supabase.rpc("seller_reviews", { p_seller: sellerId, p_limit: 30 });
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((r) => ({ rating: Number(r.rating), comment: r.comment, createdAt: r.created_at, reviewerName: r.reviewer_name || t("مستخدم دار السلع"), listingTitle: r.listing_title }));
}

export async function getSellerRating(sellerId: string): Promise<{ average: number; count: number }> {
  const { data } = await supabase.from("listing_ratings").select("rating").eq("seller_id", sellerId).limit(500);
  const ratings = (data ?? []).map((r) => Number(r.rating));
  return { count: ratings.length, average: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0 };
}

// ---------------------------------------------------------------------------
// Account & profile
// ---------------------------------------------------------------------------

export type AppUser = {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  bio: string | null;
  avatarUrl: string | null;
  loginMethod: string | null;
  role?: "user" | "admin" | "merchant";
  merchantStatus?: "none" | "pending" | "active" | "rejected" | "suspended";
  lastSignedIn: Date;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  const { data } = await supabase.auth.getSession();
  const authUser = data.session?.user;
  if (!authUser) return null;
  // my_profile() returns the full own row (phone included); phone is not readable for other users.
  const { data: profile } = await supabase.rpc("my_profile").maybeSingle();
  const p = (profile ?? {}) as Record<string, unknown>;
  const role = p.role === "admin" || p.role === "merchant" ? p.role : "user";
  return {
    id: authUser.id,
    openId: authUser.id,
    name: (p.full_name as string | null) ?? (authUser.user_metadata?.full_name as string | undefined) ?? authUser.email?.split("@")[0] ?? null,
    email: authUser.email ?? null,
    phone: (p.phone as string | null) ?? null,
    city: (p.city as string | null) ?? null,
    bio: (p.bio as string | null) ?? null,
    avatarUrl: (p.avatar_url as string | null) ?? null,
    loginMethod: authUser.app_metadata?.provider ?? null,
    role,
    merchantStatus: (p.merchant_status as AppUser["merchantStatus"]) ?? "none",
    lastSignedIn: new Date(authUser.last_sign_in_at ?? Date.now()),
  };
}

export async function updateProfile(input: { fullName: string; phone: string; city: string; bio: string; avatarUrl?: string | null }) {
  const userId = await requireUserId();
  if (input.fullName.trim().length < 2) throw new Error(t("الاسم قصير جدًا."));
  if (input.phone.trim() && !/^[+\d\s٠-٩-]{8,20}$/.test(input.phone.trim())) throw new Error(t("رقم الهاتف غير صحيح."));
  const values: Record<string, unknown> = { full_name: input.fullName.trim().slice(0, 80), phone: input.phone.trim() || null, city: input.city.trim().slice(0, 60) || null, bio: input.bio.trim().slice(0, 500) || null };
  if (input.avatarUrl !== undefined) values.avatar_url = input.avatarUrl;
  const { error } = await supabase.from("profiles").update(values).eq("id", userId);
  if (error) fail(error, "تعذر حفظ الملف الشخصي.");
  return true;
}

export async function changePassword(newPassword: string) {
  if (newPassword.length < 8) throw new Error(t("كلمة المرور يجب أن تكون 8 أحرف على الأقل."));
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  return true;
}

export async function getPermissions() {
  const user = await getCurrentUser();
  if (!user) throw new Error("LOGIN_REQUIRED");
  return getMarketplacePermissions({ role: user.role ?? "user", merchantStatus: user.merchantStatus, subscription: null });
}

export async function logout() {
  await supabase.auth.signOut();
  return { success: true } as const;
}

/**
 * Account deletion request: removes the user's listings, images, favorites and store, clears the
 * profile and signs out. Removing the login itself needs a server function with service_role.
 */
export async function deleteAccount() {
  const userId = await requireUserId();
  const failures: string[] = [];
  const { data: mine } = await supabase.from("listings").select("id").eq("user_id", userId);
  for (const row of mine ?? []) {
    try { await deleteListing({ id: row.id as string }); } catch { failures.push(row.id as string); }
  }
  await supabase.from("favorites").delete().eq("user_id", userId);
  await supabase.from("profiles").update({ full_name: null, phone: null, bio: null, avatar_url: null, city: null }).eq("id", userId);
  if (failures.length) throw new Error(t("تعذر حذف بعض الإعلانات. حاول مرة أخرى."));
  await supabase.auth.signOut();
  return { success: true } as const;
}

// ---------------------------------------------------------------------------
// Stores (spec 4.7)
// ---------------------------------------------------------------------------

export type StoreType = "small_shop" | "merchant" | "supplier" | "service_provider";
export type Store = {
  id: string; ownerId: string; name: string; description: string | null; logoUrl: string | null; coverUrl: string | null;
  locationId: number | null; phone: string | null; whatsapp: string | null; storeType: StoreType;
  status: "pending" | "active" | "suspended"; isFeatured: boolean; createdAt: string;
};

const toStore = (row: Record<string, any>): Store => ({
  id: row.id ?? row.store_id, ownerId: row.owner_id ?? row.merchant_id, name: row.name, description: row.description ?? null,
  logoUrl: row.logo_url ?? null, coverUrl: row.cover_url ?? null, locationId: row.location_id ?? null, phone: row.phone ?? null,
  whatsapp: row.whatsapp ?? null, storeType: row.store_type ?? "small_shop", status: row.status ?? "active",
  isFeatured: Boolean(row.is_featured), createdAt: row.created_at,
});

export async function listStores(input?: { featured?: boolean; q?: string; limit?: number }): Promise<Store[]> {
  let query = supabase.from("public_stores").select("*");
  if (input?.featured) query = query.eq("is_featured", true);
  if (input?.q?.trim()) query = query.ilike("name", likeTerm(input.q));
  const { data, error } = await query.order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(input?.limit ?? 50);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map(toStore);
}

export async function getStore(input: { merchantId: string }): Promise<{ store: Store; products: Listing[]; featured: Listing[] }> {
  const { data, error } = await supabase.from("public_stores").select("*").eq("merchant_id", input.merchantId).maybeSingle();
  if (error) fail(error);
  if (!data) throw new Error("STORE_NOT_FOUND");
  const store = toStore(data);
  const products = (await searchListings({ sellerId: store.ownerId, pageSize: 60 })).items;
  return { store, products, featured: products.filter((p) => p.isFeatured) };
}

export async function getMyStore(): Promise<Store | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("stores").select("*").eq("owner_id", userId).maybeSingle();
  if (error && !isMissingTable(error)) throw new Error(error.message);
  return data ? toStore(data) : null;
}

export type StoreInput = { name: string; description: string; logoUrl: string | null; coverUrl: string | null; locationId: number | null; phone: string; whatsapp: string; storeType: StoreType };

export async function saveMyStore(input: StoreInput): Promise<Store> {
  const userId = await requireUserId();
  if (input.name.trim().length < 2) throw new Error(t("اسم المتجر قصير جدًا."));
  const values = {
    name: input.name.trim().slice(0, 80), description: input.description.trim().slice(0, 1000) || null, logo_url: input.logoUrl, cover_url: input.coverUrl,
    location_id: input.locationId, phone: input.phone.trim() || null, whatsapp: input.whatsapp.trim() || null, store_type: input.storeType,
  };
  const existing = await getMyStore();
  const { data, error } = existing
    ? await supabase.from("stores").update(values).eq("owner_id", userId).select("*").single()
    : await supabase.from("stores").insert({ ...values, owner_id: userId }).select("*").single();
  if (error) fail(error, "تعذر حفظ المتجر.");
  return toStore(data);
}

// ---------------------------------------------------------------------------
// Messaging (spec 4.8)
// ---------------------------------------------------------------------------

export type Conversation = {
  id: string; listingId: string | null; listingTitle: string | null; listingImage: string | null;
  buyerId: string; sellerId: string; otherUserId: string; otherName: string; otherAvatar: string | null;
  status: "active" | "closed"; updatedAt: string; lastMessage: string | null; lastAt: string | null; unread: number; iAmSeller: boolean;
};
export type Message = { id: string; conversationId: string; senderId: string; body: string; imageUrl: string | null; readAt: string | null; createdAt: string };

export async function listConversations(): Promise<Conversation[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("store_conversations")
    .select("*, listing:listings(id, title, media:listing_media(media_url, sort_order)), buyer:profiles!store_conversations_buyer_user_id_fkey(full_name, username, avatar_url), seller:profiles!store_conversations_merchant_user_id_fkey(full_name, username, avatar_url)")
    .or(`buyer_user_id.eq.${userId},merchant_user_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows = rowsOrEmpty(data as Record<string, any>[] | null, error);
  if (!rows.length) return [];
  const { data: msgs } = await supabase.from("store_messages").select("conversation_id, sender_user_id, body, image_url, read_at, created_at").in("conversation_id", rows.map((r) => r.id)).order("created_at", { ascending: false }).limit(1000);
  return rows.map((row) => {
    const iAmSeller = row.merchant_user_id === userId;
    const other = iAmSeller ? row.buyer : row.seller;
    const mine = (msgs ?? []).filter((m) => m.conversation_id === row.id);
    const last = mine[0];
    const media = [...(row.listing?.media ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
    return {
      id: row.id, listingId: row.listing_id, listingTitle: row.listing?.title ?? null, listingImage: media[0]?.media_url ?? null,
      buyerId: row.buyer_user_id, sellerId: row.merchant_user_id, otherUserId: iAmSeller ? row.buyer_user_id : row.merchant_user_id,
      otherName: other?.full_name || other?.username || t("مستخدم"), otherAvatar: other?.avatar_url ?? null,
      status: row.status, updatedAt: row.updated_at, lastMessage: last ? (last.body || (last.image_url ? t("📷 صورة") : "")) : null, lastAt: last?.created_at ?? null,
      unread: mine.filter((m) => !m.read_at && m.sender_user_id !== userId).length, iAmSeller,
    };
  });
}

export async function unreadMessageCount(): Promise<number> {
  try {
    return (await listConversations()).reduce((sum, c) => sum + c.unread, 0);
  } catch {
    return 0;
  }
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  await requireUserId();
  const { data, error } = await supabase.from("store_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(300);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((r) => ({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_user_id, body: r.body, imageUrl: r.image_url ?? null, readAt: r.read_at, createdAt: r.created_at }));
}

export async function markConversationRead(conversationId: string) {
  const userId = await requireUserId();
  await supabase.from("store_messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", conversationId).neq("sender_user_id", userId).is("read_at", null);
}

export async function startConversation(listingId: string): Promise<string> {
  const userId = await requireUserId();
  const { data: listing } = await supabase.from("listings").select("id, user_id").eq("id", listingId).eq("status", "active").maybeSingle();
  if (!listing) throw new Error("LISTING_NOT_FOUND");
  if (listing.user_id === userId) throw new Error(t("هذا إعلانك."));
  const { data: existing } = await supabase.from("store_conversations").select("id").eq("listing_id", listingId).eq("buyer_user_id", userId).eq("status", "active").maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabase.from("store_conversations").insert({ listing_id: listingId, buyer_user_id: userId, merchant_user_id: listing.user_id, status: "active" }).select("id").single();
  if (error) fail(error, "تعذر بدء المحادثة.");
  return data.id as string;
}

export async function sendMessage(input: { conversationId: string; body: string; imageDataUrl?: string | null }) {
  const userId = await requireUserId();
  const body = input.body.trim().slice(0, 2000);
  let imageUrl: string | null = null;
  if (input.imageDataUrl) imageUrl = await uploadImage(input.imageDataUrl, "chat");
  if (!body && !imageUrl) throw new Error(t("اكتب رسالة أولًا."));
  const { error } = await supabase.from("store_messages").insert({ conversation_id: input.conversationId, sender_user_id: userId, body, image_url: imageUrl });
  if (error) fail(error, "تعذر إرسال الرسالة.");
  return true;
}

export async function getBlockedIds(): Promise<Set<string>> {
  const userId = await currentUserId();
  if (!userId) return new Set();
  const { data } = await supabase.from("user_blocks").select("blocked_user_id").eq("blocker_user_id", userId);
  return new Set((data ?? []).map((r) => r.blocked_user_id as string));
}

export async function setBlocked(input: { userId: string; blocked: boolean }) {
  const me = await requireUserId();
  const { error } = input.blocked
    ? await supabase.from("user_blocks").upsert({ blocker_user_id: me, blocked_user_id: input.userId }, { onConflict: "blocker_user_id,blocked_user_id" })
    : await supabase.from("user_blocks").delete().eq("blocker_user_id", me).eq("blocked_user_id", input.userId);
  if (error) fail(error);
  return input.blocked;
}

// ---------------------------------------------------------------------------
// Notifications (spec 4.11)
// ---------------------------------------------------------------------------

export type AppNotification = { id: number; type: string; title: string; body: string; listingId: string | null; readAt: string | null; createdAt: string };

export async function getNotifications(): Promise<AppNotification[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body, listingId: r.listing_id, readAt: r.read_at, createdAt: r.created_at }));
}

/** Unread notification count, optionally skipping muted types (chat_message / listing_*). */
export async function unreadNotificationCount(muted: { messages?: boolean; moderation?: boolean } = {}): Promise<number> {
  const userId = await currentUserId();
  if (!userId) return 0;
  let query = supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  if (muted.messages) query = query.neq("type", "chat_message");
  if (muted.moderation) query = query.not("type", "like", "listing\\_%");
  const { count } = await query;
  return count ?? 0;
}

export async function markNotificationsRead(ids?: number[]) {
  const userId = await requireUserId();
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  if (ids?.length) query = query.in("id", ids);
  const { error } = await query;
  if (error) fail(error);
  return true;
}

export async function getAnnouncement(): Promise<{ ar: string; en: string } | null> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "announcement").maybeSingle();
  const value = data?.value as { ar?: string; en?: string } | undefined;
  return value && (value.ar || value.en) ? { ar: value.ar ?? "", en: value.en ?? "" } : null;
}

// ---------------------------------------------------------------------------
// Reports (spec 4.13)
// ---------------------------------------------------------------------------

export type ReportReason = "fraud" | "misleading" | "inappropriate" | "suspicious_seller" | "prohibited" | "abuse" | "other";
export type Report = {
  id: string; reason: ReportReason; subject: string; details: string; status: "open" | "reviewing" | "resolved" | "dismissed";
  priority: "low" | "medium" | "high"; listingId: string | null; listingTitle: string | null; reportedUserId: string | null; reportedName: string | null;
  conversationId: string | null; reporterName: string | null; resolution: string | null; createdAt: string;
};

export async function createReport(input: { reason: ReportReason; details: string; listingId?: string | null; reportedUserId?: string | null; conversationId?: string | null }) {
  const userId = await requireUserId();
  const details = input.details.trim();
  if (details.length < 10) throw new Error(t("اكتب تفاصيل أكثر (10 أحرف على الأقل)."));
  const priority = input.reason === "fraud" || input.reason === "prohibited" || input.reason === "abuse" ? "high" : "medium";
  const { error } = await supabase.from("report_cases").insert({
    reporter_user_id: userId, reason: input.reason, subject: input.reason, details: details.slice(0, 1000), priority,
    listing_id: input.listingId ?? null, reported_user_id: input.reportedUserId ?? null, conversation_id: input.conversationId ?? null,
  });
  if (error) fail(error, "تعذر إرسال البلاغ.");
  return true;
}

const REPORT_SELECT = "*, listing:listings(id, title), reporter:profiles!report_cases_reporter_user_id_fkey(full_name, username), reported:profiles!report_cases_reported_user_id_fkey(full_name, username)";
const toReport = (r: Record<string, any>): Report => ({
  id: r.id, reason: r.reason, subject: r.subject, details: r.details, status: r.status, priority: r.priority, listingId: r.listing_id,
  listingTitle: r.listing?.title ?? null, reportedUserId: r.reported_user_id, reportedName: r.reported?.full_name || r.reported?.username || null,
  conversationId: r.conversation_id, reporterName: r.reporter?.full_name || r.reporter?.username || null, resolution: r.resolution, createdAt: r.created_at,
});

// ---------------------------------------------------------------------------
// Admin panel lock (0007): admin rights also need a password unlock in the last 30 minutes.
export type AdminUnlockResult = { ok: true; until: string } | { ok: false; reason: "wrong" | "locked" | "not_admin" | "not_configured"; remaining?: number; lockedUntil?: string };

export async function adminUnlockStatus(): Promise<string | null> {
  const { data, error } = await supabase.rpc("admin_unlock_status");
  if (error) throw new Error(friendlyError(error));
  return (data as string | null) ?? null;
}

export async function adminUnlock(password: string): Promise<AdminUnlockResult> {
  const { data, error } = await supabase.rpc("admin_unlock", { p_password: password });
  if (error) throw new Error(friendlyError(error));
  const r = data as { ok: boolean; reason?: string; remaining?: number; locked_until?: string; unlocked_until?: string };
  if (r.ok) return { ok: true, until: r.unlocked_until! };
  return { ok: false, reason: (r.reason as "wrong") ?? "wrong", remaining: r.remaining, lockedUntil: r.locked_until };
}

export async function adminLock() {
  await supabase.rpc("admin_lock");
}

// Administration (spec 4.15). Every call is re-checked by RLS (is_admin()) and
// every change is written to admin_audit_logs by a database trigger.
// ---------------------------------------------------------------------------

export async function adminOverview() {
  const count = async (table: string, filter?: (q: any) => any) => {
    let query: any = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) query = filter(query);
    const { count: n } = await query;
    return n ?? 0;
  };
  const [users, active, pending, rejected, paused, storesPending, storesActive, reportsOpen, conversations] = await Promise.all([
    count("profiles"),
    count("listings", (q) => q.eq("status", "active")),
    count("listings", (q) => q.eq("status", "pending")),
    count("listings", (q) => q.eq("status", "rejected")),
    count("listings", (q) => q.eq("status", "paused")),
    count("stores", (q) => q.eq("status", "pending")),
    count("stores", (q) => q.eq("status", "active")),
    count("report_cases", (q) => q.in("status", ["open", "reviewing"])),
    count("store_conversations"),
  ]);
  return { users, listings: { active, pending, rejected, paused }, stores: { pending: storesPending, active: storesActive }, reportsOpen, conversations };
}

export async function adminListings(input: { status?: DbStatus | "all"; q?: string }): Promise<Listing[]> {
  let query = supabase.from("listings").select(LISTING_SELECT).order("created_at", { ascending: false }).limit(200);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  if (input.q?.trim()) query = query.ilike("title", likeTerm(input.q));
  const { data, error } = await query;
  if (error) fail(error);
  const items = toListings(data);
  // Attach the latest AI verdict per listing (admins can read ai_moderation_results).
  if (items.length) {
    const { data: results } = await supabase.from("ai_moderation_results")
      .select("listing_id, verdict, confidence, reason, categories, mode, applied, created_at")
      .in("listing_id", items.map((l) => l.id)).order("created_at", { ascending: false }).limit(500);
    const latest = new Map<string, AiVerdict>();
    for (const r of results ?? []) if (!latest.has(r.listing_id)) latest.set(r.listing_id, { verdict: r.verdict, confidence: r.confidence === null ? null : Number(r.confidence), reason: r.reason, categories: r.categories ?? [], mode: r.mode, applied: r.applied, createdAt: r.created_at });
    for (const l of items) l.ai = latest.get(l.id) ?? null;
  }
  return items;
}

export async function moderateListing(input: { id: string; action: "approve" | "reject" | "suspend" | "feature" | "unfeature"; reason?: string }) {
  await requireUserId();
  const { data: current, error: readError } = await supabase.from("listings").select("attributes").eq("id", input.id).maybeSingle();
  if (readError) fail(readError);
  if (!current) throw new Error("LISTING_NOT_FOUND");
  const attributes = { ...((current.attributes as Record<string, unknown>) ?? {}) };
  let values: Record<string, unknown> = {};
  if (input.action === "feature" || input.action === "unfeature") values = { is_featured: input.action === "feature" };
  else {
    if ((input.action === "reject" || input.action === "suspend") && !input.reason?.trim()) throw new Error(t("اكتب سبب القرار."));
    attributes.moderation_status = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "suspended";
    attributes.moderation_reason = input.reason?.trim() || null;
    values = { status: input.action === "approve" ? "active" : "rejected", attributes };
  }
  const { data, error } = await supabase.from("listings").update(values).eq("id", input.id).select("id").maybeSingle();
  if (error) fail(error);
  if (!data) throw new Error(t("لا تملك صلاحية المشرف لهذا الإجراء."));
  return true;
}

export type AdminUser = { id: string; name: string; username: string | null; phone: string | null; role: "user" | "merchant" | "admin"; merchantStatus: string; createdAt: string; restriction: Restriction | null };

export async function adminUsers(input: { q?: string }): Promise<AdminUser[]> {
  // admin_list_profiles() is checked with is_admin() on the server and includes phone numbers.
  const [{ data, error }, restrictions] = await Promise.all([
    supabase.rpc("admin_list_profiles", { q: input.q?.trim() || null }),
    supabase.from("account_restrictions").select("user_id, until, reason"),
  ]);
  const active = new Map<string, Restriction>();
  for (const r of restrictions.data ?? []) if (!r.until || new Date(r.until).getTime() > Date.now()) active.set(r.user_id, { until: r.until, reason: r.reason });
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((r) => ({ id: r.id, name: r.full_name || r.username || "—", username: r.username, phone: r.phone, role: r.role ?? "user", merchantStatus: r.merchant_status ?? "none", createdAt: r.created_at, restriction: active.get(r.id) ?? null }));
}

// ---------------------------------------------------------------------------
// Account suspensions (0008): enforced by RLS; set only through audited admin functions.
// ---------------------------------------------------------------------------

/** True when the decision came from an automatic check, not an admin. */
export function isAutomaticDecision(status: string | null | undefined) {
  return Boolean(status && (status.startsWith("auto_") || status === "ai_review"));
}

export type Restriction = { until: string | null; reason: string };

/** The signed-in user's active suspension, or null. */
export async function getMyRestriction(): Promise<Restriction | null> {
  if (!(await currentUserId())) return null;
  const { data, error } = await supabase.rpc("my_restriction");
  if (error) return null;
  const row = (data as { until: string | null; reason: string }[] | null)?.[0];
  return row ? { until: row.until, reason: row.reason } : null;
}

// ---------------------------------------------------------------------------
// Appeals (0009)
// ---------------------------------------------------------------------------

export type AppealKind = "listing" | "account";
export type Appeal = { id: number; kind: AppealKind; listingId: string | null; listingTitle: string | null; originalReason: string | null; statement: string; status: "open" | "accepted" | "rejected"; decisionNote: string | null; createdAt: string; decidedAt: string | null; userName?: string };

function toAppeal(r: Record<string, any>): Appeal {
  return { id: r.id, kind: r.kind, listingId: r.listing_id, listingTitle: r.listing?.title ?? null, originalReason: r.original_reason, statement: r.statement, status: r.status, decisionNote: r.decision_note, createdAt: r.created_at, decidedAt: r.decided_at };
}

export async function fileAppeal(input: { kind: AppealKind; listingId?: string | null; statement: string }) {
  const { error } = await supabase.rpc("file_appeal", { p_kind: input.kind, p_listing: input.listingId ?? null, p_statement: input.statement.trim() });
  if (error) fail(error);
  return true;
}

/** The signed-in user's appeals, newest first (optionally for one subject). */
export async function getMyAppeals(input: { kind?: AppealKind; listingId?: string | null } = {}): Promise<Appeal[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  let query = supabase.from("appeals").select("*, listing:listings(title)").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (input.kind) query = query.eq("kind", input.kind);
  if (input.listingId) query = query.eq("listing_id", input.listingId);
  const { data, error } = await query;
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map(toAppeal);
}

export async function adminAppeals(status: "open" | "decided"): Promise<Appeal[]> {
  let query = supabase.from("appeals").select("*, listing:listings(title)").order("created_at", { ascending: status === "open" }).limit(100);
  query = status === "open" ? query.eq("status", "open") : query.neq("status", "open");
  const { data, error } = await query;
  const rows = rowsOrEmpty(data as Record<string, any>[] | null, error);
  const ids = [...new Set(rows.map((r) => r.user_id as string))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
    for (const p of people ?? []) names.set(p.id, p.full_name || p.username || "—");
  }
  return rows.map((r) => ({ ...toAppeal(r), userName: names.get(r.user_id) ?? "—" }));
}

export async function adminDecideAppeal(input: { id: number; accept: boolean; note: string }) {
  const { error } = await supabase.rpc("admin_decide_appeal", { p_id: input.id, p_accept: input.accept, p_note: input.note.trim() });
  if (error) fail(error);
  return true;
}

// ---------------------------------------------------------------------------
// Rating comments moderation (0009)
// ---------------------------------------------------------------------------

export type AdminRatingComment = { listingId: string; reviewerId: string; sellerId: string; rating: number; text: string; status: "review" | "visible" | "hidden"; createdAt: string; reviewerName: string; sellerName: string; listingTitle: string | null };

export async function adminRatingComments(status: "review" | "visible" | "hidden"): Promise<AdminRatingComment[]> {
  const { data, error } = await supabase.rpc("admin_list_rating_comments", { p_status: status });
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((r) => ({ listingId: r.listing_id, reviewerId: r.reviewer_user_id, sellerId: r.seller_id, rating: Number(r.rating), text: r.text ?? "", status: r.comment_status, createdAt: r.created_at, reviewerName: r.reviewer_name || "—", sellerName: r.seller_name || "—", listingTitle: r.listing_title }));
}

export async function adminModerateRating(input: { listingId: string; reviewerId: string; action: "approve" | "hide" }) {
  const { error } = await supabase.rpc("admin_moderate_rating", { p_listing: input.listingId, p_reviewer: input.reviewerId, p_action: input.action });
  if (error) fail(error);
  return true;
}

/** days = null suspends permanently. */
export async function adminSuspendUser(input: { userId: string; days: number | null; reason: string }) {
  const { error } = await supabase.rpc("admin_suspend_user", { p_user: input.userId, p_days: input.days, p_reason: input.reason });
  if (error) fail(error);
  return true;
}

export async function adminLiftSuspension(userId: string) {
  const { error } = await supabase.rpc("admin_lift_suspension", { p_user: userId });
  if (error) fail(error);
  return true;
}

export async function adminSetRole(input: { userId: string; role: "user" | "merchant" | "admin" }) {
  const { error } = await supabase.from("profiles").update({ role: input.role, merchant_status: input.role === "merchant" ? "active" : "none" }).eq("id", input.userId);
  if (error) fail(error);
  return true;
}

export async function adminStores(): Promise<(Store & { ownerName: string })[]> {
  const { data, error } = await supabase.from("stores").select("*, owner:profiles!stores_owner_id_fkey(full_name, username)").order("created_at", { ascending: false }).limit(200);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((r) => ({ ...toStore(r), ownerName: r.owner?.full_name || r.owner?.username || "—" }));
}

export async function adminUpdateStore(input: { id: string; status?: Store["status"]; isFeatured?: boolean }) {
  const values: Record<string, unknown> = {};
  if (input.status) values.status = input.status;
  if (input.isFeatured !== undefined) values.is_featured = input.isFeatured;
  const { error } = await supabase.from("stores").update(values).eq("id", input.id);
  if (error) fail(error);
  return true;
}

export async function adminCategories(): Promise<(Category & { is_active: boolean })[]> {
  const { data, error } = await supabase.from("categories").select("id, slug, name, name_ar, icon, parent_id, sort_order, is_active").not("slug", "like", "old-%").order("sort_order").order("id");
  return rowsOrEmpty(data as (Category & { is_active: boolean })[] | null, error);
}

export async function adminSaveCategory(input: { id?: number; name: string; name_ar: string; parent_id: number | null; is_active?: boolean }) {
  if (!input.name.trim() || !input.name_ar.trim()) throw new Error(t("اكتب الاسم بالعربية والإنجليزية."));
  const values: Record<string, unknown> = { name: input.name.trim(), name_ar: input.name_ar.trim(), parent_id: input.parent_id };
  if (input.is_active !== undefined) values.is_active = input.is_active;
  const { error } = input.id
    ? await supabase.from("categories").update(values).eq("id", input.id)
    : await supabase.from("categories").insert({ ...values, slug: `c-${Date.now().toString(36)}`, is_active: true, sort_order: 999 });
  if (error) fail(error);
  invalidateCategoryCache();
  return true;
}

export async function adminReports(): Promise<Report[]> {
  const { data, error } = await supabase.from("report_cases").select(REPORT_SELECT).order("created_at", { ascending: false }).limit(200);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map(toReport);
}

export async function adminUpdateReport(input: { id: string; status: "reviewing" | "resolved" | "dismissed"; resolution?: string }) {
  const userId = await requireUserId();
  if (input.status !== "reviewing" && !input.resolution?.trim()) throw new Error(t("اكتب ملاحظة القرار."));
  const { error } = await supabase.from("report_cases").update({ status: input.status, reviewer_user_id: userId, resolution: input.resolution?.trim() || null }).eq("id", input.id);
  if (error) fail(error);
  return true;
}

export type AuditEntry = { id: number; adminName: string; action: string; table: string; targetId: string | null; changes: string[]; createdAt: string };

export async function adminAuditLog(): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from("admin_audit_logs").select("*, admin:profiles!admin_audit_logs_admin_user_id_fkey(full_name, username)").order("created_at", { ascending: false }).limit(200);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((r) => {
    const before = (r.before_data ?? {}) as Record<string, unknown>;
    const after = (r.after_data ?? {}) as Record<string, unknown>;
    const changes = Object.keys(after).filter((k) => !["updated_at", "attributes"].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k])).map((k) => `${k}: ${String(before[k] ?? "—")} → ${String(after[k] ?? "—")}`);
    return { id: r.id, adminName: r.admin?.full_name || r.admin?.username || "—", action: r.action, table: r.target_table, targetId: r.target_id, changes, createdAt: r.created_at };
  });
}

export async function adminSettings(): Promise<{ announcement: { ar: string; en: string }; autoPublish: boolean; aiMode: AiMode }> {
  const { data } = await supabase.from("platform_settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  const ann = (map.announcement ?? {}) as { ar?: string; en?: string };
  const ai = map.ai_moderation === "shadow" || map.ai_moderation === "enforce" ? map.ai_moderation : "off";
  return { announcement: { ar: ann.ar ?? "", en: ann.en ?? "" }, autoPublish: map.listing_auto_publish !== false, aiMode: ai };
}

export async function adminSaveSettings(input: { announcement: { ar: string; en: string }; autoPublish: boolean; aiMode: AiMode }) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("platform_settings").upsert([
    { key: "announcement", value: { ar: input.announcement.ar.trim().slice(0, 300), en: input.announcement.en.trim().slice(0, 300) }, updated_at: now },
    { key: "listing_auto_publish", value: input.autoPublish, updated_at: now },
    { key: "ai_moderation", value: input.aiMode, updated_at: now },
  ]);
  if (error) fail(error);
  return true;
}
