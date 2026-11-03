const synonyms: Record<string, string[]> = {
  سيارة: ["سيارات", "مركبة", "مركبات", "car", "cars"],
  لكزس: ["lexus", "لكزس"],
  كرسي: ["كراسي", "أثاث", "chair", "chairs"],
  هاتف: ["موبايل", "جوال", "هاتف", "iphone", "samsung", "آيفون"],
  لابتوب: ["كمبيوتر", "حاسوب", "لابتوب", "laptop", "computer"],
  تلفزيون: ["شاشة", "تلفزيون", "tv", "screen"],
  منزل: ["بيت", "أثاث", "حدائق", "home", "garden"],
  لعبة: ["ألعاب", "بلايستيشن", "إكس بوكس", "game", "gaming"],
  وظيفة: ["وظائف", "عمل", "توظيف", "job", "jobs"],
};

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function expandSearchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);
  const terms = normalized.split(" ").filter(Boolean);
  const expanded = new Set(terms);
  for (const term of terms) {
    for (const [key, values] of Object.entries(synonyms)) {
      const normalizedValues = [key, ...values].map(normalizeSearchText);
      if (normalizedValues.some((value) => value === term || value.includes(term) || term.includes(value))) {
        normalizedValues.forEach((value) => expanded.add(value));
      }
    }
  }
  return [...expanded];
}

export function matchesSearch(query: string, ...fields: string[]): boolean {
  const baseTerms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!baseTerms.length) return true;
  const haystack = normalizeSearchText(fields.join(" "));
  return baseTerms.every((term) => {
    const related = expandSearchTerms(term);
    return related.some((candidate) => haystack.includes(candidate));
  });
}

export function getSearchSuggestions(query: string, items: string[]): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return items.filter((item) => normalizeSearchText(item).includes(normalized)).slice(0, 6);
}
