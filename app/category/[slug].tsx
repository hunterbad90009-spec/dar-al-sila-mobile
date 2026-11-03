import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Chip, EmptyState, ErrorState, Header, ListingGrid, Loading, SectionHeader } from "@/components/market/ui";
import { searchListings } from "@/lib/data";
import { pickName, t } from "@/lib/i18n";
import { useCategories } from "@/lib/queries";
import { createStyles } from "@/lib/i18n/rtl";

/** One screen for every category level (replaces the old static category pages). */
export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const categories = useCategories();
  const category = categories.all.find((c) => c.slug === slug);
  const parent = category?.parent_id ? categories.byId(category.parent_id) : undefined;
  const children = category ? categories.childrenOf(category.id) : [];

  const listings = useInfiniteQuery({
    queryKey: ["category", category?.id],
    queryFn: ({ pageParam }) => searchListings({ categoryId: category!.id, page: pageParam, sort: "relevance" }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: Boolean(category),
  });
  const items = listings.data?.pages.flatMap((p) => p.items) ?? [];

  if (categories.isLoading) return <ScreenContainer className="px-4"><Loading /></ScreenContainer>;
  if (!category) return <ScreenContainer className="px-4"><Header title={t("التصنيف غير موجود")} /><EmptyState title={t("التصنيف غير موجود")} actionLabel={t("كل التصنيفات")} onAction={() => router.replace("/(tabs)/categories")} /></ScreenContainer>;

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header title={pickName(category)} subtitle={parent ? pickName(parent) : t("تصفح الأقسام الفرعية والإعلانات")} />
        <View style={styles.actions}>
          <Button small icon="tune" label={t("بحث وفلترة")} onPress={() => router.push({ pathname: "/search", params: { categoryId: String(category.id) } })} style={{ flex: 1 }} />
          <Button small variant="outline" icon="add-a-photo" label={t("أضف إعلان هنا")} onPress={() => router.push({ pathname: "/(tabs)/post", params: { categoryId: String(category.id) } })} style={{ flex: 1 }} />
        </View>
        {children.length > 0 ? (
          <>
            <SectionHeader title={t("الأقسام الفرعية")} />
            <View style={styles.chips}>{children.map((child) => <Chip key={child.id} label={pickName(child)} onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: child.slug } })} />)}</View>
          </>
        ) : null}
        <SectionHeader title={t("الإعلانات")} />
        {listings.isLoading ? <Loading label={t("جارٍ تحميل الإعلانات...")} /> : listings.isError ? <ErrorState onRetry={() => listings.refetch()} /> : items.length === 0 ? (
          <EmptyState title={t("لا توجد إعلانات في هذا القسم بعد")} text={t("أضف أول إعلان في هذا القسم.")} actionLabel={t("أضف إعلان هنا")} onAction={() => router.push({ pathname: "/(tabs)/post", params: { categoryId: String(category.id) } })} />
        ) : (
          <>
            <ListingGrid items={items} />
            {listings.hasNextPage ? <Button variant="ghost" label={t("عرض المزيد")} loading={listings.isFetchingNextPage} onPress={() => listings.fetchNextPage()} style={{ marginTop: 14 }} /> : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 36 },
  actions: { flexDirection: "row-reverse", gap: 10, marginTop: 8 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
});
