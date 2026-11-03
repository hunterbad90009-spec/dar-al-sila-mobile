import MapView, { Marker } from "react-native-maps";
import type { Region } from "react-native-maps";
import { Platform } from "react-native";
import { LocationCard } from "./location-card";
import { t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";

export type MapRegion = Region;

type LocationMapProps = {
  region: MapRegion;
  title: string;
  onRegionChangeComplete?: (region: MapRegion) => void;
};

/**
 * The Google Maps provider needs a native API key in a standalone binary.
 * Do not mount the native map when the key is absent: Android can terminate
 * the process while creating the map view. The location picker stays fully
 * usable through the governorate/wilayat controls.
 */
export function LocationMap({ region, title, onRegionChangeComplete }: LocationMapProps) {
  const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  const canRenderNativeMap = Platform.OS !== "android" || Boolean(googleMapsKey);
  if (!canRenderNativeMap) return <LocationCard title={title} />;
  return (
    <MapView style={styles.map} region={region} onRegionChangeComplete={onRegionChangeComplete}>
      <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} title={title} description={t("موقع البحث الحالي")} />
    </MapView>
  );
}

const styles = createStyles({ map: { flex: 1 } });
