import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState, useEffect, useMemo } from "react";
import { Image, Platform, Pressable, ScrollView, Text, View, Modal, TextInput } from "react-native";
import { StarRating } from "@/components/star-rating";
import { getToolReviews } from "@/lib/api/tools";
import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { useCompanyTheme } from "@/hooks/use-company-theme";
import { spacing, fontSize, fontWeight, radius } from "@/lib/design-tokens";

export default function ToolScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tools, companies, cart, addToCart, user } = useApp();
  const tool = tools.find((t) => t.id === id);
  const company = companies.find((c) => c.id === tool?.companyId);
  const cartItem = cart.find((i) => i.tool.id === id);
  const quantityInCart = cartItem ? (cartItem.quantity || 1) : 0;
  const availableQty = Math.max(0, (tool?.quantity || 0) - quantityInCart);
  const inCart = quantityInCart > 0;
  const isCompany = user?.profile === "company";

  const [reviews, setReviews] = useState<import("@/lib/types").ToolReview[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [filterType, setFilterType] = useState<"highest" | "lowest" | "recent">("highest");

  const allImages = useMemo(() => {
    const list: string[] = [];
    if (tool?.image && tool.image.trim()) list.push(tool.image.trim());
    if (tool?.images && Array.isArray(tool.images)) {
      tool.images.forEach((img) => {
        if (img && img.trim() && !list.includes(img.trim())) {
          list.push(img.trim());
        }
      });
    }
    return list;
  }, [tool]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const activeImage = allImages[currentImageIndex] || tool?.image;

  const handlePrevImage = () => {
    if (allImages.length <= 1) return;
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const handleNextImage = () => {
    if (allImages.length <= 1) return;
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  // Centralized company theme hook (replaces duplicated useFocusEffect)
  useCompanyTheme(company);

  useEffect(() => {
    if (id) {
      getToolReviews(id).then(setReviews).catch(err => console.error(err));
    }
  }, [id]);

  const topReviews = useMemo(() => {
    return [...reviews].sort((a, b) => b.rating - a.rating).slice(0, 4);
  }, [reviews]);

  const sortedReviews = useMemo(() => {
    const sorted = [...reviews];
    if (filterType === "highest") {
      sorted.sort((a, b) => b.rating - a.rating);
    } else if (filterType === "lowest") {
      sorted.sort((a, b) => a.rating - b.rating);
    } else if (filterType === "recent") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  }, [reviews, filterType]);

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
    <ScreenContainer edges={["top", "left", "right"]} watermarkUri={company.logo}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ padding: 16 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, flexDirection: "row", alignItems: "center", gap: 6 }]}>
            <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontSize: 15 }}>Voltar</Text>
          </Pressable>
        </View>

        {/* Imagem Principal da Capa + Navegação com Setas para Fotos Opcionais */}
        <View style={{ position: "relative", width: "100%", height: 280, backgroundColor: colors.border }}>
          <Image
            source={activeImage ? { uri: activeImage } : require("@/assets/images/sem-imagem.png")}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />

          {allImages.length > 1 && (
            <>
              {/* Seta para Esquerda */}
              <Pressable
                onPress={handlePrevImage}
                style={({ pressed }) => [
                  {
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    marginTop: -22,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "rgba(0,0,0,0.55)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <IconSymbol name="chevron.left" size={24} color="#fff" />
              </Pressable>

              {/* Seta para Direita */}
              <Pressable
                onPress={handleNextImage}
                style={({ pressed }) => [
                  {
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    marginTop: -22,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "rgba(0,0,0,0.55)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <IconSymbol name="chevron.right" size={24} color="#fff" />
              </Pressable>

              {/* Contador de Imagens */}
              <View
                style={{
                  position: "absolute",
                  bottom: 12,
                  right: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: "rgba(0,0,0,0.65)",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                  {currentImageIndex + 1} / {allImages.length}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Miniaturas abaixo da imagem principal se houver mais de uma foto */}
        {allImages.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, paddingHorizontal: 16, marginTop: 12 }}
            contentContainerStyle={{ gap: 10 }}
          >
            {allImages.map((imgUri, idx) => (
              <Pressable
                key={idx}
                onPress={() => setCurrentImageIndex(idx)}
                style={({ pressed }) => [
                  {
                    width: 58,
                    height: 58,
                    borderRadius: 12,
                    overflow: "hidden",
                    borderWidth: currentImageIndex === idx ? 2.5 : 1,
                    borderColor: currentImageIndex === idx ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Image source={{ uri: imgUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={{ padding: 16, gap: 12 }}>
          {/* Nome do produto */}
          <View style={{ backgroundColor: "#000000", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF" }}>{tool.name}</Text>
          </View>

          {/* Nome da empresa */}
          <Pressable
            onPress={() => router.push({ pathname: "/company/[id]", params: { id: company.id } })}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#000000",
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 8,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Image
              source={company.logo ? { uri: company.logo } : require("@/assets/images/sem-imagem.png")}
              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#1f2937" }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>{company.name}</Text>
          </Pressable>

          {/* R$999/dia */}
          <View style={{ backgroundColor: "#000000", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: "flex-start" }}>
            <Text style={{ fontSize: 28, fontWeight: "800", color: colors.success }}>
              R$ {tool.pricePerDay}
              <Text style={{ fontSize: 15, color: "#FFFFFF", fontWeight: "500" }}> /dia</Text>
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: availableQty > 0 && tool.available ? colors.success : (quantityInCart > 0 ? colors.warning : colors.error) }} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: availableQty > 0 && tool.available ? colors.success : (quantityInCart > 0 ? colors.warning : colors.error) }}>
              {availableQty > 0 && tool.available 
                ? `${availableQty} disponível(eis)` 
                : (quantityInCart > 0 ? "Limite de estoque atingido (no carrinho)" : "Indisponível no momento")}
            </Text>
          </View>

          {tool.quantity > 0 && tool.available && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <IconSymbol name="calendar" size={15} color={colors.muted} />
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Aluguel:{" "}
                <Text style={{ fontWeight: "700", color: colors.foreground }}>
                  mín. {tool.minDays ?? 1} dia{(tool.minDays ?? 1) > 1 ? "s" : ""}
                </Text>
                {" · "}
                <Text style={{ fontWeight: "700", color: colors.foreground }}>
                  máx. {tool.maxDays ?? 30} dias
                </Text>
              </Text>
            </View>
          )}

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

          {/* Descrição */}
          <View style={{ backgroundColor: "#000000", padding: 14, borderRadius: 8, gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>Descrição</Text>
            <Text style={{ fontSize: 15, color: "#E5E7EB", lineHeight: 22 }}>{tool.description}</Text>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

          {/* Reviews section */}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
                Avaliações ({reviews.length})
              </Text>
              {tool.rating && tool.rating > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <IconSymbol name="star.fill" size={14} color="#FBBF24" />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                    {tool.rating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>

            {topReviews.length > 0 ? (
              <View style={{ gap: 10 }}>
                {topReviews.map((rev) => (
                  <View key={rev.id} style={{ padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>{rev.customerName}</Text>
                      <StarRating value={rev.rating} size={12} />
                    </View>
                    {rev.comment ? (
                      <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic" }}>"{rev.comment}"</Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>Apenas deu nota</Text>
                    )}
                    <Text style={{ fontSize: 10, color: colors.muted, alignSelf: "flex-end" }}>
                      {new Date(rev.createdAt).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                ))}

                {reviews.length > 4 && (
                  <Pressable
                    onPress={() => setIsModalVisible(true)}
                    style={({ pressed }) => [
                      {
                        alignItems: "center",
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Mostrar mais</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic" }}>Sem avaliações ainda.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={handleAdd}
          disabled={availableQty <= 0 || !tool.available || isCompany || company?.isOpen === false}
          style={({ pressed }) => [
            {
              backgroundColor: availableQty <= 0 || !tool.available || isCompany || company?.isOpen === false ? colors.border : colors.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              transform: [{ scale: pressed && availableQty > 0 && tool.available && !isCompany && company?.isOpen !== false ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={{ color: availableQty <= 0 || !tool.available || isCompany || company?.isOpen === false ? colors.muted : "#fff", fontWeight: "800", fontSize: 16 }}>
            {isCompany
              ? "Empresas não podem alugar"
              : company?.isOpen === false
              ? "Loja fechada no momento"
              : !tool.available || tool.quantity <= 0
              ? "Sem estoque disponível"
              : availableQty <= 0
              ? "Limite de estoque atingido"
              : inCart
              ? "Adicionar outro ao carrinho"
              : "Adicionar ao carrinho"}
          </Text>
        </Pressable>
      </View>

      {/* Modal all reviews */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ height: "75%", backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Todas as Avaliações ({reviews.length})</Text>
              <Pressable onPress={() => setIsModalVisible(false)}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Filter buttons */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["highest", "lowest", "recent"] as const).map((filter) => {
                const label = { highest: "Mais estrelas", lowest: "Menos estrelas", recent: "Recentes" }[filter];
                const isSelected = filterType === filter;
                return (
                  <Pressable
                    key={filter}
                    onPress={() => setFilterType(filter)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 20,
                      alignItems: "center",
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ color: isSelected ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "700" }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              {sortedReviews.map((rev) => (
                <View key={rev.id} style={{ padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 5 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{rev.customerName}</Text>
                    <StarRating value={rev.rating} size={12} />
                  </View>
                  {rev.comment ? (
                    <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic" }}>"{rev.comment}"</Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>Apenas deu nota</Text>
                  )}
                  <Text style={{ fontSize: 10, color: colors.muted, alignSelf: "flex-end" }}>
                    {new Date(rev.createdAt).toLocaleDateString("pt-BR")}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
