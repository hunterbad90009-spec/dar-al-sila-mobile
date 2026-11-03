/**
 * The shopper's chosen area (governorate or wilayat id from the locations table),
 * used for location-aware browsing on the home page and as the default search filter.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { omanGovernorates } from "@/constants/oman-locations";
import type { Location } from "@/lib/data";

const KEY = "dar_al_sila_location_id";
const QUERY_KEY = ["selected-location"] as const;

export async function readSelectedLocationId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const id = raw ? Number(raw) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function useSelectedLocation() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: readSelectedLocationId, staleTime: Infinity });
  const set = async (id: number | null) => {
    try {
      if (id) await AsyncStorage.setItem(KEY, String(id));
      else await AsyncStorage.removeItem(KEY);
    } catch {
      /* still applies for this session */
    }
    client.setQueryData(QUERY_KEY, id);
  };
  return { locationId: query.data ?? null, set };
}

const stripPrefix = (name: string) => name.replace(/^محافظة\s+/, "").trim();

/** Approximate centre of a governorate (database rows have no coordinates yet). */
export function governorateCenter(location: Location | undefined): { latitude: number; longitude: number } {
  const match = location ? omanGovernorates.find((g) => g.name === stripPrefix(location.name_ar)) : undefined;
  return match ? { latitude: match.latitude, longitude: match.longitude } : { latitude: 23.588, longitude: 58.382 };
}

/** Nearest governorate to a GPS fix, mapped back to its database row. */
export function nearestGovernorate(governorates: Location[], latitude: number, longitude: number): Location | undefined {
  let best: Location | undefined;
  let bestDistance = Infinity;
  for (const gov of governorates) {
    const c = governorateCenter(gov);
    const d = (c.latitude - latitude) ** 2 + (c.longitude - longitude) ** 2;
    if (d < bestDistance) { bestDistance = d; best = gov; }
  }
  return best;
}
