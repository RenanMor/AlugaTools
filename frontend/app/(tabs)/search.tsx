import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import { FlatList, Image, Pressable, ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { CATEGORIES } from "@/lib/data";
import { Tool } from "@/lib/types";
import { spacing, fontSize, fontWeight, radius, pageTitle } from "@/lib/design-tokens";

export default function SearchScreen() {
  const colors = useColors();
  const { tools, companies, user } = useApp();

  useEffect(() => {
    if (user?.profile === "deliverer") {
      router.replace("/orders");
    }
  }, [user]);

  const params = useLocalSearchParams<{ category?: string }>();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(params.category ?? null);

  const results = useMemo(() => {
    const filtered = tools.filter((t) => {
      const matchQuery = query.trim() === "" || t.name.toLowerCase().includes(query.toLowerCase());
      const matchCat = !activeCat || (t.categoryId && t.categoryId.split(",").map((c) => c.trim()).includes(activeCat));
      return matchQuery && matchCat;
    });

    // Prioritize open stores
    return filtered.sort((a, b) => {
      const aComp = companies.find((c) => c.id === a.companyId);
      const bComp = companies.find((c) => c.id === b.companyId);
      const aOpen = aComp?.isOpen !== false;
      const bOpen = bComp?.isOpen !== false;
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      return 0;
    });
  }, [tools, query, activeCat, companies]);

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "";
  const isCompanyClosed = (id: string) => {
    const comp = companies.find((c) => c.id === id);
    return comp ? comp.isOpen === false : false;
  };

  return (
    <ScreenContainer className="p-4">
      <Text style={[pageTitle(colors), { marginBottom: spacing.lg - 2 }]}>
        Buscar ferramentas
      </Text>

      <Input
        icon="magnifyingglass"
        value={query}
        onChangeText={setQuery}
        placeholder="Digite o nome da ferramenta"
        returnKeyType="search"
        containerStyle={{ marginBottom: spacing.lg - 2 }}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, height: 42, marginBottom: spacing.lg - 2 }}
        contentContainerStyle={{ gap: spacing.sm, alignItems: "center" }}
      >
        <CategoryChip label="Todas" active={!activeCat} onPress={() => setActiveCat(null)} />
        {CATEGORIES.map((c) => (
          <CategoryChip key={c.id} label={c.name} active={activeCat === c.id} onPress={() => setActiveCat(c.id)} />
        ))}
      </ScrollView>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
            Nenhuma ferramenta encontrada.
          </Text>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <ToolRow tool={item} company={companyName(item.companyId)} closed={isCompanyClosed(item.companyId)} />
        )}
      />
    </ScreenContainer>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: 9,
          borderRadius: radius.pill,
          backgroundColor: active ? colors.primary : colors.surface,
          borderWidth: 0.5,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Text style={{ color: active ? "#fff" : colors.foreground, fontWeight: fontWeight.semibold, fontSize: fontSize.sm }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ToolRow({ tool, company, closed }: { tool: Tool; company: string; closed: boolean }) {
  const colors = useColors();

  return (
    <Card
      onPress={() => router.push({ pathname: "/tool/[id]", params: { id: tool.id } })}
      style={{ padding: spacing.sm + 2 }}
    >
      <View style={{ flexDirection: "row", gap: spacing.md, position: "relative" }}>
        {/* Pop-out rating badge */}
        {tool.rating !== undefined && tool.rating > 0 && (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              backgroundColor: "#18181B",
              borderWidth: 0.5,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: 8,
              paddingVertical: 3,
              zIndex: 10,
            }}
          >
            <IconSymbol name="star.fill" size={10} color="#FBBF24" />
            <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.black, color: "#fff" }}>
              {tool.rating.toFixed(1)}
              <Text style={{ fontWeight: fontWeight.normal, color: "#9CA3AF" }}>
                {` (${tool.ratingCount})`}
              </Text>
            </Text>
          </View>
        )}

        <Image
          source={tool.image ? { uri: tool.image } : require("@/assets/images/sem-imagem.png")}
          style={{ width: 70, height: 70, borderRadius: radius.md, backgroundColor: colors.border }}
        />

        <View style={{ flex: 1, justifyContent: "center", gap: 3 }}>
          <Text numberOfLines={1} style={{ fontSize: fontSize.md + 1, fontWeight: fontWeight.bold, color: colors.foreground }}>
            {tool.name}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>{company}</Text>
            {closed && (
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.error }}>
                • Fechada
              </Text>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 2 }}>
            <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.success }}>
              R$ {tool.pricePerDay}/dia
            </Text>
            <Badge variant={tool.quantity > 0 && tool.available ? "success" : "error"} size="sm">
              {tool.quantity > 0 && tool.available ? `${tool.quantity} disp.` : "Sem estoque"}
            </Badge>
          </View>
        </View>
      </View>
    </Card>
  );
}
