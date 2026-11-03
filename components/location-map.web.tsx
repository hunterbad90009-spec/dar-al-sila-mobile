import type { MapRegion } from "./location-map";
import { LocationCard } from "./location-card";

export function LocationMap({ title }: { region: MapRegion; title: string; onRegionChangeComplete?: (region: MapRegion) => void }) {
  return <LocationCard title={title} />;
}
