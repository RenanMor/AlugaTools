import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState, useEffect, useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  Modal,
} from "react-native";
import { StarRating } from "@/components/star-rating";
import { getToolReviews } from "@/lib/api/tools";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { useCompanyTheme } from "@/hooks/use-company-theme";
import { CATEGORIES } from "@/lib/data";

export default function ToolScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tools, companies, cart, addToCart, user } = useApp();
  const tool = tools.find((t) => t.id === id);
  const company = companies.find((c) => c.id === tool?.companyId);
  const cartItem = cart.find((i) => i.tool.id === id);
  const quantityInCart = cartItem ? cartItem.quantity || 1 : 0;
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

  const categoryNames = useMemo(() => {
    if (!tool?.categoryId) return [];
    const ids = tool.categoryId.split(",").map((c) => c.trim());
    return ids
      .map((catId) => CATEGORIES.find((c) => c.id === catId)?.name)
      .filter((n): n is string => !!n);
  }, [tool?.categoryId]);

  const handlePrevImage = () => {
    if (allImages.length <= 1) return;
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const handleNextImage = () => {
    if (allImages.length <= 1) return;
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  // Centralized company theme hook
  useCompanyTheme(company);

  useEffect(() => {
    if (id) {
      getToolReviews(id).then(setReviews).catch((err) => console.error(err));
    }
  }, [id]);

  const topReviews = useMemo(() => {
    return [...reviews].sort((a, b) => b.rating - a.rating).slice(0, 3);
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

  const isStoreClosed = company.isOpen === false;
  const isOutOfStock = !tool.available || availableQty <= 0;
  const canAddToCart = !isOutOfStock && !isCompany && !isStoreClosed;

  return (
    <ScreenContainer edges={["top", "left", "right"]} watermarkUri={company.logo}>
      {/* Top Floating Navigation Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 10,
          zIndex: 10,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(20, 20, 24, 0.65)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
        </Pressable>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: "rgba(20, 20, 24, 0.65)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
          }}
        >
          <Image
            source={company.logo ? { uri: company.logo } : require("@/assets/images/sem-imagem.png")}
            style={{ width: 18, height: 18, borderRadius: 9 }}
            resizeMode="contain"
          />
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, fontWeight: "700", color: colors.foreground, maxWidth: 160 }}
          >
            {company.name}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/cart")}
          style={({ pressed }) => [
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(20, 20, 24, 0.65)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.75 : 1,
              position: "relative",
            },
          ]}
        >
          <IconSymbol name="cart.fill" size={18} color={colors.foreground} />
          {cart.length > 0 && (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                backgroundColor: colors.primary,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{cart.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Hero Image Showcase */}
        <View
          style={{
            position: "relative",
            width: "100%",
            height: 270,
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            overflow: "hidden",
          }}
        >
          <Image
            source={activeImage ? { uri: activeImage } : require("@/assets/images/sem-imagem.png")}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />

          {allImages.length > 1 && (
            <>
              <Pressable
                onPress={handlePrevImage}
                style={({ pressed }) => [
                  {
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    marginTop: -20,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "rgba(0, 0, 0, 0.55)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <IconSymbol name="chevron.left" size={20} color="#fff" />
              </Pressable>

              <Pressable
                onPress={handleNextImage}
                style={({ pressed }) => [
                  {
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    marginTop: -20,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "rgba(0, 0, 0, 0.55)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <IconSymbol name="chevron.right" size={20} color="#fff" />
              </Pressable>

              {/* Counter Badge */}
              <View
                style={{
                  position: "absolute",
                  bottom: 12,
                  right: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: "rgba(0, 0, 0, 0.65)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.15)",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                  {currentImageIndex + 1} / {allImages.length}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Thumbnail Strip */}
        {allImages.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginTop: 12 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          >
            {allImages.map((imgUri, idx) => {
              const isSelected = currentImageIndex === idx;
              return (
                <Pressable
                  key={idx}
                  onPress={() => setCurrentImageIndex(idx)}
                  style={({ pressed }) => [
                    {
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? colors.primary : "rgba(255, 255, 255, 0.15)",
                      backgroundColor: "rgba(0,0,0,0.4)",
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Image source={{ uri: imgUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Content Container */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 14 }}>
          {/* Title & Category/Rating Bar */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, lineHeight: 28 }}>
              {tool.name}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              {categoryNames.length > 0 && (
                <View
                  style={{
                    backgroundColor: colors.primary + "20",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.primary + "35",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                    {categoryNames.join(", ")}
                  </Text>
                </View>
              )}

              {tool.rating && tool.rating > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <IconSymbol name="star.fill" size={14} color="#FBBF24" />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                    {tool.rating.toFixed(1)}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    ({reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"})
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Pricing & Stock Card */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderRadius: 16,
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <View>
              <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Valor da diária</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 2 }}>
                <Text style={{ fontSize: 26, fontWeight: "900", color: colors.success }}>
                  R$ {tool.pricePerDay}
                </Text>
                <Text style={{ fontSize: 14, color: colors.muted, fontWeight: "600" }}>/dia</Text>
              </View>
            </View>

            <View
              style={{
                alignItems: "flex-end",
                backgroundColor: availableQty > 0 && tool.available ? colors.success + "18" : colors.error + "18",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: availableQty > 0 && tool.available ? colors.success + "35" : colors.error + "35",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: availableQty > 0 && tool.available ? colors.success : colors.error,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: availableQty > 0 && tool.available ? colors.success : colors.error,
                  }}
                >
                  {availableQty > 0 && tool.available
                    ? `${availableQty} disponível(eis)`
                    : quantityInCart > 0
                    ? "Limite no carrinho"
                    : "Indisponível"}
                </Text>
              </View>
            </View>
          </View>

          {/* Supplier Store Card */}
          <Pressable
            onPress={() => router.push({ pathname: "/company/[id]", params: { id: company.id } })}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 16,
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Image
                source={company.logo ? { uri: company.logo } : require("@/assets/images/sem-imagem.png")}
                style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)" }}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  {company.name}
                </Text>
                <Text style={{ fontSize: 12, color: isStoreClosed ? colors.error : colors.success, fontWeight: "600", marginTop: 1 }}>
                  {isStoreClosed ? "Fechada no momento" : "Loja aberta"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Ver loja</Text>
              <IconSymbol name="chevron.right" size={14} color={colors.primary} />
            </View>
          </Pressable>

          {/* Rental Conditions Chips */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 12,
                borderRadius: 14,
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <IconSymbol name="calendar" size={18} color={colors.primary} />
              <View>
                <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "600", textTransform: "uppercase" }}>
                  Prazo de locação
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground, marginTop: 1 }}>
                  {tool.minDays ?? 1} a {tool.maxDays ?? 30} dias
                </Text>
              </View>
            </View>

            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 12,
                borderRadius: 14,
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <IconSymbol name="shippingbox.fill" size={18} color={colors.primary} />
              <View>
                <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "600", textTransform: "uppercase" }}>
                  Entrega
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground, marginTop: 1 }}>
                  Retirada / Frete
                </Text>
              </View>
            </View>
          </View>

          {/* Description Section */}
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.08)",
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              Descrição da Ferramenta
            </Text>
            <Text style={{ fontSize: 14, color: "#D1D5DB", lineHeight: 22 }}>
              {tool.description || "Nenhuma descrição informada pelo fornecedor."}
            </Text>
          </View>

          {/* Reviews Section */}
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.08)",
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                Avaliações ({reviews.length})
              </Text>
              {reviews.length > 3 && (
                <Pressable onPress={() => setIsModalVisible(true)}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>Ver todas</Text>
                </Pressable>
              )}
            </View>

            {topReviews.length > 0 ? (
              <View style={{ gap: 8 }}>
                {topReviews.map((rev) => (
                  <View
                    key={rev.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: "rgba(0, 0, 0, 0.3)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.06)",
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                        {rev.customerName}
                      </Text>
                      <StarRating value={rev.rating} size={12} />
                    </View>
                    {rev.comment ? (
                      <Text style={{ fontSize: 13, color: "#D1D5DB", fontStyle: "italic", lineHeight: 18 }}>
                        "{rev.comment}"
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
                        Avaliou o produto com {rev.rating} estrelas
                      </Text>
                    )}
                    <Text style={{ fontSize: 10, color: colors.muted, alignSelf: "flex-end" }}>
                      {new Date(rev.createdAt).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic" }}>
                Esta ferramenta ainda não possui avaliações.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Action Bar */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Platform.OS === "ios" ? 28 : 16,
          backgroundColor: "rgba(16, 16, 20, 0.92)",
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.1)",
          gap: 12,
        }}
      >
        <View>
          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>Total da diária</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: colors.foreground }}>
              R$ {tool.pricePerDay}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>/dia</Text>
          </View>
        </View>

        <Pressable
          onPress={handleAdd}
          disabled={!canAddToCart}
          style={({ pressed }) => [
            {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: canAddToCart ? "#F97316" : "rgba(255, 255, 255, 0.1)",
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 16,
              transform: [{ scale: pressed && canAddToCart ? 0.98 : 1 }],
              opacity: canAddToCart ? 1 : 0.6,
            },
          ]}
        >
          <IconSymbol
            name="cart.badge.plus"
            size={18}
            color={canAddToCart ? "#fff" : colors.muted}
          />
          <Text
            style={{
              color: canAddToCart ? "#fff" : colors.muted,
              fontWeight: "800",
              fontSize: 15,
            }}
          >
            {isCompany
              ? "Empresas não alugam"
              : isStoreClosed
              ? "Loja Fechada"
              : isOutOfStock
              ? "Sem Estoque"
              : inCart
              ? "Adicionar Outro"
              : "Alugar Ferramenta"}
          </Text>
        </Pressable>
      </View>

      {/* Modal all reviews */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }}>
          <View
            style={{
              height: "75%",
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              gap: 14,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: 12,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
                Todas as Avaliações ({reviews.length})
              </Text>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Filter buttons */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["highest", "lowest", "recent"] as const).map((filter) => {
                const label = {
                  highest: "Mais estrelas",
                  lowest: "Menos estrelas",
                  recent: "Recentes",
                }[filter];
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
                    <Text
                      style={{
                        color: isSelected ? "#fff" : colors.foreground,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              {sortedReviews.map((rev) => (
                <View
                  key={rev.id}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 5,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                      {rev.customerName}
                    </Text>
                    <StarRating value={rev.rating} size={12} />
                  </View>
                  {rev.comment ? (
                    <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic", lineHeight: 18 }}>
                      "{rev.comment}"
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
                      Avaliou com {rev.rating} estrelas
                    </Text>
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

