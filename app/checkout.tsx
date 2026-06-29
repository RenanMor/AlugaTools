import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { createRental, payRental, lookupCep } from "@/lib/api/rentals";

const SHIPPING_OPTIONS = [
  { id: "pickup", name: "Retirada no local", price: 0, days: "Imediato" },
  { id: "standard", name: "Entrega Padrão", price: 15.9, days: "3 a 5 dias úteis" },
  { id: "express", name: "Entrega Expressa", price: 29.9, days: "1 a 2 dias úteis" },
];

export default function CheckoutScreen() {
  const colors = useColors();
  const { cart, cartTotal, clearCart, refreshCatalog, refreshRentals, user } = useApp();

  // Address fields
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  // Shipping
  const [shippingId, setShippingId] = useState("pickup");
  const selectedShipping = useMemo(
    () => SHIPPING_OPTIONS.find((o) => o.id === shippingId)!,
    [shippingId]
  );

  // Coupon
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "BOLETO">("PIX");

  // Card details
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState(""); // MM/AA
  const [cardCvv, setCardCvv] = useState("");
  const [installments, setInstallments] = useState("1");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // CEP Lookup trigger
  const handleCepChange = async (val: string) => {
    const formatted = val.replace(/\D/g, "").substring(0, 8);
    setCep(formatted);

    if (formatted.length === 8) {
      setIsLoadingCep(true);
      try {
        const addressData = await lookupCep(formatted);
        if (addressData) {
          setStreet(addressData.street || "");
          setNeighborhood(addressData.neighborhood || "");
          setCity(addressData.city || "");
          setState(addressData.state || "");
        }
      } catch (err: any) {
        Alert.alert("Erro", "Não foi possível encontrar o CEP informado.");
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  // Coupon Validation
  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (code === "PROMO10") {
      setAppliedCoupon(code);
      setDiscountAmount(cartTotal * 0.1); // 10% discount
      Alert.alert("Sucesso", "Cupom de 10% de desconto aplicado!");
    } else {
      Alert.alert("Aviso", "Cupom inválido ou expirado.");
    }
  };

  // Financial Totals
  const totalAmount = useMemo(() => {
    return Math.max(0, cartTotal + selectedShipping.price - discountAmount);
  }, [cartTotal, selectedShipping.price, discountAmount]);

  // Submit Rent & Payment Order
  const handlePay = async () => {
    // 1. Validations
    if (paymentMethod !== "PIX" && (!cep || !number || !street || !city || !state)) {
      Alert.alert("Erro", "CEP, Número da residência e endereço são obrigatórios para entregas e faturamento.");
      return;
    }

    if (cep.length !== 8) {
      Alert.alert("Erro", "O CEP informado deve conter 8 dígitos.");
      return;
    }

    if (!number.trim()) {
      Alert.alert("Erro", "O número da residência é obrigatório.");
      return;
    }

    if ((paymentMethod === "CREDIT_CARD" || paymentMethod === "DEBIT_CARD") && (!cardNumber || !cardHolder || !cardExpiry || !cardCvv)) {
      Alert.alert("Erro", "Por favor, preencha todos os dados do cartão.");
      return;
    }

    if (cart.length === 0) {
      Alert.alert("Erro", "Seu carrinho está vazio.");
      return;
    }

    setIsSubmitting(true);

    try {
      const address = {
        cep,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
      };

      // 2. Create the rentals in awaiting_payment
      const createdRentals = await Promise.all(
        cart.map((item) =>
          createRental({
            toolId: item.tool.id,
            companyId: item.tool.companyId,
            days: item.days,
            totalPrice: item.tool.pricePerDay * item.days + selectedShipping.price / cart.length - discountAmount / cart.length,
            paymentMethod,
            shippingPrice: selectedShipping.price / cart.length,
            address,
            couponCode: appliedCoupon || undefined,
            couponDiscount: discountAmount / cart.length,
          })
        )
      );

      // 3. Process the payments via backend proxy (which calls PagBank)
      for (const rental of createdRentals) {
        let cardPayload = undefined;
        if (paymentMethod === "CREDIT_CARD" || paymentMethod === "DEBIT_CARD") {
          const expParts = cardExpiry.split("/");
          cardPayload = {
            number: cardNumber.replace(/\D/g, ""),
            exp_month: expParts[0] || "12",
            exp_year: expParts[1] ? "20" + expParts[1] : "2027",
            security_code: cardCvv,
            holder: { name: cardHolder },
          };
        }

        await payRental(rental.id, {
          card: cardPayload,
          installments: paymentMethod === "CREDIT_CARD" ? Number(installments) || 1 : undefined,
        });
      }

      // 4. Cleanup & Complete
      clearCart();
      await Promise.all([refreshCatalog(), refreshRentals()]);

      Alert.alert("Sucesso", "Pedido realizado! Você pode acompanhar o pagamento em Meus Pedidos.", [
        {
          text: "Ir para Meus Pedidos",
          onPress: () => router.replace("/orders"),
        },
      ]);
    } catch (error: any) {
      console.error("[Checkout] Payment process error:", error);
      Alert.alert("Falha no Pagamento", error.message || "Não foi possível concluir o pagamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>Finalizar Compra</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} showsVerticalScrollIndicator={false}>
          {/* 1. Resumo dos produtos */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Resumo das Ferramentas</Text>
            {cart.map((item) => (
              <View key={item.tool.id} style={{ flexDirection: "row", gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Image source={{ uri: item.tool.image }} style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: colors.border }} />
                <View style={{ flex: 1, justifyContent: "center" }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{item.tool.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>{item.days} {item.days > 1 ? "dias" : "dia"} · R$ {item.tool.pricePerDay * item.days}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 2. Endereço de entrega */}
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Endereço de Entrega</Text>

            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>CEP (Obrigatório)</Text>
                <TextInput
                  value={cep}
                  onChangeText={handleCepChange}
                  placeholder="00000000"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 14,
                  }}
                />
              </View>
              {isLoadingCep && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 3 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Rua / Av.</Text>
                <TextInput
                  value={street}
                  onChangeText={setStreet}
                  placeholder="Nome da rua"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 14,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Número (Obrigatório)</Text>
                <TextInput
                  value={number}
                  onChangeText={setNumber}
                  placeholder="123"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 14,
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Complemento (Opcional)</Text>
                <TextInput
                  value={complement}
                  onChangeText={setComplement}
                  placeholder="Apto, bloco..."
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 14,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Bairro</Text>
                <TextInput
                  value={neighborhood}
                  onChangeText={setNeighborhood}
                  placeholder="Nome do bairro"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 14,
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Cidade</Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="São Paulo"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 14,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Estado (UF)</Text>
                <TextInput
                  value={state}
                  onChangeText={setState}
                  placeholder="SP"
                  placeholderTextColor={colors.muted}
                  maxLength={2}
                  autoCapitalize="characters"
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 14,
                  }}
                />
              </View>
            </View>
          </View>

          {/* 3. Escolha de frete */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Escolha de Envio</Text>
            {SHIPPING_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setShippingId(option.id)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: shippingId === option.id ? colors.primary + "11" : colors.surface,
                  borderWidth: 1,
                  borderColor: shippingId === option.id ? colors.primary : colors.border,
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{option.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Prazo: {option.days}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.foreground }}>
                  {option.price === 0 ? "Grátis" : `R$ ${option.price.toFixed(2)}`}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 4. Cupom de desconto */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Cupom de Desconto</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                value={couponInput}
                onChangeText={setCouponInput}
                placeholder="Ex: PROMO10"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  fontSize: 14,
                }}
              />
              <Pressable
                onPress={handleApplyCoupon}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    paddingHorizontal: 16,
                    justifyContent: "center",
                    borderRadius: 10,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Aplicar</Text>
              </Pressable>
            </View>
            {appliedCoupon && (
              <Text style={{ fontSize: 12, color: colors.success, fontWeight: "600" }}>
                Cupom {appliedCoupon} ativo (- R$ {discountAmount.toFixed(2)})
              </Text>
            )}
          </View>

          {/* 5. Forma de pagamento */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Método de Pagamento</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO"] as const).map((method) => {
                const labels = { PIX: "PIX", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", BOLETO: "Boleto" };
                const isSelected = paymentMethod === method;
                return (
                  <Pressable
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    style={{
                      flex: 1,
                      minWidth: 100,
                      alignItems: "center",
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ color: isSelected ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 13 }}>
                      {labels[method]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Card inputs */}
          {(paymentMethod === "CREDIT_CARD" || paymentMethod === "DEBIT_CARD") && (
            <View style={{ gap: 12, padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>Dados do Cartão (Simulação)</Text>

              <View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Número do Cartão</Text>
                <TextInput
                  value={cardNumber}
                  onChangeText={setCardNumber}
                  placeholder="4111 1111 1111 1111"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: colors.foreground,
                  }}
                />
              </View>

              <View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Nome no Cartão</Text>
                <TextInput
                  value={cardHolder}
                  onChangeText={setCardHolder}
                  placeholder="Nome do Titular"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: colors.foreground,
                  }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Validade (MM/AA)</Text>
                  <TextInput
                    value={cardExpiry}
                    onChangeText={setCardExpiry}
                    placeholder="12/28"
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      color: colors.foreground,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>CVV</Text>
                  <TextInput
                    value={cardCvv}
                    onChangeText={setCardCvv}
                    placeholder="123"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    maxLength={4}
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      color: colors.foreground,
                    }}
                  />
                </View>
              </View>

              {paymentMethod === "CREDIT_CARD" && (
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Parcelas</Text>
                  <TextInput
                    value={installments}
                    onChangeText={setInstallments}
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      color: colors.foreground,
                    }}
                  />
                </View>
              )}
            </View>
          )}

          {/* Resumo financeiro */}
          <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Subtotal</Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>R$ {cartTotal.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Frete</Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>R$ {selectedShipping.price.toFixed(2)}</Text>
            </View>
            {discountAmount > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.success, fontSize: 13 }}>Desconto</Text>
                <Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>- R$ {discountAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>Total</Text>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>R$ {totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          {/* Botão Pagar Agora */}
          <Pressable
            onPress={handlePay}
            disabled={isSubmitting}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                opacity: isSubmitting ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Pagar agora</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
