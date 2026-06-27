import { router, useLocalSearchParams } from "expo-router";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Tool } from "@/lib/types";

export default function CompanyScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companies, tools } = useApp();
  const company = companies.find((c) => c.id === id);
  const companyTools = tools.filter((t) => t.companyId === id);

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
        data={companyTools}
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
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <IconSymbol name="location.fill" size={13} color={colors.muted} />
                  <Text style={{ fontSize: 12, color: colors.muted }}>{company.location}</Text>
                </View>
              </View>
            </View>

            <Text style={{ fontSize: 14, color: colors.muted }}>{company.description}</Text>

            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, marginTop: 4 }}>
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
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/tool/[id]", params: { id: tool.id } })}
      style={({ pressed }) => [
        {
          flex: 1,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Image source={{ uri: tool.image }} style={{ width: "100%", height: 110, backgroundColor: colors.border }} />
      <View style={{ padding: 10, gap: 3 }}>
        <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, minHeight: 34 }}>
          {tool.name}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>R$ {tool.pricePerDay}/dia</Text>
      </View>
    </Pressable>
  );
}
