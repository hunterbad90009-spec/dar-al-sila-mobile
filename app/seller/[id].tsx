import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Button, EmptyState, ErrorState, Header, ListingGrid, Loading } from "@/components/market/ui";
import { friendlyError, searchListings } from "@/lib/data";
import { t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";

/** All active listings of one seller. */
export default function SellerListingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listings = useInfiniteQuery({
    queryKey: ["seller", id],
    queryFn: ({ pageParam }) => searchListings({ sellerId: id, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: Boolean(id),
  });
  const items = listings.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header title={items[0]?.sellerName ?? t("إعلانات البائع")} subtitle={t("كل الإعلانات النشطة لهذا البائع")} />
        {listings.isLoading ? <Loading /> : listings.isError ? <ErrorState message={friendlyError(listings.error)} onRetry={() => listings.refetch()} /> : items.length === 0 ? <EmptyState title={t("لا توجد إعلانات نشطة")} /> : (
          <>
            <ListingGrid items={items} />
            {listings.hasNextPage ? <Button variant="ghost" label={t("عرض المزيد")} loading={listings.isFetchingNextPage} onPress={() => listings.fetchNextPage()} style={{ marginTop: 14 }} /> : null}
          </>
        )}
        <Button variant="ghost" icon="flag" label={t("الإبلاغ عن البائع")} onPress={() => router.push({ pathname: "/report", params: { userId: id } })} style={{ marginTop: 18 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({ content: { paddingBottom: 40 } });
