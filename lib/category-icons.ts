import type MaterialIcons from "@expo/vector-icons/MaterialIcons";

type IconName = keyof typeof MaterialIcons.glyphMap;

/** Icon + soft tile color per top-level category slug (spec 4.2 main categories). */
export const CATEGORY_STYLE: Record<string, { icon: IconName; tint: string }> = {
  cars: { icon: "directions-car", tint: "#E6EFEA" },
  "real-estate": { icon: "home-work", tint: "#F4ECD6" },
  "mobiles-tablets": { icon: "smartphone", tint: "#E7ECF4" },
  electronics: { icon: "tv", tint: "#ECE8F4" },
  computers: { icon: "laptop-mac", tint: "#E5EEF2" },
  gaming: { icon: "sports-esports", tint: "#E4F1E8" },
  furniture: { icon: "chair", tint: "#F3E9E1" },
  jobs: { icon: "work-outline", tint: "#EEF0E3" },
  services: { icon: "handyman", tint: "#F1EADF" },
  fashion: { icon: "checkroom", tint: "#F6E6E8" },
  pets: { icon: "pets", tint: "#EAF0E6" },
  "sports-fitness": { icon: "sports-soccer", tint: "#E3EEF0" },
  "business-supplies": { icon: "business-center", tint: "#ECEBE6" },
  "old-watches-jewelry": { icon: "watch", tint: "#F5EEDB" },
  "old-kids-toys": { icon: "toys", tint: "#F4E8F0" },
  "old-tools-equipment": { icon: "construction", tint: "#EEEDE7" },
  "old-books-education": { icon: "menu-book", tint: "#EDEAF2" },
  other: { icon: "category", tint: "#EEEEEA" },
};

export function categoryStyle(slug: string | null | undefined): { icon: IconName; tint: string } {
  return (slug && CATEGORY_STYLE[slug]) || { icon: "category", tint: "#EEEEEA" };
}
