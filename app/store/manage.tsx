import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const emptyForm = { title: "", description: "", category: "", price: "", location: "مسقط", phone: "" };

export default function StoreManageScreen() {
  const colors = useColors();
  const { publicId } = useLocalSearchParams<{ publicId?: string }>();
  const utils = trpc.useUtils();
  const products = trpc.stores.myProducts.useQuery();
  const createProduct = trpc.stores.createProduct.useMutation({ onSuccess: () => { void utils.stores.myProducts.invalidate(); setForm(emptyForm); Alert.alert("تم الحفظ", "أضيف المنتج إلى متجرِك وأرسل للمراجعة."); } });
  const updateProduct = trpc.stores.updateProduct.useMutation({ onSuccess: () => { void utils.stores.myProducts.invalidate(); setEditingId(undefined); setForm(emptyForm); Alert.alert("تم التحديث", "أعيد إرسال المنتج للمراجعة."); } });
  const deleteProduct = trpc.stores.deleteProduct.useMutation({ onSuccess: () => void utils.stores.myProducts.invalidate() });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | undefined>(publicId);
  const editingProduct = products.data?.find((product) => product.publicId === editingId);

  useEffect(() => {
    if (editingProduct) setForm({ title: editingProduct.title ?? "", description: editingProduct.description ?? "", category: editingProduct.category ?? "", price: editingProduct.price ?? "", location: editingProduct.location ?? "مسقط", phone: editingProduct.phone ?? "" });
  }, [editingProduct]);

  const setField = (field: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const save = () => {
    if (form.title.trim().length < 3 || form.description.trim().length < 10 || !form.category.trim()) { Alert.alert("بيانات ناقصة", "أدخل العنوان والوصف والتصنيف قبل الحفظ."); return; }
    if (editingId) updateProduct.mutate({ publicId: editingId, ...form });
    else createProduct.mutate({ publicId: `store-${Date.now().toString(36)}`, ...form });
  };

  return <ScreenContainer className="px-4"><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.header}><Pressable onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>رجوع</Text></Pressable><Text style={[styles.title, { color: colors.foreground }]}>إدارة متجر مسقط</Text></View><Text style={[styles.subtitle, { color: colors.muted }]}>إضافة منتجات المتجر لا تمنح اعتمادًا مباشرًا؛ كل منتج يمر بالمراجعة.</Text><View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>{([ ["title", "اسم المنتج"], ["description", "وصف المنتج"], ["category", "التصنيف"], ["price", "السعر"], ["location", "الموقع"], ["phone", "رقم التواصل"] ] as const).map(([field, label]) => <TextInput key={field} value={form[field]} onChangeText={(value) => setField(field, value)} placeholder={label} placeholderTextColor={colors.muted} multiline={field === "description"} style={[styles.input, { borderColor: colors.border, color: colors.foreground, minHeight: field === "description" ? 86 : 46 }]} textAlign="right" />)}<Pressable onPress={save} disabled={createProduct.isPending || updateProduct.isPending} style={[styles.save, { backgroundColor: colors.primary }]}><Text style={styles.saveText}>{editingId ? "حفظ التعديلات" : "إضافة المنتج"}</Text></Pressable>{editingId && <Pressable onPress={() => { setEditingId(undefined); setForm(emptyForm); }}><Text style={[styles.cancel, { color: colors.muted }]}>إلغاء التعديل</Text></Pressable>}</View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>منتجات المتجر</Text>{products.isError && <Text style={[styles.status, { color: colors.error }]}>لا يمكن إدارة المنتجات دون اشتراك تاجر نشط.</Text>}{(products.data ?? []).map((product) => <View key={product.publicId} style={[styles.product, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.productCopy}><Text style={[styles.productTitle, { color: colors.foreground }]}>{product.title}</Text><Text style={[styles.productMeta, { color: colors.muted }]}>{product.price || "السعر عند التواصل"} · {product.status}</Text></View><View style={styles.actions}><Pressable onPress={() => { setEditingId(product.publicId); setForm({ title: product.title ?? "", description: product.description ?? "", category: product.category ?? "", price: product.price ?? "", location: product.location ?? "مسقط", phone: product.phone ?? "" }); }}><Text style={[styles.action, { color: colors.primary }]}>تعديل</Text></Pressable><Pressable onPress={() => Alert.alert("حذف المنتج", "سيتم إخفاء المنتج من المتجر.", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => deleteProduct.mutate({ publicId: product.publicId }) }])}><Text style={[styles.action, { color: colors.error }]}>حذف</Text></Pressable></View></View>)}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 36 }, header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", paddingTop: 12 }, title: { fontSize: 25, fontWeight: "900", textAlign: "right" }, back: { fontSize: 14, fontWeight: "800" }, subtitle: { fontSize: 13, lineHeight: 21, marginTop: 12, textAlign: "right" }, form: { borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 12 }, input: { borderRadius: 11, borderWidth: 1, fontSize: 14, marginBottom: 9, paddingHorizontal: 12, paddingVertical: 10 }, save: { alignItems: "center", borderRadius: 12, marginTop: 4, paddingVertical: 13 }, saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }, cancel: { fontSize: 13, marginTop: 12, textAlign: "center" }, sectionTitle: { fontSize: 19, fontWeight: "900", marginTop: 25, textAlign: "right" }, status: { fontSize: 13, marginTop: 15, textAlign: "right" }, product: { alignItems: "center", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", marginTop: 10, padding: 12 }, productCopy: { flex: 1 }, productTitle: { fontSize: 15, fontWeight: "800", textAlign: "right" }, productMeta: { fontSize: 12, marginTop: 5, textAlign: "right" }, actions: { flexDirection: "row-reverse", gap: 12, marginRight: 12 }, action: { fontSize: 12, fontWeight: "800" } });
