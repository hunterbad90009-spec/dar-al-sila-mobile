import AsyncStorage from "@react-native-async-storage/async-storage";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Chip, EmptyState, ErrorState, Field, Header, Input, ListingGrid, Loading, SectionHeader, SelectField, SelectSheet } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { CONDITIONS, type Condition, fieldsForCategory } from "@/lib/category-fields";
import { listStores, type ListingFilters, searchListings, type SortKey } from "@/lib/data";
import { isRTL, pickName, t } from "@/lib/i18n";
import { useCategories, useLocations } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

const HISTORY_KEY = "dar_al_sila_search_history";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "الأكثر صلة" },
  { value: "newest", label: "الأحدث" },
  { value: "oldest", label: "الأقدم" },
  { value: "price_asc", label: "السعر: الأقل أولًا" },
  { value: "price_desc", label: "السعر: الأعلى أولًا" },
  { value: "popular", label: "الأكثر مشاهدة" },
];

type Sheet = null | "category" | "location" | "sort" | "condition";

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; categoryId?: string; locationId?: string; sort?: string; featured?: string }>();
  const colors = useColors();
  const categories = useCategories();
  const locations = useLocations();

  const [text, setText] = useState(params.q ?? "");
  const [filters, setFilters] = useState<ListingFilters>({
    q: params.q ?? "",
    categoryId: params.categoryId ? Number(params.categoryId) : null,
    locationId: params.locationId ? Number(params.locationId) : null,
    sort: (params.sort as SortKey) || undefined,
    featured: params.featured === "1",
    attrs: {},
  });
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [categoryPath, setCategoryPath] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => setHistory(raw ? JSON.parse(raw) : [])).catch(() => undefined);
  }, []);

  const saveHistory = async (term: string) => {
    const next = [term, ...history.filter((h) => h !== term)].slice(0, 10);
    setHistory(next);
    try { await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* optional */ }
  };
  const clearHistory = async () => {
    setHistory([]);
    try { await AsyncStorage.removeItem(HISTORY_KEY); } catch { /* optional */ }
  };

  const runSearch = (term = text) => {
    const q = term.trim();
    setText(q);
    setFilters((f) => ({ ...f, q }));
    if (q) void saveHistory(q);
  };

  const applyPrice = () => setFilters((f) => ({
    ...f,
    minPrice: minPrice.trim() ? Number(minPrice.replace(/[^\d.]/g, "")) : null,
    maxPrice: maxPrice.trim() ? Number(maxPrice.replace(/[^\d.]/g, "")) : null,
  }));

  const hasQuery = Boolean(filters.q || filters.categoryId || filters.locationId || filters.minPrice || filters.maxPrice || filters.condition || filters.featured || filters.sort || Object.values(filters.attrs ?? {}).some(Boolean));

  const results = useInfiniteQuery({
    queryKey: ["search", filters],
    queryFn: ({ pageParam }) => searchListings({ ...filters, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: hasQuery,
  });
  const stores = useQuery({ queryKey: ["search-stores", filters.q], queryFn: () => listStores({ q: filters.q, limit: 6 }), enabled: Boolean(filters.q) });
  const items = results.data?.pages.flatMap((p) => p.items) ?? [];

  const category = categories.byId(filters.categoryId);
  const topSlug = categories.topOf(filters.categoryId)?.slug;
  const filterFields = useMemo(() => fieldsForCategory(topSlug).filter((f) => f.filterable), [topSlug]);

  const categoryOptions = useMemo(() => {
    const list = categories.childrenOf(categoryPath);
    const head = categoryPath ? [{ value: `pick:${categoryPath}`, label: t("كل: {name}", { name: pickName(categories.byId(categoryPath)) }) }] : [{ value: "clear", label: t("كل التصنيفات") }];
    return [...head, ...list.map((c) => ({ value: String(c.id), label: pickName(c), drill: categories.childrenOf(c.id).length > 0 }))];
  }, [categories, categoryPath]);

  const locationOptions = useMemo(() => [
    { value: "clear", label: t("كل عُمان") },
    ...locations.governorates.flatMap((g) => [
      { value: String(g.id), label: pickName(g) },
      ...locations.wilayatsOf(g.id).map((w) => ({ value: String(w.id), label: `   ${pickName(w)}`, detail: pickName(g) })),
    ]),
  ], [locations]);

  const activeCount = [filters.categoryId, filters.locationId, filters.minPrice, filters.maxPrice, filters.condition, filters.featured].filter(Boolean).length + Object.values(filters.attrs ?? {}).filter(Boolean).length;

  return (
    <ScreenContainer className="px-4">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header title={t("البحث")} />
        <View style={styles.searchRow}>
          <Input value={text} onChangeText={setText} placeholder={t("ابحث عن منتج أو إعلان أو متجر...")} returnKeyType="search" onSubmitEditing={() => runSearch()} style={{ flex: 1 }} autoFocus={!params.categoryId && !params.featured && !params.sort} />
          <Pressable accessibilityLabel={t("بحث")} onPress={() => runSearch()} style={[styles.go, { backgroundColor: colors.primary }]}><MaterialIcons name="search" size={22} color={colors.primaryText} /></Pressable>
        </View>

        <View style={styles.toolbar}>
          <Chip icon="tune" label={activeCount ? t("الفلاتر ({n})", { n: activeCount }) : t("الفلاتر")} active={showFilters} onPress={() => setShowFilters((v) => !v)} />
          <Chip icon="swap-vert" label={t(SORTS.find((s) => s.value === (filters.sort ?? (filters.q ? "relevance" : "newest")))?.label ?? "الأحدث")} onPress={() => setSheet("sort")} />
          {activeCount ? <Chip icon="close" label={t("مسح الفلاتر")} onPress={() => { setFilters({ q: filters.q, attrs: {} }); setMinPrice(""); setMaxPrice(""); }} /> : null}
        </View>

        {showFilters ? (
          <View style={[styles.filters, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Field label={t("التصنيف")}><SelectField value={category ? pickName(category) : null} placeholder={t("كل التصنيفات")} onPress={() => { setCategoryPath(null); setSheet("category"); }} /></Field>
            <Field label={t("الموقع")}><SelectField value={filters.locationId ? locations.label(filters.locationId) : null} placeholder={t("كل عُمان")} onPress={() => setSheet("location")} /></Field>
            <Field label={t("السعر (ر.ع.)")}>
              <View style={styles.priceRow}>
                <Input value={minPrice} onChangeText={setMinPrice} onBlur={applyPrice} placeholder={t("من")} keyboardType="numeric" style={{ flex: 1 }} />
                <Input value={maxPrice} onChangeText={setMaxPrice} onBlur={applyPrice} placeholder={t("إلى")} keyboardType="numeric" style={{ flex: 1 }} />
              </View>
            </Field>
            <Field label={t("الحالة")}><SelectField value={filters.condition ? t(CONDITIONS.find((c) => c.value === filters.condition)!.label) : null} placeholder={t("أي حالة")} onPress={() => setSheet("condition")} /></Field>
            {filterFields.map((field) => (
              <Field key={field.key} label={t(field.label)}>
                {field.options ? (
                  <View style={styles.chips}>
                    {field.options.map((o) => <Chip key={o.value} label={t(o.label)} active={filters.attrs?.[field.key] === o.value} onPress={() => setFilters((f) => ({ ...f, attrs: { ...f.attrs, [field.key]: f.attrs?.[field.key] === o.value ? "" : o.value } }))} />)}
                  </View>
                ) : (
                  <Input value={filters.attrs?.[field.key] ?? ""} onChangeText={(v) => setFilters((f) => ({ ...f, attrs: { ...f.attrs, [field.key]: v } }))} keyboardType={field.type === "number" ? "numeric" : "default"} />
                )}
              </Field>
            ))}
            <Button label={t("عرض النتائج")} onPress={() => { applyPrice(); setShowFilters(false); }} style={{ marginTop: 18 }} />
          </View>
        ) : null}

        {!hasQuery ? (
          history.length > 0 ? (
            <>
              <SectionHeader title={t("عمليات البحث الأخيرة")} action={t("مسح")} onAction={clearHistory} />
              {history.map((term) => (
                <Pressable key={term} onPress={() => runSearch(term)} style={[styles.historyItem, { borderBottomColor: colors.border }]}>
                  <MaterialIcons name="history" size={20} color={colors.muted} />
                  <Text style={[styles.historyText, { color: colors.foreground }]}>{term}</Text>
                  <MaterialIcons name={isRTL() ? "north-west" : "north-east"} size={18} color={colors.muted} />
                </Pressable>
              ))}
            </>
          ) : <EmptyState icon="search" title={t("ابحث في دار السلع")} text={t("اكتب اسم منتج أو استخدم الفلاتر حسب القسم والموقع والسعر.")} />
        ) : (
          <>
            {(stores.data?.length ?? 0) > 0 ? (
              <>
                <SectionHeader title={t("متاجر مطابقة")} />
                {stores.data!.map((store) => (
                  <Pressable key={store.id} onPress={() => router.push({ pathname: "/store/[merchantId]", params: { merchantId: store.ownerId } })} style={[styles.storeItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {store.logoUrl ? <Image source={{ uri: store.logoUrl }} style={styles.storeLogo} /> : <MaterialIcons name="storefront" size={30} color={colors.primary} />}
                    <Text style={[styles.storeName, { color: colors.foreground }]}>{store.name}</Text>
                    <MaterialIcons name={isRTL() ? "chevron-left" : "chevron-right"} size={20} color={colors.muted} />
                  </Pressable>
                ))}
              </>
            ) : null}
            <SectionHeader title={t("الإعلانات")} />
            {results.isLoading ? <Loading label={t("جارٍ البحث...")} /> : results.isError ? <ErrorState onRetry={() => results.refetch()} /> : items.length === 0 ? (
              <EmptyState icon="search-off" title={t("لا توجد نتائج")} text={t("جرّب كلمات أخرى أو خفف الفلاتر.")} />
            ) : (
              <>
                <ListingGrid items={items} />
                {results.hasNextPage ? <Button variant="ghost" label={t("عرض المزيد")} loading={results.isFetchingNextPage} onPress={() => results.fetchNextPage()} style={{ marginTop: 14 }} /> : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      <SelectSheet visible={sheet === "sort"} title={t("ترتيب حسب")} searchable={false} selected={filters.sort ?? null} options={SORTS.map((s) => ({ value: s.value, label: t(s.label) }))} onClose={() => setSheet(null)} onSelect={(v) => { setFilters((f) => ({ ...f, sort: v as SortKey })); setSheet(null); }} />
      <SelectSheet visible={sheet === "condition"} title={t("الحالة")} searchable={false} selected={filters.condition ?? "any"} options={[{ value: "any", label: t("أي حالة") }, ...CONDITIONS.map((c) => ({ value: c.value, label: t(c.label) }))]} onClose={() => setSheet(null)} onSelect={(v) => { setFilters((f) => ({ ...f, condition: v === "any" ? null : (v as Condition) })); setSheet(null); }} />
      <SelectSheet visible={sheet === "location"} title={t("الموقع")} selected={filters.locationId ? String(filters.locationId) : "clear"} options={locationOptions} onClose={() => setSheet(null)} onSelect={(v) => { setFilters((f) => ({ ...f, locationId: v === "clear" ? null : Number(v) })); setSheet(null); }} />
      <SelectSheet
        visible={sheet === "category"}
        title={categoryPath ? pickName(categories.byId(categoryPath)) : t("التصنيف")}
        options={categoryOptions}
        selected={filters.categoryId ? String(filters.categoryId) : "clear"}
        onClose={() => setSheet(null)}
        onSelect={(v) => {
          if (v === "clear") { setFilters((f) => ({ ...f, categoryId: null, attrs: {} })); setSheet(null); return; }
          if (v.startsWith("pick:")) { setFilters((f) => ({ ...f, categoryId: Number(v.slice(5)), attrs: {} })); setSheet(null); return; }
          const id = Number(v);
          if (categories.childrenOf(id).length) { setCategoryPath(id); return; }
          setFilters((f) => ({ ...f, categoryId: id, attrs: {} }));
          setSheet(null);
        }}
      />
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  searchRow: { alignItems: "center", flexDirection: "row-reverse", gap: 8 },
  go: { alignItems: "center", borderRadius: 13, height: 50, justifyContent: "center", width: 50 },
  toolbar: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 12 },
  filters: { borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 14 },
  priceRow: { flexDirection: "row-reverse", gap: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  historyItem: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row-reverse", gap: 10, paddingVertical: 12 },
  historyText: { flex: 1, fontSize: 14, textAlign: "right" },
  storeItem: { alignItems: "center", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginBottom: 8, padding: 10 },
  storeLogo: { borderRadius: 20, height: 40, width: 40 },
  storeName: { flex: 1, fontSize: 14, fontWeight: "800", textAlign: "right" },
});
