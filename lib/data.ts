/**
 * Supabase data layer for دار السلع.
 *
 * Replaces the original Manus tRPC server + MySQL. Every function here keeps the
 * same name/input/output shape as the old tRPC procedure so the screens stay unchanged.
 *
 * Security: all access goes through Row Level Security with the user's own session.
 * Features that rely on tables not yet created in Supabase (stores, chats, reports,
 * notifications, views, ratings, follows) fail gracefully with a clear Arabic message
 * until supabase/migrations/0001_mobile_features.sql is approved and applied.
 */
import { LISTING_MEDIA_BUCKET, supabase } from "@/lib/supabase";
import { isSupportedImageDataUrl } from "@/lib/image-moderation";
import { getMarketplacePermissions } from "@/shared/marketplace-permissions";

// ---------------------------------------------------------------------------
// Errors & helpers
// ---------------------------------------------------------------------------

export const FEATURE_NOT_READY = "هذه الميزة تحتاج تفعيل جداولها في قاعدة البيانات أولًا.";

type PgError = { code?: string; message?: string } | null;

function isMissingTable(error: PgError) {
  return Boolean(error && (error.code === "PGRST205" || error.code === "42P01" || error.code === "PGRST204" || error.code === "42703"));
}

function fail(error: PgError, fallback = "تعذر إكمال الطلب."): never {
  if (isMissingTable(error)) throw new Error(FEATURE_NOT_READY);
  throw new Error(error?.message || fallback);
}

/** For list queries: a missing table yields an empty list instead of a broken screen. */
function rowsOrEmpty<T>(data: T[] | null, error: PgError): T[] {
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message || "تعذر تحميل البيانات.");
  }
  return data ?? [];
}

/** Throws an error tagged like a tRPC CONFLICT so screens show "نسخة أحدث". */
function conflict(message: string): never {
  throw Object.assign(new Error(message), { data: { code: "CONFLICT" } });
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("يجب تسجيل الدخول أولًا.");
  return id;
}

// ---------------------------------------------------------------------------
// Category & location mapping (UI uses Arabic labels; DB uses ids)
// ---------------------------------------------------------------------------

/** UI label → category slug in Supabase. */
const LABEL_TO_SLUG: Record<string, string> = {
  "سيارات": "cars", "سيارات ومركبات": "cars", "السيارات": "cars",
  "عقارات": "real-estate", "عقارات للبيع": "real-estate", "عقارات للإيجار": "real-estate", "العقارات": "real-estate",
  "إلكترونيات": "electronics", "الإلكترونيات": "electronics", "أجهزة إلكترونية وأجهزة منزلية": "electronics",
  "ألعاب": "gaming", "ألعاب وألعاب الفيديو": "gaming",
  "منزل وحدائق": "furniture",
  "أزياء": "fashion", "موضة وأطفال": "fashion",
  "الخدمات": "services", "خدمات": "services",
  "وظائف": "jobs", "الوظائف": "jobs",
  "حيوانات وإكسسوارات": "pets",
  "ترفيه وكتب ومقتنيات": "old-books-education",
  "معدات رياضية ولياقة": "sports-fitness",
  "تجهيزات ومعدات الشركات": "business-supplies",
  "جمال وصحة": "other", "طعام - غذاء": "other", "غير محدد": "other",
};

/** Category slug → the short label the home screen chips filter on. */
const SLUG_TO_LABEL: Record<string, string> = {
  cars: "سيارات", "real-estate": "عقارات", electronics: "إلكترونيات", "mobiles-tablets": "إلكترونيات", computers: "إلكترونيات",
  gaming: "ألعاب", furniture: "منزل وحدائق", fashion: "أزياء", services: "الخدمات", jobs: "وظائف",
};

type CategoryRow = { id: number; slug: string; name_ar: string; parent_id: number | null };
type LocationRow = { id: number; name_ar: string; kind: string | null; parent_id: number | null };

let categoryCache: Promise<CategoryRow[]> | null = null;
let locationCache: Promise<LocationRow[]> | null = null;

function loadCategories() {
  categoryCache ??= (async () => {
    const { data, error } = await supabase.from("categories").select("id, slug, name_ar, parent_id");
    if (error) { categoryCache = null; return []; }
    return (data ?? []) as CategoryRow[];
  })();
  return categoryCache;
}

function loadLocations() {
  locationCache ??= (async () => {
    const { data, error } = await supabase.from("locations").select("id, name_ar, kind, parent_id");
    if (error) { locationCache = null; return []; }
    return (data ?? []) as LocationRow[];
  })();
  return locationCache;
}

const normalizeAr = (value: string) => value.trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

async function categoryIdFor(label?: string | null): Promise<number | null> {
  if (!label?.trim()) return null;
  const rows = await loadCategories();
  const exact = rows.find((row) => normalizeAr(row.name_ar) === normalizeAr(label));
  if (exact) return exact.parent_id ?? exact.id;
  const slug = LABEL_TO_SLUG[label.trim()] ?? "other";
  return rows.find((row) => row.slug === slug)?.id ?? rows.find((row) => row.slug === "other")?.id ?? null;
}

async function locationIdFor(label?: string | null): Promise<number | null> {
  if (!label?.trim()) return null;
  const rows = await loadLocations();
  const parts = label.split(/[،,\-–]/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const wilayat = rows.find((row) => row.kind === "wilayat" && normalizeAr(row.name_ar) === normalizeAr(part));
    if (wilayat) return wilayat.id;
  }
  for (const part of parts) {
    const any = rows.find((row) => normalizeAr(row.name_ar) === normalizeAr(part));
    if (any) return any.id;
  }
  return null;
}

/** Split typed price text ("250", "250 ر.ع", "على السوم") into numeric + original text. */
function parsePrice(text?: string | null): { price: number | null; priceText: string | null } {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return { price: null, priceText: null };
  const western = trimmed.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[٫,]/g, ".");
  const match = /\d+(\.\d+)?/.exec(western);
  return { price: match ? Number(match[0]) : null, priceText: trimmed };
}

// ---------------------------------------------------------------------------
// Listing row mapping (Supabase → shape the screens expect)
// ---------------------------------------------------------------------------

export type ListingStatus = "draft" | "pending" | "published" | "rejected" | "suspended";

/** Supabase listing status → original app vocabulary. */
function toUiStatus(status: string | null | undefined, attributes: Record<string, unknown>): ListingStatus {
  if (status === "draft") return "draft";
  if (status === "archived") return attributes.moderation_status === "rejected" ? "rejected" : "suspended";
  return "published";
}

const LISTING_SELECT =
  "id, user_id, title, description, price, currency, status, phone, created_at, updated_at, attributes, category_id, location_id," +
  " category:categories!listings_category_id_fkey(slug, name_ar)," +
  " location:locations!listings_location_id_fkey(name_ar)," +
  " seller:profiles!listings_user_id_fkey(full_name, username)," +
  " media:listing_media(id, media_url, sort_order)";

type RawListing = {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  status: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  attributes: Record<string, unknown> | null;
  category_id: number | null;
  location_id: number | null;
  category: { slug: string; name_ar: string } | null;
  location: { name_ar: string } | null;
  seller: { full_name: string | null; username: string | null } | null;
  media: { id: string; media_url: string; sort_order: number }[] | null;
};

export type ListingRow = {
  id: string;
  publicId: string;
  sellerId: string;
  title: string | null;
  description: string | null;
  category: string | null;
  price: string | null;
  location: string | null;
  phone: string | null;
  status: ListingStatus;
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  version: number;
};

export type PublicListing = {
  id: string;
  publicId: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  category: string;
  price: string;
  location: string;
  phone: string | null;
  publishedAt: unknown;
  imageUrl: string | null;
  imageMimeType: string | null;
  images: string[];
};

function priceLabel(row: RawListing): string | null {
  const attrs = row.attributes ?? {};
  if (typeof attrs.price_text === "string" && attrs.price_text.trim()) return attrs.price_text;
  if (row.price === null || row.price === undefined || row.price === "") return null;
  return `${Number(row.price).toLocaleString("en-US", { maximumFractionDigits: 3 })} ر.ع.`;
}

function categoryLabel(row: RawListing): string | null {
  const attrs = row.attributes ?? {};
  if (row.category?.slug && SLUG_TO_LABEL[row.category.slug]) return SLUG_TO_LABEL[row.category.slug];
  if (typeof attrs.category_label === "string") return attrs.category_label;
  return row.category?.name_ar ?? null;
}

function locationLabel(row: RawListing): string | null {
  const attrs = row.attributes ?? {};
  if (typeof attrs.location_label === "string" && attrs.location_label.trim()) return attrs.location_label;
  return row.location?.name_ar ?? null;
}

function toListingRow(row: RawListing): ListingRow {
  const attrs = row.attributes ?? {};
  const status = toUiStatus(row.status, attrs);
  return {
    id: row.id,
    publicId: row.id,
    sellerId: row.user_id,
    title: row.title,
    description: row.description,
    category: categoryLabel(row),
    price: priceLabel(row),
    location: locationLabel(row),
    phone: row.phone,
    status,
    moderationReason: typeof attrs.moderation_reason === "string" ? attrs.moderation_reason : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    publishedAt: status === "published" ? new Date(row.created_at) : null,
    version: typeof attrs.version === "number" ? attrs.version : 1,
  };
}

function toPublicListing(row: RawListing): PublicListing {
  const images = [...(row.media ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((item) => item.media_url);
  return {
    id: row.id,
    publicId: row.id,
    sellerId: row.user_id,
    sellerName: row.seller?.full_name || row.seller?.username || "معلن دار السلع",
    title: row.title?.trim() || "إعلان بدون عنوان",
    description: row.description ?? "",
    category: categoryLabel(row) ?? "غير محدد",
    price: priceLabel(row) ?? "السعر عند التواصل",
    location: locationLabel(row) ?? "مسقط",
    phone: row.phone,
    publishedAt: row.created_at,
    imageUrl: images[0] ?? null,
    imageMimeType: images[0] ? "image/jpeg" : null,
    images,
  };
}

// ---------------------------------------------------------------------------
// Auth & account
// ---------------------------------------------------------------------------

export type AppUser = {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role?: "user" | "admin" | "merchant";
  merchantStatus?: "none" | "pending" | "active" | "rejected" | "suspended";
  lastSignedIn: Date;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  const { data } = await supabase.auth.getSession();
  const authUser = data.session?.user;
  if (!authUser) return null;
  // select("*") so this keeps working before and after the role columns migration.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  const p = (profile ?? {}) as Record<string, unknown>;
  const role = p.role === "admin" || p.role === "merchant" ? p.role : "user";
  return {
    id: authUser.id,
    openId: authUser.id,
    name: (p.full_name as string | null) ?? (authUser.user_metadata?.full_name as string | undefined) ?? authUser.email?.split("@")[0] ?? null,
    email: authUser.email ?? null,
    loginMethod: authUser.app_metadata?.provider ?? null,
    role,
    merchantStatus: (p.merchant_status as AppUser["merchantStatus"]) ?? "none",
    lastSignedIn: new Date(authUser.last_sign_in_at ?? Date.now()),
  };
}

type MerchantSubscription = {
  status: "pending" | "active" | "expired" | "suspended" | "cancelled";
  can_use_store: boolean;
  can_manage_products: boolean;
  can_reply_to_chats: boolean;
  max_products: number;
  max_images_per_product: number;
};

async function latestSubscription(userId: string): Promise<MerchantSubscription | null> {
  const { data, error } = await supabase.from("merchant_subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
  if (error) return null;
  return (data?.[0] as MerchantSubscription | undefined) ?? null;
}

export async function getPermissions() {
  const user = await getCurrentUser();
  if (!user) throw new Error("يجب تسجيل الدخول أولًا.");
  const subscription = user.role === "merchant" ? await latestSubscription(user.id) : null;
  return getMarketplacePermissions({
    role: user.role ?? "user",
    merchantStatus: user.merchantStatus,
    subscription: subscription
      ? {
          status: subscription.status,
          canUseStore: subscription.can_use_store,
          canManageProducts: subscription.can_manage_products,
          canReplyToChats: subscription.can_reply_to_chats,
          maxProducts: subscription.max_products,
          maxImagesPerProduct: subscription.max_images_per_product,
        }
      : null,
  });
}

export async function logout() {
  await supabase.auth.signOut();
  return { success: true } as const;
}

/**
 * Account deletion from the client: removes the user's listings, media and favorites
 * (allowed by RLS) then signs out. Deleting the auth user itself needs a server-side
 * Edge Function with service_role — never done from the app.
 */
export async function deleteAccount() {
  const userId = await requireUserId();
  const { data: mine } = await supabase.from("listings").select("id").eq("user_id", userId);
  const ids = (mine ?? []).map((row) => row.id as string);
  if (ids.length) {
    await supabase.from("listing_media").delete().in("listing_id", ids);
    await supabase.from("favorites").delete().in("listing_id", ids);
    await supabase.from("listings").delete().eq("user_id", userId);
  }
  await supabase.from("favorites").delete().eq("user_id", userId);
  await supabase.from("profiles").update({ full_name: null, phone: null, bio: null, avatar_url: null }).eq("id", userId);
  await supabase.auth.signOut();
  return { success: true } as const;
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export async function listPublicListings(input?: { limit?: number }): Promise<PublicListing[]> {
  const limit = Math.max(1, Math.min(input?.limit ?? 30, 100));
  const { data, error } = await supabase.from("listings").select(LISTING_SELECT).eq("status", "active").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawListing[]).map(toPublicListing);
}

export async function getPublicListing(input: { publicId: string }): Promise<PublicListing> {
  const { data, error } = await supabase.from("listings").select(LISTING_SELECT).eq("id", input.publicId).eq("status", "active").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("LISTING_NOT_FOUND");
  return toPublicListing(data as unknown as RawListing);
}

export async function getMyListings(): Promise<ListingRow[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("listings").select(LISTING_SELECT).eq("user_id", userId).order("updated_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawListing[]).map(toListingRow);
}

type DraftInput = { publicId?: string; title?: string; description?: string; category?: string; price?: string; location?: string; phone?: string };

async function draftColumns(values: DraftInput, existingAttributes: Record<string, unknown> = {}) {
  const { price, priceText } = parsePrice(values.price);
  const attributes: Record<string, unknown> = { ...existingAttributes };
  if (values.category !== undefined) attributes.category_label = values.category || null;
  if (values.location !== undefined) attributes.location_label = values.location || null;
  if (values.price !== undefined) attributes.price_text = priceText;
  const columns: Record<string, unknown> = { attributes };
  if (values.title !== undefined) columns.title = values.title?.trim() || "مسودة إعلان";
  if (values.description !== undefined) columns.description = values.description ?? null;
  if (values.phone !== undefined) columns.phone = values.phone || null;
  if (values.price !== undefined) columns.price = price;
  if (values.category !== undefined) columns.category_id = await categoryIdFor(values.category);
  if (values.location !== undefined) columns.location_id = await locationIdFor(values.location);
  return columns;
}

export async function createDraft(input: DraftInput): Promise<ListingRow> {
  const userId = await requireUserId();
  const columns = await draftColumns({ title: input.title ?? "", ...input });
  const attributes = { ...(columns.attributes as Record<string, unknown>), version: 1 };
  const { data, error } = await supabase.from("listings").insert({ ...columns, attributes, user_id: userId, status: "draft" }).select(LISTING_SELECT).single();
  if (error) fail(error, "تعذر حفظ المسودة.");
  return toListingRow(data as unknown as RawListing);
}

async function loadOwnDraft(publicId: string, userId: string) {
  const { data, error } = await supabase.from("listings").select("id, status, attributes").eq("id", publicId).eq("user_id", userId).maybeSingle();
  if (error) fail(error);
  return data as { id: string; status: string; attributes: Record<string, unknown> | null } | null;
}

export async function updateDraft(input: DraftInput & { publicId: string; expectedVersion: number }): Promise<ListingRow> {
  const userId = await requireUserId();
  const current = await loadOwnDraft(input.publicId, userId);
  const currentVersion = typeof current?.attributes?.version === "number" ? current.attributes.version : 1;
  if (!current || current.status !== "draft" || currentVersion !== input.expectedVersion) conflict("DRAFT_NOT_EDITABLE");
  const { publicId, expectedVersion, ...values } = input;
  const columns = await draftColumns(values, current.attributes ?? {});
  (columns.attributes as Record<string, unknown>).version = expectedVersion + 1;
  const { data, error } = await supabase.from("listings").update(columns).eq("id", publicId).eq("user_id", userId).eq("status", "draft").select(LISTING_SELECT).single();
  if (error) fail(error, "DRAFT_NOT_EDITABLE");
  return toListingRow(data as unknown as RawListing);
}

export async function submitDraft(input: Required<Omit<DraftInput, "price" | "publicId">> & { publicId: string; expectedVersion: number; price?: string }): Promise<ListingRow> {
  const userId = await requireUserId();
  const current = await loadOwnDraft(input.publicId, userId);
  const currentVersion = typeof current?.attributes?.version === "number" ? current.attributes.version : 1;
  if (!current || current.status !== "draft" || currentVersion !== input.expectedVersion) conflict("DRAFT_NOT_SUBMITTABLE");
  const { publicId, expectedVersion, ...values } = input;
  const columns = await draftColumns(values, current.attributes ?? {});
  (columns.attributes as Record<string, unknown>).version = expectedVersion + 1;
  // Published straight away (Supabase listings have no "pending" state); admins can archive it later.
  const { data, error } = await supabase.from("listings").update({ ...columns, status: "active" }).eq("id", publicId).eq("user_id", userId).eq("status", "draft").select(LISTING_SELECT).single();
  if (error) fail(error, "DRAFT_NOT_SUBMITTABLE");
  return toListingRow(data as unknown as RawListing);
}

export async function deleteDraft(input: { publicId: string }) {
  const userId = await requireUserId();
  const { data: media } = await supabase.from("listing_media").select("id, media_url").eq("listing_id", input.publicId);
  await removeStorageFiles((media ?? []).map((item) => item.media_url as string));
  await supabase.from("listing_media").delete().eq("listing_id", input.publicId);
  const { error, count } = await supabase.from("listings").delete({ count: "exact" }).eq("id", input.publicId).eq("user_id", userId).eq("status", "draft");
  if (error) fail(error, "DRAFT_NOT_DELETABLE");
  if (!count) conflict("DRAFT_NOT_DELETABLE");
  return { success: true } as const;
}

// ---------------------------------------------------------------------------
// Media (Supabase Storage bucket "listing-media", folder = user id)
// ---------------------------------------------------------------------------

function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${LISTING_MEDIA_BUCKET}/`;
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
}

async function removeStorageFiles(urls: string[]) {
  const paths = urls.map(storagePathFromUrl).filter((path): path is string => Boolean(path));
  if (paths.length) await supabase.storage.from(LISTING_MEDIA_BUCKET).remove(paths);
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string; extension: string } {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("INVALID_IMAGE_BYTES");
  const extension = match[1] === "jpg" ? "jpeg" : match[1];
  const binary = globalThis.atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, mimeType: `image/${extension}`, extension };
}

type UploadResult =
  | { status: "approved"; mediaUrl: string; mediaAssetId: string; listingMediaId: string }
  | { status: "rejected" | "review"; reason: string };

export async function uploadForDraft(input: { publicId: string; dataUrl: string }): Promise<UploadResult> {
  const userId = await requireUserId();
  if (!isSupportedImageDataUrl(input.dataUrl)) throw new Error("INVALID_IMAGE_BYTES");
  const { bytes, mimeType, extension } = dataUrlToBytes(input.dataUrl);
  if (bytes.length === 0 || bytes.length > 1_500_000) throw new Error("MEDIA_SIZE_INVALID");
  const path = `${userId}/${input.publicId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(LISTING_MEDIA_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const mediaUrl = supabase.storage.from(LISTING_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  const { count } = await supabase.from("listing_media").select("id", { count: "exact", head: true }).eq("listing_id", input.publicId);
  const { data, error } = await supabase.from("listing_media").insert({ listing_id: input.publicId, media_url: mediaUrl, media_type: "image", sort_order: count ?? 0 }).select("id").single();
  if (error) {
    await supabase.storage.from(LISTING_MEDIA_BUCKET).remove([path]);
    fail(error, "MEDIA_DRAFT_LINK_FAILED");
  }
  return { status: "approved", mediaUrl, mediaAssetId: data.id as string, listingMediaId: data.id as string };
}

export async function detachFromDraft(input: { listingMediaId: string | number }) {
  const { data } = await supabase.from("listing_media").select("media_url").eq("id", String(input.listingMediaId)).maybeSingle();
  const { error, count } = await supabase.from("listing_media").delete({ count: "exact" }).eq("id", String(input.listingMediaId));
  if (error || !count) throw new Error("MEDIA_DELETE_FORBIDDEN");
  if (data?.media_url) await removeStorageFiles([data.media_url as string]);
  return { success: true } as const;
}

// ---------------------------------------------------------------------------
// Moderation
// The original used an LLM on the Manus server. Here we run local checks only;
// an AI check can later move to a Supabase Edge Function without touching screens.
// ---------------------------------------------------------------------------

const BLOCKED_TERMS = ["سلاح", "أسلحة", "اسلحة", "ذخيرة", "رصاص", "مسدس", "بندقية", "مخدرات", "حشيش", "كوكايين", "هيروين", "حبوب مخدرة", "إباحي", "اباحي", "جنس", "دعارة", "تزوير", "جواز سفر للبيع", "بطاقات ائتمان", "weapon", "gun", "ammo", "drugs", "cocaine", "porn"];

type ModerationResult = { verdict: "allow" | "reject" | "review"; safeToPublish: boolean; category: string; reason: string; confidence: number };
type ImageModerationResult = { verdict: "allow" | "reject" | "review"; safeToPublish: boolean; categories: string[]; reason: string; confidence: number };

export async function checkListing(input: { title: string; description: string; category?: string; price?: string; location?: string; phone?: string }): Promise<ModerationResult> {
  const haystack = `${input.title} ${input.description}`.toLowerCase();
  const hit = BLOCKED_TERMS.find((term) => haystack.includes(term.toLowerCase()));
  if (hit) {
    return { verdict: "reject", safeToPublish: false, category: "prohibited", reason: "يحتوي الإعلان على كلمات مرتبطة بمواد ممنوعة ولا يمكن نشره.", confidence: 0.95 };
  }
  return { verdict: "allow", safeToPublish: true, category: input.category ?? "general", reason: "اجتاز الإعلان فحص الأمان الأساسي.", confidence: 0.95 };
}

export async function checkImage(input: { dataUrl: string }): Promise<ImageModerationResult> {
  if (!isSupportedImageDataUrl(input.dataUrl)) {
    return { verdict: "reject", safeToPublish: false, categories: ["invalid_image"], reason: "صيغة الصورة غير مدعومة.", confidence: 1 };
  }
  return { verdict: "allow", safeToPublish: true, categories: [] as string[], reason: "صورة صالحة.", confidence: 0.95 };
}

// ---------------------------------------------------------------------------
// Favorites, views, ratings
// ---------------------------------------------------------------------------

export async function saveListing(input: { publicId: string }) {
  const userId = await requireUserId();
  const { error } = await supabase.from("favorites").upsert({ user_id: userId, listing_id: input.publicId }, { onConflict: "user_id,listing_id" });
  if (error) fail(error);
  return true;
}

export async function unsaveListing(input: { publicId: string }) {
  const userId = await requireUserId();
  const { error } = await supabase.from("favorites").delete().eq("user_id", userId).eq("listing_id", input.publicId);
  if (error) fail(error);
  return true;
}

export async function getSavedListings() {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("favorites").select("created_at, listing:listings(id, title, price, status, attributes, location:locations!listings_location_id_fkey(name_ar))").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  type Row = { created_at: string; listing: (Pick<RawListing, "id" | "title" | "price" | "status" | "attributes" | "location">) | null };
  return rowsOrEmpty(data as unknown as Row[], error)
    .filter((row) => row.listing && row.listing.status === "active")
    .map((row) => {
      const listing = row.listing as RawListing;
      return { publicId: listing.id, title: listing.title, price: priceLabel(listing), location: locationLabel(listing), createdAt: new Date(row.created_at) };
    });
}

export async function recordView(input: { publicId: string }) {
  const userId = await requireUserId();
  await supabase.rpc("increment_listing_views", { p_listing_id: input.publicId }).then(() => undefined, () => undefined);
  const { error } = await supabase.from("listing_views").upsert({ listing_id: input.publicId, viewer_user_id: userId, viewed_at: new Date().toISOString() }, { onConflict: "listing_id,viewer_user_id" });
  if (error && !isMissingTable(error)) throw new Error(error.message);
  return { listingId: input.publicId, sellerId: "" };
}

export async function getRecentViews() {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("listing_views").select("viewed_at, listing:listings(id, title, status)").eq("viewer_user_id", userId).order("viewed_at", { ascending: false }).limit(100);
  type Row = { viewed_at: string; listing: { id: string; title: string | null; status: string } | null };
  return rowsOrEmpty(data as unknown as Row[], error)
    .filter((row) => row.listing?.status === "active")
    .map((row) => ({ publicId: row.listing!.id, title: row.listing!.title, viewedAt: new Date(row.viewed_at) }));
}

export async function rateListing(input: { publicId: string; rating: number; comment?: string }) {
  const userId = await requireUserId();
  const { data: listing } = await supabase.from("listings").select("user_id").eq("id", input.publicId).maybeSingle();
  if (!listing || listing.user_id === userId) return false;
  const { data: visit, error: visitError } = await supabase.from("listing_views").select("listing_id").eq("listing_id", input.publicId).eq("viewer_user_id", userId).maybeSingle();
  if (visitError) fail(visitError);
  if (!visit) throw new Error("LISTING_VISIT_REQUIRED");
  const { error } = await supabase.from("listing_ratings").upsert({ listing_id: input.publicId, reviewer_user_id: userId, seller_id: listing.user_id, rating: input.rating, comment: input.comment ?? null }, { onConflict: "listing_id,reviewer_user_id" });
  if (error) fail(error);
  return true;
}

// ---------------------------------------------------------------------------
// Follows & notifications
// ---------------------------------------------------------------------------

export async function getFollowedUsers() {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("user_follows").select("followed_user_id, created_at, followed:profiles!user_follows_followed_user_id_fkey(full_name)").eq("follower_user_id", userId).order("created_at", { ascending: false }).limit(100);
  type Row = { followed_user_id: string; created_at: string; followed: { full_name: string | null } | null };
  return rowsOrEmpty(data as unknown as Row[], error).map((row) => ({ userId: row.followed_user_id, name: row.followed?.full_name ?? null, createdAt: new Date(row.created_at) }));
}

export async function followUser(input: { userId: string | number }) {
  const userId = await requireUserId();
  if (String(input.userId) === userId) throw new Error("SELF_FOLLOW_FORBIDDEN");
  const { error } = await supabase.from("user_follows").upsert({ follower_user_id: userId, followed_user_id: String(input.userId) }, { onConflict: "follower_user_id,followed_user_id" });
  if (error) fail(error);
  return true;
}

export async function unfollowUser(input: { userId: string | number }) {
  const userId = await requireUserId();
  const { error } = await supabase.from("user_follows").delete().eq("follower_user_id", userId).eq("followed_user_id", String(input.userId));
  if (error) fail(error);
  return true;
}

export type NotificationRow = { id: number; userId: string; type: string; title: string; body: string; listingId: string | null; readAt: Date | null; createdAt: Date };

export async function getNotifications(): Promise<NotificationRow[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((row) => ({
    id: row.id, userId: row.user_id, type: row.type, title: row.title, body: row.body, listingId: row.listing_id,
    readAt: row.read_at ? new Date(row.read_at) : null, createdAt: new Date(row.created_at),
  }));
}

export async function markNotificationRead(input: { notificationId: number }) {
  const userId = await requireUserId();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", input.notificationId).eq("user_id", userId);
  if (error) fail(error);
  return true;
}

// ---------------------------------------------------------------------------
// Merchant stores
// ---------------------------------------------------------------------------

export async function listStores() {
  const { data, error } = await supabase.from("public_stores").select("merchant_id, name");
  return rowsOrEmpty(data as { merchant_id: string; name: string | null }[] | null, error).map((row) => ({ merchantId: row.merchant_id, name: row.name ?? "متجر مسقط" }));
}

export async function getStore(input: { merchantId: string | number }) {
  const merchantId = String(input.merchantId);
  const { data: store, error } = await supabase.from("public_stores").select("merchant_id, name, max_products").eq("merchant_id", merchantId).maybeSingle();
  if (error) fail(error);
  if (!store) throw new Error("STORE_NOT_FOUND");
  const { data: products, error: productsError } = await supabase.from("listings").select(LISTING_SELECT).eq("user_id", merchantId).eq("status", "active").order("created_at", { ascending: false }).limit((store as { max_products?: number }).max_products ?? 50);
  if (productsError) fail(productsError);
  return { merchantId, name: (store as { name: string | null }).name ?? "متجر مسقط", products: ((products ?? []) as unknown as RawListing[]).map(toListingRow) };
}

async function requireActiveMerchant(userId: string) {
  const subscription = await latestSubscription(userId);
  if (!subscription || subscription.status !== "active" || !subscription.can_use_store || !subscription.can_manage_products) throw new Error("MERCHANT_SUBSCRIPTION_NOT_ACTIVE");
  return subscription;
}

export async function getMyProducts(): Promise<ListingRow[]> {
  const userId = await requireUserId();
  await requireActiveMerchant(userId);
  const { data, error } = await supabase.from("listings").select(LISTING_SELECT).eq("user_id", userId).neq("status", "draft").order("updated_at", { ascending: false }).limit(200);
  if (error) fail(error);
  return ((data ?? []) as unknown as RawListing[]).map(toListingRow);
}

export async function createProduct(input: DraftInput & { title: string; description: string }) {
  const userId = await requireUserId();
  const subscription = await requireActiveMerchant(userId);
  const { count } = await supabase.from("listings").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active");
  if ((count ?? 0) >= subscription.max_products) throw new Error("MERCHANT_PRODUCT_LIMIT_REACHED");
  const columns = await draftColumns(input);
  const attributes = { ...(columns.attributes as Record<string, unknown>), version: 1, store_product: true };
  const { data, error } = await supabase.from("listings").insert({ ...columns, attributes, user_id: userId, status: "active" }).select(LISTING_SELECT).single();
  if (error) fail(error);
  return toListingRow(data as unknown as RawListing);
}

export async function updateProduct(input: DraftInput & { publicId: string }) {
  const userId = await requireUserId();
  await requireActiveMerchant(userId);
  const current = await loadOwnDraft(input.publicId, userId);
  if (!current) throw new Error("STORE_PRODUCT_NOT_FOUND");
  const { publicId, ...values } = input;
  const columns = await draftColumns(values, current.attributes ?? {});
  const { data, error } = await supabase.from("listings").update(columns).eq("id", publicId).eq("user_id", userId).select(LISTING_SELECT).single();
  if (error) fail(error);
  return toListingRow(data as unknown as RawListing);
}

export async function deleteProduct(input: { publicId: string }) {
  const userId = await requireUserId();
  await requireActiveMerchant(userId);
  const { error, count } = await supabase.from("listings").update({ status: "archived" }, { count: "exact" }).eq("id", input.publicId).eq("user_id", userId);
  if (error) fail(error);
  if (!count) throw new Error("STORE_PRODUCT_NOT_FOUND");
  return { success: true } as const;
}

// ---------------------------------------------------------------------------
// Store chats
// ---------------------------------------------------------------------------

export type ConversationRow = { id: string; publicId: string; listingId: string | null; buyerUserId: string; merchantUserId: string; status: "active" | "closed"; createdAt: Date; updatedAt: Date };
export type MessageRow = { id: string; conversationId: string; senderUserId: string; body: string; readAt: Date | null; createdAt: Date };

const toConversation = (row: Record<string, any>): ConversationRow => ({
  id: row.id, publicId: row.id, listingId: row.listing_id, buyerUserId: row.buyer_user_id, merchantUserId: row.merchant_user_id,
  status: row.status, createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
});

export async function listChats(): Promise<ConversationRow[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("store_conversations").select("*").or(`buyer_user_id.eq.${userId},merchant_user_id.eq.${userId}`).order("updated_at", { ascending: false }).limit(100);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map(toConversation);
}

export async function chatMessages(input: { conversationPublicId: string }): Promise<MessageRow[]> {
  await requireUserId();
  const { data, error } = await supabase.from("store_messages").select("*").eq("conversation_id", input.conversationPublicId).order("created_at", { ascending: true }).limit(200);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((row) => ({
    id: row.id, conversationId: row.conversation_id, senderUserId: row.sender_user_id, body: row.body,
    readAt: row.read_at ? new Date(row.read_at) : null, createdAt: new Date(row.created_at),
  }));
}

export async function startChat(input: { listingPublicId: string }): Promise<ConversationRow> {
  const userId = await requireUserId();
  const { data: listing } = await supabase.from("listings").select("id, user_id").eq("id", input.listingPublicId).eq("status", "active").maybeSingle();
  if (!listing || listing.user_id === userId) throw new Error("STORE_CONVERSATION_NOT_ALLOWED");
  const { data: existing, error: existingError } = await supabase.from("store_conversations").select("*").eq("listing_id", listing.id).eq("buyer_user_id", userId).eq("status", "active").maybeSingle();
  if (existingError) fail(existingError);
  if (existing) return toConversation(existing);
  const { data, error } = await supabase.from("store_conversations").insert({ listing_id: listing.id, buyer_user_id: userId, merchant_user_id: listing.user_id, status: "active" }).select("*").single();
  if (error) fail(error, "STORE_CONVERSATION_NOT_ALLOWED");
  return toConversation(data);
}

export async function sendChat(input: { conversationPublicId: string; body: string }): Promise<MessageRow> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("store_messages").insert({ conversation_id: input.conversationPublicId, sender_user_id: userId, body: input.body.trim() }).select("*").single();
  if (error) fail(error, "STORE_MESSAGE_NOT_ALLOWED");
  return { id: data.id, conversationId: data.conversation_id, senderUserId: data.sender_user_id, body: data.body, readAt: null, createdAt: new Date(data.created_at) };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportRow = { id: string; publicId: string; reporterUserId: string; listingId: string | null; subject: string; details: string; status: "open" | "reviewing" | "resolved" | "dismissed"; priority: "low" | "medium" | "high"; reviewerUserId: string | null; resolution: string | null; createdAt: Date; updatedAt: Date };

const toReport = (row: Record<string, any>): ReportRow => ({
  id: row.id, publicId: row.id, reporterUserId: row.reporter_user_id, listingId: row.listing_id, subject: row.subject, details: row.details,
  status: row.status, priority: row.priority, reviewerUserId: row.reviewer_user_id, resolution: row.resolution,
  createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
});

export async function createReport(input: { publicId?: string; subject: string; details: string; priority?: "low" | "medium" | "high" }) {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("report_cases").insert({ reporter_user_id: userId, listing_id: input.publicId ?? null, subject: input.subject.trim(), details: input.details.trim(), priority: input.priority ?? "medium" }).select("*").single();
  if (error) fail(error, "REPORT_CREATE_FAILED");
  return toReport(data);
}

export async function adminReports() {
  const { data, error } = await supabase.from("report_cases").select("*, listing:listings(id, title), reporter:profiles!report_cases_reporter_user_id_fkey(full_name)").order("created_at", { ascending: false }).limit(200);
  return rowsOrEmpty(data as Record<string, any>[] | null, error).map((row) => ({
    report: toReport(row), listingPublicId: (row.listing?.id as string | undefined) ?? null, listingTitle: (row.listing?.title as string | undefined) ?? null, reporterName: (row.reporter?.full_name as string | undefined) ?? null,
  }));
}

export async function adminUpdateReport(input: { publicId: string; status: "reviewing" | "resolved" | "dismissed"; resolution?: string }) {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("report_cases").update({ status: input.status, reviewer_user_id: userId, resolution: input.resolution?.trim() || null }).eq("id", input.publicId).select("*").maybeSingle();
  if (error) fail(error);
  return data ? toReport(data) : undefined;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function adminListings(input?: { search?: string }): Promise<ListingRow[]> {
  const { data, error } = await supabase.from("listings").select(LISTING_SELECT).order("created_at", { ascending: false }).limit(200);
  if (error) fail(error);
  const rows = ((data ?? []) as unknown as RawListing[]).map(toListingRow);
  const needle = input?.search?.trim().toLowerCase();
  return needle ? rows.filter((row) => `${row.publicId} ${row.title ?? ""} ${row.category ?? ""} ${row.location ?? ""}`.toLowerCase().includes(needle)) : rows;
}

export async function adminUsers(input?: { search?: string }) {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500);
  const rows = rowsOrEmpty(data as Record<string, any>[] | null, error).map((row) => ({
    id: row.id as string, name: (row.full_name ?? row.username ?? null) as string | null, email: null as string | null,
    role: (row.role ?? "user") as "user" | "merchant" | "admin", merchantStatus: (row.merchant_status ?? "none") as string, createdAt: new Date(row.created_at),
  }));
  const needle = input?.search?.trim().toLowerCase();
  return needle ? rows.filter((row) => `${row.name ?? ""} ${row.role} ${row.merchantStatus}`.toLowerCase().includes(needle)) : rows;
}

export async function moderateListing(input: { publicId: string; status: "published" | "rejected" | "suspended"; reason?: string }) {
  await requireUserId();
  const { data: current, error: readError } = await supabase.from("listings").select("attributes").eq("id", input.publicId).maybeSingle();
  if (readError) fail(readError);
  if (!current) throw new Error("LISTING_NOT_FOUND");
  const attributes = { ...((current.attributes as Record<string, unknown>) ?? {}), moderation_status: input.status, moderation_reason: input.reason?.trim() || null };
  const { data, error } = await supabase.from("listings").update({ status: input.status === "published" ? "active" : "archived", attributes }).eq("id", input.publicId).select(LISTING_SELECT).maybeSingle();
  if (error) fail(error);
  if (!data) throw new Error("لا تملك صلاحية المشرف لتعديل هذا الإعلان.");
  return toListingRow(data as unknown as RawListing);
}
