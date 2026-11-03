import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, ErrorState, Header, ListingGrid, Loading, LoginRequired } from "@/components/market/ui";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError, getRecentViews } from "@/lib/data";
import { t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";

export default function RecentViewsScreen() {
  const { isAuthenticated, loading } = useAuth();
  const views = useQuery({ queryKey: ["recent-views"], queryFn: getRecentViews, enabled: isAuthenticated });
  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header title={t("آخر المشاهدات")} subtitle={t("الإعلانات التي فتحتها مؤخرًا")} />
        {loading ? <Loading /> : !isAuthenticated ? <LoginRequired /> : views.isLoading ? <Loading /> : views.isError ? <ErrorState message={friendlyError(views.error)} onRetry={() => views.refetch()} /> : (views.data ?? []).length === 0 ? (
          <EmptyState icon="history" title={t("لا توجد مشاهدات بعد")} actionLabel={t("تصفح الإعلانات")} onAction={() => router.push("/search")} />
        ) : <ListingGrid items={views.data!.map((v) => v.listing)} />}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({ content: { paddingBottom: 30 } });
