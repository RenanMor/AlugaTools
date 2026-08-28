import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  Modal,
  Dimensions,
  Animated,
} from "react-native";
import { StarRating } from "@/components/star-rating";
import { getToolReviews } from "@/lib/api/tools";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { useCompanyTheme } from "@/hooks/use-company-theme";
import { spacing, fontSize, fontWeight, radius } from "@/lib/design-tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

  const activeImage = allImages[currentImageIndex] || tool?.image;

  const handlePrevImage = () => {
    if (allImages.length <= 1) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const handleNextImage = () => {
    if (allImages.length <= 1) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  // Centralized company theme hook
  useCompanyTheme(company);

  useEffect(() => {
    if (id) {
      getToolReviews(id).then(setReviews).catch(err => console.error(err));
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
      <ScreenContainer className="p-4" style={{ justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.foreground, fontSize: 16 }}>Ferramenta não encontrada.</Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.primary, borderRadius: 10 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Voltar</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const handleAdd = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addToCart(tool, company.name);
    router.push("/cart");
  };

  const isAvailable = tool.available && tool.quantity > 0 && availableQty > 0;
  const isStoreClosed = company.isOpen === false;
  const isActionDisabled = !isAvailable || isCompany || isStoreClosed;

  return (
    <ScreenContainer edges={["left", "right"]} watermarkUri={company.logo} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ============================================================ */}
        {/* 1. HERO IMAGE GALLERY WITH FLOATING CONTROLS                  */}
        {/* ============================================================ */}
        <View style={{ position: "relative", width: "100%", height: 320, backgroundColor: colors.surface }}>
          <Image
            source={activeImage ? { uri: activeImage } : require("@/assets/images/sem-imagem.png")}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />

          {/* Floating Back Button */}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              {
                position: "absolute",
                top: Platform.OS === "ios" ? 54 : 20,
                left: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconSymbol name="chevron.left" size={20} color="#FFFFFF" />
          </Pressable>

          {/* Company Mini Badge on Top Right */}
          <Pressable
            onPress={() => router.push({ pathname: "/company/[id]", params: { id: company.id } })}
            style={({ pressed }) => [
              {
                position: "absolute",
                top: Platform.OS === "ios" ? 54 : 20,
                right: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor: "rgba(0,0,0,0.55)",
                zIndex: 10,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Image
              source={company.logo ? { uri: company.logo } : require("@/assets/images/sem-imagem.png")}
              style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" }}
              resizeMode="contain"
            />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700", maxWidth: 120 }} numberOfLines={1}>
              {company.name}
            </Text>
          </Pressable>

          {/* Gallery Navigation Arrows (if multiple images) */}
          {allImages.length > 1 && (
            <>
              <Pressable
                onPress={handlePrevImage}
                style={({ pressed }) => [
                  {
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    marginTop: -18,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <IconSymbol name="chevron.left" size={18} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={handleNextImage}
                style={({ pressed }) => [
                  {
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    marginTop: -18,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <IconSymbol name="chevron.right" size={18} color="#FFFFFF" />
              </Pressable>

              {/* Counter Pill */}
              <View
                style={{
                  position: "absolute",
                  bottom: 14,
                  right: 16,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: "rgba(0,0,0,0.6)",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
                  {currentImageIndex + 1} / {allImages.length}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Horizontal Mini Thumbnails */}
        {allImages.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ paddingHorizontal: 16, marginTop: 12 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {allImages.map((imgUri, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentImageIndex(idx);
                }}
                style={({ pressed }) => [
                  {
                    width: 52,
                    height: 52,
                    borderRadius: 10,
                    overflow: "hidden",
                    borderWidth: currentImageIndex === idx ? 2 : 1,
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

        {/* ============================================================ */}
        {/* 2. PRODUCT DETAILS & SPECS                                   */}
        {/* ============================================================ */}
        <View style={{ padding: 18, gap: 16 }}>
          {/* Title & Price Header */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <Text
                style={{
                  flex: 1,
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.foreground,
                  letterSpacing: -0.3,
                  lineHeight: 28,
                }}
              >
                {tool.name}
              </Text>

              {/* Rating pill */}
              {tool.rating && tool.rating > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: "#FEF3C7",
                  }}
                >
                  <IconSymbol name="star.fill" size={13} color="#D97706" />
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#92400E" }}>
                    {tool.rating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Price Tag with clean modern styling */}
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text style={{ fontSize: 26, fontWeight: "900", color: colors.primary, letterSpacing: -0.5 }}>
                R$ {tool.pricePerDay}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.muted }}>
                / dia
              </Text>
            </View>
          </View>

          {/* Key Specs Chips Strip */}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {/* Availability status chip */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: isAvailable ? colors.success + "15" : (quantityInCart > 0 ? "#FEF3C7" : colors.error + "15"),
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: isAvailable ? colors.success : (quantityInCart > 0 ? "#D97706" : colors.error),
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: isAvailable ? colors.success : (quantityInCart > 0 ? "#B45309" : colors.error),
                }}
              >
                {isAvailable
                  ? `${availableQty} un. disponível`
                  : quantityInCart > 0
                  ? "No seu carrinho"
                  : "Sem estoque"}
              </Text>
            </View>

            {/* Min / Max Rental Days Chip */}
            {tool.quantity > 0 && tool.available && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <IconSymbol name="calendar" size={13} color={colors.muted} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>
                  Mín. {tool.minDays ?? 1}d · Máx. {tool.maxDays ?? 30}d
                </Text>
              </View>
            )}

            {/* Category / Location Chip */}
            {company.location && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <IconSymbol name="mappin.and.ellipse" size={13} color={colors.muted} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }} numberOfLines={1}>
                  {company.city || company.location}
                </Text>
              </View>
            )}
          </View>

          {/* Company Store Banner Card */}
          <Pressable
            onPress={() => router.push({ pathname: "/company/[id]", params: { id: company.id } })}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <Image
                source={company.logo ? { uri: company.logo } : require("@/assets/images/sem-imagem.png")}
                style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.background }}
                resizeMode="contain"
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.foreground }} numberOfLines={1}>
                  {company.name}
                </Text>
                <Text style={{ fontSize: 12, color: company.isOpen !== false ? colors.success : colors.muted, fontWeight: "600" }}>
                  {company.isOpen !== false ? "● Loja Aberta agora" : "● Loja Fechada"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                Ver loja
              </Text>
              <IconSymbol name="chevron.right" size={14} color={colors.primary} />
            </View>
          </Pressable>

          {/* Description Section */}
          <View
            style={{
              padding: 16,
              borderRadius: 14,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground }}>
              Sobre a ferramenta
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 22 }}>
              {tool.description || "Nenhuma descrição informada pela empresa."}
            </Text>
          </View>

          {/* Reviews Section */}
          <View style={{ gap: 12, marginTop: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>
                Avaliações ({reviews.length})
              </Text>
              {reviews.length > 3 && (
                <Pressable onPress={() => setIsModalVisible(true)}>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                    Ver todas
                  </Text>
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
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                        {rev.customerName}
                      </Text>
                      <StarRating value={rev.rating} size={11} />
                    </View>
                    {rev.comment ? (
                      <Text style={{ fontSize: 13, color: colors.foreground, fontStyle: "italic", lineHeight: 18 }}>
                        "{rev.comment}"
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
                        Avaliação sem comentário
                      </Text>
                    )}
                    <Text style={{ fontSize: 10, color: colors.muted, alignSelf: "flex-end" }}>
                      {new Date(rev.createdAt).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic" }}>
                  Ainda não há avaliações para este item.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ============================================================ */}
      {/* 3. DOCKED BOTTOM ACTION BAR (Clean Mobile Call to Action)     */}
      {/* ============================================================ */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: Platform.OS === "ios" ? 34 : 16,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <View style={{ minWidth: 90 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
            Diária
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.foreground }}>
            R$ {tool.pricePerDay}
          </Text>
        </View>

        <Pressable
          onPress={handleAdd}
          disabled={isActionDisabled}
          style={({ pressed }) => [
            {
              flex: 1,
              backgroundColor: isActionDisabled ? colors.border : colors.primary,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed && !isActionDisabled ? 0.85 : 1,
              transform: [{ scale: pressed && !isActionDisabled ? 0.98 : 1 }],
            },
          ]}
        >
          <Text
            style={{
              color: isActionDisabled ? colors.muted : "#FFFFFF",
              fontWeight: "800",
              fontSize: 15,
            }}
          >
            {isCompany
              ? "Empresas não podem alugar"
              : isStoreClosed
              ? "Loja fechada no momento"
              : !tool.available || tool.quantity <= 0
              ? "Sem estoque disponível"
              : availableQty <= 0
              ? "Limite atingido"
              : inCart
              ? "Adicionar outro"
              : "Alugar Agora"}
          </Text>
        </Pressable>
      </View>

      {/* ============================================================ */}
      {/* 4. MODAL ALL REVIEWS                                         */}
      {/* ============================================================ */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View
            style={{
              height: "75%",
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              gap: 14,
            }}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
                Avaliações ({reviews.length})
              </Text>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}
              >
                <IconSymbol name="xmark" size={16} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Filter Pills */}
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
                    <Text style={{ color: isSelected ? "#FFFFFF" : colors.foreground, fontSize: 12, fontWeight: "700" }}>
                      {label}
                    </Text>
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
