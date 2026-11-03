import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { Region } from "react-native-maps";
import { ScreenContainer } from "@/components/screen-container";
import { LocationMap } from "@/components/location-map";
import { Button, Chip, ErrorState, Header, Loading, SectionHeader, notify } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { pickName, t } from "@/lib/i18n";
import { useLocations } from "@/lib/queries";
import { governorateCenter, nearestGovernorate, useSelectedLocation } from "@/lib/user-location";
import { createStyles } from "@/lib/i18n/rtl";

/** Choose governorate / wilayat for location-aware browsing (spec 4.1). */
export default function LocationPickerScreen() {
  const colors = useColors();
  const locations = useLocations();
  const { locationId, set } = useSelectedLocation();
  const [governorate, setGovernorate] = useState<number | null>(null);
  const [wilayat, setWilayat] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!locationId || !locations.all.length) return;
    const loc = locations.all.find((l) => l.id === locationId);
    if (loc?.kind === "wilayat") { setGovernorate(loc.parent_id); setWilayat(loc.id); } else if (loc) setGovernorate(loc.id);
  }, [locationId, locations.all]);

  const gov = locations.all.find((l) => l.id === governorate);
  const center = governorateCenter(gov);
  const region: Region = { ...center, latitudeDelta: gov ? 0.9 : 6, longitudeDelta: gov ? 0.9 : 6 };

  const useGps = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { notify(t("الموقع غير مسموح"), t("اختر المحافظة يدويًا أو اسمح بالموقع من الإعدادات.")); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nearest = nearestGovernorate(locations.governorates, position.coords.latitude, position.coords.longitude);
      if (nearest) { setGovernorate(nearest.id); setWilayat(null); }
    } catch {
      notify(t("تعذر تحديد موقعك"), t("اختر المحافظة يدويًا."));
    } finally {
      setLocating(false);
    }
  };

  const save = async (id: number | null) => {
    await set(id);
    if (router.canGoBack()) router.back(); else router.replace("/(tabs)");
  };

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Header title={t("اختيار الموقع")} subtitle={t("نعرض لك الإعلانات القريبة أولًا")} />
        <View style={[styles.map, { borderColor: colors.border }]}><LocationMap region={region} title={gov ? pickName(gov) : t("سلطنة عُمان")} /></View>
        <Button variant="outline" icon="my-location" label={t("استخدم موقعي الحالي")} loading={locating} onPress={useGps} style={{ marginTop: 12 }} />
        {locations.isLoading ? <Loading /> : locations.isError ? <ErrorState onRetry={() => locations.refetch()} /> : (
          <>
            <SectionHeader title={t("المحافظة")} />
            <View style={styles.chips}>{locations.governorates.map((g) => <Chip key={g.id} label={pickName(g).replace(/^محافظة\s+/, "").replace(/\s+Governorate$/, "")} active={governorate === g.id} onPress={() => { setGovernorate(g.id); setWilayat(null); }} />)}</View>
            {gov ? (
              <>
                <SectionHeader title={t("الولاية (اختياري)")} />
                <View style={styles.chips}>{locations.wilayatsOf(gov.id).map((w) => <Chip key={w.id} label={pickName(w)} active={wilayat === w.id} onPress={() => setWilayat(wilayat === w.id ? null : w.id)} />)}</View>
              </>
            ) : null}
          </>
        )}
        <Text style={[styles.selected, { color: colors.foreground }]}>{wilayat || governorate ? locations.label(wilayat ?? governorate) : t("كل عُمان")}</Text>
        <Button label={t("حفظ الموقع")} disabled={!governorate} onPress={() => save(wilayat ?? governorate)} style={{ marginTop: 10 }} />
        <Button variant="ghost" label={t("عرض كل عُمان")} onPress={() => save(null)} style={{ marginTop: 8 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  map: { borderRadius: 18, borderWidth: 1, height: 220, overflow: "hidden" },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  selected: { fontSize: 15, fontWeight: "900", marginTop: 20, textAlign: "center" },
});
