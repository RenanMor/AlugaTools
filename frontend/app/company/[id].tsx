import { router, useLocalSearchParams } from "expo-router";
import { useState, useMemo, useEffect } from "react";
import { FlatList, Image, Pressable, Text, View, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToolCardSkeleton } from "@/components/ui/skeleton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { useCompanyTheme } from "@/hooks/use-company-theme";
import { CATEGORIES } from "@/lib/data";
import { Tool, Company } from "@/lib/types";
import { getCompanyById } from "@/lib/api/companies";
import { spacing, fontSize, fontWeight, radius, pageTitle } from "@/lib/design-tokens";

export default function CompanyScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companies, tools } = useApp();

  const [localCompany, setLocalCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const company = localCompany || companies.find((c) => c.id === id);
  const companyTools = tools.filter((t) => t.companyId === id);

  const [searchQuery, setSearchQuery] = useState("");

  // Use centralized company theme hook (replaces inline useFocusEffect)
  useCompanyTheme(company);

  // Stale-while-revalidate: show cached data instantly, fetch fresh from API
  useEffect(() => {
    async function loadCompany() {
      if (!id) return;

      const cached = companies.find((c) => c.id === id);
      if (cached) {
        setLocalCompany(cached);
        setIsLoading(false);
      }

      try {
        const freshData = await getCompanyById(id);
        if (freshData) setLocalCompany(freshData);
      } catch (err) {
        console.error("Erro ao revalidar dados da empresa:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCompany();
  }, [id, companies]);

  const filteredTools = useMemo(() => {
    return companyTools.filter((t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [companyTools, searchQuery]);

  if (isLoading && !company) {
    return (
      <ScreenContainer style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!company) {
    return (
      <ScreenContainer className="p-4">
        <Text style={{ color: colors.foreground }}>Empresa não encontrada.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} watermarkUri={company.logo}>
      <FlatList
        data={filteredTools}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, gap: spacing.lg - 2 }}>
            {/* Back button + loading indicator */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontSize: fontSize.md + 1 }}>Voltar</Text>
              </Pressable>
              {isLoading && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>Atualizando...</Text>
                </View>
              )}
            </View>

            {/* Company header */}
            <View style={{ flexDirection: "row", gap: spacing.lg - 2, alignItems: "center" }}>
              <Image
                source={company.logo ? { uri: company.logo } : require("@/assets/images/sem-imagem.png")}
                style={{ width: 76, height: 76, borderRadius: radius.lg, backgroundColor: colors.border }}
                resizeMode="contain"
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.black, color: colors.foreground }}>
                  {company.name}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StarRating value={company.rating} size={14} />
                  <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>
                    {company.rating.toFixed(1)} ({company.ratingCount})
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Badge variant={company.isOpen !== false ? "success" : "error"}>
                    {company.isOpen !== false ? "Aberta" : "Fechada"}
                  </Badge>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <IconSymbol name="location.fill" size={12} color={colors.muted} />
                    <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>
                      {company.city && company.state ? `${company.city}, ${company.state}` : company.location}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={{ fontSize: fontSize.md, color: colors.muted }}>{company.description}</Text>

            <Input
              icon="magnifyingglass"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar ferramentas nesta empresa"
            />

            <Text style={{ fontSize: 17, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: spacing.sm }}>
              Ferramentas disponíveis
            </Text>
          </View>
        }
        renderItem={({ item }) => <ToolGridCard tool={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </ScreenContainer>
  );
}

function ToolGridCard({ tool }: { tool: Tool }) {
  const colors = useColors();

  const categoryNames = useMemo(() => {
    if (!tool.categoryId) return [];
    const ids = tool.categoryId.split(",").map((c) => c.trim());
    return ids.map((id) => CATEGORIES.find((c) => c.id === id)?.name).filter((n): n is string => !!n);
  }, [tool.categoryId]);

  const categoryText = useMemo(() => {
    if (categoryNames.length === 0) return "";
    if (categoryNames.length <= 2) return categoryNames.join(", ");
    return `${categoryNames.slice(0, 2).join(", ")} e +${categoryNames.length - 2}`;
  }, [categoryNames]);

  return (
    <Card
      onPress={() => router.push({ pathname: "/tool/[id]", params: { id: tool.id } })}
      noPadding
      style={{ flex: 1, maxWidth: "48%", overflow: "hidden" }}
    >
      <Image
        source={tool.image ? { uri: tool.image } : require("@/assets/images/sem-imagem.png")}
        style={{ width: "100%", height: 110, backgroundColor: colors.border }}
      />
      <View style={{ padding: spacing.sm + 2, gap: 4 }}>
        <Text numberOfLines={2} style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.foreground }}>
          {tool.name}
        </Text>
        {categoryText ? (
          <Text numberOfLines={1} style={{ fontSize: fontSize.xs, color: colors.muted }}>
            {categoryText}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.xs }}>
          <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.success }}>
            R$ {tool.pricePerDay}/dia
          </Text>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            {tool.rating !== undefined && tool.rating > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <IconSymbol name="star.fill" size={10} color="#FBBF24" />
                <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.foreground }}>
                  {tool.rating.toFixed(1)}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 9, color: colors.muted }}>Sem avaliações</Text>
            )}
            <Badge variant={tool.quantity > 0 && tool.available ? "success" : "error"} size="sm">
              {tool.quantity > 0 && tool.available ? `${tool.quantity} disp.` : "Sem estoque"}
            </Badge>
          </View>
        </View>
      </View>
    </Card>
  );
}
