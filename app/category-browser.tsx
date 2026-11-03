import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const tree: Record<string, Record<string, string[]>> = {
  "عقارات للبيع": { root: ["سكني", "أراضي", "تجاري"], سكني: ["شقق", "فلل", "عمارات", "عقارات أجنبية", "بيوت", "مزارع وشاليهات"], تجاري: ["مكاتب", "محلات", "مجمعات", "معارض", "مطاعم", "مخازن", "سوبر ماركت", "عيادات", "مصانع"] },
  "عقارات للإيجار": { root: ["سكني", "تجاري", "أراضي"], سكني: ["شقق", "فلل", "غرف", "بيوت", "مزارع وشاليهات"], تجاري: ["مكاتب", "محلات", "معارض", "مطاعم", "مخازن"] },
  "أجهزة إلكترونية وأجهزة منزلية": { root: ["موبايل وتابلت", "أجهزة منزلية", "لابتوب وكمبيوتر", "إلكترونيات"], "موبايل وتابلت": ["أرقام مميزة", "هواتف", "تابلت", "ساعات ذكية", "إكسسوارات", "هواتف أرضية"], "لابتوب وكمبيوتر": ["حلول شبكات", "أجهزة محمولة", "كمبيوتر ألعاب", "شاشات", "خوادم", "برامج"] },
  "منزل وحديقة": { root: ["مطابخ", "ديكور", "الأثاث", "حمامات", "مسابح", "أثاث حدائق", "نباتات", "إضاءة", "أبواب ونوافذ", "بلاط وأرضيات"], الأثاث: ["غرف جلوس", "غرف نوم", "خزائن", "فرشات", "أغطية", "غرف سفرة", "أطفال", "مكاتب"], "بلاط وأرضيات": ["سيراميك", "بورسلان", "موزاييك", "رخام", "زجاجي", "خارجي"] },
  "موضة وأطفال": { root: ["نساء", "رجال", "أطفال ورضع"], "أطفال ورضع": ["بنات", "أولاد", "أطفال رضع", "مستلزمات"] },
  "جمال وصحة": { root: ["مكياج", "مستلزمات أظافر", "مستحضرات تجميل", "عطور"], مكياج: ["شفاه", "وجه", "عيون", "أدوات وفرش"] },
  الخدمات: { root: ["صحة وجمال", "أعمال", "إنشاءات", "نقل وتوصيل", "تنظيف", "صيانة", "حدائق", "مركبات", "صيانة إلكترونيات", "رعاية منزلية", "حيوانات", "فعاليات", "تدريس"], "صيانة إلكترونيات": ["كمبيوتر", "موبايل", "ألعاب فيديو", "ستالايت", "أجهزة كبيرة", "أفران", "أنظمة مراقبة", "مصاعد", "مكيفات"] },
  وظائف: { root: ["باحثين عن عمل", "وظائف شاغرة", "تدريب وتدريس", "دوام كامل", "دوام جزئي"] },
  "طعام - غذاء": { root: ["مطاعم", "حلويات", "تموين", "منتجات منزلية", "مشروبات"] },
  "حيوانات وإكسسوارات": { root: ["قطط", "كلاب", "طيور", "أسماك", "مستلزمات الحيوانات", "خدمات بيطرية"] },
  "ترفيه وكتب ومقتنيات": { root: ["كتب", "آلات موسيقية", "تحف ومقتنيات", "أفلام وموسيقى", "هوايات"] },
  "معدات رياضية ولياقة": { root: ["معدات لياقة", "دراجات", "رياضات مائية", "رياضات جماعية", "مستلزمات رياضية"] },
  "تجهيزات ومعدات الشركات": { root: ["معدات مكتبية", "معدات مطاعم", "معدات ورش", "معدات إنشاءات", "معدات طبية", "معدات زراعية"] },
};

export default function CategoryBrowserScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ root?: string; parent?: string }>();
  const root = params.root ?? "الخدمات";
  const parent = params.parent ?? "root";
  const [query, setQuery] = useState("");
  const sections = useMemo(() => tree[root]?.[parent] ?? tree[root]?.root ?? [], [root, parent]);
  const filtered = useMemo(() => sections.filter((item) => item.includes(query.trim())), [sections, query]);
  const choose = (section: string) => {
    const children = tree[root]?.[section];
    if (children?.length) router.push({ pathname: "/category-browser" as any, params: { root, parent: section } });
    else router.push({ pathname: "/image-upload" as any, params: { category: `${root} / ${section}` } });
  };
  const title = parent === "root" ? root : parent;

  return <ScreenContainer className="px-4"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.topBar}><Pressable onPress={() => router.back()}><IconSymbol name="xmark" size={30} color={colors.foreground} /></Pressable><Text numberOfLines={1} style={[styles.topTitle, { color: colors.foreground }]}>{title}</Text><Pressable onPress={() => router.back()}><IconSymbol name="chevron.right" size={29} color={colors.foreground} /></Pressable></View><Text style={[styles.heading, { color: colors.foreground }]}>اختر القسم المناسب لإضافة الإعلان</Text><View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><TextInput value={query} onChangeText={setQuery} placeholder="إبحث في القسم" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.foreground }]} textAlign="right" /><IconSymbol name="magnifyingglass" size={25} color={colors.muted} /></View><View style={styles.cards}>{filtered.map((section) => <Pressable key={section} onPress={() => choose(section)} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.7 }]}><IconSymbol name="chevron.left" size={28} color={colors.foreground} /><Text style={[styles.cardText, { color: colors.foreground }]}>{section}</Text><IconSymbol name="square.grid.2x2.fill" size={30} color={colors.primary} /></Pressable>)}</View></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 32 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 9 }, topTitle: { flex: 1, fontSize: 22, fontWeight: "900", marginHorizontal: 10, textAlign: "center" }, heading: { fontSize: 23, fontWeight: "900", marginTop: 42, textAlign: "right" }, search: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 22, minHeight: 58, paddingHorizontal: 16 }, searchInput: { flex: 1, fontSize: 16 }, cards: { gap: 14, marginTop: 18 }, card: { alignItems: "center", borderRadius: 17, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 116, paddingHorizontal: 19 }, cardText: { flex: 1, fontSize: 20, fontWeight: "900", marginHorizontal: 14, textAlign: "center" } });
