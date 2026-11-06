import { router } from "expo-router";
import { Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Button } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { formatDate, t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";
import { useMyRestriction } from "@/lib/queries";

/** Shown to a suspended user: why, until when, and how to appeal. Renders nothing otherwise. */
export function SuspensionNotice({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  const restriction = useMyRestriction();
  const r = restriction.data;
  if (!r) return null;
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.error }]}>
      <View style={styles.head}>
        <MaterialIcons name="block" size={22} color={colors.error} />
        <Text style={[styles.title, { color: colors.error }]}>
          {r.until ? t("حسابك موقوف حتى {date}", { date: formatDate(r.until) }) : t("حسابك موقوف بشكل دائم")}
        </Text>
      </View>
      <Text style={[styles.text, { color: colors.foreground }]}>{t("السبب")}: {t(r.reason)}</Text>
      {!compact ? <Text style={[styles.text, { color: colors.muted }]}>{t("لا يمكنك نشر الإعلانات أو إرسال الرسائل خلال الإيقاف، وإعلاناتك مخفية عن الناس.")}</Text> : null}
      <Button small variant="outline" icon="gavel" label={t("اعتراض على القرار")} onPress={() => router.push({ pathname: "/appeal", params: { kind: "account" } })} style={{ alignSelf: "flex-start", marginTop: 10 }} />
    </View>
  );
}

const styles = createStyles({
  box: { borderRadius: 16, borderWidth: 1.5, marginTop: 12, padding: 14 },
  head: { alignItems: "center", flexDirection: "row-reverse", gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: "900", textAlign: "right" },
  text: { fontSize: 13, lineHeight: 21, marginTop: 6, textAlign: "right" },
});
