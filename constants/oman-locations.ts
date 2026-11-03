export type OmanGovernorate = {
  name: string;
  latitude: number;
  longitude: number;
  wilayats: readonly string[];
};

/**
 * Administrative divisions of the Sultanate of Oman.
 * Source: Ministry of Interior, Oman National Open Data Portal (October 2025).
 * The list contains 11 governorates and 63 wilayats.
 */
export const omanGovernorates: readonly OmanGovernorate[] = [
  { name: "مسقط", latitude: 23.588, longitude: 58.382, wilayats: ["مسقط", "مطرح", "بوشر", "العامرات", "السيب", "قريات"] },
  { name: "شمال الباطنة", latitude: 24.250, longitude: 56.500, wilayats: ["صحار", "شناص", "لوى", "صحم", "الخابورة", "السويق"] },
  { name: "مسندم", latitude: 26.180, longitude: 56.300, wilayats: ["خصب", "دبا", "بخاء", "مدحاء"] },
  { name: "البريمي", latitude: 24.250, longitude: 55.790, wilayats: ["البريمي", "محضة", "السنينة"] },
  { name: "الظاهرة", latitude: 23.220, longitude: 56.500, wilayats: ["عبري", "ينقل", "ضنك"] },
  { name: "الداخلية", latitude: 22.900, longitude: 57.530, wilayats: ["نزوى", "بهلاء", "منح", "الحمراء", "أدم", "إزكي", "سمائل", "بدبد", "الجبل الأخضر"] },
  { name: "شمال الشرقية", latitude: 22.700, longitude: 58.600, wilayats: ["إبراء", "المضيبي", "بدية", "القابل", "وادي بني خالد", "دماء والطائيين", "سناو"] },
  { name: "الوسطى", latitude: 19.950, longitude: 56.280, wilayats: ["هيماء", "محوت", "الدقم", "الجازر"] },
  { name: "ظفار", latitude: 17.019, longitude: 54.089, wilayats: ["صلالة", "طاقة", "مرباط", "ثمريت", "مقشن", "سدح", "رخيوت", "ضلكوت", "شليم وجزر الحلانيات", "المزيونة"] },
  { name: "جنوب الباطنة", latitude: 23.700, longitude: 57.900, wilayats: ["الرستاق", "العوابي", "نخل", "وادي المعاول", "بركاء", "المصنعة"] },
  { name: "جنوب الشرقية", latitude: 22.560, longitude: 59.530, wilayats: ["صور", "جعلان بني بوحسن", "جعلان بني بوعلي", "الكامل والوافي", "مصيرة"] },
] as const;

export const omanGovernorateCount = omanGovernorates.length;
export const omanWilayatCount = omanGovernorates.reduce((total, item) => total + item.wilayats.length, 0);

export function findNearestGovernorate(latitude: number, longitude: number): OmanGovernorate {
  return omanGovernorates.reduce((nearest, item) => {
    const nearestDistance = (nearest.latitude - latitude) ** 2 + (nearest.longitude - longitude) ** 2;
    const itemDistance = (item.latitude - latitude) ** 2 + (item.longitude - longitude) ** 2;
    return itemDistance < nearestDistance ? item : nearest;
  }, omanGovernorates[0]);
}

export function formatOmanLocation(governorate: string, wilayat?: string): string {
  return wilayat && wilayat !== governorate ? `${wilayat}، ${governorate}` : governorate;
}
