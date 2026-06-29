import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Rental, RentalStatus } from "@/lib/types";
import { cancelRental, getRentalById } from "@/lib/api/rentals";

const STATUS_LABEL: Record<RentalStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  pending: "Aguardando empresa",
  accepted: "Aceito",
  rejected: "Recusado",
  active: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_COLOR: Record<RentalStatus, string> = {
  awaiting_payment: "#3B82F6",
  pending: "#F59E0B",
  accepted: "#3B82F6",
  rejected: "#EF4444",
  active: "#22C55E",
  completed: "#64748B",
  cancelled: "#6B7280",
};

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { refreshRentals, refreshCatalog, rateRental, setRentalStatus } = useApp();
  
  const [rental, setRental] = useState<Rental | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const fetchOrder = async () => {
    try {
      const data = await getRentalById(id as string);
      setRental(data);
    } catch (err: any) {
      Alert.alert("Erro", "Não foi possível carregar os detalhes do pedido.");
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  // Timer logic
  const expiryTime = useMemo(() => rental ? rental.createdAt + 30 * 60 * 1000 : 0, [rental]);

  useEffect(() => {
    if (!rental || rental.status !== "awaiting_payment") return;

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(interval);
        handleAutoCancel();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [rental?.status, expiryTime]);

  const handleAutoCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelRental(rental!.id);
      await Promise.all([refreshRentals(), refreshCatalog()]);
      await fetchOrder();
    } catch (err) {
      console.warn("Failed to auto-cancel rental:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleManualCancel = () => {
    Alert.alert("Cancelar Aluguel", "Tem certeza que deseja cancelar esta reserva?", [
      { text: "Não", style: "cancel" },
      {
        text: "Sim, Cancelar",
        style: "destructive",
        onPress: async () => {
          setIsCancelling(true);
          try {
            await cancelRental(rental!.id);
            await Promise.all([refreshRentals(), refreshCatalog()]);
            await fetchOrder();
            Alert.alert("Sucesso", "Reserva cancelada com sucesso!");
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao cancelar reserva.");
          } finally {
            setIsCancelling(false);
          }
        },
      },
    ]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const pixCode = useMemo(() => {
    if (!rental || rental.paymentMethod !== "PIX") return null;
    const charge = rental.paymentData?.charges?.[0];
    return charge?.payment_method?.pix?.qrcode?.text || rental.paymentData?.qr_codes?.[0]?.text || null;
  }, [rental]);

  const boletoInfo = useMemo(() => {
    if (!rental || rental.paymentMethod !== "BOLETO") return null;
    const charge = rental.paymentData?.charges?.[0];
    const barcode = charge?.payment_method?.boleto?.barcode || null;
    const bookletUrl = charge?.links?.find((l: any) => l.rel === "pay" || l.media === "application/pdf")?.href || null;
    return { barcode, bookletUrl };
  }, [rental]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!rental) return null;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>Detalhes do Pedido</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} showsVerticalScrollIndicator={false}>
        
        {/* Header (Status) */}
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: STATUS_COLOR[rental.status] + "11", borderWidth: 1, borderColor: STATUS_COLOR[rental.status] + "44", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>Status do Pedido</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: STATUS_COLOR[rental.status] }}>
            {STATUS_LABEL[rental.status]}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Realizado em: {new Date(rental.createdAt).toLocaleString("pt-BR")}
          </Text>
        </View>

        {/* Pagamento Pendente - Instruções */}
        {rental.status === "awaiting_payment" && (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <IconSymbol name="clock" size={18} color={colors.primary} />
                <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "700" }}>
                  Pague em até {formatTime(timeLeft)}
                </Text>
              </View>
              <Pressable onPress={handleManualCancel} disabled={isCancelling} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                {isCancelling ? <ActivityIndicator size="small" color={colors.error} /> : <Text style={{ fontSize: 13, color: colors.error, fontWeight: "700" }}>Cancelar</Text>}
              </Pressable>
            </View>

            {rental.paymentMethod === "PIX" && pixCode && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Chave Copia e Cola PIX:</Text>
                <TextInput
                  value={pixCode}
                  editable={false}
                  selectTextOnFocus
                  style={{ fontSize: 12, fontFamily: Platform.OS === "web" ? "monospace" : undefined, color: colors.muted, backgroundColor: colors.background, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                />
              </View>
            )}

            {rental.paymentMethod === "BOLETO" && boletoInfo && (
              <View style={{ gap: 8 }}>
                {boletoInfo.barcode && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Código de Barras:</Text>
                    <TextInput
                      value={boletoInfo.barcode}
                      editable={false}
                      selectTextOnFocus
                      style={{ fontSize: 12, fontFamily: Platform.OS === "web" ? "monospace" : undefined, color: colors.muted, backgroundColor: colors.background, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                    />
                  </View>
                )}
                {boletoInfo.bookletUrl && (
                  <Pressable onPress={() => Linking.openURL(boletoInfo.bookletUrl!)} style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.85 : 1 }]}>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Visualizar Boleto (PDF)</Text>
                  </Pressable>
                )}
              </View>
            )}

            {(rental.paymentMethod === "CREDIT_CARD" || rental.paymentMethod === "DEBIT_CARD") && (
              <View style={{ padding: 12, borderRadius: 8, backgroundColor: colors.error + "11" }}>
                <Text style={{ fontSize: 13, color: colors.error, fontWeight: "600", textAlign: "center" }}>
                  Ocorreu um erro no processamento do seu cartão de crédito. Por favor, cancele este pedido e refaça a compra utilizando um cartão válido.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Produto */}
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>Ferramenta Alugada</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Image source={{ uri: rental.toolImage }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.border }} />
            <View style={{ flex: 1, justifyContent: "center", gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{rental.toolName}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>Fornecedor: {rental.companyName}</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>
                {rental.days} {rental.days > 1 ? "dias" : "dia"}
              </Text>
            </View>
          </View>
        </View>

        {/* Entrega */}
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>Dados de Entrega</Text>
          <View style={{ gap: 4 }}>
            {rental.address ? (
              <>
                <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600" }}>{rental.address.street}, {rental.address.number}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {rental.address.neighborhood} - {rental.address.city} / {rental.address.state}
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>CEP: {rental.address.cep}</Text>
                {rental.address.complement ? <Text style={{ fontSize: 13, color: colors.muted }}>Complemento: {rental.address.complement}</Text> : null}
              </>
            ) : (
              <Text style={{ fontSize: 14, color: colors.muted }}>Retirada no local</Text>
            )}
          </View>
        </View>

        {/* Resumo Financeiro */}
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>Pagamento</Text>
          
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>Método selecionado</Text>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
              {rental.paymentMethod === "PIX" ? "PIX" : rental.paymentMethod === "BOLETO" ? "Boleto" : rental.paymentMethod === "CREDIT_CARD" ? "Cartão de Crédito" : "Cartão de Débito"}
            </Text>
          </View>
          
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Frete</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
              {rental.shippingPrice && rental.shippingPrice > 0 ? `R$ ${rental.shippingPrice.toFixed(2)}` : "Grátis"}
            </Text>
          </View>
          
          {rental.couponDiscount && rental.couponDiscount > 0 ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.success, fontSize: 13 }}>Desconto ({rental.couponCode})</Text>
              <Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>- R$ {rental.couponDiscount.toFixed(2)}</Text>
            </View>
          ) : null}
          
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>Total Pago</Text>
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>R$ {rental.totalPrice.toFixed(2)}</Text>
          </View>
        </View>

        {/* Ações pós-pagamento */}
        {rental.status === "active" && (
          <Pressable
            onPress={async () => {
              await setRentalStatus(rental.id, "completed");
              await fetchOrder();
            }}
            style={({ pressed }) => [
              { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Marcar como concluído</Text>
          </Pressable>
        )}

        {rental.status === "completed" && (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10, alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              {rental.rating ? "Sua avaliação" : "Avalie este serviço"}
            </Text>
            <StarRating value={rental.rating ?? 0} size={32} editable={!rental.rating} onChange={async (v) => {
              await rateRental(rental.id, v);
              await fetchOrder();
            }} />
          </View>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}
