import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Rental, RentalStatus } from "@/lib/types";
import { cancelRental, getRentalById, payRental } from "@/lib/api/rentals";
import { cancelCompanyRental } from "@/lib/api/admin";
import { RentalTimer } from "@/components/rental-timer";
import { formatOrderId } from "@/lib/utils";

const STATUS_LABEL: Record<RentalStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  pending: "Aguardando entrega",
  accepted: "Entrega antecipada solicitada",
  rejected: "Recusado",
  delivering: "Em rota de entrega",
  delivered: "Entregue (Em uso)",
  active: "Em uso",
  completed: "Concluído",
  cancelled: "Cancelado",
  return_expired: "Tempo expirado, entregador a caminho",
};

const STATUS_COLOR: Record<RentalStatus, string> = {
  awaiting_payment: "#3B82F6",
  pending: "#F59E0B",
  accepted: "#8B5CF6",
  rejected: "#EF4444",
  delivering: "#F97316",
  delivered: "#22C55E",
  active: "#22C55E",
  completed: "#64748B",
  cancelled: "#EF4444",
  return_expired: "#EF4444",
};

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { refreshRentals, refreshCatalog, rateRental, setRentalStatus, user } = useApp();
  
  const [rental, setRental] = useState<Rental | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>("");
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  const [showReceiverModal, setShowReceiverModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [receiverCpf, setReceiverCpf] = useState("");

  // Retry payment state
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCardNumber, setRetryCardNumber] = useState("");
  const [retryCardHolder, setRetryCardHolder] = useState("");
  const [retryCardExpiry, setRetryCardExpiry] = useState("");
  const [retryCardCvv, setRetryCardCvv] = useState("");
  const [retryInstallments, setRetryInstallments] = useState("1");

  // Payment loading modal state
  const [paymentLoadingVisible, setPaymentLoadingVisible] = useState(false);
  const [paymentLoadingStatus, setPaymentLoadingStatus] = useState<"processing" | "success" | "failed">("processing");
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (paymentLoadingVisible && paymentLoadingStatus === "processing") {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      spinAnim.stopAnimation();
      pulseAnim.stopAnimation();
      spinAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [paymentLoadingVisible, paymentLoadingStatus]);

  const isDeliverer = user?.profile === "deliverer";
  const isCompany = !!rental && user?.profile === "company" && user?.companyId === rental.companyId;
  const isOwner = !!user?.isOwner;
  const isPickup = !!rental && (!rental.address || rental.shippingPrice === 0 || !rental.address.street);

  // CPF validation helper: checks digit verification algorithm
  const isCpfValid = useMemo(() => {
    const digits = receiverCpf.replace(/\D/g, "");
    if (digits.length !== 11) return false;
    // Reject all same digits
    if (/^(\d)\1{10}$/.test(digits)) return false;
    // Verify check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem === 10) rem = 0;
    if (rem !== parseInt(digits[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem === 10) rem = 0;
    return rem === parseInt(digits[10]);
  }, [receiverCpf]);

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
    const doCancel = async () => {
      setIsCancelling(true);
      try {
        if (isOwner && rental) {
          await cancelCompanyRental(rental.companyId, rental.id);
        } else {
          await cancelRental(rental!.id);
        }
        await Promise.all([refreshRentals(), refreshCatalog()]);
        await fetchOrder();
        if (Platform.OS === "web") {
          window.alert("Reserva cancelada com sucesso!");
        } else {
          Alert.alert("Sucesso", "Reserva cancelada com sucesso!");
        }
      } catch (err: any) {
        if (Platform.OS === "web") {
          window.alert(err.message || "Falha ao cancelar reserva.");
        } else {
          Alert.alert("Erro", err.message || "Falha ao cancelar reserva.");
        }
      } finally {
        setIsCancelling(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Cancelar Aluguel\n\nTem certeza que deseja cancelar esta reserva?")) {
        doCancel();
      }
    } else {
      Alert.alert("Cancelar Aluguel", "Tem certeza que deseja cancelar esta reserva?", [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, Cancelar",
          style: "destructive",
          onPress: doCancel,
        },
      ]);
    }
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

  const handleUpdateStatus = async (status: RentalStatus, rName?: string, rCpf?: string) => {
    if (isStatusLoading) return;
    setIsStatusLoading(true);
    try {
      await setRentalStatus(rental!.id, status, rName, rCpf);
      await fetchOrder();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível atualizar o status.");
    } finally {
      setIsStatusLoading(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!rental || isRetrying) return;
    setIsRetrying(true);
    setPaymentLoadingStatus("processing");
    setPaymentLoadingVisible(true);
    try {
      let cardPayload: any = undefined;
      const method = rental.paymentMethod || "";

      if (method === "CREDIT_CARD" || method === "DEBIT_CARD") {
        if (!retryCardNumber || !retryCardHolder || !retryCardExpiry || !retryCardCvv) {
          setPaymentLoadingVisible(false);
          Alert.alert("Erro", "Por favor, preencha todos os dados do cartão.");
          setIsRetrying(false);
          return;
        }
        const expParts = retryCardExpiry.split("/");
        cardPayload = {
          number: retryCardNumber.replace(/\D/g, ""),
          exp_month: expParts[0] || "12",
          exp_year: expParts[1] ? (expParts[1].length === 2 ? "20" + expParts[1] : expParts[1]) : "2027",
          security_code: retryCardCvv,
          holder: { name: retryCardHolder },
        };
      }

      await payRental(rental.id, {
        card: cardPayload,
        installments: method === "CREDIT_CARD" ? Number(retryInstallments) || 1 : undefined,
      });

      await Promise.all([refreshRentals(), refreshCatalog()]);
      setPaymentLoadingStatus("success");
      setTimeout(async () => {
        setPaymentLoadingVisible(false);
        setShowRetryModal(false);
        await fetchOrder();
      }, 1800);
    } catch (err: any) {
      setPaymentLoadingStatus("failed");
      await new Promise((r) => setTimeout(r, 900));
      setPaymentLoadingVisible(false);
      Alert.alert(
        "Pagamento Recusado",
        "Seu pagamento foi recusado. Tente com outro método de pagamento.",
        [{ text: "Tentar Novamente", style: "cancel" }]
      );
    } finally {
      setIsRetrying(false);
    }
  };

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
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>Detalhes do Pedido</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primary + "15", borderWidth: 0.5, borderColor: colors.primary + "33" }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>{formatOrderId(rental.id)}</Text>
        </View>
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
          {rental.status === "cancelled" && rental.cancelledByName ? (
            <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
              Cancelado por: {rental.cancelledByName}
            </Text>
          ) : null}
        </View>

        {/* Timer de uso do aluguel */}
        {rental.deliveredAt && (rental.status === "delivered" || rental.status === "active" || rental.status === "accepted") && (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: colors.muted, fontWeight: "700" }}>Tempo de Uso Restante</Text>
            <RentalTimer deliveredAt={rental.deliveredAt} days={rental.days} />
          </View>
        )}

        {/* Deliverer banner when in transit */}
        {rental.status === "delivering" && rental.delivererName && (
          <View style={{ padding: 14, borderRadius: 14, backgroundColor: "#F9731622", borderWidth: 1, borderColor: "#F9731644", flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F97316", justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>{rental.delivererName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Entregador responsável</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#F97316" }}>{rental.delivererName}</Text>
            </View>
          </View>
        )}

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

            {/* Retry payment CTA for awaiting_payment */}
            <Pressable
              onPress={() => {
                setRetryCardNumber("");
                setRetryCardHolder("");
                setRetryCardExpiry("");
                setRetryCardCvv("");
                setRetryInstallments("1");
                setShowRetryModal(true);
              }}
              style={({ pressed }) => [
                { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                {rental.paymentMethod === "CREDIT_CARD" || rental.paymentMethod === "DEBIT_CARD"
                  ? "Tentar Pagar Novamente"
                  : "Ver Opção de Pagamento"}
              </Text>
            </Pressable>
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

            {/* Deliverer Name */}
            {rental.delivererName ? (
              <View style={{ marginTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8 }}>
                <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>Entregador: <Text style={{ fontWeight: "400", color: colors.muted }}>{rental.delivererName}</Text></Text>
              </View>
            ) : null}

            {/* Receiver / Return Name & CPF */}
            {rental.receiverName ? (
              <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border, gap: 2 }}>
                <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>
                  {rental.status === "completed" ? "Devolvido por: " : "Recebido por: "}
                  <Text style={{ fontWeight: "400", color: colors.muted }}>{rental.receiverName}</Text>
                </Text>
                {rental.receiverCpf ? (
                  <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>
                    {rental.status === "completed" ? "CPF de quem devolveu: " : "CPF do Recebedor: "}
                    <Text style={{ fontWeight: "400", color: colors.muted }}>{rental.receiverCpf}</Text>
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {/* Observações do Cliente */}
        {rental.customerNote ? (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>Observações do Pedido</Text>
            <Text style={{ fontSize: 14, color: colors.muted }}>{rental.customerNote}</Text>
          </View>
        ) : null}

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
        {isStatusLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            {/* Deliverer Actions (Standard/Express Delivery) */}
            {!isPickup && isDeliverer && rental.status === "pending" && (
              <Pressable
                onPress={() => handleUpdateStatus("delivering")}
                style={({ pressed }) => [
                  { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Iniciar Entrega</Text>
              </Pressable>
            )}

            {!isPickup && isDeliverer && rental.status === "delivering" && (
              <Pressable
                onPress={() => setShowReceiverModal(true)}
                style={({ pressed }) => [
                  { backgroundColor: colors.success, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Finalizar Entrega</Text>
              </Pressable>
            )}

            {/* Company Actions for Pickup (Retirada no local) */}
            {isPickup && isCompany && rental.status === "pending" && (
              <Pressable
                onPress={() => handleUpdateStatus("delivering")}
                style={({ pressed }) => [
                  { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Iniciar Entrega</Text>
              </Pressable>
            )}

            {isPickup && isCompany && rental.status === "delivering" && (
              <Pressable
                onPress={() => handleUpdateStatus("delivered")}
                style={({ pressed }) => [
                  { backgroundColor: colors.success, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Finalizar Entrega</Text>
              </Pressable>
            )}

            {/* Customer Actions: Entregar Antecipadamente (not for owner or company) */}
            {!isDeliverer && !isCompany && !isOwner && (rental.status === "delivered" || rental.status === "active") && (
              <Pressable
                onPress={() => handleUpdateStatus("accepted")}
                style={({ pressed }) => [
                  { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Entregar antecipadamente</Text>
              </Pressable>
            )}

            {/* Owner Actions: Cancelar Pedido */}
            {isOwner && rental.status !== "cancelled" && rental.status !== "completed" && (
              <Pressable
                onPress={handleManualCancel}
                disabled={isCancelling}
                style={({ pressed }) => [
                  { backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: isCancelling ? 0.5 : pressed ? 0.85 : 1 },
                ]}
              >
                {isCancelling
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Cancelar Pedido</Text>
                }
              </Pressable>
            )}

            {/* Company Actions: Marcar como concluído direct */}
            {isCompany && (rental.status === "delivered" || rental.status === "active") && (
              <Pressable
                onPress={() => handleUpdateStatus("completed")}
                style={({ pressed }) => [
                  { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Marcar como concluído</Text>
              </Pressable>
            )}

            {/* Company Actions: Accept/Reject Early Return */}
            {isCompany && rental.status === "accepted" && (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={() => handleUpdateStatus("return_expired")}
                  style={({ pressed }) => [
                    { backgroundColor: colors.success, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Aceitar Entrega Antecipada</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleUpdateStatus("delivered")}
                  style={({ pressed }) => [
                    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={{ color: colors.error, fontWeight: "800", fontSize: 15 }}>Recusar Entrega Antecipada</Text>
                </Pressable>
              </View>
            )}

            {/* Deliverer: Confirmar Devolução (non-pickup only) */}
            {!isPickup && isDeliverer && rental.status === "return_expired" && (
              <Pressable
                onPress={() => {
                  setReceiverName("");
                  setReceiverCpf("");
                  setShowReturnModal(true);
                }}
                style={({ pressed }) => [
                  { backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Confirmar Devolução</Text>
              </Pressable>
            )}

            {/* Company: Confirmar Devolução no Balcão (pickup only) */}
            {isPickup && isCompany && rental.status === "return_expired" && (
              <Pressable
                onPress={() => {
                  setReceiverName("");
                  setReceiverCpf("");
                  setShowReturnModal(true);
                }}
                style={({ pressed }) => [
                  { backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Confirmar Devolução no Balcão</Text>
              </Pressable>
            )}
          </>
        )}

        {rental.status === "completed" && user?.profile === "customer" && (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10, alignItems: "center", width: "100%" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              {rental.rating ? "Sua avaliação" : "Avalie este serviço"}
            </Text>
            <StarRating 
              value={rental.rating ?? selectedRating} 
              size={32} 
              editable={!rental.rating} 
              onChange={(v) => {
                setSelectedRating(v);
              }} 
            />

            {!rental.rating && selectedRating > 0 && (
              <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
                <TextInput
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  placeholder="Escreva sua opinião (opcional)"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  style={{
                    width: "100%",
                    minHeight: 60,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: colors.foreground,
                    fontSize: 14,
                    textAlignVertical: "top",
                  }}
                />
                
                <Pressable
                  onPress={async () => {
                    if (isSubmittingRating) return;
                    setIsSubmittingRating(true);
                    try {
                      await rateRental(rental.id, selectedRating, ratingComment);
                      await Promise.all([refreshRentals(), refreshCatalog()]);
                      setSelectedRating(0);
                      setRatingComment("");
                      await fetchOrder();
                      Alert.alert("Sucesso", "Obrigado por avaliar!");
                    } catch (err: any) {
                      Alert.alert("Erro", err.message || "Não foi possível enviar a avaliação.");
                    } finally {
                      setIsSubmittingRating(false);
                    }
                  }}
                  style={({ pressed }) => [
                    {
                      width: "100%",
                      backgroundColor: colors.primary,
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: "center",
                      opacity: pressed || isSubmittingRating ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                    {isSubmittingRating ? "Enviando..." : "Enviar avaliação"}
                  </Text>
                </Pressable>
              </View>
            )}

            {rental.rating && rental.ratingComment && (
              <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic", textAlign: "center", marginTop: 4 }}>
                "{rental.ratingComment}"
              </Text>
            )}
          </View>
        )}

      </ScrollView>

      {/* Modal para Dados do Recebedor (Finalizar Entrega) */}
      <Modal visible={showReceiverModal} transparent={true} animationType="slide" onRequestClose={() => setShowReceiverModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Confirmar Recebimento</Text>
              <Pressable onPress={() => setShowReceiverModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {/* CPF field first */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>CPF do Recebedor</Text>
              <TextInput
                value={receiverCpf}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, "");
                  const limited = cleaned.slice(0, 11);
                  let formatted = limited;
                  if (limited.length > 9) {
                    formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9, 11)}`;
                  } else if (limited.length > 6) {
                    formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
                  } else if (limited.length > 3) {
                    formatted = `${limited.slice(0, 3)}.${limited.slice(3)}`;
                  }
                  setReceiverCpf(formatted);
                  // Clear name if CPF becomes invalid
                  if (limited.length !== 11) setReceiverName("");
                }}
                placeholder="000.000.000-00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: isCpfValid ? colors.success : colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                }}
              />
              {receiverCpf.replace(/\D/g, "").length === 11 && !isCpfValid && (
                <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600" }}>CPF inválido. Verifique os dígitos.</Text>
              )}
              {isCpfValid && (
                <Text style={{ fontSize: 11, color: colors.success, fontWeight: "600" }}>✓ CPF válido</Text>
              )}
            </View>

            {/* Name field - only enabled when CPF is valid */}
            <View style={{ gap: 6, opacity: isCpfValid ? 1 : 0.4 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Nome Completo do Recebedor</Text>
              <TextInput
                value={receiverName}
                onChangeText={setReceiverName}
                placeholder="Ex: João da Silva"
                placeholderTextColor={colors.muted}
                editable={isCpfValid}
                style={{
                  backgroundColor: isCpfValid ? colors.background : colors.border + "44",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                }}
              />
            </View>

            <Pressable
              onPress={() => {
                setShowReceiverModal(false);
                handleUpdateStatus("delivered", receiverName, receiverCpf);
              }}
              disabled={!isCpfValid || !receiverName.trim()}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.success,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: (!isCpfValid || !receiverName.trim()) ? 0.4 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Finalizar Entrega</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal para Confirmar Devolução */}
      <Modal visible={showReturnModal} transparent={true} animationType="slide" onRequestClose={() => setShowReturnModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Confirmar Devolução</Text>
              <Pressable onPress={() => setShowReturnModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={{ padding: 12, borderRadius: 10, backgroundColor: "#EF444422" }}>
              <Text style={{ fontSize: 13, color: "#EF4444", fontWeight: "600", textAlign: "center" }}>
                O período de aluguel expirou. Confirme a devolução registrando o CPF e nome de quem está devolvendo.
              </Text>
            </View>

            {/* CPF field first */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>CPF de Quem Devolve</Text>
              <TextInput
                value={receiverCpf}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, "");
                  const limited = cleaned.slice(0, 11);
                  let formatted = limited;
                  if (limited.length > 9) {
                    formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9, 11)}`;
                  } else if (limited.length > 6) {
                    formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
                  } else if (limited.length > 3) {
                    formatted = `${limited.slice(0, 3)}.${limited.slice(3)}`;
                  }
                  setReceiverCpf(formatted);
                  if (limited.length !== 11) setReceiverName("");
                }}
                placeholder="000.000.000-00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: isCpfValid ? colors.success : colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                }}
              />
              {receiverCpf.replace(/\D/g, "").length === 11 && !isCpfValid && (
                <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600" }}>CPF inválido. Verifique os dígitos.</Text>
              )}
              {isCpfValid && (
                <Text style={{ fontSize: 11, color: colors.success, fontWeight: "600" }}>✓ CPF válido</Text>
              )}
            </View>

            {/* Name field - only enabled when CPF is valid */}
            <View style={{ gap: 6, opacity: isCpfValid ? 1 : 0.4 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Nome Completo de Quem Devolve</Text>
              <TextInput
                value={receiverName}
                onChangeText={setReceiverName}
                placeholder="Ex: João da Silva"
                placeholderTextColor={colors.muted}
                editable={isCpfValid}
                style={{
                  backgroundColor: isCpfValid ? colors.background : colors.border + "44",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                }}
              />
            </View>

            <Pressable
              onPress={() => {
                setShowReturnModal(false);
                handleUpdateStatus("completed", receiverName, receiverCpf);
              }}
              disabled={!isCpfValid || !receiverName.trim()}
              style={({ pressed }) => [
                {
                  backgroundColor: "#EF4444",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: (!isCpfValid || !receiverName.trim()) ? 0.4 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Confirmar Devolução</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal de Retry de Pagamento */}
      <Modal visible={showRetryModal} transparent={true} animationType="slide" onRequestClose={() => setShowRetryModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Tentar Pagar Novamente</Text>
                <Pressable onPress={() => setShowRetryModal(false)}>
                  <IconSymbol name="xmark" size={24} color={colors.foreground} />
                </Pressable>
              </View>

              {/* Summary */}
              {rental && (
                <View style={{ padding: 14, borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, gap: 6, marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{rental.toolName}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Empresa: {rental.companyName} · {rental.days} dia{rental.days > 1 ? "s" : ""}</Text>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>Total: R$ {rental.totalPrice.toFixed(2)}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <IconSymbol name="creditcard.fill" size={14} color={colors.muted} />
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {rental.paymentMethod === "CREDIT_CARD" ? "Cartão de Crédito" :
                       rental.paymentMethod === "DEBIT_CARD" ? "Cartão de Débito" :
                       rental.paymentMethod === "PIX" ? "PIX" : "Boleto"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Card form - shown only for card payments */}
              {rental && (rental.paymentMethod === "CREDIT_CARD" || rental.paymentMethod === "DEBIT_CARD") && (
                <View style={{ gap: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>Dados do Cartão</Text>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Número do Cartão</Text>
                    <TextInput
                      value={retryCardNumber}
                      onChangeText={(t) => {
                        const d = t.replace(/\D/g, "").slice(0, 16);
                        setRetryCardNumber(d.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
                      }}
                      placeholder="0000 0000 0000 0000"
                      placeholderTextColor={colors.muted}
                      keyboardType="numeric"
                      style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 16, letterSpacing: 2 }}
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Nome no Cartão</Text>
                    <TextInput
                      value={retryCardHolder}
                      onChangeText={(t) => setRetryCardHolder(t.toUpperCase())}
                      placeholder="NOME SOBRENOME"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="characters"
                      style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground }}
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Validade (MM/AA)</Text>
                      <TextInput
                        value={retryCardExpiry}
                        onChangeText={(t) => {
                          const d = t.replace(/\D/g, "").slice(0, 4);
                          setRetryCardExpiry(d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d);
                        }}
                        placeholder="12/28"
                        placeholderTextColor={colors.muted}
                        keyboardType="numeric"
                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground }}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>CVV</Text>
                      <TextInput
                        value={retryCardCvv}
                        onChangeText={(t) => setRetryCardCvv(t.replace(/\D/g, "").slice(0, 4))}
                        placeholder="123"
                        placeholderTextColor={colors.muted}
                        keyboardType="numeric"
                        secureTextEntry
                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground }}
                      />
                    </View>
                  </View>

                  {rental.paymentMethod === "CREDIT_CARD" && (
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Parcelas</Text>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        {["1", "2", "3", "6", "12"].map((n) => (
                          <Pressable
                            key={n}
                            onPress={() => setRetryInstallments(n)}
                            style={({ pressed }) => [{
                              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
                              backgroundColor: retryInstallments === n ? colors.primary : colors.background,
                              borderWidth: 1, borderColor: retryInstallments === n ? colors.primary : colors.border,
                              opacity: pressed ? 0.8 : 1,
                            }]}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: retryInstallments === n ? "#fff" : colors.foreground }}>{n}x</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* PIX / Boleto notice */}
              {rental && rental.paymentMethod !== "CREDIT_CARD" && rental.paymentMethod !== "DEBIT_CARD" && (
                <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.info + "15" ?? colors.border, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: colors.foreground, textAlign: "center" }}>
                    Um novo código será gerado para você ao confirmar. Verifique os dados do pedido acima.
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleRetryPayment}
                disabled={isRetrying}
                style={({ pressed }) => [{
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: "center",
                  opacity: pressed || isRetrying ? 0.75 : 1,
                  marginBottom: 8,
                }]}
              >
                {isRetrying
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Confirmar Pagamento</Text>
                }
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Processing Loading Modal */}
      <Modal visible={paymentLoadingVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.75)",
          justifyContent: "center",
          alignItems: "center",
          padding: 32,
        }}>
          <Animated.View style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 36,
            alignItems: "center",
            gap: 20,
            width: "100%",
            maxWidth: 340,
            transform: [{ scale: pulseAnim }],
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 20,
          }}>
            {paymentLoadingStatus === "processing" && (
              <>
                <Animated.View style={{
                  transform: [{
                    rotate: spinAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  }],
                }}>
                  <View style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    borderWidth: 5,
                    borderColor: colors.primary + "33",
                    borderTopColor: colors.primary,
                  }} />
                </Animated.View>
                <View style={{ alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Verificando Pagamento</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                    Aguarde enquanto processamos o seu pagamento...
                  </Text>
                </View>
              </>
            )}

            {paymentLoadingStatus === "success" && (
              <>
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: "#22C55E22",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 3,
                  borderColor: "#22C55E",
                }}>
                  <Text style={{ fontSize: 36 }}>✓</Text>
                </View>
                <View style={{ alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#22C55E" }}>Pagamento Aprovado!</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                    Pedido atualizado. Redirecionando...
                  </Text>
                </View>
              </>
            )}

            {paymentLoadingStatus === "failed" && (
              <>
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: "#EF444422",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 3,
                  borderColor: "#EF4444",
                }}>
                  <Text style={{ fontSize: 36 }}>✗</Text>
                </View>
                <View style={{ alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#EF4444" }}>Pagamento Recusado</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                    Tente com outro método de pagamento.
                  </Text>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
