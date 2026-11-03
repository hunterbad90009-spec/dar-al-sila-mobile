import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import type { Region } from "react-native-maps";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";
import { LocationMap } from "@/components/location-map";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { findNearestGovernorate, formatOmanLocation, omanGovernorates, type OmanGovernorate } from "@/constants/oman-locations";

const LOCATION_KEY = "selected_oman_location";

type SavedLocation = { governorate: string; wilayat?: string; latitude: number; longitude: number };

async function readSavedLocation(): Promise<string | null> {
  try {
    const secureValue = await SecureStore.getItemAsync(LOCATION_KEY);
    return secureValue ?? await AsyncStorage.getItem(LOCATION_KEY);
  } catch {
    return AsyncStorage.getItem(LOCATION_KEY).catch(() => null);
  }
}

async function writeSavedLocation(value: string): Promise<void> {
  await AsyncStorage.setItem(LOCATION_KEY, value);
  try { await SecureStore.setItemAsync(LOCATION_KEY, value); } catch { /* web fallback is already saved */ }
}

export default function LocationPickerScreen() {
  const colors = useColors();
  const [selected, setSelected] = useState<OmanGovernorate>(omanGovernorates[0]);
  const [selectedWilayat, setSelectedWilayat] = useState(omanGovernorates[0].wilayats[0]);
  const [region, setRegion] = useState<Region>({ latitude: selected.latitude, longitude: selected.longitude, latitudeDelta: 0.45, longitudeDelta: 0.45 });
  const [loading, setLoading] = useState(false);
  const [showWilayats, setShowWilayats] = useState(false);

  useEffect(() => {
    let mounted = true;
    readSavedLocation().then((raw) => {
      if (!mounted || !raw) return;
      try {
        const saved = JSON.parse(raw) as SavedLocation;
        const governorate = omanGovernorates.find((item) => item.name === saved.governorate);
        if (!governorate) return;
        const wilayat = governorate.wilayats.includes(saved.wilayat ?? "") ? saved.wilayat! : governorate.wilayats[0];
        setSelected(governorate);
        setSelectedWilayat(wilayat);
        setRegion({ latitude: saved.latitude, longitude: saved.longitude, latitudeDelta: 0.45, longitudeDelta: 0.45 });
      } catch {
        // Ignore malformed legacy storage and keep the safe default.
      }
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const selectGovernorate = (item: OmanGovernorate) => {
    const wilayat = item.wilayats[0];
    setSelected(item);
    setSelectedWilayat(wilayat);
    setRegion({ latitude: item.latitude, longitude: item.longitude, latitudeDelta: 0.45, longitudeDelta: 0.45 });
    setShowWilayats(true);
  };

  const selectWilayat = (wilayat: string) => {
    setSelectedWilayat(wilayat);
    setShowWilayats(true);
  };

  const useMyLocation = async () => {
    setLoading(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert("الموقع غير مفعّل", "فعّل خدمة الموقع من إعدادات الهاتف ثم حاول مرة أخرى.");
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("إذن الموقع مرفوض", "يمكنك اختيار محافظة أو ولاية يدويًا، أو تفعيل الإذن من إعدادات الهاتف.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextRegion = { latitude: current.coords.latitude, longitude: current.coords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
      const nearest = findNearestGovernorate(current.coords.latitude, current.coords.longitude);
      setRegion(nextRegion);
      setSelected(nearest);
      setSelectedWilayat(nearest.wilayats[0]);
      setShowWilayats(true);
      Alert.alert("تم تحديد موقعك", `تم اختيار أقرب محافظة: ${nearest.name}. راجع الولاية ثم اضغط حفظ الموقع.`);
    } catch {
      Alert.alert("تعذر تحديد الموقع", "اختر منطقتك يدويًا من القائمة.");
    } finally {
      setLoading(false);
    }
  };

  const saveLocation = async () => {
    try {
      await writeSavedLocation(JSON.stringify({ governorate: selected.name, wilayat: selectedWilayat, latitude: region.latitude, longitude: region.longitude }));
      router.back();
    } catch {
      Alert.alert("تعذر حفظ الموقع", "حاول مرة أخرى.");
    }
  };

  const selectedWilayats = useMemo(() => selected.wilayats, [selected]);

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}><IconSymbol name="xmark" size={22} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>اختيار الموقع</Text>
        <View style={styles.iconButton} />
      </View>
      <LocationMap region={region} title={formatOmanLocation(selected.name, selectedWilayat)} onRegionChangeComplete={setRegion} />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}> 
        <View style={styles.sheetTitleRow}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>موقعك في سلطنة عُمان</Text><IconSymbol name="location.fill" size={22} color={colors.primary} /></View>
        <Pressable onPress={useMyLocation} style={({ pressed }) => [styles.currentButton, { borderColor: colors.primary }, pressed && styles.pressed]}><IconSymbol name="location.fill" size={18} color={colors.primary} /><Text style={[styles.currentText, { color: colors.primary }]}>{loading ? "جارٍ تحديد موقعك..." : "استخدم موقعي الحالي"}</Text></Pressable>
        <Pressable onPress={() => setShowWilayats((value) => !value)} style={[styles.selectedPill, { backgroundColor: colors.surface, borderColor: colors.border }]}><IconSymbol name="chevron.down" size={16} color={colors.muted} /><Text style={[styles.selectedText, { color: colors.foreground }]}>{selectedWilayat}، {selected.name}</Text></Pressable>
        {showWilayats ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wilayatRow}>{selectedWilayats.map((wilayat) => <Pressable key={wilayat} onPress={() => selectWilayat(wilayat)} style={[styles.wilayatChip, { borderColor: wilayat === selectedWilayat ? colors.primary : colors.border, backgroundColor: wilayat === selectedWilayat ? colors.primary : colors.surface }]}><Text style={[styles.wilayatText, { color: wilayat === selectedWilayat ? "#FFFFFF" : colors.foreground }]}>{wilayat}</Text></Pressable>)}</ScrollView> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.governorateRow}>{omanGovernorates.map((item) => <Pressable key={item.name} onPress={() => selectGovernorate(item)} style={[styles.governorateChip, { borderColor: item.name === selected.name ? colors.primary : colors.border, backgroundColor: item.name === selected.name ? colors.primary : colors.surface }]}><Text style={[styles.governorateText, { color: item.name === selected.name ? "#FFFFFF" : colors.foreground }]}>{item.name}</Text></Pressable>)}</ScrollView>}
        <Pressable onPress={saveLocation} style={[styles.saveButton, { backgroundColor: colors.primary }]}><Text style={styles.saveText}>حفظ الموقع</Text></Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 },
  iconButton: { alignItems: "center", height: 38, justifyContent: "center", width: 38 },
  title: { fontSize: 20, fontWeight: "900" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, padding: 16 },
  sheetTitleRow: { alignItems: "center", flexDirection: "row-reverse", gap: 8, justifyContent: "flex-start" },
  sheetTitle: { fontSize: 17, fontWeight: "900" },
  currentButton: { alignItems: "center", alignSelf: "flex-end", borderRadius: 12, borderWidth: 1, flexDirection: "row-reverse", gap: 7, marginTop: 12, paddingHorizontal: 12, paddingVertical: 9 },
  currentText: { fontSize: 12, fontWeight: "800" },
  selectedPill: { alignItems: "center", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "space-between", marginTop: 12, paddingHorizontal: 14, paddingVertical: 12 },
  selectedText: { flex: 1, fontSize: 15, fontWeight: "800", textAlign: "right" },
  governorateRow: { gap: 8, paddingVertical: 12 },
  governorateChip: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  governorateText: { fontSize: 12, fontWeight: "800" },
  wilayatRow: { gap: 8, paddingVertical: 12 },
  wilayatChip: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  wilayatText: { fontSize: 12, fontWeight: "700" },
  saveButton: { alignItems: "center", borderRadius: 14, height: 50, justifyContent: "center", marginTop: 4 },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.7 },
});
