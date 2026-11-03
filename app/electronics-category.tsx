import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type Node = { label: string; next?: string };

const data: Record<string, { title: string; items: Node[] }> = {
  root: { title: "أجهزة إلكترونية وأجهزة منزلية", items: [{ label: "موبايل وتابلت", next: "mobile" }, { label: "أجهزة منزلية", next: "home" }, { label: "لابتوب وكمبيوتر", next: "computer" }, { label: "إلكترونيات", next: "electronics" }] },
  mobile: { title: "موبايل وتابلت", items: ["أرقام هواتف مميزة", "موبايل", "تابلت", "ساعات ذكية وأساور رياضية", "إكسسوارات موبايل وتابلت", "هواتف أرضية", "أجهزة قراءة إلكترونية", "قطع موبايل وتابلت", "سماعات"].map((label) => ({ label })) },
  home: { title: "أجهزة منزلية", items: [{ label: "أدوات ومستلزمات تنظيف", next: "cleaning" }, { label: "أجهزة تكييف وتدفئة", next: "climate" }, { label: "أجهزة مطبخ", next: "kitchen" }, { label: "أجهزة عناية بالملابس", next: "clothing" }] },
  cleaning: { title: "أدوات ومستلزمات تنظيف", items: ["مكانس كهربائية", "مكانس روبوت", "أجهزة تنظيف بالبخار", "إكسسوارات وقطع مكانس", "معدات تنظيف أخرى"].map((label) => ({ label })) },
  climate: { title: "أجهزة تكييف وتدفئة", items: ["مكيفات هواء", "مراوح", "منقي هواء", "أجهزة ترطيب هواء", "سخانات مياه", "سخانات وغلايات مياه", "رديترات", "مدافئ ومواقد كهربائية", "سخانات شمسية", "مدفأة كهربائية", "مدفأة غاز", "مدفأة كاز", "إكسسوارات تكييف وتدفئة أخرى"].map((label) => ({ label })) },
  kitchen: { title: "أجهزة مطبخ", items: [{ label: "أجهزة كهربائية صغيرة", next: "kitchen-small" }, { label: "الأجهزة المنزلية الكبيرة", next: "kitchen-large" }] },
  "kitchen-small": { title: "أجهزة كهربائية صغيرة", items: ["قلايات هوائية", "خلاطات", "صانعات بان كيك", "أجهزة تفريغ هواء", "صانعات وافل", "موازين مطبخ", "صانعات زبادي", "صانعات فشار", "مطاحن قهوة", "ماكينات قهوة", "محضرات طعام", "أفران ميكروويف", "خلاطات عجن", "أجهزة طبخ متعددة", "مطاحن لحم", "محامص", "عصارات", "صانعات ساندويتش", "صانعات خبز", "مقالي عميقة", "شواية كهربائية", "غلايات ماء", "ماكينات آيس كريم", "طباخات كهربائية", "مبردات مياه", "فلاتر مياه", "أجهزة مطبخ صغيرة أخرى"].map((label) => ({ label })) },
  "kitchen-large": { title: "الأجهزة المنزلية الكبيرة", items: ["أفران", "شفاطات مطبخ", "ثلاجات", "فريزرات", "غسالات صحون", "أجهزة مطبخ كبيرة أخرى"].map((label) => ({ label })) },
  clothing: { title: "أجهزة عناية بالملابس", items: ["غسالات ملابس", "مكواة", "أجهزة بخار", "طاولات كوي", "أدوات وإكسسوارات تفصيل", "سلال غسيل", "أجهزة غسيل وخياطة أخرى"].map((label) => ({ label })) },
  computer: { title: "لابتوب وكمبيوتر", items: [{ label: "حلول الشبكات والربط", next: "network" }, { label: "فئات أخرى", next: "computer-other" }] },
  network: { title: "حلول الشبكات والربط", items: ["مودمات وراوترات", "نقاط وصول", "محولات وموزعات", "مقويات واي فاي", "كابلات إيثرنت", "جدران حماية", "أجهزة واتصال أخرى"].map((label) => ({ label })) },
  "computer-other": { title: "فئات اللابتوب والكمبيوتر", items: ["أجهزة كمبيوتر محمولة", "أجهزة كمبيوتر", "أجهزة كمبيوتر ألعاب", "شاشات", "خوادم", "برامج وأنظمة", "إكسسوارات كمبيوتر", "قطع كمبيوتر", "طابعات وإكسسوارات"].map((label) => ({ label })) },
  electronics: { title: "إلكترونيات", items: [{ label: "شاشات وبروجكتور", next: "screens" }, { label: "كاميرات وإكسسوارات", next: "cameras" }, { label: "أنظمة المنزل الذكي والأمان", next: "smart" }, { label: "معدات مكافحة الحشرات", next: "insects" }, { label: "عناية شخصية وتصفيف الشعر", next: "personal" }, { label: "أجهزة صوت وسماعات", next: "audio" }, { label: "كابلات شحن ووصلات" }] },
  screens: { title: "شاشات وبروجكتور", items: ["رسيفرات", "مشغلات فيديو وDVD", "حوامل حائط", "بروجكترات", "تلفزيونات وشاشات"].map((label) => ({ label })) },
  cameras: { title: "كاميرات وإكسسوارات", items: ["كاميرات", "مناظير وتلسكوبات", "كاميرات وإكسسوارات أخرى"].map((label) => ({ label })) },
  smart: { title: "أنظمة المنزل الذكي والأمان", items: ["المنزل الذكي", "حماية"].map((label) => ({ label })) },
  insects: { title: "معدات مكافحة الحشرات", items: ["أجهزة صاعق", "مصائد بعوض", "طاردات حشرات", "أجهزة مكافحة أخرى"].map((label) => ({ label })) },
  personal: { title: "عناية شخصية وتصفيف الشعر", items: ["أجهزة تصفيف شعر", "أجهزة حلاقة", "أجهزة عناية بالبشرة"].map((label) => ({ label })) },
  audio: { title: "أجهزة صوت وسماعات", items: ["سماعات", "أنظمة صوت", "ميكروفونات", "إكسسوارات صوت"].map((label) => ({ label })) },
};

export default function ElectronicsCategoryScreen() {
  const colors = useColors();
  const { kind = "root" } = useLocalSearchParams<{ kind?: string }>();
  const current = data[kind] ?? data.root;
  const [query, setQuery] = useState("");
  const items = useMemo(() => current.items.filter((item) => item.label.includes(query.trim())), [current.items, query]);
  const go = (item: Node) => item.next ? router.push({ pathname: "/electronics-category" as any, params: { kind: item.next } }) : router.push({ pathname: "/image-upload" as any, params: { category: `أجهزة إلكترونية وأجهزة منزلية / ${current.title} / ${item.label}` } });

  return <ScreenContainer className="px-4"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.topBar}><Pressable onPress={() => router.back()}><IconSymbol name="xmark" size={30} color={colors.foreground} /></Pressable><Text numberOfLines={1} style={[styles.topTitle, { color: colors.foreground }]}>{current.title}</Text><Pressable onPress={() => router.back()}><IconSymbol name="chevron.right" size={29} color={colors.foreground} /></Pressable></View><Text style={[styles.title, { color: colors.foreground }]}>ما الذي تود بيعه او الإعلان عنه؟</Text><Text style={[styles.subtitle, { color: colors.muted }]}>اختر القسم المناسب لإضافة الإعلان</Text><View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}><TextInput value={query} onChangeText={setQuery} placeholder="إبحث في القسم" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.foreground }]} textAlign="right" /><IconSymbol name="magnifyingglass" size={26} color={colors.muted} /></View><View style={styles.cards}>{items.map((item) => <Pressable key={item.label} onPress={() => go(item)} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={28} color={colors.foreground} /><Text style={[styles.cardText, { color: colors.foreground }]}>{item.label}</Text><View style={[styles.iconBubble, { backgroundColor: colors.primary + "22" }]}><Text style={[styles.iconMark, { color: colors.primary }]}>⌁</Text></View></Pressable>)}</View>{items.length === 0 && <Text style={[styles.empty, { color: colors.muted }]}>لا توجد أقسام مطابقة للبحث</Text>}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 34 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 9 }, topTitle: { flex: 1, fontSize: 21, fontWeight: "900", marginHorizontal: 10, textAlign: "center" }, title: { fontSize: 27, fontWeight: "900", marginTop: 43, textAlign: "right" }, subtitle: { fontSize: 15, marginTop: 8, textAlign: "right" }, search: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 26, minHeight: 58, paddingHorizontal: 16 }, searchInput: { flex: 1, fontSize: 16 }, cards: { gap: 14, marginTop: 18 }, card: { alignItems: "center", borderRadius: 17, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 105, paddingHorizontal: 19 }, cardText: { flex: 1, fontSize: 19, fontWeight: "900", marginHorizontal: 14, textAlign: "center" }, iconBubble: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", width: 48 }, iconMark: { fontSize: 30, fontWeight: "900" }, pressed: { opacity: 0.7 }, empty: { fontSize: 16, marginTop: 40, textAlign: "center" } });
