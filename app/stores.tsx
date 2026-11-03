import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { Button, EmptyState, ErrorState, Header, Input, Loading } from "@/components/market/ui";
import { useColors } from "@/hooks/use-colors";
import { friendlyError, listStores } from "@/lib/data";
import { isRTL, t } from "@/lib/i18n";
import { useLocations } from "@/lib/queries";
import { STORE_TYPES } from "@/lib/store-types";
import { createStyles } from "@/lib/i18n/rtl";


export default function StoresScreen() {
  const colors = useColors();
  const locations = useLocations();
  const [q, setQ] = useState("");
  const stores = useQuery({ queryKey: ["stores", q], queryFn: () => listStores({ q, limit: 100 }) });

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Header title={t("المتاجر")} subtitle={t("محلات وتجار وموردون في دار السلع")} />
        <Input value={q} onChangeText={setQ} placeholder={t("ابحث عن متجر...")} />
        {stores.isLoading ? <Loading /> : stores.isError ? <ErrorState message={friendlyError(stores.error)} onRetry={() => stores.refetch()} /> : (stores.data ?? []).length === 0 ? (
          <EmptyState icon="storefront" title={t("لا توجد متاجر بعد")} text={t("أنشئ متجرك واعرض منتجاتك في مكان واحد.")} actionLabel={t("أنشئ متجرك")} onAction={() => router.push("/store/manage")} />
        ) : stores.data!.map((store) => (
          <Pressable key={store.id} onPress={() => router.push({ pathname: "/store/[merchantId]", params: { merchantId: store.ownerId } })} style={[styles.item, { backgroundColor: colors.surface, borderColor: store.isFeatured ? colors.accent : colors.border }]}>
            {store.logoUrl ? <Image source={{ uri: store.logoUrl }} style={styles.logo} /> : <View style={[styles.logo, styles.logoEmpty, { backgroundColor: colors.accentSoft }]}><MaterialIcons name="storefront" size={26} color={colors.primary} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>{store.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{t(STORE_TYPES[store.storeType])}{store.locationId ? ` · ${locations.label(store.locationId)}` : ""}</Text>
              {store.isFeatured ? <Text style={[styles.featured, { color: colors.accent }]}>★ {t("متجر مميز")}</Text> : null}
            </View>
            <MaterialIcons name={isRTL() ? "chevron-left" : "chevron-right"} size={22} color={colors.muted} />
          </Pressable>
        ))}
        <Button variant="outline" icon="add-business" label={t("أنشئ متجرك")} onPress={() => router.push("/store/manage")} style={{ marginTop: 20 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = createStyles({
  content: { paddingBottom: 40 },
  item: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginTop: 10, padding: 12 },
  logo: { borderRadius: 26, height: 52, width: 52 },
  logoEmpty: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "900", textAlign: "right" },
  meta: { fontSize: 12, marginTop: 3, textAlign: "right" },
  featured: { fontSize: 11, fontWeight: "900", marginTop: 3, textAlign: "right" },
});
