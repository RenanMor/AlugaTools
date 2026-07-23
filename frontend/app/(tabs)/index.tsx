import { router } from "expo-router";
import { useMemo } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompanyCardSkeleton } from "@/components/ui/skeleton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Company } from "@/lib/types";
import { spacing, fontSize, fontWeight, radius } from "@/lib/design-tokens";
import { useEffect, useState } from "react";

export default function HomeScreen() {
  const colors = useColors();
  const { companies, user } = useApp();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user?.profile === "deliverer") {
      router.replace("/orders");
    }
  }, [user]);

  const filteredCompanies = useMemo(() => {
    const filtered = companies.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Prioritize open stores
    return filtered.sort((a, b) => {
      const aOpen = a.isOpen !== false;
      const bOpen = b.isOpen !== false;
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      return 0;
    });
  }, [companies, searchQuery]);

  const isLoading = companies.length === 0;

  return (
    <ScreenContainer>
      <FlatList
        data={isLoading ? [] : filteredCompanies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: spacing.md }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: fontWeight.black, color: colors.foreground, letterSpacing: -0.5 }}>
                AlugaTools
              </Text>
              <Text style={{ fontSize: fontSize.md, color: colors.muted, marginTop: 2 }}>
                Alugue ferramentas perto de você
              </Text>
            </View>

            <Input
              icon="magnifyingglass"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar empresas pelo nome"
            />

            <Text style={{ fontSize: 17, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: spacing.xs }}>
              Empresas em destaque
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: spacing.md }}>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CompanyCardSkeleton />
                </Card>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 60 }}>
              Nenhuma empresa encontrada.
            </Text>
          )
        }
        renderItem={({ item }) => <CompanyCard company={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </ScreenContainer>
  );
}

function CompanyCard({ company }: { company: Company }) {
  const colors = useColors();

  return (
    <Card
      onPress={() => router.push({ pathname: "/company/[id]", params: { id: company.id } })}
      style={{ padding: spacing.md }}
    >
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <Image
          source={company.logo ? { uri: company.logo } : require("@/assets/images/sem-imagem.png")}
          style={{
            width: 68,
            height: 68,
            borderRadius: radius.lg,
            backgroundColor: colors.border,
          }}
          resizeMode="contain"
        />

        <View style={{ flex: 1, gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground }}
          >
            {company.name}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <StarRating value={company.rating} size={13} />
            <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>
              {company.rating.toFixed(1)} ({company.ratingCount})
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Badge variant={company.isOpen !== false ? "success" : "error"}>
              {company.isOpen !== false ? "Aberta" : "Fechada"}
            </Badge>

            {company.city && company.state ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <IconSymbol name="location.fill" size={11} color={colors.muted} />
                <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>
                  {company.city}, {company.state}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <IconSymbol name="chevron.right" size={18} color={colors.muted} />
      </View>
    </Card>
  );
}
