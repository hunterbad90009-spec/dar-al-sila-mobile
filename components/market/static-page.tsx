import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Button, Card, Header } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { getPage, pick } from "@/lib/content";
import { t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";

/** Renders one bilingual help/legal page from lib/content.ts. */
export function StaticPageScreen({ pageKey }: { pageKey: string }) {
  const colors = useColors();
  const page = getPage(pageKey);
  if (!page) return null;
  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header title={pick(page.title)} subtitle={page.updated ? pick(page.updated) : undefined} />
        {page.intro ? <View style={[styles.intro, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}><Text style={[styles.introText, { color: colors.foreground }]}>{pick(page.intro)}</Text></View> : null}
        {page.sections.map((s) => (
          <Card key={s.title.ar} style={styles.section}>
            <Text style={[styles.title, { color: colors.foreground }]}>{pick(s.title)}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{pick(s.body)}</Text>
          </Card>
        ))}
        <Button variant="ghost" icon="help-outline" label={t("مركز المساعدة")} onPress={() => router.push("/help-center")} style={{ marginTop: 18 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  intro: { borderRadius: 14, borderWidth: 1, marginTop: 8, padding: 14 },
  introText: { fontSize: 14, fontWeight: "800", lineHeight: 22, textAlign: "right" },
  section: { marginTop: 12 },
  title: { fontSize: 16, fontWeight: "900", textAlign: "right" },
  body: { fontSize: 14, lineHeight: 23, marginTop: 6, textAlign: "right" },
});
