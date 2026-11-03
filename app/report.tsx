import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function ReportScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const { listingPublicId } = useLocalSearchParams<{ listingPublicId?: string }>();
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const createReport = trpc.reports.create.useMutation({ onSuccess: () => { Alert.alert("تم استلام البلاغ", "سيراجع فريق دار السلع البلاغ ويتخذ الإجراء المناسب."); router.back(); } });

  const submit = () => {
    if (!isAuthenticated) { router.push({ pathname: "/login", params: { returnTo: "/report" } } as never); return; }
    if (subject.trim().length < 3 || details.trim().length < 10) { Alert.alert("بيانات ناقصة", "اكتب موضوع البلاغ وتفاصيله بوضوح."); return; }
    createReport.mutate({ publicId: listingPublicId || undefined, subject, details, priority });
  };

  return <ScreenContainer edges={["top", "left", "right", "bottom"]} className="px-4"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.header}><Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface }]}><IconSymbol name="chevron.right" size={22} color={colors.foreground} /></Pressable><Text style={[styles.title, { color: colors.foreground }]}>رفع بلاغ</Text></View><View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}><IconSymbol name="shield.lefthalf.filled" size={26} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.muted }]}>استخدم البلاغ للمحتوى المخالف أو الاحتيال أو انتحال الهوية فقط. لا تُرسل بيانات دفع أو رموز تحقق.</Text></View><Text style={[styles.label, { color: colors.foreground }]}>موضوع البلاغ</Text><TextInput value={subject} onChangeText={setSubject} placeholder="مثال: إعلان مضلل" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} textAlign="right" /><Text style={[styles.label, { color: colors.foreground }]}>تفاصيل البلاغ</Text><TextInput value={details} onChangeText={setDetails} placeholder="اذكر ما حدث وأي معلومات تساعد فريق المراجعة" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} multiline textAlign="right" textAlignVertical="top" /><Text style={[styles.label, { color: colors.foreground }]}>الأولوية</Text><View style={styles.priorityRow}>{([["low", "منخفضة"], ["medium", "متوسطة"], ["high", "عالية"]] as const).map(([value, label]) => <Pressable key={value} onPress={() => setPriority(value)} style={[styles.priority, { borderColor: priority === value ? colors.primary : colors.border, backgroundColor: priority === value ? `${colors.primary}18` : colors.surface }]}><Text style={[styles.priorityText, { color: priority === value ? colors.primary : colors.foreground }]}>{label}</Text></Pressable>)}</View><Pressable disabled={createReport.isPending} onPress={submit} style={[styles.submit, { backgroundColor: colors.primary }, createReport.isPending && { opacity: 0.65 }]}>{createReport.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{isAuthenticated ? "إرسال البلاغ" : "تسجيل الدخول لإرسال البلاغ"}</Text>}</Pressable></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 30 }, header: { alignItems: "center", flexDirection: "row-reverse", gap: 12, paddingTop: 15 }, back: { alignItems: "center", borderRadius: 21, height: 42, justifyContent: "center", width: 42 }, title: { flex: 1, fontSize: 27, fontWeight: "900", textAlign: "right" }, notice: { alignItems: "center", borderRadius: 17, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 22, padding: 14 }, noticeText: { flex: 1, fontSize: 12, lineHeight: 19, textAlign: "right" }, label: { fontSize: 14, fontWeight: "900", marginBottom: 8, marginTop: 22, textAlign: "right" }, input: { borderRadius: 13, borderWidth: 1, fontSize: 14, minHeight: 52, paddingHorizontal: 14 }, textarea: { minHeight: 145, paddingTop: 14 }, priorityRow: { flexDirection: "row-reverse", gap: 8 }, priority: { borderRadius: 11, borderWidth: 1, flex: 1, paddingVertical: 12 }, priorityText: { fontSize: 12, fontWeight: "800", textAlign: "center" }, submit: { alignItems: "center", borderRadius: 14, marginTop: 28, minHeight: 52, justifyContent: "center" }, submitText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" } });
