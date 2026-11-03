import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MapRegion } from "./location-map";

export function LocationMap({ region, title, onRegionChangeComplete }: { region: MapRegion; title: string; onRegionChangeComplete?: (region: MapRegion) => void }) {
  return (
    <View style={styles.mapFallback}>
      <View style={styles.controls}>
        <Pressable accessibilityLabel="تكبير الخريطة" onPress={() => onRegionChangeComplete?.({ ...region, latitudeDelta: Math.max(0.01, region.latitudeDelta * 0.65), longitudeDelta: Math.max(0.01, region.longitudeDelta * 0.65) })} style={styles.button}><Text style={styles.buttonText}>+</Text></Pressable>
        <Pressable accessibilityLabel="تصغير الخريطة" onPress={() => onRegionChangeComplete?.({ ...region, latitudeDelta: Math.min(4, region.latitudeDelta * 1.5), longitudeDelta: Math.min(4, region.longitudeDelta * 1.5) })} style={styles.button}><Text style={styles.buttonText}>−</Text></Pressable>
      </View>
      <View style={styles.grid} />
      <View style={styles.pin}><Text style={styles.pinText}>●</Text></View>
      <View style={styles.label}><Text style={styles.title}>{title}</Text><Text style={styles.coords}>{region.latitude.toFixed(3)}, {region.longitude.toFixed(3)}</Text><Text style={styles.note}>الخريطة التفاعلية متاحة في نسخة Android</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapFallback: { backgroundColor: "#DDE8DF", flex: 1, justifyContent: "center", overflow: "hidden", position: "relative" },
  grid: { backgroundColor: "#C5D9C9", borderColor: "#B0C8B5", borderWidth: 1, height: 520, opacity: 0.55, position: "absolute", transform: [{ rotate: "14deg" }], width: "150%" },
  pin: { alignItems: "center", alignSelf: "center", backgroundColor: "#0B4A3B", borderColor: "#FFFFFF", borderRadius: 26, borderWidth: 4, height: 52, justifyContent: "center", width: 52 },
  pinText: { color: "#D5B36A", fontSize: 26 },
  label: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 14, bottom: 18, left: 18, paddingHorizontal: 14, paddingVertical: 10, position: "absolute", right: 18 },
  controls: { gap: 6, position: "absolute", right: 12, top: 12, zIndex: 2 },
  button: { alignItems: "center", backgroundColor: "#FFFFFFEE", borderRadius: 8, height: 36, justifyContent: "center", width: 36 },
  buttonText: { color: "#0B4A3B", fontSize: 24, fontWeight: "700", lineHeight: 28 },
  title: { color: "#0B4A3B", fontSize: 15, fontWeight: "900" },
  coords: { color: "#52665D", fontSize: 11, marginTop: 2 },
  note: { color: "#7A817C", fontSize: 10, marginTop: 4 },
});
