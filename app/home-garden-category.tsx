import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type Node = { label: string; next?: string };
const leaves = (labels: string[]): Node[] => labels.map((label) => ({ label }));
const data: Record<string, { title: string; items: Node[] }> = {
  root: { title: "منزل وحدائق", items: [{ label: "مطابخ ومستلزماتها", next: "kitchens" }, { label: "ديكور المنزل وإكسسواراته", next: "decor" }, { label: "المنزل والحديقة أخرى" }, { label: "الأثاث", next: "furniture" }, { label: "الحمامات وإكسسواراتها", next: "bathrooms" }, { label: "مسابح وساونا", next: "pools" }, { label: "أثاث الحدائق والخارج", next: "outdoor" }, { label: "نباتات", next: "plants" }, { label: "إضاءة", next: "lighting" }, { label: "أبواب ونوافذ", next: "doors" }, { label: "بلاط وأرضيات", next: "floors" }] },
  kitchens: { title: "مطابخ ومستلزماتها", items: leaves(["مطابخ", "أثاث مطابخ", "أواني وأدوات مطبخ"]) },
  decor: { title: "ديكور المنزل وإكسسواراته", items: leaves(["سجاد ومنسوجات", "ستائر وستائر معتمة", "ديكور وإكسسوارات"]) },
  furniture: { title: "الأثاث", items: leaves(["أثاث غرف جلوس", "أثاث غرف نوم", "خزائن وطاولات جانبية", "فرشات", "أغطية وأقمشة", "أثاث غرف سفرة", "أثاث غرف أطفال", "أثاث مكاتب ودراسة"]) },
  bathrooms: { title: "الحمامات وإكسسواراتها", items: [{ label: "حمامات", next: "bath" }, { label: "جاكوزي" }, { label: "أحواض استحمام" }, { label: "إكسسوارات حمام", next: "bath-accessories" }] },
  bath: { title: "حمامات", items: leaves(["أطقم حمام", "بيديه", "مراحيض", "رشاش مرحاض", "مفاصل وقواعد مغاسل", "خلاطات المفاصل"]) },
  "bath-accessories": { title: "إكسسوارات حمام", items: leaves(["حاملات ورفوف للحمام", "خزائن الحمام ووحدات التخزين", "سلال ملابس", "أثاث حمام أخرى", "إكسسوارات ومستلزمات الحمام", "وحدات تخزين وديكورات الحمام", "معدات حمام أخرى"]) },
  pools: { title: "مسابح وساونا", items: leaves(["مسابح", "معدات مسابح", "فلاتر ومضخات للمسابح", "مواد كيماوية للمسابح", "ساونا", "مسابح وساونا أخرى"]) },
  outdoor: { title: "أثاث الحدائق والخارج", items: [{ label: "أثاث خارجي", next: "outdoor-furniture" }, { label: "شوايات ومستلزمات طهي خارجي", next: "grills" }] },
  "outdoor-furniture": { title: "أثاث خارجي", items: leaves(["مظلات وبرجولات", "أراجيح خارجية وهاموك", "أطقم أثاث خارجي", "طاولات خارجية", "كراسي ونبشات خارجية", "ألعاب خارجية", "أثاث خارجي أخرى"]) },
  grills: { title: "شوايات ومستلزمات طهي خارجي", items: leaves(["شوايات", "مواقد خارجية", "مداخن", "فحم وحطب وغاز", "أدوات وملحقات شواء", "شوايات وطبخ خارجي أخرى"]) },
  plants: { title: "نباتات", items: [{ label: "نباتات داخلية", next: "indoor-plants" }, { label: "نباتات خارجية", next: "outdoor-plants" }, { label: "نباتات صناعية", next: "artificial-plants" }, { label: "مستلزمات زراعية", next: "farming" }, { label: "الري وسقاية النباتات", next: "irrigation" }, { label: "معدات وأدوات حدائق", next: "garden-tools" }] },
  "indoor-plants": { title: "نباتات داخلية", items: leaves(["مزهرة", "ورقية زخرفية", "صبارات وعصاريات", "متسلقة ومعلقة", "بونساي ومصغرة", "أشجار داخلية", "أخرى"]) },
  "outdoor-plants": { title: "نباتات خارجية", items: leaves(["مزهرة", "شجيرات وأحراش", "أشجار ونخيل", "أعشاب وعطرية", "عشب حدائق", "زاحفة", "أشجار مثمرة", "نباتات مثمرة"]) },
  "artificial-plants": { title: "نباتات صناعية", items: leaves(["زهور", "ورقية", "أشجار", "متسلقة ومعلقة"]) },
  farming: { title: "مستلزمات زراعية", items: leaves(["أصص وأحواض", "تربة وأسمدة", "أدوات زراعة"]) },
  irrigation: { title: "الري وسقاية النباتات", items: leaves(["علب ري", "خراطيم", "رشاشات", "ري بالتنقيط", "مؤقتات", "مضخات وملحقات"]) },
  "garden-tools": { title: "معدات وأدوات حدائق", items: leaves(["مناشير كهربائية", "جزازات عشب", "خراطيم وأنظمة ري", "مقصات", "بيوت زجاجية", "مجارف", "عربات", "أخرى"]) },
  lighting: { title: "إضاءة", items: [{ label: "إضاءة داخلية", next: "indoor-light" }, { label: "إضاءة خارجية", next: "outdoor-light" }, { label: "إضاءة محمولة وطوارئ", next: "portable-light" }, { label: "مصابيح ولمبات نيون", next: "neon-light" }] },
  "indoor-light": { title: "إضاءة داخلية", items: leaves(["سقف وثريات", "معلقة", "أباليك", "أرضية", "طاولات", "سبوتات ومسار", "شرائط LED", "أخرى"]) },
  "outdoor-light": { title: "إضاءة خارجية", items: leaves(["حدائق وباحات", "شمسية", "أمان وكشافات", "حائط وبوابات", "أخرى"]) },
  "portable-light": { title: "إضاءة محمولة وطوارئ", items: leaves(["يدوية وكشافات", "فوانيس شحن", "تخييم", "أخرى"]) },
  "neon-light": { title: "مصابيح ولمبات نيون", items: leaves(["لمبات", "أنابيب فلورسنت", "أخرى"]) },
  doors: { title: "أبواب ونوافذ", items: [{ label: "أبواب وإكسسوارات أبواب", next: "door-items" }, { label: "نوافذ وإكسسوارات", next: "window-items" }, { label: "أسوار ودرابزين", next: "fences" }] },
  "door-items": { title: "أبواب وإكسسوارات أبواب", items: leaves(["داخلية", "خارجية", "كراج", "أمان", "منزلقة", "إكسسوارات"]) },
  "window-items": { title: "نوافذ وإكسسوارات", items: leaves(["نوافذ", "أباجورات", "إكسسوارات شبابيك"]) },
  fences: { title: "أسوار ودرابزين", items: leaves(["أسوار حدائق", "درابزين شرفات", "بوابات ودرابزين أخرى"]) },
  floors: { title: "بلاط وأرضيات", items: [{ label: "بلاط", next: "tiles" }, { label: "أرضيات", next: "flooring" }] },
  tiles: { title: "بلاط", items: leaves(["سيراميك", "بورسلان", "موزاييك", "رخام وحجر", "زجاجي وزخرفي", "خارجي", "آخر"]) },
  flooring: { title: "أرضيات", items: leaves(["خشب وباركيه", "رخام وحجر", "لامينيت", "PVC", "أخرى"]) },
};

export default function HomeGardenCategoryScreen() {
  const colors = useColors();
  const { kind = "root" } = useLocalSearchParams<{ kind?: string }>();
  const current = data[kind] ?? data.root;
  const [query, setQuery] = useState("");
  const items = useMemo(() => current.items.filter((item) => item.label.includes(query.trim())), [current.items, query]);
  const go = (item: Node) => item.next ? router.push({ pathname: "/home-garden-category" as any, params: { kind: item.next } }) : router.push({ pathname: "/image-upload" as any, params: { category: `منزل وحدائق / ${current.title} / ${item.label}` } });
  return <ScreenContainer className="px-4"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.topBar}><Pressable onPress={() => router.back()}><IconSymbol name="xmark" size={30} color={colors.foreground} /></Pressable><Text numberOfLines={1} style={[styles.topTitle, { color: colors.foreground }]}>{current.title}</Text><Pressable onPress={() => router.back()}><IconSymbol name="chevron.right" size={29} color={colors.foreground} /></Pressable></View><Text style={[styles.title, { color: colors.foreground }]}>ما الذي تود بيعه او الإعلان عنه؟</Text><Text style={[styles.subtitle, { color: colors.muted }]}>اختر القسم المناسب لإضافة الإعلان</Text><View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><TextInput value={query} onChangeText={setQuery} placeholder="إبحث في القسم" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.foreground }]} textAlign="right" /><IconSymbol name="magnifyingglass" size={26} color={colors.muted} /></View><View style={styles.cards}>{items.map((item) => <Pressable key={item.label} onPress={() => go(item)} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={28} color={colors.foreground} /><Text style={[styles.cardText, { color: colors.foreground }]}>{item.label}</Text><View style={[styles.iconBubble, { backgroundColor: colors.primary + "22" }]}><Text style={[styles.iconMark, { color: colors.primary }]}>⌁</Text></View></Pressable>)}</View></ScrollView></ScreenContainer>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 34 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 9 }, topTitle: { flex: 1, fontSize: 21, fontWeight: "900", marginHorizontal: 10, textAlign: "center" }, title: { fontSize: 27, fontWeight: "900", marginTop: 43, textAlign: "right" }, subtitle: { fontSize: 15, marginTop: 8, textAlign: "right" }, search: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 26, minHeight: 58, paddingHorizontal: 16 }, searchInput: { flex: 1, fontSize: 16 }, cards: { gap: 14, marginTop: 18 }, card: { alignItems: "center", borderRadius: 17, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 105, paddingHorizontal: 19 }, cardText: { flex: 1, fontSize: 19, fontWeight: "900", marginHorizontal: 14, textAlign: "center" }, iconBubble: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", width: 48 }, iconMark: { fontSize: 30, fontWeight: "900" }, pressed: { opacity: 0.7 } });
