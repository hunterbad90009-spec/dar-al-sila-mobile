import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Card, EmptyState, ErrorState, Header, ListingGrid, Loading, SectionHeader } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { friendlyError, getSellerReviews, searchListings } from "@/lib/data";
import { formatNumber, t, timeAgo } from "@/lib/i18n";
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
  const colors = useColors();
  const reviews = useQuery({ queryKey: ["seller-reviews", id], queryFn: () => getSellerReviews(id!), enabled: Boolean(id) });
  const rated = reviews.data ?? [];
  const average = rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : 0;
  const withText = rated.filter((r) => r.comment);
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
        <SectionHeader title={t("تقييمات البائع")} />
        {rated.length ? (
          <Text style={[styles.summary, { color: colors.foreground }]}>★ {formatNumber(average, { maximumFractionDigits: 1 })} · {t("{n} تقييم", { n: rated.length })}</Text>
        ) : <Text style={[styles.empty, { color: colors.muted }]}>{t("لا توجد تقييمات بعد")}</Text>}
        {withText.slice(0, 15).map((r, i) => (
          <Card key={`${r.createdAt}-${i}`} style={{ marginTop: 8 }}>
            <View style={styles.reviewHead}>
              <Text style={[styles.stars, { color: colors.accent }]}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{r.reviewerName} · {timeAgo(r.createdAt)}</Text>
            </View>
            <Text style={[styles.comment, { color: colors.foreground }]}>{r.comment}</Text>
            {r.listingTitle ? <Text style={[styles.meta, { color: colors.muted }]}>{r.listingTitle}</Text> : null}
          </Card>
        ))}
        <Button variant="ghost" icon="flag" label={t("الإبلاغ عن البائع")} onPress={() => router.push({ pathname: "/report", params: { userId: id } })} style={{ marginTop: 18 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  summary: { fontSize: 15, fontWeight: "900", textAlign: "right" },
  empty: { fontSize: 13, textAlign: "right" },
  reviewHead: { alignItems: "center", flexDirection: "row-reverse", gap: 8, justifyContent: "space-between" },
  stars: { fontSize: 15 },
  meta: { fontSize: 11, marginTop: 4, textAlign: "right" },
  comment: { fontSize: 14, lineHeight: 22, marginTop: 6, textAlign: "right" },
});
