import { router, useLocalSearchParams } from "expo-router";
import { useState, useMemo } from "react";
import { FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { CATEGORIES } from "@/lib/data";
import { Tool } from "@/lib/types";

export default function CompanyScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companies, tools } = useApp();
  const company = companies.find((c) => c.id === id);
  const companyTools = tools.filter((t) => t.companyId === id);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredTools = useMemo(() => {
    return companyTools.filter((t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [companyTools, searchQuery]);

  if (!company) {
    return (
      <ScreenContainer className="p-4">
        <Text style={{ color: colors.foreground }}>Empresa não encontrada.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <FlatList
        data={filteredTools}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ padding: 16, gap: 14 }}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, flexDirection: "row", alignItems: "center", gap: 6 }]}>
              <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontSize: 15 }}>Voltar</Text>
            </Pressable>

            <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
              <Image source={{ uri: company.logo }} style={{ width: 76, height: 76, borderRadius: 16, backgroundColor: colors.border }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>{company.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StarRating value={company.rating} size={15} />
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {company.rating.toFixed(1)} ({company.ratingCount})
                  </Text>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.muted, marginHorizontal: 2 }} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: company.isOpen !== false ? colors.success : colors.error }}>
                    {company.isOpen !== false ? "Loja Aberta" : "Loja Fechada"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <IconSymbol name="location.fill" size={13} color={colors.muted} />
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {company.city && company.state ? `${company.city}, ${company.state}` : company.location}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={{ fontSize: 14, color: colors.muted }}>{company.description}</Text>

            {/* Search Input */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 6,
              }}
            >
              <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar ferramentas nesta empresa"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, color: colors.foreground, fontSize: 14 }}
              />
            </View>

            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, marginTop: 10 }}>
              Ferramentas disponíveis
            </Text>
          </View>
        }
        renderItem={({ item }) => <ToolGridCard tool={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </ScreenContainer>
  );
}

function ToolGridCard({ tool }: { tool: Tool }) {
  const colors = useColors();

  const categoryNames = useMemo(() => {
    if (!tool.categoryId) return [];
    const ids = tool.categoryId.split(",").map((c) => c.trim());
    return ids
      .map((id) => CATEGORIES.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n);
  }, [tool.categoryId]);

  const categoryText = useMemo(() => {
    if (categoryNames.length === 0) return "";
    if (categoryNames.length <= 2) {
      return categoryNames.join(", ");
    }
    return `${categoryNames.slice(0, 2).join(", ")} e +${categoryNames.length - 2}`;
  }, [categoryNames]);

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/tool/[id]", params: { id: tool.id } })}
      style={({ pressed }) => [
        {
          flex: 1,
          maxWidth: "48%",
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Image source={{ uri: tool.image || "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80" }} style={{ width: "100%", height: 110, backgroundColor: colors.border }} />
      <View style={{ padding: 10, gap: 4 }}>
        <View style={{ gap: 2 }}>
          <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, minHeight: 34 }}>
            {tool.name}
          </Text>
          {categoryText ? (
            <Text numberOfLines={1} style={{ fontSize: 10, color: colors.muted }}>
              {categoryText}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>R$ {tool.pricePerDay}/dia</Text>
          
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            {tool.rating !== undefined && tool.rating > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <IconSymbol name="star.fill" size={10} color="#FBBF24" />
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.foreground }}>
                  {tool.rating.toFixed(1)}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 9, color: colors.muted }}>Sem avaliações</Text>
            )}

            <Text style={{ fontSize: 10, fontWeight: "600", color: tool.quantity > 0 && tool.available ? colors.success : colors.error }}>
              {tool.quantity > 0 && tool.available ? `${tool.quantity} disp.` : "Sem estoque"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
