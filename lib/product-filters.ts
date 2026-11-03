import { matchesSearch } from "./search";

type SearchableProduct = {
  title?: string | null;
  location?: string | null;
  category?: string | null;
};

export function filterProducts<T extends SearchableProduct>(items: T[], query: string, category: string): T[] {
  const normalizedCategory = category.trim();
  const normalizedQuery = query.trim();

  return items.filter((item) => {
    const matchesCategory = normalizedCategory === "الكل" || item.category === normalizedCategory;
    const matchesText = !normalizedQuery || matchesSearch(normalizedQuery, item.title ?? "", item.location ?? "", item.category ?? "");
    return matchesCategory && matchesText;
  });
}

export function getProductCategories<T extends SearchableProduct>(items: T[]): string[] {
  return Array.from(new Set(items.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value))));
}
