import MapView, { Marker } from "react-native-maps";
import type { Region } from "react-native-maps";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

export type MapRegion = Region;

type LocationMapProps = {
  region: MapRegion;
  title: string;
  onRegionChangeComplete?: (region: MapRegion) => void;
};

/**
 * The Google Maps provider needs a native API key in a standalone binary.
 * Do not mount the native map when the key is absent: Android can terminate
 * the process while creating the map view. The hierarchical location picker
 * remains fully usable through the governorate/wilayat controls.
 */
export function LocationMap({ region, title, onRegionChangeComplete }: LocationMapProps) {
  const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  const canRenderNativeMap = Platform.OS !== "android" || Boolean(googleMapsKey);

  if (!canRenderNativeMap) {
    return (
      <View style={styles.fallback} accessibilityLabel={`خريطة ${title}`}>
        <View style={styles.fallbackControls}>
          <Pressable accessibilityLabel="تكبير الخريطة" onPress={() => onRegionChangeComplete?.({ ...region, latitudeDelta: Math.max(0.01, region.latitudeDelta * 0.65), longitudeDelta: Math.max(0.01, region.longitudeDelta * 0.65) })} style={styles.zoomButton}><Text style={styles.zoomText}>+</Text></Pressable>
          <Pressable accessibilityLabel="تصغير الخريطة" onPress={() => onRegionChangeComplete?.({ ...region, latitudeDelta: Math.min(4, region.latitudeDelta * 1.5), longitudeDelta: Math.min(4, region.longitudeDelta * 1.5) })} style={styles.zoomButton}><Text style={styles.zoomText}>−</Text></Pressable>
        </View>
        <Text style={styles.fallbackTitle}>{title}</Text>
        <Text style={styles.fallbackText}>اختر المحافظة والولاية من القائمة أدناه</Text>
        <Text style={styles.coordinates}>{region.latitude.toFixed(3)}, {region.longitude.toFixed(3)}</Text>
      </View>
    );
  }

  return (
    <MapView style={styles.map} region={region} onRegionChangeComplete={onRegionChangeComplete}>
      <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} title={title} description="موقع البحث الحالي" />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  fallback: { alignItems: "center", backgroundColor: "#E9F4EE", justifyContent: "center", minHeight: 220, padding: 24 },
  fallbackControls: { gap: 6, position: "absolute", right: 12, top: 12, zIndex: 2 },
  zoomButton: { alignItems: "center", backgroundColor: "#FFFFFFEE", borderRadius: 8, elevation: 2, height: 36, justifyContent: "center", width: 36 },
  zoomText: { color: "#0B4A3B", fontSize: 24, fontWeight: "700", lineHeight: 28 },
  fallbackTitle: { color: "#0B4A3B", fontSize: 18, fontWeight: "900", textAlign: "center" },
  fallbackText: { color: "#53635C", fontSize: 14, marginTop: 10, textAlign: "center" },
  coordinates: { color: "#53635C", fontSize: 12, marginTop: 8 },
});
