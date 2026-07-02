import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";

export default function ToolScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tools, companies, cart, addToCart, user } = useApp();
  const tool = tools.find((t) => t.id === id);
  const company = companies.find((c) => c.id === tool?.companyId);
  const inCart = cart.some((i) => i.tool.id === id);
  const isCompany = user?.profile === "company";

  if (!tool || !company) {
    return (
      <ScreenContainer className="p-4">
        <Text style={{ color: colors.foreground }}>Ferramenta não encontrada.</Text>
      </ScreenContainer>
    );
  }

  const handleAdd = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart(tool, company.name);
    router.push("/cart");
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ padding: 16 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, flexDirection: "row", alignItems: "center", gap: 6 }]}>
            <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontSize: 15 }}>Voltar</Text>
          </Pressable>
        </View>

        <Image source={{ uri: tool.image || "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600&q=80" }} style={{ width: "100%", height: 260, backgroundColor: colors.border }} />

        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>{tool.name}</Text>

          <Pressable
            onPress={() => router.push({ pathname: "/company/[id]", params: { id: company.id } })}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1 }]}
          >
            <Image source={{ uri: company.logo }} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 14, color: colors.muted }}>{company.name}</Text>
          </Pressable>

          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.primary }}>
            R$ {tool.pricePerDay}
            <Text style={{ fontSize: 15, color: colors.muted, fontWeight: "500" }}> /dia</Text>
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tool.quantity > 0 && tool.available ? colors.success : colors.error }} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: tool.quantity > 0 && tool.available ? colors.success : colors.error }}>
              {tool.quantity > 0 && tool.available ? `${tool.quantity} disponível(eis)` : "Indisponível no momento"}
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Descrição</Text>
          <Text style={{ fontSize: 15, color: colors.muted, lineHeight: 22 }}>{tool.description}</Text>
        </View>
      </ScrollView>

      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={handleAdd}
          disabled={tool.quantity <= 0 || !tool.available || isCompany}
          style={({ pressed }) => [
            {
              backgroundColor: tool.quantity <= 0 || !tool.available || isCompany ? colors.border : colors.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              transform: [{ scale: pressed && tool.quantity > 0 && tool.available && !isCompany ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={{ color: tool.quantity <= 0 || !tool.available || isCompany ? colors.muted : "#fff", fontWeight: "800", fontSize: 16 }}>
            {isCompany
              ? "Empresas não podem alugar"
              : tool.quantity <= 0 || !tool.available
              ? "Sem estoque disponível"
              : inCart
              ? "Adicionar outro ao carrinho"
              : "Adicionar ao carrinho"}
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
